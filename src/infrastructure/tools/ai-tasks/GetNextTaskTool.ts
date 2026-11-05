import { z } from "zod";
import type { MCPResponse } from "../../../domain/mcp-types.js";
import {
  type NextTaskResult,
  NextTaskService,
  type TaskRecommendation,
} from "../../../services/NextTaskService.js";
import { logger, redactSecretPatterns } from "../../logger/index.js";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations.js";
import { NextTaskOutputSchema } from "../schemas/ai-schemas.js";
import { ToolResultFormatter } from "../ToolResultFormatter.js";
import { type ToolDefinition, type ToolSchema, ToolValidator } from "../ToolValidator.js";
import { createGitHubFactory } from "../tool-factory.js";

// Schema for get_next_task tool
const getNextTaskSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe(
      "GitHub project node ID whose items are ranked (uses its Status/Priority/Complexity/Estimate fields); without it the configured repository's issues are used"
    ),
  featureId: z
    .string()
    .optional()
    .describe("Only tasks labelled with this feature ID or `feature:<featureId>`"),
  assignee: z.string().optional().describe("Filter tasks for specific team member"),
  teamSkills: z
    .array(z.string())
    .optional()
    .describe("Team skills; tasks carrying matching labels rank higher within the same priority"),
  sprintCapacity: z.number().optional().describe("Available hours in current sprint (default: 40)"),
  currentPhase: z
    .enum(["planning", "development", "testing", "review", "deployment"])
    .optional()
    .describe("Only tasks whose Status or a label places them in this phase"),
  excludeBlocked: z.boolean().default(true).describe("Whether to exclude blocked tasks"),
  maxComplexity: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe(
      "Maximum task complexity (Complexity project field or `complexity:N` label); tasks with no known complexity are kept"
    ),
  includeAnalysis: z.boolean().default(true).describe("Whether to include the data summary"),
  limit: z.number().min(1).max(20).default(5).describe("Maximum number of tasks to recommend"),
});

export type GetNextTaskArgs = z.infer<typeof getNextTaskSchema>;

interface SprintMetrics {
  /** Hours of the recommended tasks that carry an hour estimate. */
  totalHours: number;
  /** Recommended tasks without an hour estimate (not counted in totalHours). */
  unestimatedTasks: number;
  sprintCapacity: number;
  /** Null when no recommended task carries an hour estimate. */
  sprintFit: boolean | null;
  filtersApplied: string[];
}

/**
 * Implementation function for get_next_task tool
 */
async function executeGetNextTask(rawArgs: unknown): Promise<MCPResponse> {
  const args = ToolValidator.validate(
    "get_next_task",
    rawArgs,
    getNextTaskSchema as unknown as ToolSchema<GetNextTaskArgs>
  );
  try {
    const service = new NextTaskService(createGitHubFactory());
    const result = await service.recommend({
      projectId: args.projectId,
      featureId: args.featureId,
      assignee: args.assignee,
      teamSkills: args.teamSkills,
      currentPhase: args.currentPhase,
      excludeBlocked: args.excludeBlocked,
      maxComplexity: args.maxComplexity,
      limit: args.limit,
    });
    const recommendations = result.recommendations;

    const estimated = recommendations.filter((task) => task.estimatedHours !== undefined);
    const totalHours = estimated.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const sprintCapacity = args.sprintCapacity ?? 40;
    const sprintFit = estimated.length > 0 ? totalHours <= sprintCapacity : null;
    const unestimatedTasks = recommendations.length - estimated.length;

    const analysis = args.includeAnalysis ? generateTaskAnalysis(recommendations, result) : null;

    const summary = formatNextTaskRecommendations(recommendations, analysis, {
      totalHours,
      unestimatedTasks,
      sprintCapacity,
      sprintFit,
      filtersApplied: getAppliedFilters(args),
    });

    return ToolResultFormatter.formatSuccess("get_next_task", {
      summary,
      recommendations,
      analysis,
      metrics: {
        totalTasks: recommendations.length,
        candidateCount: result.candidateCount,
        blockedCount: result.blockedCount,
        source: result.source,
        totalHours,
        unestimatedTasks,
        sprintCapacity,
        sprintFit,
      },
    });
  } catch (error) {
    logger.error(`Error in get_next_task tool: ${error}`);
    return ToolResultFormatter.formatSuccess("get_next_task", {
      error: `Failed to get task recommendations: ${redactSecretPatterns(error instanceof Error ? error.message : "Unknown error")}`,
      success: false,
    });
  }
}

/**
 * Summarise the recommendations from what the data says (no generated advice).
 */
function generateTaskAnalysis(tasks: TaskRecommendation[], result: NextTaskResult): string {
  const source = result.source === "project" ? "project items" : "repository issues";
  const lines = [
    `Read ${result.candidateCount} open ${source} matching the filters; ${result.blockedCount} skipped because an open issue blocks them.`,
  ];

  const unprioritised = tasks.filter((task) => task.priority === undefined).length;
  if (unprioritised > 0) {
    lines.push(
      `${unprioritised} recommended task(s) have no priority (Priority field or priority: label), so they follow the prioritised ones.`
    );
  }
  const complex = tasks.filter((task) => (task.complexity ?? 0) >= 7).length;
  if (complex > 0) {
    lines.push(
      `${complex} recommended task(s) have complexity 7 or more; consider \`expand_task\`.`
    );
  }
  return lines.join("\n");
}

/**
 * Get list of applied filters
 */
function getAppliedFilters(args: GetNextTaskArgs): string[] {
  const filters = [];
  if (args.projectId) filters.push(`Project: ${args.projectId}`);
  if (args.featureId) filters.push(`Feature: ${args.featureId}`);
  if (args.assignee) filters.push(`Assignee: ${args.assignee}`);
  if (args.maxComplexity) filters.push(`Max Complexity: ${args.maxComplexity}`);
  if (args.currentPhase) filters.push(`Phase: ${args.currentPhase}`);
  return filters;
}

/**
 * Format task recommendations summary
 */
function formatNextTaskRecommendations(
  tasks: TaskRecommendation[],
  analysis: string | null,
  metrics: SprintMetrics
): string {
  const sections = [
    "# Next Task Recommendations",
    "",
    "## Overview",
    `**Recommended Tasks:** ${tasks.length}`,
    `**Total Effort:** ${metrics.totalHours} hours${metrics.unestimatedTasks > 0 ? ` (${metrics.unestimatedTasks} task(s) without an hour estimate not counted)` : ""}`,
    `**Sprint Capacity:** ${metrics.sprintCapacity} hours`,
    `**Sprint Fit:** ${metrics.sprintFit === null ? "Unknown (no hour estimates on the recommended tasks)" : metrics.sprintFit ? "✅ Fits in sprint" : "⚠️ Exceeds capacity"}`,
    "",
  ];

  // Applied filters
  if (metrics.filtersApplied.length > 0) {
    sections.push(
      "**Applied Filters:**",
      ...metrics.filtersApplied.map((filter) => `- ${filter}`),
      ""
    );
  }

  // AI Analysis
  if (analysis) {
    sections.push("## AI Analysis", analysis, "");
  }

  // Task recommendations
  if (tasks.length === 0) {
    sections.push(
      "## No Tasks Available",
      "No tasks match your criteria or all tasks are completed/blocked.",
      "",
      "**Suggestions:**",
      "- Remove some filters to see more tasks",
      "- Check if there are blocked tasks that need attention",
      "- Consider adding new features with `add_feature`"
    );
  } else {
    sections.push("## Recommended Tasks");

    tasks.forEach((task, index) => {
      sections.push(
        `### ${index + 1}. ${task.title}`,
        [
          `**Priority:** ${task.priority ?? "not set"}`,
          task.complexity !== undefined ? `**Complexity:** ${task.complexity}/10` : null,
          task.estimatedHours !== undefined
            ? `**Effort:** ${task.estimatedHours}h`
            : task.estimate !== undefined
              ? `**Estimate:** ${task.estimate}`
              : null,
        ]
          .filter((part) => part !== null)
          .join(" | "),
        `**Status:** ${task.status}`,
        `**Why:** ${task.reason}`,
        ""
      );

      if (task.description) {
        sections.push(`**Description:** ${task.description}`, "");
      }

      if (task.dependencies.length > 0) {
        sections.push(`**Blockers:** ${task.dependencies.map((n) => `#${n}`).join(", ")}`, "");
      }

      if (task.tags.length > 0) {
        sections.push(`**Tags:** ${task.tags.join(", ")}`, "");
      }

      sections.push("---", "");
    });

    // Priority breakdown
    const priorityBreakdown = tasks.reduce<Record<string, number>>((acc, task) => {
      const priority = task.priority ?? "not set";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      "## Summary",
      "**Priority Breakdown:**",
      ...Object.entries(priorityBreakdown).map(
        ([priority, count]) => `- ${priority}: ${count} task${count > 1 ? "s" : ""}`
      ),
      ""
    );
  }

  // Next steps
  sections.push(
    "## Next Steps",
    "1. Review the recommended tasks and select one to start",
    "2. Use `update_task_lifecycle` to begin work and track progress",
    "3. Use `expand_task` if any task seems too complex",
    "4. Check dependencies before starting work",
    ""
  );

  // Related commands
  sections.push(
    "## Related Commands",
    "- `update_task_lifecycle` - Start work and track progress",
    "- `expand_task` - Break down complex tasks",
    "- `analyze_task_complexity` - Get detailed complexity analysis",
    "- `add_feature` - Add new features if no suitable tasks available"
  );

  return sections.join("\n");
}

// Tool definition
export const getNextTaskTool: ToolDefinition<
  GetNextTaskArgs,
  z.infer<typeof NextTaskOutputSchema>
> = {
  name: "get_next_task",
  title: "Get Next Task",
  description:
    "Recommend the next tasks to work on from real project/repository data: open items only, not blocked by open issues (unless excludeBlocked=false), ranked by priority, team-skill match, complexity, estimate and age/board order",
  schema: getNextTaskSchema as unknown as ToolSchema<GetNextTaskArgs>,
  outputSchema: NextTaskOutputSchema,
  annotations: {
    ...ANNOTATION_PATTERNS.aiOperation,
    readOnlyHint: true, // Recommends but doesn't modify
  },
  examples: [
    {
      name: "Get next task for development",
      description: "Get the next recommended task for a developer with specific skills",
      args: {
        teamSkills: ["typescript", "react", "node.js"],
        sprintCapacity: 40,
        maxComplexity: 7,
        excludeBlocked: true,
        includeAnalysis: true,
        limit: 3,
      },
    },
  ],
};

// Export the execution function
export { executeGetNextTask };
