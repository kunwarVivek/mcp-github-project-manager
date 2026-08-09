import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from '../ai/AIServiceFactory.js';
import { type ILogger, Logger } from '../../infrastructure/logger';
import {
  type TaskLifecycleState,
  type TaskPhaseInfo,
  type TaskBlocker,
  isTaskPhaseStatus
} from '../../domain/feature-lifecycle-types.js';
import type { AITask, } from '../../domain/ai-types.js';
import {
  FEATURE_PROMPT_CONFIGS,
  formatFeaturePrompt
} from '../ai/prompts/FeatureAdditionPrompts.js';
import { safeCall } from '../utils/safeCall';

/**
 * Manages the lifecycle of individual tasks through planning → development
 * → testing → review → deployment phases.
 *
 * Extracted from FeatureManagementService (SRP decomposition).
 * Responsibility: update phase status, calculate progress, determine
 * current phase, provide AI-powered next-action recommendations.
 */
export class TaskLifecycleService {
  private readonly aiFactory: AIServiceFactory;
  private readonly logger: ILogger;

  /**
   * @param aiFactory - AI service factory for model access. When omitted (DI mode),
   *   defaults to the global singleton via `AIServiceFactory.getInstance()`.
   * @param logger - Logger instance for diagnostics. When omitted, defaults to
   *   the global singleton via `Logger.getInstance()`.
   */
  constructor(aiFactory?: AIServiceFactory, logger?: ILogger) {
    this.aiFactory = aiFactory ?? AIServiceFactory.getInstance();
    this.logger = logger ?? Logger.getInstance();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Create an initial lifecycle state for a newly generated task.
   * All phases start as `not_started`; the current phase is `planning`.
   */
  createInitialTaskLifecycleState(task: AITask): TaskLifecycleState {
    const basePhase: TaskPhaseInfo = {
      status: 'not_started',
      startedAt: undefined,
      completedAt: undefined,
      assignee: undefined,
      notes: undefined,
      artifacts: []
    };

    return {
      taskId: task.id,
      currentPhase: 'planning',
      phases: {
        planning: { ...basePhase },
        development: { ...basePhase },
        testing: { ...basePhase },
        review: { ...basePhase },
        deployment: { ...basePhase }
      },
      blockers: [],
      progressPercentage: 0,
      estimatedCompletion: new Date(
        Date.now() + task.estimatedHours * 60 * 60 * 1000
      ).toISOString()
    };
  }

  /**
   * Update a task's lifecycle state (phase status, blockers, assignee …).
   */
  async updateTaskLifecycle(params: {
    taskId: string;
    currentState: TaskLifecycleState;
    updateData: {
      phase?: string;
      status?: string;
      assignee?: string;
      notes?: string;
      artifacts?: string[];
      blockers?: TaskBlocker[];
    };
  }): Promise<TaskLifecycleState> {
    return safeCall(async () => {
      const updatedState = { ...params.currentState };

      if (params.updateData.phase && params.updateData.status) {
        if (!isTaskPhaseStatus(params.updateData.status)) {
          throw new Error(
            `Invalid status: ${params.updateData.status}. Valid values are: not_started, in_progress, completed, blocked`
          );
        }
        const validStatus = params.updateData.status;

        const phase = params.updateData.phase as keyof typeof updatedState.phases;
        if (updatedState.phases[phase]) {
          updatedState.phases[phase] = {
            ...updatedState.phases[phase],
            status: validStatus,
            assignee: params.updateData.assignee,
            notes: params.updateData.notes,
            artifacts:
              params.updateData.artifacts || updatedState.phases[phase].artifacts
          };

          if (validStatus === 'in_progress' && !updatedState.phases[phase].startedAt) {
            updatedState.phases[phase].startedAt = new Date().toISOString();
          }
          if (validStatus === 'completed') {
            updatedState.phases[phase].completedAt = new Date().toISOString();
          }
        }
      }

      if (params.updateData.blockers) {
        updatedState.blockers = params.updateData.blockers;
      }

      updatedState.progressPercentage = this.calculateTaskProgress(updatedState);
      updatedState.currentPhase = this.determineCurrentPhase(updatedState);

      return updatedState;
    });
  }

  /**
   * Get AI-powered next-action recommendations for a task.
   */
  async getNextTaskActions(taskLifecycle: TaskLifecycleState): Promise<{
    nextActions: string[];
    blockers: string[];
    recommendations: string[];
    estimatedCompletion: string;
  }> {
    return safeCall(async () => {
      const config = FEATURE_PROMPT_CONFIGS.trackLifecycle;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
        this.logger.error('Task lifecycle recommendations failed: AI service is not available');
        throw new Error(
          'AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).'
        );
      }

      const prompt = formatFeaturePrompt(config.userPrompt, {
        taskTitle: `Task ${taskLifecycle.taskId}`,
        currentPhase: taskLifecycle.currentPhase,
        progressData: JSON.stringify(taskLifecycle.phases),
        blockers: JSON.stringify(taskLifecycle.blockers),
        teamContext: 'Standard development team'
      });

      const LifecycleAnalysisSchema = z.object({
        nextActions: z.array(z.string()).describe('Ordered list of next actions to take'),
        recommendations: z.array(z.string()).describe('Strategic recommendations'),
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: LifecycleAnalysisSchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return {
        nextActions: result.object.nextActions,
        blockers: taskLifecycle.blockers.map(b => b.description),
        recommendations: result.object.recommendations,
        estimatedCompletion: this.calculateEstimatedCompletion(taskLifecycle)
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  calculateTaskProgress(state: TaskLifecycleState): number {
    const phases = Object.values(state.phases);
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    return Math.round((completedPhases / phases.length) * 100);
  }

  determineCurrentPhase(
    state: TaskLifecycleState
  ): TaskLifecycleState['currentPhase'] {
    const phaseOrder: (keyof TaskLifecycleState['phases'])[] = [
      'planning',
      'development',
      'testing',
      'review',
      'deployment'
    ];

    for (const phase of phaseOrder) {
      if (state.phases[phase].status !== 'completed') {
        return phase;
      }
    }
    return 'completed';
  }

  calculateEstimatedCompletion(state: TaskLifecycleState): string {
    const remainingWork = (100 - state.progressPercentage) / 100;
    const estimatedDays = remainingWork * 5;
    return new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString();
  }

  extractNextActions(analysis: string): string[] {
    // Look for numbered/bulleted action items or "next steps" section
    const sectionMatch = analysis.match(/(?:next (?:steps|actions)|action items?|to.?do|immediate actions?)[:\s]*\n([\s\S]*?)(?:\n\n|$)/i);
    if (sectionMatch) {
      const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 5);
      if (lines.length > 0) return lines.slice(0, 5);
    }
    // Fallback: look for imperative sentences
    const imperativePattern = /(?:^|\n)\s*[-*•\d.]+\s*((?:Review|Implement|Create|Set up|Configure|Test|Deploy|Document|Fix|Update|Add|Remove|Refactor)\s[^.\n]+)/gi;
    const actions: string[] = [];
    let match;
    while ((match = imperativePattern.exec(analysis)) !== null) {
      actions.push(match[1].trim());
    }
    return actions.length > 0 ? actions.slice(0, 5) : ['Review requirements', 'Start implementation', 'Set up testing environment'];
  }

  extractRecommendations(analysis: string): string[] {
    const sectionMatch = analysis.match(/(?:recommend(?:ation)?s?|suggest(?:ion)?s?|best practices?|advice)[:\s]*\n([\s\S]*?)(?:\n\n|$)/i);
    if (sectionMatch) {
      const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 5);
      if (lines.length > 0) return lines.slice(0, 5);
    }
    // Fallback: look for sentences with recommendation language
    const recPattern = /(?:recommend|suggest|advise|consider|should|best practice)s?[:\-]?\s*([^.\n]+[.]?)/gi;
    const recs: string[] = [];
    let match;
    while ((match = recPattern.exec(analysis)) !== null) {
      const rec = match[1].trim();
      if (rec.length > 10) recs.push(rec);
    }
    return recs.length > 0 ? recs.slice(0, 5) : ['Focus on core functionality first', 'Implement comprehensive testing', 'Plan for gradual rollout'];
  }
}
