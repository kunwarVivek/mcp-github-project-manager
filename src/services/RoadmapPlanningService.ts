import { generateObject } from "ai";
import { z } from "zod";
import { type ILogger, Logger } from "../infrastructure/logger";
import type { AIServiceFactory } from "./ai/AIServiceFactory";
import type { ProjectManagementService } from "./ProjectManagementService";
import { InputSanitizer } from "./utils/InputSanitizer";

/**
 * AI-powered roadmap planning service
 * Analyzes project context and issues to create intelligent roadmaps, milestones, and sprints
 */
export class RoadmapPlanningService {
  private readonly logger: ILogger;

  constructor(
    private aiFactory: AIServiceFactory,
    private projectService: ProjectManagementService,
    logger?: ILogger
  ) {
    this.logger = logger ?? Logger.getInstance();
  }

  /**
   * Generate a complete project roadmap from existing issues
   */
  async generateRoadmap(params: {
    projectId: string;
    projectTitle: string;
    projectDescription?: string;
    sprintDurationWeeks?: number;
    targetMilestones?: number;
  }): Promise<{
    roadmap: {
      phases: Array<{
        name: string;
        description: string;
        duration: string;
        milestones: Array<{
          title: string;
          description: string;
          dueDate?: string;
          issues: string[];
        }>;
      }>;
    };
    milestones: Array<{
      title: string;
      description: string;
      dueDate?: string;
      issueIds: string[];
    }>;
    sprints: Array<{
      title: string;
      description: string;
      startDate: string;
      endDate: string;
      issueIds: string[];
    }>;
  }> {
    try {
      this.logger.info(`Generating roadmap for project ${params.projectId}`);

      // Fetch all issues for the project
      const items = await this.projectService.listProjectItems({
        projectId: params.projectId,
        limit: 200,
      });

      // Extract issue information
      const issues = items.map((item: any) => ({
        id: item.id,
        title: item.title || "Untitled",
        type: item.type,
        content: item.content,
      }));

      if (issues.length === 0) {
        throw new Error("No issues found in project. Cannot generate roadmap.");
      }

      // Generate roadmap using AI
      const roadmapAnalysis = await this.analyzeIssuesForRoadmap({
        projectTitle: params.projectTitle,
        projectDescription: params.projectDescription || "",
        issues,
        sprintDurationWeeks: params.sprintDurationWeeks || 2,
        targetMilestones: params.targetMilestones || 4,
      });

      return roadmapAnalysis;
    } catch (error) {
      this.logger.error("Failed to generate roadmap", error);
      throw error;
    }
  }

  /**
   * Analyze issues and create roadmap structure
   */
  private async analyzeIssuesForRoadmap(params: {
    projectTitle: string;
    projectDescription: string;
    issues: Array<{ id: string; title: string; type: string; content?: any }>;
    sprintDurationWeeks: number;
    targetMilestones: number;
  }): Promise<any> {
    const model = this.aiFactory.getModel("main") || this.aiFactory.getBestAvailableModel();
    if (!model) {
      throw new Error("AI service is not available");
    }

    const prompt = `You are a product roadmap planning expert. Analyze the following project and its issues to create a comprehensive roadmap.

PROJECT INFORMATION:
Title: ${InputSanitizer.sanitizeText(params.projectTitle)}
Description: ${InputSanitizer.sanitizeIssueContent(params.projectDescription)}

EXISTING ISSUES (${params.issues.length} total):
${params.issues.map((issue, idx) => `${idx + 1}. [${issue.type}] ${InputSanitizer.sanitizeText(issue.title)} (ID: ${issue.id})`).join("\n")}

YOUR TASK:
Create a comprehensive project roadmap with the following structure:

1. **Development Phases**: Organize work into 3-5 logical phases (e.g., Foundation, Core Features, Enhancement, Polish)
2. **Milestones**: Create ${params.targetMilestones} milestones distributed across phases with realistic due dates
3. **Sprint Planning**: Organize issues into ${params.sprintDurationWeeks}-week sprints

REQUIREMENTS:
- Group related issues by theme/feature area
- Balance workload across sprints
- Prioritize based on dependencies and logical order
- Create meaningful milestone descriptions
- Suggest realistic timelines
- Start sprints from today's date (${new Date().toISOString().split("T")[0]}).`;

    const RoadmapAnalysisSchema = z.object({
      roadmap: z.object({
        phases: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            duration: z.string(),
            milestones: z.array(z.string()),
          })
        ),
      }),
      milestones: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          dueDate: z.string(),
          issueIds: z.array(z.string()),
        })
      ),
      sprints: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          issueIds: z.array(z.string()),
        })
      ),
    });

    const result = await generateObject({
      model,
      prompt,
      schema: RoadmapAnalysisSchema,
      temperature: 0.7,
      maxOutputTokens: 4000,
    });

    return result.object;
  }

  /**
   * Auto-create roadmap in GitHub: creates the milestones of the plan and
   * assigns them to the issues of the project the plan was generated from.
   *
   * The plan references issues by PROJECT ITEM id (that is what
   * `generateRoadmap` sees when it reads the project's items), while a
   * milestone has to be set on the issue itself - so the item id is resolved
   * to its issue node id first. `projectId` is what makes that resolution
   * possible; without it the milestones would be created on the repository
   * but never attached to the issues of the project the plan came from.
   *
   * Partial failure is the norm for a multi-item write, so the outcome is
   * reported rather than swallowed: `failures` lists every item that could
   * not be created or updated, with the reason.
   */
  async createRoadmapInGitHub(params: { projectId: string; roadmap: any }): Promise<{
    createdMilestones: number;
    updatedIssues: number;
    failures: Array<{ target: string; error: string }>;
  }> {
    const failures: Array<{ target: string; error: string }> = [];
    let createdMilestones = 0;
    let updatedIssues = 0;

    // project item id -> issue node id
    const issueNodeIdByItemId = new Map<string, string>();
    try {
      const items = await this.projectService.listProjectItems({
        projectId: params.projectId,
        limit: 200,
      });
      for (const item of items ?? []) {
        const itemId = item?.id === undefined ? undefined : String(item.id);
        const contentId = item?.contentId === undefined ? undefined : String(item.contentId);
        if (itemId && contentId) {
          issueNodeIdByItemId.set(itemId, contentId);
        }
      }
    } catch (error) {
      // Without the mapping the milestones can still be created, but no issue
      // can be attached to them - say so instead of silently doing half the job.
      failures.push({
        target: `project:${params.projectId}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const milestones = Array.isArray(params.roadmap?.milestones) ? params.roadmap.milestones : [];

    for (const milestone of milestones) {
      const title = milestone?.title ?? "Untitled milestone";
      try {
        const created = await this.projectService.createMilestone({
          title: milestone.title,
          description: milestone.description,
          dueDate: milestone.dueDate,
        });
        createdMilestones++;
        this.logger.info(`Created milestone: ${title}`);

        for (const itemId of milestone.issueIds ?? []) {
          const issueNodeId = issueNodeIdByItemId.get(String(itemId));
          if (!issueNodeId) {
            failures.push({
              target: `issue:${itemId}`,
              error: "Issue is not an item of this project",
            });
            continue;
          }
          try {
            await this.projectService.updateIssue(issueNodeId, { milestoneId: created.id });
            updatedIssues++;
          } catch (error) {
            failures.push({
              target: `issue:${itemId}`,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        this.logger.error(`Failed to create milestone ${title}`, error);
        failures.push({
          target: title,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info(
      `Roadmap created: ${createdMilestones} milestones, ${updatedIssues} issues updated, ${failures.length} failures`
    );

    return {
      createdMilestones,
      updatedIssues,
      failures,
    };
  }
}
