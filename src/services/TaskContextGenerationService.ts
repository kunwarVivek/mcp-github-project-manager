import { generateObject } from 'ai';
import { AIServiceFactory } from './ai/AIServiceFactory';
import {
  CONTEXT_GENERATION_CONFIGS,
  formatContextPrompt,
  BusinessContextSchema,
  TechnicalContextSchema
} from './ai/prompts/ContextGenerationPrompts';
import {
  AITask,
  PRDDocument,
  EnhancedTaskGenerationConfig,
  FeatureRequirement
} from '../domain/ai-types';
import {
  TaskExecutionContext,
  ContextQualityMetrics
} from '../domain/task-context-schemas';
import { RequirementsTraceabilityService } from './RequirementsTraceabilityService';
import {
  ENHANCED_TASK_GENERATION,
  INCLUDE_BUSINESS_CONTEXT,
  INCLUDE_TECHNICAL_CONTEXT,
  INCLUDE_IMPLEMENTATION_GUIDANCE,
  ENHANCED_CONTEXT_LEVEL
} from '../env';

// Import new context generation services
import { ContextualReferenceGenerator } from './context/ContextualReferenceGenerator';
import { DependencyContextGenerator } from './context/DependencyContextGenerator';
import { CodeExampleGenerator } from './context/CodeExampleGenerator';
import { ContextQualityValidator } from './validation/ContextQualityValidator';

/**
 * Service for generating comprehensive task context using AI and traceability
 *
 * UPDATED: Now includes FR-4, FR-5, FR-6 implementations
 * - FR-4: Contextual References System
 * - FR-5: Enhanced Acceptance Criteria (integration)
 * - FR-6: Dependency Context Enhancement
 */
export class TaskContextGenerationService {
  private aiFactory: AIServiceFactory;
  private traceabilityService: RequirementsTraceabilityService;
  private contextualRefGenerator: ContextualReferenceGenerator;
  private dependencyContextGenerator: DependencyContextGenerator;
  private codeExampleGenerator: CodeExampleGenerator;
  private qualityValidator: ContextQualityValidator;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
    this.traceabilityService = new RequirementsTraceabilityService();
    this.contextualRefGenerator = new ContextualReferenceGenerator();
    this.dependencyContextGenerator = new DependencyContextGenerator();
    this.codeExampleGenerator = new CodeExampleGenerator();
    this.qualityValidator = new ContextQualityValidator();
  }

  /**
   * Generate comprehensive context for a task with quality validation
   */
  async generateTaskContext(
    task: AITask,
    prd: PRDDocument | string,
    config: EnhancedTaskGenerationConfig,
    allTasks?: AITask[],
    features?: FeatureRequirement[]
  ): Promise<{ context: TaskExecutionContext; metrics: ContextQualityMetrics }> {
    const startTime = Date.now();
    let tokenUsage = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const prdContent = typeof prd === 'string' ? prd : JSON.stringify(prd, null, 2);

      // Start with traceability-based context (always available)
      const traceabilityContext = await this.generateTraceabilityContext(task, prd);

      // Add AI-enhanced context if enabled and available
      let aiEnhancedContext = {};
      let aiEnhanced = false;

      if (config.enableEnhancedGeneration && this.aiFactory.getBestAvailableModel()) {
        try {
          const aiResult = await this.generateAIEnhancedContext(
            task,
            prdContent,
            config,
            allTasks,
            features
          );
          aiEnhancedContext = aiResult.context;
          tokenUsage = aiResult.tokenUsage;
          aiEnhanced = true;
        } catch (error) {
          errors.push(`AI enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          warnings.push('Falling back to traceability-based context only');
        }
      }

      // Merge contexts with AI enhancement taking precedence
      const context = this.mergeContexts(traceabilityContext, aiEnhancedContext);

      // Calculate generation time
      const generationTime = (Date.now() - startTime) / 1000;

      // Create quality metrics
      const metrics: ContextQualityMetrics = {
        completenessScore: this.calculateContextCompleteness(context),
        generationTime,
        tokenUsage,
        cacheHit: false, // TODO: Implement caching
        aiEnhanced,
        errors,
        warnings
      };

      return { context, metrics };

    } catch (error) {
      errors.push(`Context generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Fallback to minimal context
      const fallbackContext = await this.generateTraceabilityContext(task, prd);
      const generationTime = (Date.now() - startTime) / 1000;

      const metrics: ContextQualityMetrics = {
        completenessScore: this.calculateContextCompleteness(fallbackContext),
        generationTime,
        tokenUsage: 0,
        cacheHit: false,
        aiEnhanced: false,
        errors,
        warnings: ['Using fallback context due to errors']
      };

      return { context: fallbackContext, metrics };
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
   * Generate AI-enhanced context with all new features
   */
  private async generateAIEnhancedContext(
    task: AITask,
    prdContent: string,
    config: EnhancedTaskGenerationConfig,
    allTasks?: AITask[],
    features?: FeatureRequirement[]
  ): Promise<{ context: Partial<TaskExecutionContext>; tokenUsage: number }> {
    const enhancedContext: Partial<TaskExecutionContext> = {};
    let totalTokens = 0;

    try {
      // FR-1: Generate business context if enabled
      if (config.includeBusinessContext) {
        const businessContext = await this.generateBusinessContext(task, prdContent);
        if (businessContext) {
          enhancedContext.businessObjective = businessContext.businessObjective;
          enhancedContext.userImpact = businessContext.userImpact;
          enhancedContext.successMetrics = businessContext.successMetrics;
          totalTokens += 300; // Estimate
        }
      }

      // FR-2: Generate technical context if enabled
      let technicalContext: any = null;
      if (config.includeTechnicalContext) {
        technicalContext = await this.generateTechnicalContext(task, prdContent);
        if (technicalContext) {
          enhancedContext.technicalConstraints = technicalContext.technicalConstraints;
          enhancedContext.architecturalDecisions = technicalContext.architecturalDecisions.map((ad: any) => ad.decision);
          enhancedContext.integrationPoints = technicalContext.integrationPoints.map((ip: any) => ip.description);
          enhancedContext.dataRequirements = technicalContext.dataRequirements.map((dr: any) => dr.description);
          totalTokens += 400; // Estimate
        }
      }

      // FR-3: Generate implementation guidance if enabled
      if (config.includeImplementationGuidance) {
        const guidance = await this.generateImplementationGuidance(task, enhancedContext, technicalContext);
        if (guidance) {
          enhancedContext.implementationGuidance = guidance;
          totalTokens += 500; // Estimate
        }
      }

      // FR-4: Generate contextual references (NEW!)
      const contextualRefs = await this.contextualRefGenerator.generateReferences(
        task,
        prdContent,
        features
      );
      if (contextualRefs) {
        enhancedContext.contextualReferences = contextualRefs;
        totalTokens += 400; // Estimate
      }

      // FR-5: Generate enhanced acceptance criteria (integration)
      // Note: This is handled in the task generation pipeline

      // FR-6: Generate dependency context (NEW!)
      if (allTasks && task.dependencies && task.dependencies.length > 0) {
        const depContext = await this.dependencyContextGenerator.generateDependencyContext(
          task,
          allTasks,
          task.dependencies
        );
        if (depContext) {
          enhancedContext.dependencyContext = depContext;
          totalTokens += 300; // Estimate
        }
      }

      return {
        context: enhancedContext,
        tokenUsage: totalTokens
      };

    } catch (error) {
      process.stderr.write(`Error generating AI-enhanced context: ${error instanceof Error ? error.message : String(error)}\n`);
      return { context: {}, tokenUsage: totalTokens };
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
  ): Promise<any> {
    try {
      // Use the code example generator for implementation guidance
      const codeExamples = await this.codeExampleGenerator.generateExamples(
        task,
        technicalContext,
        3
      );

      const model = this.aiFactory.getBestAvailableModel();
      if (!model) {
        // Return basic guidance without AI
        return {
          recommendedApproach: `Implement ${task.title} following best practices`,
          implementationSteps: [
            'Review requirements and acceptance criteria',
            'Design the solution architecture',
            'Implement core functionality',
            'Write comprehensive tests',
            'Review and refactor code',
            'Document the implementation'
          ],
          technicalConsiderations: ['Follow coding standards', 'Ensure proper error handling'],
          commonPitfalls: ['Not handling edge cases', 'Insufficient testing'],
          testingStrategy: 'Write unit tests for all functionality',
          recommendedTools: [],
          codeQualityStandards: ['Follow linting rules', 'Maintain test coverage'],
          performanceConsiderations: ['Optimize for performance'],
          securityConsiderations: ['Follow security best practices']
        };
      }

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
        schema: config.schema,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Merge with code examples
      const guidance = this.transformImplementationGuidance(result.object);
      if (codeExamples.length > 0 && guidance.contextualReferences) {
        guidance.contextualReferences = {
          ...guidance.contextualReferences,
          codeExamples
        };
      }

      return guidance;
    } catch (error) {
      process.stderr.write(`Error generating implementation guidance: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
  }

  /**
   * Transform AI implementation guidance to our format
   */
  private transformImplementationGuidance(aiGuidance: any): any {
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
   * Calculate context completeness score
   */
  private calculateContextCompleteness(context: Partial<TaskExecutionContext>): number {
    // Import the function from schemas
    const { calculateCompletenessScore } = require('../domain/task-context-schemas');
    return calculateCompletenessScore(context);
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
   * Validate context quality and generate report
   */
  validateContextQuality(
    task: AITask,
    context: TaskExecutionContext,
    metrics: ContextQualityMetrics
  ) {
    return this.qualityValidator.generateQualityReport(task, context, metrics);
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
