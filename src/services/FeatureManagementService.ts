import { v4 as uuidv4 } from 'uuid';
import { AIServiceFactory } from './ai/AIServiceFactory.js';
import { type ILogger, Logger } from '../infrastructure/logger';
import type {
  FeatureAdditionRequest,
  FeatureExpansionResult,
  TaskLifecycleState,
  ProjectFeatureRoadmap,
  FeatureRequirement,
  PRDDocument
} from '../domain/ai-types.js';
import { FeatureAnalysisService } from './feature/FeatureAnalysisService.js';
import { FeaturePRDService } from './feature/FeaturePRDService.js';
import { FeatureExpansionService } from './feature/FeatureExpansionService.js';
import { TaskLifecycleService } from './feature/TaskLifecycleService.js';
import { safeCall } from './utils/safeCall';

/**
 * Thin orchestrator that composes the four feature-management sub-services.
 *
 * **SRP note:** This class was previously responsible for feature analysis,
 * PRD mutation, task expansion, and lifecycle tracking — four distinct
 * responsibilities that have been extracted into dedicated services.  The
 * orchestrator now only wires them together and exposes convenience
 * entry-points (`addFeatureToPRD`, `expandFeatureToTasks`,
 * `updateTaskLifecycle`, `getNextTaskActions`).
 *
 * Prefer the individual sub-services for direct, targeted access.
 */
export class FeatureManagementService {
  private readonly analysisService: FeatureAnalysisService;
  private readonly prdService: FeaturePRDService;
  private readonly expansionService: FeatureExpansionService;
  private readonly lifecycleService: TaskLifecycleService;
  private readonly logger: ILogger;

  /**
   * @param aiFactory - AI service factory for model access. When omitted (DI mode),
   *   defaults to the global singleton via `AIServiceFactory.getInstance()`.
   *   Passed through to all four sub-services.
   * @param logger - Logger instance for diagnostics. When omitted, defaults to
   *   the global singleton via `Logger.getInstance()`.
   */
  constructor(aiFactory?: AIServiceFactory, logger?: ILogger) {
    const factory = aiFactory ?? AIServiceFactory.getInstance();
    this.analysisService = new FeatureAnalysisService(factory);
    this.prdService = new FeaturePRDService(this.analysisService);
    this.expansionService = new FeatureExpansionService(factory);
    this.lifecycleService = new TaskLifecycleService(factory);
    this.logger = logger ?? Logger.getInstance();
  }

  // ---------------------------------------------------------------------------
  // Convenience delegates (preserves backward-compatible API)
  // ---------------------------------------------------------------------------

  /** @see FeatureAnalysisService.analyzeFeatureRequest */
  async analyzeFeatureRequest(params: {
    featureIdea: string;
    description: string;
    existingPRD?: PRDDocument;
    projectState?: any;
    businessJustification?: string;
    targetUsers?: string[];
    requestedBy: string;
  }) {
    return this.analysisService.analyzeFeatureRequest(params);
  }

  /** @see FeaturePRDService.addFeatureToPRD */
  async addFeatureToPRD(params: {
    featureRequest: FeatureAdditionRequest;
    targetPRD: PRDDocument;
    autoApprove?: boolean;
  }) {
    return this.prdService.addFeatureToPRD(params);
  }

  /** @see FeatureExpansionService.expandFeatureToTasks */
  async expandFeatureToTasks(params: {
    feature: FeatureRequirement;
    systemContext?: any;
    integrationPoints?: string[];
    teamSkills?: string[];
  }): Promise<FeatureExpansionResult> {
    return this.expansionService.expandFeatureToTasks(params);
  }

  /** @see TaskLifecycleService.updateTaskLifecycle */
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
    return this.lifecycleService.updateTaskLifecycle(params);
  }

  /** @see TaskLifecycleService.getNextTaskActions */
  async getNextTaskActions(taskLifecycle: TaskLifecycleState) {
    return this.lifecycleService.getNextTaskActions(taskLifecycle);
  }

  // ---------------------------------------------------------------------------
  // Orchestration: createCompleteFeatureLifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create complete feature lifecycle from idea to implementation.
   * This is the main orchestrator method that chains analysis → PRD → expansion
   * → lifecycle and (optionally) roadmap updates.
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
    return safeCall(async () => {
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

      // Step 2: Analyse the feature request
      const analysis = await this.analysisService.analyzeFeatureRequest({
        featureIdea: params.featureIdea,
        description: params.description,
        existingPRD: params.targetPRD,
        businessJustification: params.businessJustification,
        requestedBy: params.requestedBy
      });

      // Step 3: Add to PRD if approved and PRD exists
      let updatedPRD: any | undefined;
      let newFeature: FeatureRequirement;

      if (params.targetPRD && (params.autoApprove || analysis.recommendation === 'approve')) {
        const prdResult = await this.prdService.addFeatureToPRD({
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
      const expansionResult = await this.expansionService.expandFeatureToTasks({
        feature: newFeature
      });

      // Step 5: Create lifecycle states for all tasks
      const lifecycleStates = expansionResult.tasks.map(task =>
        this.lifecycleService.createInitialTaskLifecycleState(task)
      );

      // Step 6: Update roadmap if needed
      let roadmapUpdate: ProjectFeatureRoadmap | undefined;
      if (params.targetProject) {
        roadmapUpdate = this.createRoadmapUpdate({
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
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers (orchestration-specific, not belonging to any sub-service)
  // ---------------------------------------------------------------------------

  private createRoadmapUpdate(params: {
    projectId: string;
    newFeature: FeatureRequirement;
    estimatedEffort: number;
  }): ProjectFeatureRoadmap {
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
}
