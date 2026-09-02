import { generateObject } from 'ai';
import { z } from 'zod';
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
    issueLabels?: string[];
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

      const TriageSchema = z.object({
        classification: z.object({
          category: z.string(),
          priority: z.string(),
          severity: z.string().optional(),
          actionable: z.boolean(),
        }),
        actions: z.array(z.object({
          type: z.string(),
          description: z.string(),
          value: z.string(),
        })),
        reasoning: z.string(),
      });

      const result = await generateObject({
        model,
        prompt: `Triage this issue.\n\nIssue Title: ${issueTitle}${issueDescription ? `\nDescription: ${issueDescription}` : ''}${params.issueLabels?.length ? `\nExisting Labels: ${params.issueLabels.join(', ')}` : ''}${params.projectContext ? `\nProject Context: ${params.projectContext}` : ''}`,
        schema: TriageSchema,
        temperature: 0.5,
        maxOutputTokens: 1000
      });

      const triage = result.object;

      return {
        issueId: params.issueId,
        issueTitle,
        classification: triage.classification,
        actions: triage.actions.map((a) => ({ ...a, applied: false })),
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
    const issues = await this.projectService.listIssues({
      status: 'open',
      limit: params.onlyUntriaged ? 100 : 50,
    });

    const candidates = params.onlyUntriaged
      ? issues.filter((issue) => !issue.labels.includes('triaged'))
      : issues;

    for (const issue of candidates) {
      try {
        const triageResult = await this.triageIssue({
          projectId: params.projectId,
          issueId: issue.id,
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueDescription: issue.description,
          issueLabels: issue.labels,
          projectContext: params.projectContext,
          autoApply: params.autoApply,
        });

        if (params.autoApply && triageResult.actions.length > 0) {
          for (const action of triageResult.actions) {
            try {
              if (action.type === 'label') {
                const updatedLabels = [...new Set([...issue.labels, action.value])];
                await this.projectService.updateIssue(issue.id, { labels: updatedLabels });
                action.applied = true;
              } else if (action.type === 'assignee') {
                const updatedAssignees = [...new Set([...issue.assignees, action.value])];
                await this.projectService.updateIssue(issue.id, { assignees: updatedAssignees });
                action.applied = true;
              } else if (action.type === 'status') {
                await this.projectService.updateIssue(issue.id, { status: action.value });
                action.applied = true;
              }
            } catch (applyError) {
              this.logger.error(`Failed to apply action '${action.type}' for issue ${issue.id}`, applyError);
            }
          }
        }

        // Mark as triaged so re-runs skip this issue
        const labelsWithTriaged = [...new Set([...issue.labels, 'triaged'])];
        await this.projectService.updateIssue(issue.id, { labels: labelsWithTriaged }).catch((err) => {
          this.logger.warn(`Could not add 'triaged' label to issue #${issue.number}`, err);
        });

        // Post audit comment only when actions were applied
        if (params.autoApply) {
          const appliedActions = triageResult.actions.filter(a => a.applied);
          const actionSummary = appliedActions.length > 0
            ? `\n\n**Actions applied:**\n${appliedActions.map(a => `- ${a.type}: ${a.value}`).join('\n')}`
            : '';
          await this.projectService.createIssueComment({
            issueNumber: issue.number,
            body: `<!-- auto-triage -->\n## Auto-Triage Result\n\n**Classification:** ${triageResult.classification.category} (${triageResult.classification.priority})\n**Reasoning:** ${triageResult.reasoning}${actionSummary}`,
          }).catch((err) => {
            this.logger.warn(`Could not post triage comment on issue #${issue.number}`, err);
          });
        }

        results.push(triageResult);
      } catch (error) {
        this.logger.error(`Failed to triage issue ${issue.id}`, error);
      }
    }

    return { triaged: results.length, results };
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

    this.logger.info(`Scheduled ${params.schedule} triage for project ${params.projectId}`, { ruleId: rule.id, schedule: params.schedule, autoApply: params.autoApply });

    return { ruleId: rule.id };
  }
}
