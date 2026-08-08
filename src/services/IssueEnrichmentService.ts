import { generateText } from 'ai';
import { InputSanitizer } from './utils/InputSanitizer';
import { AIServiceFactory } from "./ai/AIServiceFactory";
import { ProjectManagementService } from "./ProjectManagementService";
import { ILogger, Logger } from "../infrastructure/logger";
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

      const prompt = `You are an expert project manager. Analyze this issue and provide enrichment as JSON: {"suggestedLabels":[],"suggestedPriority":"medium","suggestedType":"task","complexity":"moderate","estimatedEffort":"2 hours","relatedIssues":[],"reasoning":"..."}`;

      const response = await generateText({
        model,
        prompt: `${prompt}\n\nIssue: ${issueTitle}\nDescription: ${issueDescription || 'None'}`,
        temperature: 0.5,
        maxOutputTokens: 1000
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const enrichment = JSON.parse(jsonMatch[0]);
      return { issueId: params.issueId, ...enrichment };
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

  private getLabelColor(label: string): string {
    return label.includes('bug') ? 'D73A4A' : '0E8A16';
  }
}
