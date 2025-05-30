import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './ai/AIServiceFactory.js';
import {
  FeatureAdditionRequest,
  FeatureExpansionResult,
  TaskLifecycleState,
  ProjectFeatureRoadmap,
  FeatureRequirement,
  AITask,
  PRDDocument,
  TaskPriority,
  TaskStatus,
  TaskComplexity,
  AITaskSchema,
  FeatureRequirementSchema,
  FeatureAdditionRequestSchema
} from '../domain/ai-types.js';
import {
  FEATURE_PROMPT_CONFIGS,
  formatFeaturePrompt
} from './ai/prompts/FeatureAdditionPrompts.js';
import { TaskGenerationService } from './TaskGenerationService.js';
import { PRDGenerationService } from './PRDGenerationService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing feature additions and complete task lifecycle
 */
export class FeatureManagementService {
  private aiFactory: AIServiceFactory;
  private taskService: TaskGenerationService;
  private prdService: PRDGenerationService;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
    this.taskService = new TaskGenerationService();
    this.prdService = new PRDGenerationService();
  }

  /**
   * Analyze a new feature request
   */
  async analyzeFeatureRequest(params: {
    featureIdea: string;
    description: string;
    existingPRD?: PRDDocument;
    projectState?: any;
    businessJustification?: string;
    targetUsers?: string[];
    requestedBy: string;
  }): Promise<{
    analysis: string;
    recommendation: 'approve' | 'reject' | 'modify';
    priority: TaskPriority;
    complexity: TaskComplexity;
    estimatedEffort: number;
    risks: string[];
    dependencies: string[];
  }> {
    try {
      const config = FEATURE_PROMPT_CONFIGS.analyzeRequest;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
        throw new Error('AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).');
      }

      const prompt = formatFeaturePrompt(config.userPrompt, {
        featureIdea: params.featureIdea,
        description: params.description,
        existingPRD: params.existingPRD ? JSON.stringify(params.existingPRD, null, 2) : 'No existing PRD provided',
        projectState: params.projectState ? JSON.stringify(params.projectState) : 'No project state provided',
        businessJustification: params.businessJustification || 'No business justification provided',
        targetUsers: params.targetUsers?.join(', ') || 'General users'
      });

      const result = await generateText({
        model,
        system: config.systemPrompt,
        prompt,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Parse the analysis (in a real implementation, use structured output)
      const analysis = result.text;

      // Extract key information (simplified - would use structured output in production)
      const recommendation = this.extractRecommendation(analysis);
      const priority = this.extractPriority(analysis);
      const complexity = this.extractComplexity(analysis);

      return {
        analysis,
        recommendation,
        priority,
        complexity,
        estimatedEffort: complexity * 8, // 8 hours per complexity point
        risks: this.extractRisks(analysis),
        dependencies: this.extractDependencies(analysis)
      };
    } catch (error) {
      process.stderr.write(`Error analyzing feature request: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to analyze feature request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a new feature to an existing PRD
   */
  async addFeatureToPRD(params: {
    featureRequest: FeatureAdditionRequest;
    targetPRD: PRDDocument;
    autoApprove?: boolean;
  }): Promise<{
    updatedPRD: PRDDocument;
    newFeature: FeatureRequirement;
    impactAssessment: string;
  }> {
    try {
      // First analyze the feature request
      const analysis = await this.analyzeFeatureRequest({
        featureIdea: params.featureRequest.featureIdea,
        description: params.featureRequest.description,
        existingPRD: params.targetPRD,
        businessJustification: params.featureRequest.businessJustification,
        targetUsers: params.featureRequest.targetUsers,
        requestedBy: params.featureRequest.requestedBy
      });

      // Check if feature should be approved
      if (!params.autoApprove && analysis.recommendation !== 'approve') {
        throw new Error(`Feature request not approved: ${analysis.analysis}`);
      }

      // Create the new feature
      const newFeature: FeatureRequirement = {
        id: uuidv4(),
        title: params.featureRequest.featureIdea,
        description: params.featureRequest.description,
        priority: analysis.priority,
        userStories: [
          `As a user, I want ${params.featureRequest.featureIdea.toLowerCase()} so that I can achieve my goals more effectively`
        ],
        acceptanceCriteria: [
          'Feature is implemented according to specifications',
          'Feature integrates seamlessly with existing functionality',
          'Feature passes all quality gates'
        ],
        estimatedComplexity: analysis.complexity,
        dependencies: analysis.dependencies
      };

      // Update the PRD with the new feature
      const updatedPRD: PRDDocument = {
        ...params.targetPRD,
        features: [...params.targetPRD.features, newFeature],
        updatedAt: new Date().toISOString(),
        version: this.incrementVersion(params.targetPRD.version)
      };

      // Assess impact on existing features
      const impactAssessment = await this.assessFeatureImpact({
        newFeature,
        existingFeatures: params.targetPRD.features,
        systemContext: params.targetPRD.technicalRequirements
      });

      return {
        updatedPRD,
        newFeature,
        impactAssessment
      };
    } catch (error) {
      process.stderr.write(`Error adding feature to PRD: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to add feature to PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Expand a feature into complete task breakdown
   */
  async expandFeatureToTasks(params: {
    feature: FeatureRequirement;
    systemContext?: any;
    integrationPoints?: string[];
    teamSkills?: string[];
  }): Promise<FeatureExpansionResult> {
    try {
      const config = FEATURE_PROMPT_CONFIGS.expandToTasks;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
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
        maxTokens: config.maxTokens,
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

      // Detect dependencies between tasks
      const tasksWithDependencies = await this.taskService.detectTaskDependencies(tasks);

      // Calculate total effort
      const totalEffort = tasksWithDependencies.reduce((sum, task) => sum + task.estimatedHours, 0);

      // Assess risks
      const riskAssessment = this.assessImplementationRisks(tasksWithDependencies, params.feature);

      return {
        feature: params.feature,
        tasks: tasksWithDependencies,
        dependencies: this.extractTaskDependencies(tasksWithDependencies),
        estimatedEffort: totalEffort,
        suggestedMilestone: this.suggestMilestone(totalEffort, params.feature.priority),
        riskAssessment
      };
    } catch (error) {
      process.stderr.write(`Error expanding feature to tasks: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to expand feature to tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create complete feature lifecycle from idea to implementation
   */
  async createCompleteFeatureLifecycle(params: {
    featureIdea: string;
    description: string;
    targetPRD?: PRDDocument;
    targetProject?: string;
    requestedBy: string;
    businessJustification?: string;
    autoApprove?: boolean;
  }): Promise<{
    featureRequest: FeatureAdditionRequest;
    analysis: any;
    updatedPRD?: PRDDocument;
    expansionResult: FeatureExpansionResult;
    lifecycleStates: TaskLifecycleState[];
    roadmapUpdate?: ProjectFeatureRoadmap;
  }> {
    try {
      // Step 1: Create feature request
      const featureRequest: FeatureAdditionRequest = {
        id: uuidv4(),
        featureIdea: params.featureIdea,
        description: params.description,
        targetPRD: params.targetPRD?.id,
        targetProject: params.targetProject,
        requestedBy: params.requestedBy,
        businessJustification: params.businessJustification,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      // Step 2: Analyze the feature request
      const analysis = await this.analyzeFeatureRequest({
        featureIdea: params.featureIdea,
        description: params.description,
        existingPRD: params.targetPRD,
        businessJustification: params.businessJustification,
        requestedBy: params.requestedBy
      });

      // Step 3: Add to PRD if approved and PRD exists
      let updatedPRD: PRDDocument | undefined;
      let newFeature: FeatureRequirement;

      if (params.targetPRD && (params.autoApprove || analysis.recommendation === 'approve')) {
        const prdResult = await this.addFeatureToPRD({
          featureRequest,
          targetPRD: params.targetPRD,
          autoApprove: params.autoApprove
        });
        updatedPRD = prdResult.updatedPRD;
        newFeature = prdResult.newFeature;
      } else {
        // Create standalone feature
        newFeature = {
          id: uuidv4(),
          title: params.featureIdea,
          description: params.description,
          priority: analysis.priority,
          userStories: [`As a user, I want ${params.featureIdea.toLowerCase()}`],
          acceptanceCriteria: ['Feature meets requirements'],
          estimatedComplexity: analysis.complexity,
          dependencies: analysis.dependencies
        };
      }

      // Step 4: Expand feature to tasks
      const expansionResult = await this.expandFeatureToTasks({
        feature: newFeature
      });

      // Step 5: Create lifecycle states for all tasks
      const lifecycleStates = expansionResult.tasks.map(task =>
        this.createInitialTaskLifecycleState(task)
      );

      // Step 6: Update roadmap if needed
      let roadmapUpdate: ProjectFeatureRoadmap | undefined;
      if (params.targetProject) {
        roadmapUpdate = await this.updateProjectRoadmap({
          projectId: params.targetProject,
          newFeature,
          estimatedEffort: expansionResult.estimatedEffort
        });
      }

      return {
        featureRequest,
        analysis,
        updatedPRD,
        expansionResult,
        lifecycleStates,
        roadmapUpdate
      };
    } catch (error) {
      process.stderr.write(`Error creating complete feature lifecycle: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to create feature lifecycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track and update task lifecycle state
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
      blockers?: any[];
    };
  }): Promise<TaskLifecycleState> {
    try {
      const updatedState = { ...params.currentState };

      // Update the specific phase if provided
      if (params.updateData.phase && params.updateData.status) {
        const phase = params.updateData.phase as keyof typeof updatedState.phases;
        if (updatedState.phases[phase]) {
          updatedState.phases[phase] = {
            ...updatedState.phases[phase],
            status: params.updateData.status as any,
            assignee: params.updateData.assignee,
            notes: params.updateData.notes,
            artifacts: params.updateData.artifacts || updatedState.phases[phase].artifacts
          };

          // Update timestamps
          if (params.updateData.status === 'in_progress' && !updatedState.phases[phase].startedAt) {
            updatedState.phases[phase].startedAt = new Date().toISOString();
          }
          if (params.updateData.status === 'completed') {
            updatedState.phases[phase].completedAt = new Date().toISOString();
          }
        }
      }

      // Update blockers if provided
      if (params.updateData.blockers) {
        updatedState.blockers = params.updateData.blockers;
      }

      // Recalculate progress
      updatedState.progressPercentage = this.calculateTaskProgress(updatedState);

      // Update current phase based on progress
      updatedState.currentPhase = this.determineCurrentPhase(updatedState);

      return updatedState;
    } catch (error) {
      process.stderr.write(`Error updating task lifecycle: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to update task lifecycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get next recommended actions for a task
   */
  async getNextTaskActions(taskLifecycle: TaskLifecycleState): Promise<{
    nextActions: string[];
    blockers: string[];
    recommendations: string[];
    estimatedCompletion: string;
  }> {
    try {
      const config = FEATURE_PROMPT_CONFIGS.trackLifecycle;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
        throw new Error('AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).');
      }

      const prompt = formatFeaturePrompt(config.userPrompt, {
        taskTitle: `Task ${taskLifecycle.taskId}`,
        currentPhase: taskLifecycle.currentPhase,
        progressData: JSON.stringify(taskLifecycle.phases),
        blockers: JSON.stringify(taskLifecycle.blockers),
        teamContext: 'Standard development team'
      });

      const result = await generateText({
        model,
        system: config.systemPrompt,
        prompt,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      // Parse recommendations (simplified - would use structured output in production)
      const analysis = result.text;

      return {
        nextActions: this.extractNextActions(analysis),
        blockers: taskLifecycle.blockers.map(b => b.description),
        recommendations: this.extractRecommendations(analysis),
        estimatedCompletion: this.calculateEstimatedCompletion(taskLifecycle)
      };
    } catch (error) {
      process.stderr.write(`Error getting next task actions: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to get next actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods
  private extractRecommendation(analysis: string): 'approve' | 'reject' | 'modify' {
    if (analysis.toLowerCase().includes('approve')) return 'approve';
    if (analysis.toLowerCase().includes('reject')) return 'reject';
    return 'modify';
  }

  private extractPriority(analysis: string): TaskPriority {
    if (analysis.toLowerCase().includes('critical')) return TaskPriority.CRITICAL;
    if (analysis.toLowerCase().includes('high')) return TaskPriority.HIGH;
    if (analysis.toLowerCase().includes('low')) return TaskPriority.LOW;
    return TaskPriority.MEDIUM;
  }

  private extractComplexity(analysis: string): TaskComplexity {
    const match = analysis.match(/complexity.*?(\d+)/i);
    if (match) {
      const complexity = parseInt(match[1]);
      return Math.min(Math.max(complexity, 1), 10) as TaskComplexity;
    }
    return 5;
  }

  private extractRisks(analysis: string): string[] {
    // Simplified risk extraction
    return ['Technical complexity', 'Integration challenges', 'Resource constraints'];
  }

  private extractDependencies(analysis: string): string[] {
    // Simplified dependency extraction
    return [];
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 3) {
      const minor = parseInt(parts[1]) + 1;
      return `${parts[0]}.${minor}.0`;
    }
    return version;
  }

  private async assessFeatureImpact(params: {
    newFeature: FeatureRequirement;
    existingFeatures: FeatureRequirement[];
    systemContext: any;
  }): Promise<string> {
    // Simplified impact assessment
    return `Adding ${params.newFeature.title} will require integration with ${params.existingFeatures.length} existing features.`;
  }

  private assessImplementationRisks(tasks: AITask[], feature: FeatureRequirement): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  } {
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

  private extractTaskDependencies(tasks: AITask[]): any[] {
    return tasks.flatMap(task => task.dependencies);
  }

  private suggestMilestone(effort: number, priority: TaskPriority): string {
    if (priority === TaskPriority.CRITICAL) return 'Current Sprint';
    if (effort <= 40) return 'Next Sprint';
    if (effort <= 120) return 'Current Quarter';
    return 'Next Quarter';
  }

  private createInitialTaskLifecycleState(task: AITask): TaskLifecycleState {
    const basePhase = {
      status: 'not_started' as const,
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
      estimatedCompletion: new Date(Date.now() + task.estimatedHours * 60 * 60 * 1000).toISOString()
    };
  }

  private calculateTaskProgress(state: TaskLifecycleState): number {
    const phases = Object.values(state.phases);
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    return Math.round((completedPhases / phases.length) * 100);
  }

  private determineCurrentPhase(state: TaskLifecycleState): TaskLifecycleState['currentPhase'] {
    const phaseOrder: (keyof TaskLifecycleState['phases'])[] = ['planning', 'development', 'testing', 'review', 'deployment'];

    for (const phase of phaseOrder) {
      if (state.phases[phase].status !== 'completed') {
        return phase;
      }
    }
    return 'completed';
  }

  private async updateProjectRoadmap(params: {
    projectId: string;
    newFeature: FeatureRequirement;
    estimatedEffort: number;
  }): Promise<ProjectFeatureRoadmap> {
    // Simplified roadmap update
    return {
      projectId: params.projectId,
      features: {
        current: [],
        planned: [params.newFeature],
        backlog: []
      },
      timeline: {
        quarters: {
          'Q1-2024': {
            features: [params.newFeature.id],
            themes: ['Feature Enhancement'],
            goals: ['Implement new feature']
          }
        }
      },
      dependencies: {}
    };
  }

  private extractNextActions(analysis: string): string[] {
    return ['Review requirements', 'Start implementation', 'Set up testing environment'];
  }

  private extractRecommendations(analysis: string): string[] {
    return ['Focus on core functionality first', 'Implement comprehensive testing', 'Plan for gradual rollout'];
  }

  private calculateEstimatedCompletion(state: TaskLifecycleState): string {
    // Simple calculation based on current progress
    const remainingWork = (100 - state.progressPercentage) / 100;
    const estimatedDays = remainingWork * 5; // Assume 5 days total work
    return new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString();
  }
}
