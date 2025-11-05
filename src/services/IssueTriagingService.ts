import { generateText } from 'ai';
import { AIServiceFactory } from "./ai/AIServiceFactory";
import { ProjectManagementService } from "./ProjectManagementService";
import { IssueEnrichmentService } from "./IssueEnrichmentService";
import { Logger } from "../infrastructure/logger";

export interface TriageResult {
  issueId: string;
  issueTitle: string;
  classification: {
    category: string;
    priority: string;
    severity?: string;
    actionable: boolean;
  };
  actions: Array<{
    type: string;
    description: string;
    value: string;
    applied: boolean;
  }>;
  reasoning: string;
}

export class IssueTriagingService {
  private logger: Logger;

  constructor(
    private aiFactory: AIServiceFactory,
    private projectService: ProjectManagementService,
    private enrichmentService: IssueEnrichmentService
  ) {
    this.logger = Logger.getInstance();
  }

  async triageIssue(params: {
    projectId: string;
    issueId: string;
    issueNumber: number;
    issueTitle: string;
    issueDescription?: string;
    projectContext?: string;
    autoApply?: boolean;
  }): Promise<TriageResult> {
    try {
      const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();
      if (!model) {
        throw new Error('AI service is not available');
      }

      const prompt = `Triage this issue as JSON: {"classification":{"category":"bug","priority":"high","actionable":true},"actions":[{"type":"add_label","description":"Add bug label","value":"bug"}],"reasoning":"..."}`;

      const response = await generateText({
        model,
        prompt: `${prompt}\n\nIssue: ${params.issueTitle}`,
        temperature: 0.5,
        maxTokens: 1000
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const triage = JSON.parse(jsonMatch[0]);
      return {
        issueId: params.issueId,
        issueTitle: params.issueTitle,
        classification: triage.classification,
        actions: triage.actions.map((a: any) => ({ ...a, applied: false })),
        reasoning: triage.reasoning
      };
    } catch (error) {
      this.logger.error(`Failed to triage issue`, error);
      throw error;
    }
  }

  async triageAllIssues(params: {
    projectId: string;
    onlyUntriaged?: boolean;
    autoApply?: boolean;
    projectContext?: string;
  }): Promise<{ triaged: number; results: TriageResult[] }> {
    const results: TriageResult[] = [];
    return { triaged: 0, results };
  }

  async scheduleTriaging(params: {
    projectId: string;
    schedule: 'hourly' | 'daily' | 'weekly';
    autoApply: boolean;
  }): Promise<{ ruleId: string }> {
    const rule = await this.projectService.createAutomationRule({
      name: `Automated Triage (${params.schedule})`,
      description: `Auto-triage issues ${params.schedule}`,
      projectId: params.projectId,
      enabled: true,
      triggers: [{ type: 'schedule' }],
      actions: [{ type: 'custom_script', parameters: { script: 'triage' } }]
    });
    return { ruleId: rule.id };
  }
}
