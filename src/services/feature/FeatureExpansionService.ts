import { generateObject } from 'ai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AIServiceFactory } from '../ai/AIServiceFactory.js';
import { type ILogger, Logger } from '../../infrastructure/logger';
import {
  type FeatureRequirement,
  type FeatureExpansionResult,
  type AITask,
  AITaskSchema,
  TaskStatus,
  TaskPriority,
  type TaskDependency
} from '../../domain/ai-types.js';
import {
  FEATURE_PROMPT_CONFIGS,
  formatFeaturePrompt
} from '../ai/prompts/FeatureAdditionPrompts.js';
import { TaskGenerationService } from '../TaskGenerationService.js';
import { safeCall } from '../utils/safeCall';

/**
 * Expands a feature requirement into a breakdown of implementable tasks.
 *
 * Extracted from FeatureManagementService (SRP decomposition).
 * Responsibility: produce an `AITask[]` breakdown for a given feature,
 * detect inter-task dependencies, assess implementation risks, and
 * suggest a milestone.
 */
export class FeatureExpansionService {
  private readonly aiFactory: AIServiceFactory;
  private readonly taskService: TaskGenerationService;
  private readonly logger: ILogger;

  /**
   * @param aiFactory - AI service factory for model access. When omitted (DI mode),
   *   defaults to the global singleton via `AIServiceFactory.getInstance()`.
   * @param taskService - Optional injected TaskGenerationService for dependency detection.
   *   Falls back to a new instance using the provided aiFactory when omitted.
   * @param logger - Logger instance for diagnostics. When omitted, defaults to
   *   the global singleton via `Logger.getInstance()`.
   */
  constructor(aiFactory?: AIServiceFactory, taskService?: TaskGenerationService, logger?: ILogger) {
    this.aiFactory = aiFactory ?? AIServiceFactory.getInstance();
    this.taskService = taskService ?? new TaskGenerationService(this.aiFactory);
    this.logger = logger ?? Logger.getInstance();
  }

  /**
   * Break a feature down into implementable tasks using AI.
   */
  async expandFeatureToTasks(params: {
    feature: FeatureRequirement;
    systemContext?: any;
    integrationPoints?: string[];
    teamSkills?: string[];
  }): Promise<FeatureExpansionResult> {
    return safeCall(async () => {
      const config = FEATURE_PROMPT_CONFIGS.expandToTasks;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
        this.logger.error('Feature expansion failed: AI service is not available');
        throw new Error('AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).');
      }

      const prompt = formatFeaturePrompt(config.userPrompt, {
        featureTitle: params.feature.title,
        featureDescription: params.feature.description,
        userStories: params.feature.userStories.join('\n'),
        acceptanceCriteria: params.feature.acceptanceCriteria.join('\n'),
        systemContext: params.systemContext ? JSON.stringify(params.systemContext) : 'No system context provided',
        integrationPoints: params.integrationPoints?.join(', ') || 'No specific integration points'
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: z.array(AITaskSchema),
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Enrich tasks with metadata
      const tasks = result.object.map(task => ({
        ...task,
        id: task.id || uuidv4(),
        status: TaskStatus.PENDING,
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourcePRD: `feature-${params.feature.id}`,
        tags: [...(task.tags || []), 'feature-expansion', `feature-${params.feature.id}`]
      }));

      const tasksWithDependencies = await this.taskService.detectTaskDependencies(tasks);
      const totalEffort = tasksWithDependencies.reduce((sum, task) => sum + task.estimatedHours, 0);

      return {
        feature: params.feature,
        tasks: tasksWithDependencies,
        dependencies: this.extractTaskDependencies(tasksWithDependencies),
        estimatedEffort: totalEffort,
        suggestedMilestone: this.suggestMilestone(totalEffort, params.feature.priority),
        riskAssessment: this.assessImplementationRisks(tasksWithDependencies, params.feature)
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  assessImplementationRisks(
    tasks: AITask[],
    feature: FeatureRequirement
  ): { level: 'low' | 'medium' | 'high'; factors: string[]; mitigations: string[] } {
    const highComplexityTasks = tasks.filter(t => t.complexity >= 7).length;
    const totalTasks = tasks.length;

    let level: 'low' | 'medium' | 'high' = 'low';
    if (highComplexityTasks > totalTasks * 0.3) level = 'high';
    else if (highComplexityTasks > totalTasks * 0.1) level = 'medium';

    return {
      level,
      factors: [
        `${highComplexityTasks} high-complexity tasks out of ${totalTasks}`,
        `Feature complexity: ${feature.estimatedComplexity}/10`
      ],
      mitigations: [
        'Break down complex tasks further',
        'Assign experienced developers to high-risk tasks',
        'Implement comprehensive testing strategy'
      ]
    };
  }

  extractTaskDependencies(tasks: AITask[]): TaskDependency[] {
    return tasks.flatMap(task => task.dependencies);
  }

  suggestMilestone(effort: number, priority: TaskPriority): string {
    if (priority === TaskPriority.CRITICAL) return 'Current Sprint';
    if (effort <= 40) return 'Next Sprint';
    if (effort <= 120) return 'Current Quarter';
    return 'Next Quarter';
  }
}
