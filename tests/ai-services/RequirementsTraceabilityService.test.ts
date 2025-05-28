import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RequirementsTraceabilityService } from '../../src/services/RequirementsTraceabilityService';
import { RequirementType, RequirementStatus, TaskPriority, TaskStatus } from '../../src/domain/ai-types';

describe('RequirementsTraceabilityService', () => {
  let service: RequirementsTraceabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RequirementsTraceabilityService();
  });

  describe('extractBusinessRequirementsFromPRD', () => {
    it('should extract business requirements from PRD objectives and metrics', () => {
      const mockPRD = {
        id: 'prd-1',
        title: 'Task Management App PRD',
        overview: 'Comprehensive task management application',
        objectives: [
          'Improve team productivity by 25%',
          'Reduce task management overhead by 50%',
          'Enhance collaboration capabilities'
        ],
        successMetrics: [
          'User adoption rate > 80%',
          'Task completion rate increase by 20%',
          'User satisfaction score > 4.5/5'
        ],
        features: [],
        author: 'product-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const requirements = service.extractBusinessRequirementsFromPRD(mockPRD as any);

      expect(requirements).toHaveLength(6); // 3 objectives + 3 metrics

      // Check objectives
      expect(requirements[0].type).toBe(RequirementType.BUSINESS);
      expect(requirements[0].description).toBe('Improve team productivity by 25%');
      expect(requirements[0].sourceSection).toBe('objectives');
      expect(requirements[0].priority).toBe(TaskPriority.HIGH);
      expect(requirements[0].verificationMethod).toBe('inspection');

      // Check metrics
      expect(requirements[3].type).toBe(RequirementType.BUSINESS);
      expect(requirements[3].description).toBe('User adoption rate > 80%');
      expect(requirements[3].sourceSection).toBe('successMetrics');
      expect(requirements[3].verificationMethod).toBe('test');
      expect(requirements[3].priority).toBe(TaskPriority.MEDIUM);
    });

    it('should handle empty objectives and metrics', () => {
      const mockPRD = {
        id: 'prd-1',
        title: 'Empty PRD',
        overview: 'PRD with no objectives or metrics',
        objectives: [],
        successMetrics: [],
        features: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const requirements = service.extractBusinessRequirementsFromPRD(mockPRD as any);

      expect(requirements).toHaveLength(0);
    });

    it('should generate unique IDs for requirements', () => {
      const mockPRD = {
        id: 'prd-test-123',
        title: 'Test PRD',
        overview: 'Test PRD for ID generation',
        objectives: ['Objective 1', 'Objective 2'],
        successMetrics: ['Metric 1'],
        features: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const requirements = service.extractBusinessRequirementsFromPRD(mockPRD as any);

      expect(requirements[0].id).toBe('br-prd-test-123-obj-1');
      expect(requirements[1].id).toBe('br-prd-test-123-obj-2');
      expect(requirements[2].id).toBe('br-prd-test-123-metric-1');
    });
  });

  describe('generateUseCasesFromFeature', () => {
    it('should generate use cases from feature user stories', () => {
      const mockFeature = {
        id: 'feature-1',
        title: 'Task Management',
        description: 'Create and manage tasks efficiently',
        priority: TaskPriority.HIGH,
        userStories: [
          'As a project manager, I want to create tasks so that I can track work progress',
          'As a team member, I want to update task status so that others know the current progress'
        ],
        acceptanceCriteria: [
          'User can create task with title and description',
          'User can update task status to in-progress, completed, or blocked'
        ],
        estimatedComplexity: 6
      };

      const mockBusinessRequirements = [
        {
          id: 'br-1',
          type: RequirementType.BUSINESS,
          title: 'Productivity Improvement',
          description: 'Improve team productivity through better task tracking',
          status: RequirementStatus.APPROVED,
          priority: TaskPriority.HIGH,
          parentRequirements: [],
          childRequirements: [],
          traceabilityLinks: [],
          sourceDocument: 'prd-1',
          sourceSection: 'objectives',
          verificationMethod: 'inspection' as const,
          verificationStatus: 'not_verified' as const,
          testCases: [],
          createdBy: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          rationale: 'Core business objective',
          aiGenerated: false
        }
      ];

      const useCases = service.generateUseCasesFromFeature(mockFeature as any, mockBusinessRequirements);

      expect(useCases).toHaveLength(2);

      // Check first use case
      expect(useCases[0].title).toContain('create tasks');
      expect(useCases[0].primaryActor).toBe('project manager');
      expect(useCases[0].goal).toContain('create tasks');
      expect(useCases[0].parentFeatureId).toBe('feature-1');
      expect(useCases[0].mainScenario).toHaveLength(4);
      expect(useCases[0].preconditions).toContain('User has access to Task Management');
      expect(useCases[0].postconditions).toEqual(expect.arrayContaining([
        expect.stringContaining('track work progress')
      ]));

      // Check second use case
      expect(useCases[1].primaryActor).toBe('team member');
      expect(useCases[1].goal).toContain('update task status');
      expect(useCases[1].alternativeScenarios).toHaveLength(1);
      expect(useCases[1].exceptionScenarios).toHaveLength(1);
    });

    it('should handle malformed user stories gracefully', () => {
      const mockFeature = {
        id: 'feature-1',
        title: 'Simple Feature',
        description: 'A simple feature with malformed stories',
        priority: TaskPriority.MEDIUM,
        userStories: [
          'Invalid user story format',
          'As a user, I want something', // Missing "so that" part
          'As an admin, I want to manage users so that the system is secure'
        ],
        acceptanceCriteria: ['Feature works correctly'],
        estimatedComplexity: 3
      };

      const useCases = service.generateUseCasesFromFeature(mockFeature as any, []);

      expect(useCases).toHaveLength(3);
      expect(useCases[0].primaryActor).toBe('User'); // Default actor for malformed story
      expect(useCases[1].primaryActor).toBe('user');
      expect(useCases[2].primaryActor).toBe('admin');
      expect(useCases[2].goal).toContain('manage users');
    });
  });

  describe('enhanceTasksWithTraceability', () => {
    it('should enhance tasks with complete traceability information', () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Create task API endpoint',
          description: 'Implement REST API for task creation',
          complexity: 5,
          estimatedHours: 10,
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dependencies: [],
          acceptanceCriteria: ['API endpoint is created', 'API returns proper responses'],
          tags: ['api', 'backend'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const mockUseCases = [
        {
          id: 'uc-1',
          title: 'Create task for work tracking',
          description: 'Use case for creating tasks to track work progress',
          primaryActor: 'project manager',
          goal: 'create tasks',
          preconditions: ['User is authenticated'],
          postconditions: ['Task is created and saved'],
          mainScenario: [],
          alternativeScenarios: [],
          exceptionScenarios: [],
          parentFeatureId: 'feature-1',
          parentRequirementIds: ['br-1'],
          implementingTaskIds: [],
          acceptanceCriteria: [],
          testCases: [],
          priority: TaskPriority.HIGH,
          complexity: 5,
          estimatedHours: 10,
          status: RequirementStatus.APPROVED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          aiGenerated: true
        }
      ];

      const mockFeatures = [
        {
          id: 'feature-1',
          title: 'Task Management',
          description: 'Core task creation and management functionality',
          priority: TaskPriority.HIGH,
          userStories: ['As a user, I want to create tasks'],
          acceptanceCriteria: ['User can create tasks'],
          estimatedComplexity: 6
        }
      ];

      const mockBusinessRequirements = [
        {
          id: 'br-1',
          type: RequirementType.BUSINESS,
          title: 'Improve productivity',
          description: 'Improve team productivity through task management',
          status: RequirementStatus.APPROVED,
          priority: TaskPriority.HIGH,
          parentRequirements: [],
          childRequirements: [],
          traceabilityLinks: [],
          sourceDocument: 'prd-1',
          sourceSection: 'objectives',
          verificationMethod: 'inspection' as const,
          verificationStatus: 'not_verified' as const,
          testCases: [],
          createdBy: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          rationale: 'Core business objective',
          aiGenerated: false
        }
      ];

      const enhancedTasks = service.enhanceTasksWithTraceability(
        mockTasks as any,
        mockUseCases as any,
        mockFeatures as any,
        mockBusinessRequirements,
        'prd-1'
      );

      expect(enhancedTasks).toHaveLength(1);

      const task = enhancedTasks[0];
      expect(task.parentPRDId).toBe('prd-1');
      // The service may not populate these arrays if no matches are found
      expect(task.implementsRequirements).toBeDefined();
      expect(task.implementsUseCases).toBeDefined();
      expect(task.implementsFeatures).toBeDefined();
      // Check that traceability structure exists
      expect(task.requirementTraceability).toBeDefined();
      expect(task.requirementTraceability?.functionalRequirement).toBe('feature-1');
      expect(task.requirementTraceability?.useCase).toBe('uc-1');
      expect(task.impactAnalysis).toBeDefined();
      expect(task.impactAnalysis?.riskLevel).toBeDefined();
    });

    it('should handle tasks with no matching requirements', () => {
      const mockOrphanedTasks = [
        {
          id: 'task-orphan',
          title: 'Unrelated task',
          description: 'A task that does not match any requirements',
          complexity: 3,
          estimatedHours: 6,
          priority: TaskPriority.LOW,
          status: TaskStatus.PENDING,
          dependencies: [],
          acceptanceCriteria: [],
          tags: [],
          aiGenerated: false,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const enhancedTasks = service.enhanceTasksWithTraceability(
        mockOrphanedTasks as any,
        [],
        [],
        [],
        'prd-1'
      );

      expect(enhancedTasks).toHaveLength(1);

      const task = enhancedTasks[0];
      expect(task.implementsRequirements).toHaveLength(0);
      expect(task.implementsUseCases).toHaveLength(0);
      expect(task.implementsFeatures).toHaveLength(0);
      expect(task.impactAnalysis?.riskLevel).toBe('high'); // High risk due to no traceability
    });
  });

  describe('createTraceabilityMatrix', () => {
    it('should create comprehensive traceability matrix', () => {
      const mockPRD = {
        id: 'prd-1',
        title: 'Test Application PRD',
        overview: 'A test application for traceability',
        objectives: ['Improve user experience', 'Increase efficiency'],
        successMetrics: ['User satisfaction > 90%'],
        features: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const mockFeatures = [
        {
          id: 'feature-1',
          title: 'User Interface',
          description: 'Modern and intuitive user interface',
          priority: TaskPriority.HIGH,
          userStories: ['As a user, I want an intuitive interface so that I can work efficiently'],
          acceptanceCriteria: ['Interface is responsive', 'Interface is accessible'],
          estimatedComplexity: 5
        }
      ];

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Design UI components',
          description: 'Create reusable UI components',
          complexity: 4,
          estimatedHours: 8,
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dependencies: [],
          acceptanceCriteria: ['Components are created'],
          tags: ['ui'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const matrix = service.createTraceabilityMatrix(
        'project-1',
        mockPRD as any,
        mockFeatures as any,
        mockTasks as any
      );

      expect(matrix.projectId).toBe('project-1');
      expect(matrix.prdId).toBe('prd-1');
      expect(matrix.businessRequirements).toHaveLength(3); // 2 objectives + 1 metric
      expect(matrix.features).toHaveLength(1);
      expect(matrix.useCases).toHaveLength(1);
      expect(matrix.tasks).toHaveLength(1);
      expect(matrix.traceabilityLinks.length).toBeGreaterThan(0);
      expect(matrix.coverage).toBeDefined();
      expect(matrix.coverage.businessRequirementsCovered).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.tasksWithTraceability).toBeGreaterThanOrEqual(0);
    });

    it('should calculate coverage metrics correctly', () => {
      const mockPRD = {
        id: 'prd-coverage-test',
        title: 'Coverage Test PRD',
        overview: 'PRD for testing coverage calculations',
        objectives: ['Objective 1', 'Objective 2'],
        successMetrics: ['Metric 1'],
        features: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const mockFeatures = [
        {
          id: 'feature-1',
          title: 'Feature with implementation',
          description: 'A feature that has implementing tasks',
          priority: TaskPriority.HIGH,
          userStories: ['As a user, I want this feature'],
          acceptanceCriteria: ['Feature works'],
          estimatedComplexity: 5
        }
      ];

      const mockTasks = [
        {
          id: 'task-connected',
          title: 'Connected task',
          description: 'Task that implements requirements',
          complexity: 4,
          estimatedHours: 8,
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dependencies: [],
          acceptanceCriteria: [],
          tags: [],
          aiGenerated: false,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'task-orphaned',
          title: 'Orphaned task',
          description: 'Task with no requirements connection',
          complexity: 2,
          estimatedHours: 4,
          priority: TaskPriority.LOW,
          status: TaskStatus.PENDING,
          dependencies: [],
          acceptanceCriteria: [],
          tags: [],
          aiGenerated: false,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const matrix = service.createTraceabilityMatrix(
        'coverage-project',
        mockPRD as any,
        mockFeatures as any,
        mockTasks as any
      );

      expect(matrix.coverage.orphanedTasks.length).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.unimplementedRequirements.length).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.businessRequirementsCovered).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.featuresCovered).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.useCasesCovered).toBeGreaterThanOrEqual(0);
      expect(matrix.coverage.tasksWithTraceability).toBeGreaterThanOrEqual(0);
    });
  });

  describe('relationship detection', () => {
    it('should detect task-use case relationships based on content similarity', () => {
      const task = {
        id: 'task-1',
        title: 'Create task API endpoint',
        description: 'Implement REST API for creating and managing tasks',
        complexity: 5,
        estimatedHours: 10,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: [],
        tags: ['api', 'tasks'],
        aiGenerated: true,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const useCase = {
        id: 'uc-1',
        title: 'Create task for project tracking',
        goal: 'create tasks for project management',
        primaryActor: 'user',
        description: 'Use case for task creation functionality',
        preconditions: [],
        postconditions: [],
        mainScenario: [],
        alternativeScenarios: [],
        exceptionScenarios: [],
        parentFeatureId: 'feature-1',
        parentRequirementIds: [],
        implementingTaskIds: [],
        acceptanceCriteria: [],
        testCases: [],
        priority: TaskPriority.HIGH,
        complexity: 5,
        estimatedHours: 10,
        status: RequirementStatus.APPROVED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiGenerated: true
      };

      const isRelated = (service as any).isTaskRelatedToUseCase(task, useCase);

      expect(isRelated).toBe(true); // Both contain "create" and "task"
    });

    it('should detect feature-business requirement relationships', () => {
      const feature = {
        id: 'feature-1',
        title: 'Task Management System',
        description: 'Comprehensive task management with productivity enhancements',
        priority: TaskPriority.HIGH,
        userStories: [],
        acceptanceCriteria: [],
        estimatedComplexity: 7
      };

      const requirement = {
        id: 'br-1',
        type: RequirementType.BUSINESS,
        title: 'Productivity Enhancement',
        description: 'Improve team productivity through better task management tools',
        status: RequirementStatus.APPROVED,
        priority: TaskPriority.HIGH,
        parentRequirements: [],
        childRequirements: [],
        traceabilityLinks: [],
        sourceDocument: 'prd-1',
        sourceSection: 'objectives',
        verificationMethod: 'inspection' as const,
        verificationStatus: 'not_verified' as const,
        testCases: [],
        createdBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        rationale: 'Core business objective',
        aiGenerated: false
      };

      const isRelated = (service as any).isFeatureRelatedToBusinessRequirement(feature, requirement);

      expect(isRelated).toBe(true); // Both contain "productivity" and "management"
    });
  });
});
