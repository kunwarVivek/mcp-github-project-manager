import { generateObject } from 'ai';
import { z } from 'zod';
import { InputSanitizer } from './utils/InputSanitizer';
import type { AIServiceFactory } from "./ai/AIServiceFactory";
import type { ProjectManagementService } from "./ProjectManagementService";
import { type ILogger, Logger } from "../infrastructure/logger";
import { isProjectItem } from "../domain/type-guards";

export interface IssueEnrichmentResult {
  issueId: string;
  suggestedLabels: string[];
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  suggestedType: 'bug' | 'feature' | 'enhancement' | 'documentation' | 'task';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedEffort: string;
  relatedIssues: string[];
  milestone?: string;
  sprint?: string;
  reasoning: string;
}

export class IssueEnrichmentService {
  private readonly logger: ILogger;

  constructor(
    private aiFactory: AIServiceFactory,
    private projectService: ProjectManagementService,
    logger?: ILogger
  ) {
    this.logger = logger ?? Logger.getInstance();
  }

  async enrichIssue(params: {
    projectId: string;
    issueId: string;
    issueTitle: string;
    issueDescription?: string;
    projectContext?: string;
    existingLabels?: string[];
    milestones?: Array<{ title: string; description: string }>;
  }): Promise<IssueEnrichmentResult> {
    try {
      const issueTitle = InputSanitizer.sanitizeIssueContent(params.issueTitle);
      const issueDescription = params.issueDescription
        ? InputSanitizer.sanitizeIssueContent(params.issueDescription)
        : undefined;

      this.logger.info(`Enriching issue: ${issueTitle}`);

      const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();
      if (!model) {
        throw new Error('AI service is not available');
      }

      const EnrichmentSchema = z.object({
        suggestedLabels: z.array(z.string()),
        suggestedPriority: z.enum(['critical', 'high', 'medium', 'low']),
        suggestedType: z.enum(['bug', 'feature', 'enhancement', 'documentation', 'task']),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        estimatedEffort: z.string(),
        relatedIssues: z.array(z.string()),
        milestone: z.string().optional(),
        sprint: z.string().optional(),
        reasoning: z.string(),
      });

      const result = await generateObject({
        model,
        prompt: `You are an expert project manager. Analyze this issue and provide enrichment.\n\nIssue: ${issueTitle}\nDescription: ${issueDescription || 'None'}`,
        schema: EnrichmentSchema,
        temperature: 0.5,
        maxOutputTokens: 1000
      });

      return { issueId: params.issueId, ...result.object };
    } catch (error) {
      this.logger.error(`Failed to enrich issue ${params.issueId}`, error);
      throw error;
    }
  }

  async enrichIssues(params: {
    projectId: string;
    issueIds: string[];
    projectContext?: string;
  }): Promise<IssueEnrichmentResult[]> {
    const results: IssueEnrichmentResult[] = [];
    const items = await this.projectService.listProjectItems({ projectId: params.projectId, limit: 200 });

    for (const issueId of params.issueIds) {
      const item = items.find((i: any) => i.id === issueId);
      if (item) {
        const enrichment = await this.enrichIssue({
          projectId: params.projectId,
          issueId: issueId,
          issueTitle: isProjectItem(item) && item.title ? item.title : 'Untitled',
          issueDescription: isProjectItem(item) ? item.content?.body : undefined
        });
        results.push(enrichment);
      }
    }

    return results;
  }

  async applyEnrichment(params: {
    projectId: string;
    issueNumber: number;
    enrichment: IssueEnrichmentResult;
    applyLabels?: boolean;
  }): Promise<{ applied: string[] }> {
    const applied: string[] = [];
    if (params.applyLabels && params.enrichment.suggestedLabels.length > 0) {
      applied.push('labels');
    }
    return { applied };
  }
}
