import { AITaskProcessor } from './ai/AITaskProcessor';
import {
  AITask,
  SubTask,
  PRDDocument,
  TaskPriority,
  TaskStatus,
  TaskComplexity,
  TaskDependency,
  AcceptanceCriteria
} from '../domain/ai-types';
import {
  MAX_TASKS_PER_PRD,
  MAX_SUBTASK_DEPTH,
  AUTO_DEPENDENCY_DETECTION,
  AUTO_EFFORT_ESTIMATION,
  ENHANCED_TASK_GENERATION,
  AUTO_CREATE_TRACEABILITY,
  AUTO_GENERATE_USE_CASES,
  AUTO_CREATE_LIFECYCLE,
  ENHANCED_CONTEXT_LEVEL,
  INCLUDE_BUSINESS_CONTEXT,
  INCLUDE_TECHNICAL_CONTEXT,
  INCLUDE_IMPLEMENTATION_GUIDANCE
} from '../env';
import {
  EnhancedTaskGenerationConfig,
  EnhancedTaskGenerationParams,
  EnhancedAITask
} from '../domain/ai-types';
import { RequirementsTraceabilityService } from './RequirementsTraceabilityService';
import { TaskContextGenerationService } from './TaskContextGenerationService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for generating and managing AI-powered tasks
 */
export class TaskGenerationService {
  private aiProcessor: AITaskProcessor;
  private traceabilityService: RequirementsTraceabilityService;
  private contextGenerationService: TaskContextGenerationService;

  constructor() {
    this.aiProcessor = new AITaskProcessor();
    this.traceabilityService = new RequirementsTraceabilityService();
    this.contextGenerationService = new TaskContextGenerationService();
  }

  /**
   * Get default enhanced task generation configuration from environment
   */
  private getDefaultEnhancedConfig(): EnhancedTaskGenerationConfig {
    return {
      enableEnhancedGeneration: ENHANCED_TASK_GENERATION,
      createTraceabilityMatrix: AUTO_CREATE_TRACEABILITY,
      generateUseCases: AUTO_GENERATE_USE_CASES,
      createLifecycleTracking: AUTO_CREATE_LIFECYCLE,
      contextLevel: ENHANCED_CONTEXT_LEVEL as 'minimal' | 'standard' | 'full',
      includeBusinessContext: INCLUDE_BUSINESS_CONTEXT,
      includeTechnicalContext: INCLUDE_TECHNICAL_CONTEXT,
      includeImplementationGuidance: INCLUDE_IMPLEMENTATION_GUIDANCE,
      enforceTraceability: AUTO_CREATE_TRACEABILITY,
      requireBusinessJustification: INCLUDE_BUSINESS_CONTEXT,
      trackRequirementCoverage: AUTO_CREATE_TRACEABILITY
    };
  }

  /**
   * Generate enhanced task list from PRD with full traceability and context
   */
  async generateEnhancedTasksFromPRD(params: EnhancedTaskGenerationParams): Promise<EnhancedAITask[]> {
    const config = { ...this.getDefaultEnhancedConfig(), ...params.enhancedConfig };

    if (!config.enableEnhancedGeneration) {
      // Fall back to basic task generation
      const basicTasks = await this.generateBasicTasksFromPRD(params);
      return basicTasks.map(task => ({ ...task } as EnhancedAITask));
    }

    try {
      const prdContent = typeof params.prd === 'string'
        ? params.prd
        : JSON.stringify(params.prd, null, 2);

      // Generate basic tasks first
      const basicTasks = await this.generateBasicTasksFromPRD(params);

      // Create traceability matrix if enabled
      let traceabilityMatrix;
      if (config.createTraceabilityMatrix) {
        // Create mock PRD for traceability
        const mockPRD = {
          id: params.projectId || `prd-${Date.now()}`,
          title: 'Generated PRD',
          overview: prdContent.substring(0, 500),
          objectives: params.businessObjectives || ['Deliver high-quality software solution'],
          successMetrics: ['User satisfaction > 90%'],
          features: [],
          author: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          aiGenerated: true,
          aiMetadata: {
            generatedBy: 'enhanced-task-generation',
            generatedAt: new Date().toISOString(),
            prompt: 'Enhanced task generation from PRD',
            confidence: 0.8,
            version: '1.0.0'
          }
        };

        traceabilityMatrix = this.traceabilityService.createTraceabilityMatrix(
          params.projectId || 'enhanced-project',
          mockPRD as any,
          [], // Features will be extracted
          basicTasks
        );
      }

      // Enhance tasks with context generation
      const enhancedTasks = await this.enhanceTasksWithContext(
        basicTasks,
        prdContent,
        config,
        traceabilityMatrix
      );

      return enhancedTasks;
    } catch (error) {
      process.stderr.write(`Error generating enhanced tasks from PRD: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate enhanced tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate comprehensive task list from PRD (legacy method - now uses enhanced generation by default)
   */
  async generateTasksFromPRD(params: {
    prd: PRDDocument | string;
    maxTasks?: number;
    includeSubtasks?: boolean;
    autoEstimate?: boolean;
    autoPrioritize?: boolean;
  }): Promise<AITask[]> {
    // Check if enhanced generation is enabled by default
    if (ENHANCED_TASK_GENERATION) {
      const enhancedParams: EnhancedTaskGenerationParams = {
        ...params,
        enhancedConfig: this.getDefaultEnhancedConfig()
      };
      const enhancedTasks = await this.generateEnhancedTasksFromPRD(enhancedParams);
      return enhancedTasks as AITask[]; // Return as basic tasks for backward compatibility
    }

    // Fall back to basic generation
    return this.generateBasicTasksFromPRD(params);
  }

  /**
   * Generate basic task list from PRD (without enhanced features)
   */
  async generateBasicTasksFromPRD(params: {
    prd: PRDDocument | string;
    maxTasks?: number;
    includeSubtasks?: boolean;
    autoEstimate?: boolean;
    autoPrioritize?: boolean;
  }): Promise<AITask[]> {
    try {
      const prdContent = typeof params.prd === 'string'
        ? params.prd
        : JSON.stringify(params.prd, null, 2);

      // Generate initial tasks using AI
      let tasks = await this.aiProcessor.generateTasksFromPRD({
        prdContent,
        maxTasks: params.maxTasks || MAX_TASKS_PER_PRD,
        includeSubtasks: params.includeSubtasks ?? true,
        autoEstimate: params.autoEstimate ?? AUTO_EFFORT_ESTIMATION
      });

      // Auto-prioritize if requested
      if (params.autoPrioritize) {
        tasks = await this.prioritizeTaskList({
          tasks,
          projectGoals: typeof params.prd === 'object' ? params.prd.objectives.join(', ') : undefined
        });
      }

      // Auto-detect dependencies if enabled
      if (AUTO_DEPENDENCY_DETECTION) {
        tasks = await this.detectTaskDependencies(tasks);
      }

      // Ensure all tasks have required metadata
      return tasks.map(task => this.enrichTaskMetadata(task, params.prd));
    } catch (error) {
      process.stderr.write(`Error generating basic tasks from PRD: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate basic tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance tasks with comprehensive context
   */
  private async enhanceTasksWithContext(
    basicTasks: AITask[],
    prdContent: string,
    config: EnhancedTaskGenerationConfig,
    traceabilityMatrix?: any
  ): Promise<EnhancedAITask[]> {
    const enhancedTasks: EnhancedAITask[] = [];

    for (const task of basicTasks) {
      try {
        // Start with traceability-enhanced task if available
        let enhancedTask: EnhancedAITask;
        if (config.createTraceabilityMatrix && traceabilityMatrix) {
          const traceabilityTask = traceabilityMatrix.tasks.find((t: any) => t.id === task.id);
          enhancedTask = traceabilityTask || { ...task } as EnhancedAITask;
        } else {
          enhancedTask = { ...task } as EnhancedAITask;
        }

        // Generate comprehensive context
        const executionContext = await this.contextGenerationService.generateTaskContext(
          task,
          prdContent,
          config
        );

        // Add execution context to the task
        enhancedTask.executionContext = executionContext;

        // Generate implementation guidance if enabled
        if (config.includeImplementationGuidance) {
          const implementationGuidance = await this.contextGenerationService.generateImplementationGuidance(
            task
          );
          if (implementationGuidance) {
            enhancedTask.implementationGuidance = implementationGuidance;
          }
        }

        // Enhance acceptance criteria
        enhancedTask.enhancedAcceptanceCriteria = this.enhanceAcceptanceCriteria(task.acceptanceCriteria);

        enhancedTasks.push(enhancedTask);
      } catch (error) {
        process.stderr.write(`Error enhancing task ${task.id}: ${error instanceof Error ? error.message : String(error)}\n`);
        // Fallback to basic enhanced task
        enhancedTasks.push({ ...task } as EnhancedAITask);
      }
    }

    return enhancedTasks;
  }

  /**
   * Enhance basic acceptance criteria with additional details
   */
  private enhanceAcceptanceCriteria(basicCriteria: any[]): any[] {
    return basicCriteria.map((criterion, index) => ({
      id: criterion.id || `ac-${index + 1}`,
      description: criterion.description,
      category: 'functional' as const,
      verificationMethod: 'manual_test' as const,
      verificationDetails: `Verify that: ${criterion.description}`,
      priority: 'must_have' as const,
      completed: criterion.completed || false
    }));
  }

  /**
   * Generate tasks from natural language description
   */
  async generateTasksFromDescription(params: {
    description: string;
    projectType?: string;
    maxTasks?: number;
    complexity?: 'low' | 'medium' | 'high';
  }): Promise<AITask[]> {
    try {
      // Create a minimal PRD-like structure from the description
      const simplePRD = {
        overview: params.description,
        objectives: [`Implement ${params.projectType || 'project'} based on requirements`],
        features: [],
        timeline: '1-3 months'
      };

      return await this.generateTasksFromPRD({
        prd: JSON.stringify(simplePRD),
        maxTasks: params.maxTasks || 20,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true
      });
    } catch (error) {
      process.stderr.write(`Error generating tasks from description: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Expand a task into subtasks
   */
  async expandTaskIntoSubtasks(params: {
    task: AITask;
    maxDepth?: number;
    autoEstimate?: boolean;
  }): Promise<SubTask[]> {
    try {
      if (params.task.subtasks.length > 0) {
        process.stderr.write('Task already has subtasks. Consider using updateTaskSubtasks instead.\n');
      }

      // Use AI to break down the task
      const subtasks = await this.aiProcessor.expandTaskIntoSubtasks({
        taskTitle: params.task.title,
        taskDescription: params.task.description,
        currentComplexity: params.task.complexity,
        maxDepth: params.maxDepth || MAX_SUBTASK_DEPTH
      });

      // Convert to SubTask format and enrich with metadata
      return subtasks.map((subtask: any) => ({
        ...subtask,
        id: subtask.id || uuidv4(),
        parentTaskId: params.task.id,
        status: TaskStatus.PENDING,
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      process.stderr.write(`Error expanding task into subtasks: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to expand task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze and update task complexity
   */
  async analyzeTaskComplexity(task: AITask): Promise<{
    originalComplexity: TaskComplexity;
    newComplexity: TaskComplexity;
    estimatedHours: number;
    analysis: string;
    recommendations: string[];
  }> {
    try {
      const analysis = await this.aiProcessor.analyzeTaskComplexity({
        taskTitle: task.title,
        taskDescription: task.description,
        currentEstimate: task.estimatedHours
      });

      return {
        originalComplexity: task.complexity,
        newComplexity: analysis.complexity as TaskComplexity,
        estimatedHours: analysis.estimatedHours,
        analysis: analysis.analysis,
        recommendations: analysis.recommendations
      };
    } catch (error) {
      process.stderr.write(`Error analyzing task complexity: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to analyze complexity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prioritize a list of tasks using AI
   */
  async prioritizeTaskList(params: {
    tasks: AITask[];
    projectGoals?: string;
    timeline?: string;
    teamSize?: number;
  }): Promise<AITask[]> {
    try {
      return await this.aiProcessor.prioritizeTasks({
        tasks: params.tasks,
        projectGoals: params.projectGoals,
        timeline: params.timeline,
        teamSize: params.teamSize
      });
    } catch (error) {
      process.stderr.write(`Error prioritizing tasks: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to prioritize tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect dependencies between tasks
   */
  async detectTaskDependencies(tasks: AITask[]): Promise<AITask[]> {
    try {
      // For now, implement basic dependency detection logic
      // In a full implementation, you'd use AI to analyze dependencies

      const tasksWithDependencies = tasks.map(task => {
        const dependencies: TaskDependency[] = [];

        // Simple heuristic: setup/infrastructure tasks should be dependencies for feature tasks
        if (task.title.toLowerCase().includes('setup') ||
            task.title.toLowerCase().includes('infrastructure') ||
            task.title.toLowerCase().includes('configuration')) {
          // This is a setup task - other tasks might depend on it
          return { ...task, dependencies };
        }

        // Feature tasks might depend on setup tasks
        const setupTasks = tasks.filter(t =>
          t.id !== task.id && (
            t.title.toLowerCase().includes('setup') ||
            t.title.toLowerCase().includes('infrastructure') ||
            t.title.toLowerCase().includes('database')
          )
        );

        setupTasks.forEach(setupTask => {
          dependencies.push({
            id: setupTask.id,
            type: 'depends_on',
            description: `Requires ${setupTask.title} to be completed first`
          });
        });

        return { ...task, dependencies };
      });

      return tasksWithDependencies;
    } catch (error) {
      process.stderr.write(`Error detecting task dependencies: ${error instanceof Error ? error.message : String(error)}\n`);
      return tasks; // Return original tasks if dependency detection fails
    }
  }

  /**
   * Generate acceptance criteria for a task
   */
  async generateAcceptanceCriteria(task: AITask): Promise<AcceptanceCriteria[]> {
    try {
      // For now, generate basic acceptance criteria
      // In a full implementation, you'd use AI to generate comprehensive criteria

      const criteria: AcceptanceCriteria[] = [
        {
          id: uuidv4(),
          description: `Task "${task.title}" is implemented according to specifications`,
          completed: false
        },
        {
          id: uuidv4(),
          description: 'All unit tests pass',
          completed: false
        },
        {
          id: uuidv4(),
          description: 'Code review is completed and approved',
          completed: false
        }
      ];

      // Add specific criteria based on task type
      if (task.title.toLowerCase().includes('api')) {
        criteria.push({
          id: uuidv4(),
          description: 'API endpoints return correct responses and status codes',
          completed: false
        });
      }

      if (task.title.toLowerCase().includes('ui') || task.title.toLowerCase().includes('frontend')) {
        criteria.push({
          id: uuidv4(),
          description: 'UI is responsive and accessible',
          completed: false
        });
      }

      return criteria;
    } catch (error) {
      process.stderr.write(`Error generating acceptance criteria: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate acceptance criteria: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate effort for a task
   */
  async estimateTaskEffort(task: AITask): Promise<{
    estimatedHours: number;
    breakdown: {
      analysis: number;
      implementation: number;
      testing: number;
      documentation: number;
    };
    confidence: 'high' | 'medium' | 'low';
    factors: string[];
  }> {
    try {
      // Simple effort estimation based on complexity
      const baseHours = task.complexity * 3; // 3 hours per complexity point

      const breakdown = {
        analysis: Math.round(baseHours * 0.15),
        implementation: Math.round(baseHours * 0.60),
        testing: Math.round(baseHours * 0.20),
        documentation: Math.round(baseHours * 0.05)
      };

      const totalHours = Object.values(breakdown).reduce((sum, hours) => sum + hours, 0);

      return {
        estimatedHours: totalHours,
        breakdown,
        confidence: task.complexity <= 5 ? 'high' : task.complexity <= 7 ? 'medium' : 'low',
        factors: [
          `Complexity level: ${task.complexity}/10`,
          `Task type: ${this.getTaskType(task)}`,
          `Dependencies: ${task.dependencies.length} identified`
        ]
      };
    } catch (error) {
      process.stderr.write(`Error estimating task effort: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to estimate effort: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recommended next tasks based on current project state
   */
  async getRecommendedNextTasks(params: {
    allTasks: AITask[];
    completedTaskIds: string[];
    currentSprintCapacity?: number;
    teamSkills?: string[];
  }): Promise<AITask[]> {
    try {
      const availableTasks = params.allTasks.filter(task =>
        !params.completedTaskIds.includes(task.id) &&
        task.status !== TaskStatus.DONE &&
        this.areTaskDependenciesMet(task, params.completedTaskIds)
      );

      // Sort by priority and complexity
      const sortedTasks = availableTasks.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, prefer lower complexity (easier to complete)
        return a.complexity - b.complexity;
      });

      // Return top tasks that fit within sprint capacity
      const capacity = params.currentSprintCapacity || 40; // Default 40 hours
      const recommendedTasks: AITask[] = [];
      let totalHours = 0;

      for (const task of sortedTasks) {
        if (totalHours + task.estimatedHours <= capacity) {
          recommendedTasks.push(task);
          totalHours += task.estimatedHours;
        }
      }

      return recommendedTasks;
    } catch (error) {
      process.stderr.write(`Error getting recommended next tasks: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if task dependencies are met
   */
  private areTaskDependenciesMet(task: AITask, completedTaskIds: string[]): boolean {
    return task.dependencies
      .filter(dep => dep.type === 'depends_on' || dep.type === 'blocks')
      .every(dep => completedTaskIds.includes(dep.id));
  }

  /**
   * Enrich task with additional metadata
   */
  private enrichTaskMetadata(task: AITask, prd: PRDDocument | string): AITask {
    return {
      ...task,
      sourcePRD: typeof prd === 'object' ? prd.id : 'external',
      tags: [
        ...task.tags,
        this.getTaskType(task),
        `complexity-${task.complexity}`,
        `priority-${task.priority}`
      ].filter((tag, index, arr) => arr.indexOf(tag) === index) // Remove duplicates
    };
  }

  /**
   * Determine task type based on title and description
   */
  private getTaskType(task: AITask): string {
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();

    if (title.includes('setup') || title.includes('config')) return 'setup';
    if (title.includes('api') || description.includes('endpoint')) return 'backend';
    if (title.includes('ui') || title.includes('frontend')) return 'frontend';
    if (title.includes('test') || description.includes('testing')) return 'testing';
    if (title.includes('deploy') || title.includes('infrastructure')) return 'devops';
    if (title.includes('database') || title.includes('migration')) return 'database';
    if (title.includes('documentation') || title.includes('docs')) return 'documentation';

    return 'feature';
  }
}
