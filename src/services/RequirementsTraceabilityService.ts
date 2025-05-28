import {
  Requirement,
  RequirementType,
  RequirementStatus,
  TraceabilityLink,
  TraceabilityLinkType,
  UseCase,
  EnhancedFeatureRequirement,
  EnhancedAITask,
  TraceabilityMatrix,
  PRDDocument,
  FeatureRequirement,
  AITask,
  TaskPriority,
  TaskComplexity,
  UseCaseStep,
  AlternativeScenario,
  ExceptionScenario
} from '../domain/ai-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing comprehensive requirements traceability
 */
export class RequirementsTraceabilityService {

  /**
   * Extract business requirements from PRD
   */
  extractBusinessRequirementsFromPRD(prd: PRDDocument): Requirement[] {
    const requirements: Requirement[] = [];

    // Extract from objectives
    prd.objectives.forEach((objective, index) => {
      requirements.push({
        id: `br-${prd.id}-obj-${index + 1}`,
        type: RequirementType.BUSINESS,
        title: `Business Objective ${index + 1}`,
        description: objective,
        status: RequirementStatus.APPROVED,
        priority: TaskPriority.HIGH,
        parentRequirements: [],
        childRequirements: [],
        traceabilityLinks: [],
        sourceDocument: prd.id,
        sourceSection: 'objectives',
        verificationMethod: 'inspection',
        verificationStatus: 'not_verified',
        testCases: [],
        createdBy: prd.author,
        createdAt: prd.createdAt,
        updatedAt: prd.updatedAt,
        version: '1.0.0',
        rationale: 'Core business objective from PRD',
        aiGenerated: prd.aiGenerated,
        aiMetadata: prd.aiMetadata
      });
    });

    // Extract from success metrics
    prd.successMetrics.forEach((metric, index) => {
      requirements.push({
        id: `br-${prd.id}-metric-${index + 1}`,
        type: RequirementType.BUSINESS,
        title: `Success Metric ${index + 1}`,
        description: metric,
        status: RequirementStatus.APPROVED,
        priority: TaskPriority.MEDIUM,
        parentRequirements: [],
        childRequirements: [],
        traceabilityLinks: [],
        sourceDocument: prd.id,
        sourceSection: 'successMetrics',
        verificationMethod: 'test',
        verificationStatus: 'not_verified',
        testCases: [],
        createdBy: prd.author,
        createdAt: prd.createdAt,
        updatedAt: prd.updatedAt,
        version: '1.0.0',
        rationale: 'Measurable success criteria from PRD',
        aiGenerated: prd.aiGenerated,
        aiMetadata: prd.aiMetadata
      });
    });

    return requirements;
  }

  /**
   * Generate use cases from feature requirements
   */
  generateUseCasesFromFeature(feature: FeatureRequirement, businessRequirements: Requirement[]): UseCase[] {
    const useCases: UseCase[] = [];

    // Generate primary use case from user stories
    feature.userStories.forEach((userStory, index) => {
      // Parse user story: "As a [actor], I want [goal] so that [benefit]"
      const actorMatch = userStory.match(/As an? (.+?),/i);
      const goalMatch = userStory.match(/I want (.+?) so that/i);
      const benefitMatch = userStory.match(/so that (.+)/i);

      const actor = actorMatch ? actorMatch[1].trim() : 'User';
      const goal = goalMatch ? goalMatch[1].trim() : userStory;
      const benefit = benefitMatch ? benefitMatch[1].trim() : 'achieve objectives';

      // Generate main scenario steps
      const mainScenario: UseCaseStep[] = [
        {
          stepNumber: 1,
          actor: actor,
          action: `Initiates ${goal.toLowerCase()}`,
          systemResponse: 'System presents interface'
        },
        {
          stepNumber: 2,
          actor: actor,
          action: 'Provides required input',
          systemResponse: 'System validates input'
        },
        {
          stepNumber: 3,
          actor: 'System',
          action: `Processes ${goal.toLowerCase()}`,
          systemResponse: 'System completes operation'
        },
        {
          stepNumber: 4,
          actor: 'System',
          action: 'Provides confirmation',
          systemResponse: `User can ${benefit}`
        }
      ];

      // Generate alternative scenarios
      const alternativeScenarios: AlternativeScenario[] = [
        {
          id: `alt-${feature.id}-${index + 1}-1`,
          title: 'Invalid Input',
          condition: 'User provides invalid input',
          steps: [
            {
              stepNumber: 1,
              actor: 'System',
              action: 'Validates input',
              systemResponse: 'Detects validation errors'
            },
            {
              stepNumber: 2,
              actor: 'System',
              action: 'Displays error message',
              systemResponse: 'User sees specific error details'
            }
          ]
        }
      ];

      // Generate exception scenarios
      const exceptionScenarios: ExceptionScenario[] = [
        {
          id: `exc-${feature.id}-${index + 1}-1`,
          title: 'System Unavailable',
          trigger: 'System is temporarily unavailable',
          steps: [
            {
              stepNumber: 1,
              actor: 'System',
              action: 'Detects unavailability',
              systemResponse: 'Returns error response'
            }
          ],
          recovery: 'User retries operation when system is available'
        }
      ];

      useCases.push({
        id: `uc-${feature.id}-${index + 1}`,
        title: `${feature.title} - ${goal}`,
        description: `Use case for ${goal} to ${benefit}`,
        primaryActor: actor,
        goal: goal,
        preconditions: [`User has access to ${feature.title}`, 'System is operational'],
        postconditions: [benefit, 'System state is updated'],
        mainScenario,
        alternativeScenarios,
        exceptionScenarios,
        parentFeatureId: feature.id,
        parentRequirementIds: businessRequirements
          .filter(req => req.description.toLowerCase().includes(goal.toLowerCase().split(' ')[0]))
          .map(req => req.id),
        implementingTaskIds: [], // Will be populated when tasks are created
        acceptanceCriteria: feature.acceptanceCriteria.map(criteria => ({
          id: `ac-${feature.id}-${index + 1}-${criteria}`,
          description: criteria,
          completed: false
        })),
        testCases: [],
        priority: feature.priority,
        complexity: feature.estimatedComplexity,
        estimatedHours: Math.ceil(feature.estimatedComplexity * 2), // Use cases are smaller than full features
        status: RequirementStatus.APPROVED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiGenerated: true,
        aiMetadata: {
          generatedBy: 'requirements-traceability-service',
          generatedAt: new Date().toISOString(),
          prompt: `Generate use case from user story: ${userStory}`,
          confidence: 0.8,
          version: '1.0.0'
        }
      });
    });

    return useCases;
  }

  /**
   * Enhance tasks with full requirements traceability
   */
  enhanceTasksWithTraceability(
    tasks: AITask[],
    useCases: UseCase[],
    features: FeatureRequirement[],
    businessRequirements: Requirement[],
    prdId: string
  ): EnhancedAITask[] {
    return tasks.map(task => {
      // Find related use cases based on task title/description
      const relatedUseCases = useCases.filter(uc =>
        this.isTaskRelatedToUseCase(task, uc)
      );

      // Find related features
      const relatedFeatures = features.filter(feature =>
        this.isTaskRelatedToFeature(task, feature)
      );

      // Find related business requirements
      const relatedBusinessReqs = businessRequirements.filter(req =>
        this.isTaskRelatedToBusinessRequirement(task, req)
      );

      // Create detailed traceability
      const requirementTraceability = {
        businessRequirement: relatedBusinessReqs[0]?.id || '',
        functionalRequirement: relatedFeatures[0]?.id || '',
        useCase: relatedUseCases[0]?.id || '',
        acceptanceCriteria: relatedUseCases.flatMap(uc =>
          uc.acceptanceCriteria.map(ac => ac.id)
        )
      };

      // Assess impact
      const impactAnalysis = {
        affectedRequirements: relatedBusinessReqs.map(req => req.id),
        affectedUseCases: relatedUseCases.map(uc => uc.id),
        affectedFeatures: relatedFeatures.map(f => f.id),
        riskLevel: this.assessTaskRiskLevel(task, relatedUseCases.length, relatedFeatures.length) as 'low' | 'medium' | 'high'
      };

      const enhancedTask: EnhancedAITask = {
        ...task,
        implementsRequirements: relatedBusinessReqs.map(req => req.id),
        implementsUseCases: relatedUseCases.map(uc => uc.id),
        implementsFeatures: relatedFeatures.map(f => f.id),
        parentPRDId: prdId,
        requirementTraceability,
        verificationTasks: [], // Would be populated with test task IDs
        verificationStatus: 'not_started',
        testCases: [],
        requirementChanges: [],
        impactAnalysis
      };

      return enhancedTask;
    });
  }

  /**
   * Create comprehensive traceability matrix
   */
  createTraceabilityMatrix(
    projectId: string,
    prd: PRDDocument,
    features: FeatureRequirement[],
    tasks: AITask[]
  ): TraceabilityMatrix {
    // Extract business requirements from PRD
    const businessRequirements = this.extractBusinessRequirementsFromPRD(prd);

    // Generate use cases from features
    const useCases = features.flatMap(feature =>
      this.generateUseCasesFromFeature(feature, businessRequirements)
    );

    // Enhance tasks with traceability
    const enhancedTasks = this.enhanceTasksWithTraceability(
      tasks, useCases, features, businessRequirements, prd.id
    );

    // Create traceability links
    const traceabilityLinks = this.generateTraceabilityLinks(
      businessRequirements, features, useCases, enhancedTasks
    );

    // Calculate coverage
    const coverage = this.calculateCoverage(
      businessRequirements, features, useCases, enhancedTasks
    );

    return {
      id: `tm-${projectId}-${Date.now()}`,
      projectId,
      prdId: prd.id,
      businessRequirements,
      features: features as EnhancedFeatureRequirement[], // Type assertion for now
      useCases,
      tasks: enhancedTasks,
      traceabilityLinks,
      coverage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Generate traceability links between all requirement levels
   */
  private generateTraceabilityLinks(
    businessRequirements: Requirement[],
    features: FeatureRequirement[],
    useCases: UseCase[],
    tasks: EnhancedAITask[]
  ): TraceabilityLink[] {
    const links: TraceabilityLink[] = [];

    // Business Requirements -> Features
    businessRequirements.forEach(businessReq => {
      features.forEach(feature => {
        if (this.isFeatureRelatedToBusinessRequirement(feature, businessReq)) {
          links.push({
            id: `link-${businessReq.id}-${feature.id}`,
            fromRequirementId: businessReq.id,
            toRequirementId: feature.id,
            linkType: TraceabilityLinkType.DERIVES_FROM,
            description: `Feature ${feature.title} derives from business requirement`,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          });
        }
      });
    });

    // Features -> Use Cases
    features.forEach(feature => {
      useCases.forEach(useCase => {
        if (useCase.parentFeatureId === feature.id) {
          links.push({
            id: `link-${feature.id}-${useCase.id}`,
            fromRequirementId: feature.id,
            toRequirementId: useCase.id,
            linkType: TraceabilityLinkType.DERIVES_FROM,
            description: `Use case derives from feature ${feature.title}`,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          });
        }
      });
    });

    // Use Cases -> Tasks
    useCases.forEach(useCase => {
      tasks.forEach(task => {
        if (task.implementsUseCases?.includes(useCase.id)) {
          links.push({
            id: `link-${useCase.id}-${task.id}`,
            fromRequirementId: useCase.id,
            toRequirementId: task.id,
            linkType: TraceabilityLinkType.IMPLEMENTS,
            description: `Task implements use case ${useCase.title}`,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          });
        }
      });
    });

    return links;
  }

  /**
   * Calculate traceability coverage metrics
   */
  private calculateCoverage(
    businessRequirements: Requirement[],
    features: FeatureRequirement[],
    useCases: UseCase[],
    tasks: EnhancedAITask[]
  ) {
    const businessRequirementsCovered = businessRequirements.filter(req =>
      features.some(feature => this.isFeatureRelatedToBusinessRequirement(feature, req))
    ).length;

    const featuresCovered = features.filter(feature =>
      useCases.some(uc => uc.parentFeatureId === feature.id)
    ).length;

    const useCasesCovered = useCases.filter(uc =>
      tasks.some(task => task.implementsUseCases?.includes(uc.id))
    ).length;

    const tasksWithTraceability = tasks.filter(task =>
      (task.implementsRequirements?.length || 0) > 0 ||
      (task.implementsUseCases?.length || 0) > 0 ||
      (task.implementsFeatures?.length || 0) > 0
    ).length;

    const orphanedTasks = tasks
      .filter(task => (task.implementsRequirements?.length || 0) === 0 &&
                     (task.implementsUseCases?.length || 0) === 0 &&
                     (task.implementsFeatures?.length || 0) === 0)
      .map(task => task.id);

    const unimplementedRequirements = businessRequirements
      .filter(req => !tasks.some(task => task.implementsRequirements?.includes(req.id)))
      .map(req => req.id);

    return {
      businessRequirementsCovered,
      featuresCovered,
      useCasesCovered,
      tasksWithTraceability,
      orphanedTasks,
      unimplementedRequirements
    };
  }

  // Helper methods for relationship detection
  private isTaskRelatedToUseCase(task: AITask, useCase: UseCase): boolean {
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const useCaseText = `${useCase.title} ${useCase.goal}`.toLowerCase();

    // Simple keyword matching - in production, use more sophisticated NLP
    const keywords = useCase.goal.toLowerCase().split(' ').filter(word => word.length > 3);
    return keywords.some(keyword => taskText.includes(keyword));
  }

  private isTaskRelatedToFeature(task: AITask, feature: FeatureRequirement): boolean {
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const featureText = `${feature.title} ${feature.description}`.toLowerCase();

    const keywords = feature.title.toLowerCase().split(' ').filter(word => word.length > 3);
    return keywords.some(keyword => taskText.includes(keyword));
  }

  private isTaskRelatedToBusinessRequirement(task: AITask, requirement: Requirement): boolean {
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const reqText = requirement.description.toLowerCase();

    const keywords = reqText.split(' ').filter(word => word.length > 4);
    return keywords.some(keyword => taskText.includes(keyword));
  }

  private isFeatureRelatedToBusinessRequirement(feature: FeatureRequirement, requirement: Requirement): boolean {
    const featureText = `${feature.title} ${feature.description}`.toLowerCase();
    const reqText = requirement.description.toLowerCase();

    const keywords = reqText.split(' ').filter(word => word.length > 4);
    return keywords.some(keyword => featureText.includes(keyword));
  }

  private assessTaskRiskLevel(task: AITask, useCaseCount: number, featureCount: number): string {
    if (useCaseCount === 0 && featureCount === 0) return 'high'; // No traceability
    if (task.complexity >= 8) return 'high';
    if (task.complexity >= 6 || useCaseCount > 2) return 'medium';
    return 'low';
  }
}
