import { generateText } from 'ai';
import { AIServiceFactory } from "./ai/AIServiceFactory";
import { ProjectManagementService } from "./ProjectManagementService";
import { Logger } from "../infrastructure/logger";

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
  private logger: Logger;

  constructor(
    private aiFactory: AIServiceFactory,
    private projectService: ProjectManagementService
  ) {
    this.logger = Logger.getInstance();
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
      this.logger.info(`Enriching issue: ${params.issueTitle}`);

      const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();
      if (!model) {
        throw new Error('AI service is not available');
      }

      const prompt = `You are an expert project manager. Analyze this issue and provide enrichment as JSON: {"suggestedLabels":[],"suggestedPriority":"medium","suggestedType":"task","complexity":"moderate","estimatedEffort":"2 hours","relatedIssues":[],"reasoning":"..."}`;

      const response = await generateText({
        model,
        prompt: `${prompt}\n\nIssue: ${params.issueTitle}\nDescription: ${params.issueDescription || 'None'}`,
        temperature: 0.5,
        maxTokens: 1000
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
          issueTitle: (item as any).title || 'Untitled',
          issueDescription: (item as any).content?.body
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
