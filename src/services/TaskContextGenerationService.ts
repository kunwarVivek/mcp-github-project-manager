import { generateObject } from 'ai';
import { AIServiceFactory } from './ai/AIServiceFactory';
import {
  CONTEXT_GENERATION_CONFIGS,
  formatContextPrompt,
  BusinessContextSchema,
  TechnicalContextSchema,
  ImplementationGuidanceSchema,
  ContextualReferencesSchema,
  EnhancedAcceptanceCriteriaSchema
} from './ai/prompts/ContextGenerationPrompts';
import {
  AITask,
  EnhancedAITask,
  PRDDocument,
  EnhancedTaskGenerationConfig,
  TaskExecutionContext,
  EnhancedAcceptanceCriteria,
  ContextualReferences,
  ImplementationGuidance,
  EnhancedTaskDependency
} from '../domain/ai-types';
import { RequirementsTraceabilityService } from './RequirementsTraceabilityService';
import {
  ENHANCED_TASK_GENERATION,
  INCLUDE_BUSINESS_CONTEXT,
  INCLUDE_TECHNICAL_CONTEXT,
  INCLUDE_IMPLEMENTATION_GUIDANCE,
  ENHANCED_CONTEXT_LEVEL
} from '../env';

/**
 * Service for generating comprehensive task context using AI and traceability
 */
export class TaskContextGenerationService {
  private aiFactory: AIServiceFactory;
  private traceabilityService: RequirementsTraceabilityService;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
    this.traceabilityService = new RequirementsTraceabilityService();
  }

  /**
   * Generate comprehensive context for a task
   */
  async generateTaskContext(
    task: AITask,
    prd: PRDDocument | string,
    config: EnhancedTaskGenerationConfig
  ): Promise<TaskExecutionContext> {
    try {
      const prdContent = typeof prd === 'string' ? prd : JSON.stringify(prd, null, 2);

      // Start with traceability-based context (always available)
      const traceabilityContext = await this.generateTraceabilityContext(task, prd);

      // Add AI-enhanced context if enabled and available
      let aiEnhancedContext = {};
      if (config.enableEnhancedGeneration && this.aiFactory.getBestAvailableModel()) {
        aiEnhancedContext = await this.generateAIEnhancedContext(task, prdContent, config);
      }

      // Merge contexts with AI enhancement taking precedence
      return this.mergeContexts(traceabilityContext, aiEnhancedContext);

    } catch (error) {
      process.stderr.write(`Error generating task context: ${error instanceof Error ? error.message : String(error)}\n`);
      // Fallback to basic traceability context
      return this.generateTraceabilityContext(task, prd);
    }
  }

  /**
   * Generate context from traceability system (default, always available)
   */
  private async generateTraceabilityContext(
    task: AITask,
    prd: PRDDocument | string
  ): Promise<TaskExecutionContext> {
    try {
      // Create basic context from traceability information
      const prdObj = typeof prd === 'object' ? prd : {
        objectives: ['Deliver high-quality software solution'],
        title: 'Project Requirements'
      };

      return {
        businessObjective: `Supports project objective: ${prdObj.objectives?.[0] || 'Deliver software solution'}`,
        userImpact: `Contributes to overall user experience and system functionality`,
        successMetrics: ['Task completed according to acceptance criteria', 'Code review approved', 'Tests passing'],

        parentFeature: {
          id: task.sourcePRD || 'unknown',
          title: 'Related Feature',
          description: 'Feature containing this task',
          userStories: ['As a user, I want this functionality to work correctly'],
          businessValue: 'Provides essential system functionality'
        },

        technicalConstraints: ['Follow existing code patterns', 'Maintain system performance', 'Ensure security standards'],
        architecturalDecisions: ['Use established architecture patterns', 'Follow team coding standards'],
        integrationPoints: ['Integrate with existing system components'],
        dataRequirements: ['Use existing data models where applicable'],

        prdContextSummary: {
          relevantObjectives: prdObj.objectives || ['Deliver software solution'],
          relevantRequirements: ['Implement according to specifications'],
          scopeConstraints: ['Stay within defined project scope']
        }
      };
    } catch (error) {
      process.stderr.write(`Error generating traceability context: ${error instanceof Error ? error.message : String(error)}\n`);
      return this.getMinimalContext(task);
    }
  }

  /**
   * Generate AI-enhanced context (when AI is available and enabled)
   */
  private async generateAIEnhancedContext(
    task: AITask,
    prdContent: string,
    config: EnhancedTaskGenerationConfig
  ): Promise<Partial<TaskExecutionContext>> {
    const enhancedContext: Partial<TaskExecutionContext> = {};

    try {
      // Generate business context if enabled
      if (config.includeBusinessContext) {
        const businessContext = await this.generateBusinessContext(task, prdContent);
        if (businessContext) {
          enhancedContext.businessObjective = businessContext.businessObjective;
          enhancedContext.userImpact = businessContext.userImpact;
          enhancedContext.successMetrics = businessContext.successMetrics;
        }
      }

      // Generate technical context if enabled
      if (config.includeTechnicalContext) {
        const technicalContext = await this.generateTechnicalContext(task, prdContent);
        if (technicalContext) {
          enhancedContext.technicalConstraints = technicalContext.technicalConstraints;
          enhancedContext.architecturalDecisions = technicalContext.architecturalDecisions.map((ad: any) => ad.decision);
          enhancedContext.integrationPoints = technicalContext.integrationPoints.map((ip: any) => ip.description);
          enhancedContext.dataRequirements = technicalContext.dataRequirements.map((dr: any) => dr.description);
        }
      }

      return enhancedContext;
    } catch (error) {
      process.stderr.write(`Error generating AI-enhanced context: ${error instanceof Error ? error.message : String(error)}\n`);
      return {};
    }
  }

  /**
   * Generate business context using AI
   */
  private async generateBusinessContext(task: AITask, prdContent: string): Promise<any> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) return null;

      const config = CONTEXT_GENERATION_CONFIGS.businessContext;
      const prompt = formatContextPrompt(config.userPrompt, {
        prdContent,
        taskTitle: task.title,
        taskDescription: task.description,
        taskPriority: task.priority
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: BusinessContextSchema,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object;
    } catch (error) {
      process.stderr.write(`Error generating business context: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
  }

  /**
   * Generate technical context using AI
   */
  private async generateTechnicalContext(task: AITask, prdContent: string): Promise<any> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) return null;

      const config = CONTEXT_GENERATION_CONFIGS.technicalContext;
      const prompt = formatContextPrompt(config.userPrompt, {
        prdContent,
        taskTitle: task.title,
        taskDescription: task.description,
        taskComplexity: task.complexity
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: TechnicalContextSchema,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object;
    } catch (error) {
      process.stderr.write(`Error generating technical context: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
  }

  /**
   * Generate implementation guidance using AI
   */
  async generateImplementationGuidance(
    task: AITask,
    businessContext?: any,
    technicalContext?: any
  ): Promise<ImplementationGuidance | null> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) return null;

      const config = CONTEXT_GENERATION_CONFIGS.implementationGuidance;
      const prompt = formatContextPrompt(config.userPrompt, {
        taskTitle: task.title,
        taskDescription: task.description,
        taskComplexity: task.complexity,
        taskPriority: task.priority,
        businessContext: businessContext ? JSON.stringify(businessContext, null, 2) : 'Not available',
        technicalContext: technicalContext ? JSON.stringify(technicalContext, null, 2) : 'Not available'
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: ImplementationGuidanceSchema,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      return this.transformImplementationGuidance(result.object);
    } catch (error) {
      process.stderr.write(`Error generating implementation guidance: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
  }

  /**
   * Transform AI implementation guidance to our format
   */
  private transformImplementationGuidance(aiGuidance: any): ImplementationGuidance {
    return {
      recommendedApproach: aiGuidance.recommendedApproach,
      implementationSteps: aiGuidance.implementationSteps.map((step: any) => step.description || step),
      technicalConsiderations: aiGuidance.technicalConsiderations,
      commonPitfalls: aiGuidance.commonPitfalls.map((pitfall: any) => pitfall.pitfall || pitfall),
      testingStrategy: aiGuidance.testingStrategy?.approach || 'Standard testing approach',
      recommendedTools: aiGuidance.bestPractices?.map((bp: any) => bp.practice) || [],
      codeQualityStandards: aiGuidance.qualityAssurance || [],
      performanceConsiderations: aiGuidance.performanceOptimization || [],
      securityConsiderations: []
    };
  }

  /**
   * Merge traceability and AI contexts
   */
  private mergeContexts(
    traceabilityContext: TaskExecutionContext,
    aiContext: Partial<TaskExecutionContext>
  ): TaskExecutionContext {
    return {
      ...traceabilityContext,
      ...aiContext,
      // Merge arrays intelligently
      successMetrics: [
        ...(aiContext.successMetrics || []),
        ...traceabilityContext.successMetrics
      ].filter((metric, index, arr) => arr.indexOf(metric) === index),

      technicalConstraints: [
        ...(aiContext.technicalConstraints || []),
        ...traceabilityContext.technicalConstraints
      ].filter((constraint, index, arr) => arr.indexOf(constraint) === index)
    };
  }

  /**
   * Get minimal context as fallback
   */
  private getMinimalContext(task: AITask): TaskExecutionContext {
    return {
      businessObjective: 'Complete assigned development task',
      userImpact: 'Contributes to overall system functionality',
      successMetrics: ['Task completed', 'Tests passing', 'Code reviewed'],

      parentFeature: {
        id: 'unknown',
        title: 'Development Task',
        description: task.description,
        userStories: ['As a developer, I need to complete this task'],
        businessValue: 'Maintains system functionality'
      },

      technicalConstraints: ['Follow coding standards'],
      architecturalDecisions: ['Use existing patterns'],
      integrationPoints: ['Standard system integration'],
      dataRequirements: ['Use appropriate data structures'],

      prdContextSummary: {
        relevantObjectives: ['Complete development work'],
        relevantRequirements: ['Implement as specified'],
        scopeConstraints: ['Stay within task scope']
      }
    };
  }

  /**
   * Check if AI context generation is available
   */
  isAIContextAvailable(): boolean {
    return ENHANCED_TASK_GENERATION && !!this.aiFactory.getBestAvailableModel();
  }

  /**
   * Get context generation configuration from environment
   */
  getDefaultContextConfig(): EnhancedTaskGenerationConfig {
    return {
      enableEnhancedGeneration: ENHANCED_TASK_GENERATION,
      createTraceabilityMatrix: true,
      generateUseCases: true,
      createLifecycleTracking: true,
      contextLevel: ENHANCED_CONTEXT_LEVEL as 'minimal' | 'standard' | 'full',
      includeBusinessContext: INCLUDE_BUSINESS_CONTEXT,
      includeTechnicalContext: INCLUDE_TECHNICAL_CONTEXT,
      includeImplementationGuidance: INCLUDE_IMPLEMENTATION_GUIDANCE,
      enforceTraceability: true,
      requireBusinessJustification: INCLUDE_BUSINESS_CONTEXT,
      trackRequirementCoverage: true
    };
  }
}
