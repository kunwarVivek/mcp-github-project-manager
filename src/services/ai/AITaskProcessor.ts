import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import { type ILogger, Logger } from '../../infrastructure/logger';
import {
  PRDDocumentSchema,
  AITaskSchema,
  FeatureRequirementSchema,
  type AITask,
  type PRDDocument,
  type FeatureRequirement,
  TaskPriority,
  TaskPrioritySchema,
  TaskStatus,
  type AIGenerationMetadata,
  type SectionConfidence,
  type ConfidenceConfig,
  DEFAULT_CONFIDENCE_CONFIG
} from '../../domain/ai-types';
import {
  PRD_PROMPT_CONFIGS,
  formatPrompt
} from './prompts/PRDGenerationPrompts';
import {
  TASK_PROMPT_CONFIGS,
  formatTaskPrompt
} from './prompts/TaskGenerationPrompts';
import {
  CONFIDENCE_PROMPT_CONFIGS,
  withConfidenceAssessment
} from './prompts/ConfidencePrompts';
import { ConfidenceScorer } from './ConfidenceScorer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Core AI Task Processor using Vercel AI SDK
 */
export class AITaskProcessor {
  private aiFactory: AIServiceFactory;
  private confidenceScorer: ConfidenceScorer;
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
    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * Get AI model with fallback logic
   */
  private getModelWithFallback(preferredType?: 'main' | 'research' | 'fallback' | 'prd'): any {
    let model = null;

    if (preferredType) {
      model = this.aiFactory.getModel(preferredType);
    }

    if (!model) {
      model = this.aiFactory.getBestAvailableModel();
    }

    if (!model) {
      throw new Error('AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).');
    }

    return model;
  }

  /**
   * Generate PRD from project idea
   */
  async generatePRDFromIdea(params: {
    projectIdea: string;
    targetUsers?: string;
    timeline?: string;
    complexity?: string;
  }): Promise<PRDDocument> {
    const config = PRD_PROMPT_CONFIGS.generateFromIdea;
    const model = this.getModelWithFallback('prd');

    const prompt = formatPrompt(config.userPrompt, {
      projectIdea: params.projectIdea,
      targetUsers: params.targetUsers || 'General users',
      timeline: params.timeline || '3-6 months',
      complexity: params.complexity || 'medium'
    });

    try {
      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: PRDDocumentSchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Add AI metadata
      const prd = result.object;
      prd.id = uuidv4();
      prd.aiGenerated = true;
      prd.aiMetadata = this.createAIMetadata(model.modelId, prompt);
      prd.createdAt = new Date().toISOString();
      prd.updatedAt = new Date().toISOString();

      return prd;
    } catch (error) {
      this.logger.error('Error generating PRD from idea', error);
      throw new Error(`Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate PRD with per-section confidence scoring
   */
  async generatePRDWithConfidence(params: {
    projectIdea: string;
    targetUsers?: string;
    timeline?: string;
    complexity?: string;
    confidenceConfig?: Partial<ConfidenceConfig>;
  }): Promise<{
    prd: PRDDocument;
    sectionConfidence: SectionConfidence[];
    overallConfidence: { score: number; tier: 'high' | 'medium' | 'low' };
    lowConfidenceSections: SectionConfidence[];
  }> {
    const config = { ...DEFAULT_CONFIDENCE_CONFIG, ...params.confidenceConfig };
    const scorer = new ConfidenceScorer(config);

    // Generate PRD with confidence request
    const prdConfig = PRD_PROMPT_CONFIGS.generateFromIdea;
    const model = this.getModelWithFallback('prd');

    const prompt = formatPrompt(prdConfig.userPrompt, {
      projectIdea: params.projectIdea,
      targetUsers: params.targetUsers || 'General users',
      timeline: params.timeline || '3-6 months',
      complexity: params.complexity || 'medium'
    }) + CONFIDENCE_PROMPT_CONFIGS.selfAssessmentSuffix;

    // Use schema with confidence assessment
    const PRDWithConfidenceSchema = withConfidenceAssessment(PRDDocumentSchema);

    try {
      const result = await generateObject({
        model,
        system: prdConfig.systemPrompt,
        prompt,
        schema: PRDWithConfidenceSchema,
        maxOutputTokens: prdConfig.maxTokens + 500, // Extra tokens for confidence
        temperature: prdConfig.temperature
      });

      const generated = result.object;
      const aiAssessment = generated.confidenceAssessment;

      // Calculate per-section confidence
      const sectionConfidence: SectionConfidence[] = [];

      // Overview section
      sectionConfidence.push(scorer.calculateSectionConfidence({
        sectionId: 'overview',
        sectionName: 'Overview',
        inputData: { description: params.projectIdea },
        aiSelfAssessment: aiAssessment.score / 100,
        aiReasoning: aiAssessment.reasoning,
        uncertainAreas: aiAssessment.uncertainAreas
      }));

      // Features section
      sectionConfidence.push(scorer.calculateSectionConfidence({
        sectionId: 'features',
        sectionName: 'Features',
        inputData: {
          description: params.projectIdea,
          context: params.targetUsers
        },
        aiSelfAssessment: Math.max(0, (aiAssessment.score - 10)) / 100, // Features often less certain
        aiReasoning: aiAssessment.reasoning,
        uncertainAreas: aiAssessment.uncertainAreas.filter(a =>
          a.toLowerCase().includes('feature')
        )
      }));

      // Technical requirements section
      sectionConfidence.push(scorer.calculateSectionConfidence({
        sectionId: 'technicalRequirements',
        sectionName: 'Technical Requirements',
        inputData: {
          description: params.projectIdea,
          constraints: params.complexity ? [`Complexity: ${params.complexity}`] : []
        },
        aiSelfAssessment: Math.max(0, (aiAssessment.score - 15)) / 100, // Tech reqs often assumed
        aiReasoning: aiAssessment.reasoning
      }));

      // Aggregate confidence
      const aggregated = scorer.aggregateConfidence(sectionConfidence);

      // Build PRD without confidence field
      const prd: PRDDocument = {
        ...generated,
        id: uuidv4(),
        aiGenerated: true,
        aiMetadata: this.createAIMetadata(model.modelId, prompt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      delete (prd as unknown as Record<string, unknown>).confidenceAssessment;

      return {
        prd,
        sectionConfidence,
        overallConfidence: {
          score: aggregated.overallScore,
          tier: aggregated.overallTier
        },
        lowConfidenceSections: aggregated.lowConfidenceSections
      };
    } catch (error) {
      this.logger.error('Error generating PRD with confidence', error);
      throw new Error(`Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance existing PRD
   */
  async enhancePRD(params: {
    currentPRD: string;
    enhancementType: string;
    focusAreas?: string[];
  }): Promise<PRDDocument> {
    const config = PRD_PROMPT_CONFIGS.enhanceExisting;
    const model = this.getModelWithFallback('prd');

    const prompt = formatPrompt(config.userPrompt, {
      currentPRD: params.currentPRD,
      enhancementType: params.enhancementType,
      focusAreas: params.focusAreas?.join(', ') || 'general improvements'
    });

    try {
      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: PRDDocumentSchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      const prd = result.object;
      prd.aiGenerated = true;
      prd.aiMetadata = this.createAIMetadata(model.modelId, prompt);
      prd.updatedAt = new Date().toISOString();

      return prd;
    } catch (error) {
      this.logger.error('Error enhancing PRD', error);
      throw new Error(`Failed to enhance PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract features from PRD
   */
  async extractFeaturesFromPRD(prdContent: string): Promise<FeatureRequirement[]> {
    const config = PRD_PROMPT_CONFIGS.extractFeatures;
    const model = this.getModelWithFallback('main');

    const prompt = formatPrompt(config.userPrompt, {
      prdContent
    });

    try {
      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: z.array(FeatureRequirementSchema),
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object.map(feature => ({
        ...feature,
        id: feature.id || uuidv4()
      }));
    } catch (error) {
      this.logger.error('Error extracting features from PRD', error);
      throw new Error(`Failed to extract features: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate tasks from PRD
   */
  async generateTasksFromPRD(params: {
    prdContent: string;
    maxTasks?: number;
    includeSubtasks?: boolean;
    autoEstimate?: boolean;
  }): Promise<AITask[]> {
    const config = TASK_PROMPT_CONFIGS.generateFromPRD;
    const model = this.getModelWithFallback('main');

    const prompt = formatTaskPrompt(config.userPrompt, {
      prdContent: params.prdContent,
      maxTasks: params.maxTasks || 30,
      includeSubtasks: params.includeSubtasks || true,
      autoEstimate: params.autoEstimate || true
    });

    try {
      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: z.array(AITaskSchema),
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object.map(task => ({
        ...task,
        id: task.id || uuidv4(),
        status: TaskStatus.PENDING,
        aiGenerated: true,
        aiMetadata: this.createAIMetadata(model.modelId, prompt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: task.subtasks || [],
        dependencies: task.dependencies || [],
        acceptanceCriteria: task.acceptanceCriteria || [],
        tags: task.tags || []
      }));
    } catch (error) {
      this.logger.error('Error generating tasks from PRD', error);
      throw new Error(`Failed to generate tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze task complexity
   */
  async analyzeTaskComplexity(params: {
    taskTitle: string;
    taskDescription: string;
    currentEstimate?: number;
  }): Promise<{
    complexity: number;
    estimatedHours: number;
    analysis: string;
    riskFactors: string[];
    recommendations: string[];
  }> {
    const config = TASK_PROMPT_CONFIGS.analyzeComplexity;
    const model = this.getModelWithFallback('main');

    const prompt = formatTaskPrompt(config.userPrompt, {
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      currentEstimate: params.currentEstimate || 'not provided'
    });

    try {
      const ComplexitySchema = z.object({
        complexity: z.number().min(1).max(10),
        estimatedHours: z.number().positive(),
        analysis: z.string(),
        riskFactors: z.array(z.string()),
        recommendations: z.array(z.string()),
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: ComplexitySchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object;
    } catch (error) {
      this.logger.error('Error analyzing task complexity', error);
      return {
        complexity: 5,
        estimatedHours: 20,
        analysis: 'Fallback: AI analysis unavailable',
        riskFactors: [],
        recommendations: [],
      };
    }
  }

  /**
   * Expand task into subtasks
   */
  async expandTaskIntoSubtasks(params: {
    taskTitle: string;
    taskDescription: string;
    currentComplexity: number;
    maxDepth: number;
  }): Promise<any[]> {
    const config = TASK_PROMPT_CONFIGS.expandTask;
    const model = this.getModelWithFallback('main');

    const prompt = formatTaskPrompt(config.userPrompt, {
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      currentComplexity: params.currentComplexity,
      maxDepth: params.maxDepth
    });

    try {
      const SubtaskSchema = z.object({
        subtasks: z.array(z.object({
          title: z.string(),
          description: z.string(),
          complexity: z.number().min(1).max(10),
          estimatedHours: z.number().positive(),
        }))
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: SubtaskSchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object.subtasks.map(subtask => ({
        id: uuidv4(),
        ...subtask
      }));
    } catch (error) {
      this.logger.error('Error expanding task into subtasks, using fallback', error);
      // Fallback to hardcoded structure
      return [
        {
          id: uuidv4(),
          title: `${params.taskTitle} - Setup`,
          description: 'Initial setup and preparation',
          complexity: Math.max(1, Math.floor(params.currentComplexity / 3)),
          estimatedHours: 2
        },
        {
          id: uuidv4(),
          title: `${params.taskTitle} - Implementation`,
          description: 'Core implementation work',
          complexity: Math.max(1, Math.floor(params.currentComplexity / 2)),
          estimatedHours: 4
        },
        {
          id: uuidv4(),
          title: `${params.taskTitle} - Testing`,
          description: 'Testing and validation',
          complexity: Math.max(1, Math.floor(params.currentComplexity / 4)),
          estimatedHours: 2
        }
      ];
    }
  }

  /**
   * Prioritize tasks using AI
   */
  async prioritizeTasks(params: {
    tasks: AITask[];
    projectGoals?: string;
    timeline?: string;
    teamSize?: number;
  }): Promise<AITask[]> {
    const config = TASK_PROMPT_CONFIGS.prioritizeTasks;
    const model = this.getModelWithFallback('main');

    const prompt = formatTaskPrompt(config.userPrompt, {
      taskList: params.tasks.map(t => ({ id: t.id, title: t.title, description: t.description })),
      projectGoals: params.projectGoals || 'Deliver MVP quickly',
      timeline: params.timeline || '3 months',
      teamSize: params.teamSize || 3
    });

    try {
      const PrioritySchema = z.object({
        priorities: z.array(z.object({
          taskId: z.string(),
          priority: TaskPrioritySchema,
        }))
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: PrioritySchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Map AI-assigned priorities onto input tasks by taskId
      const priorityMap = new Map(
        result.object.priorities.map(p => [p.taskId, p.priority])
      );

      return params.tasks.map((task, index) => ({
        ...task,
        priority: priorityMap.get(task.id) ?? this.assignPriorityBasedOnIndex(index, params.tasks.length),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      this.logger.error('Error prioritizing tasks, using fallback', error);
      // Fallback to index-based priority assignment
      return params.tasks.map((task, index) => ({
        ...task,
        priority: this.assignPriorityBasedOnIndex(index, params.tasks.length),
        updatedAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Create AI generation metadata
   */
  private createAIMetadata(modelId: string, prompt: string): AIGenerationMetadata {
    return {
      generatedBy: modelId,
      generatedAt: new Date().toISOString(),
      prompt: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
      confidence: 0.8, // Would be calculated based on model response
      version: '1.0.0'
    };
  }

  /**
   * Assign priority based on task index (simplified logic)
   */
  private assignPriorityBasedOnIndex(index: number, total: number): TaskPriority {
    const ratio = index / total;
    if (ratio < 0.2) return TaskPriority.CRITICAL;
    if (ratio < 0.4) return TaskPriority.HIGH;
    if (ratio < 0.7) return TaskPriority.MEDIUM;
    return TaskPriority.LOW;
  }

  /**
   * Test AI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) {
        this.logger.warn('No AI models available for testing');
        return false;
      }

      await generateText({
        model,
        prompt: 'Test connection',
        maxOutputTokens: 10
      });
      return true;
    } catch (error) {
      this.logger.error('AI connection test failed', error);
      return false;
    }
  }
}
