import { generateText } from 'ai';
import { InputSanitizer } from './utils/InputSanitizer';
import type { AIServiceFactory } from "./ai/AIServiceFactory";
import type { ProjectManagementService } from "./ProjectManagementService";
import type { IssueEnrichmentService } from "./IssueEnrichmentService";
import { type ILogger, Logger } from "../infrastructure/logger";

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
  private readonly logger: ILogger;

  constructor(
    private aiFactory: AIServiceFactory,
    private projectService: ProjectManagementService,
    private enrichmentService: IssueEnrichmentService,
    logger?: ILogger
  ) {
    this.logger = logger ?? Logger.getInstance();
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
      const issueTitle = InputSanitizer.sanitizeIssueContent(params.issueTitle);
      const issueDescription = params.issueDescription
        ? InputSanitizer.sanitizeIssueContent(params.issueDescription)
        : undefined;

      const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();
      if (!model) {
        throw new Error('AI service is not available');
      }

      const prompt = `Triage this issue as JSON: {"classification":{"category":"bug","priority":"high","actionable":true},"actions":[{"type":"add_label","description":"Add bug label","value":"bug"}],"reasoning":"..."}`;

      const response = await generateText({
        model,
        prompt: `${prompt}\n\nIssue Title: ${issueTitle}${issueDescription ? `\nDescription: ${issueDescription}` : ''}`,
        temperature: 0.5,
        maxOutputTokens: 1000
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI triage response');
      }

      // Explicit `any`: this holds an unvalidated AI response. Properly typing
      // it is real work (the shape varies by prompt); making the `any` explicit
      // at least removes the *implicit* one so the gap is visible.
      // biome-ignore lint/suspicious/noExplicitAny: unvalidated AI response shape
      let triage: any;
      try {
        triage = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`Failed to parse triage JSON: ${message}`);
      }

      return {
        issueId: params.issueId,
        issueTitle,
        classification: triage.classification,
        actions: triage.actions.map((a: any) => ({ ...a, applied: false })),
        reasoning: triage.reasoning
      };
    } catch (error) {
      this.logger.error(`Failed to triage issue`, error);
      throw error;
    }
  }

  async triageAllIssues(_params: {
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
