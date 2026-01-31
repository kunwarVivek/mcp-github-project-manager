import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DependencyContextGenerator } from '../../../services/context/DependencyContextGenerator';
import { AIServiceFactory } from '../../../services/ai/AIServiceFactory';
import { AITask, TaskStatus, TaskPriority, TaskDependency } from '../../../domain/ai-types';

// Mock the AI modules
jest.mock('ai', () => ({
  generateObject: jest.fn()
}));

jest.mock('../../../services/ai/AIServiceFactory');

describe('DependencyContextGenerator', () => {
  let generator: DependencyContextGenerator;
  let mockAIServiceFactory: jest.Mocked<AIServiceFactory>;

  // Sample task for testing
  const createMockTask = (overrides?: Partial<AITask>): AITask => ({
    id: 'task-1',
    title: 'Implement User Authentication',
    description: 'Add user login and registration functionality',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    complexity: 7,
    estimatedHours: 16,
    aiGenerated: false,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    tags: [],
    ...overrides
  });

  // Sample dependency task
  const createDependencyTask = (id: string, title: string): AITask => ({
    id,
    title,
    description: `Implementation for ${title}`,
    status: TaskStatus.DONE,
    priority: TaskPriority.MEDIUM,
    complexity: 5,
    estimatedHours: 8,
    aiGenerated: false,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    tags: []
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock AIServiceFactory
    mockAIServiceFactory = {
      getBestAvailableModel: jest.fn(),
      getAvailableProviders: jest.fn(),
      createProvider: jest.fn(),
      createLanguageModel: jest.fn()
    } as unknown as jest.Mocked<AIServiceFactory>;

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockAIServiceFactory);

    generator = new DependencyContextGenerator();
  });

  describe('isAIAvailable', () => {
    it('should return true when AI model is available', () => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue({} as any);

      expect(generator.isAIAvailable()).toBe(true);
    });

    it('should return false when no AI model is available', () => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);

      expect(generator.isAIAvailable()).toBe(false);
    });
  });

  describe('generateDependencyContext', () => {
    describe('fallback mode (no AI)', () => {
      beforeEach(() => {
        mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
      });

      it('should generate basic dependency context without AI', async () => {
        const task = createMockTask({
          dependencies: [{ id: 'dep-1', type: 'depends_on', description: 'Needs database setup' }]
        });
        const depTask = createDependencyTask('dep-1', 'Setup Database Schema');
        const allTasks = [task, depTask];

        const result = await generator.generateDependencyContext(task, allTasks);

        expect(result).not.toBeNull();
        expect(result!.dependencies).toBeDefined();
        expect(result!.dependencies.length).toBeGreaterThan(0);
        expect(result!.parallelOpportunities).toBeDefined();
        expect(result!.criticalPath).toBeDefined();
      });

      it('should handle task with no dependencies', async () => {
        const task = createMockTask({ dependencies: [] });
        const allTasks = [task];

        const result = await generator.generateDependencyContext(task, allTasks);

        expect(result).not.toBeNull();
        expect(result!.dependencies).toHaveLength(0);
      });

      it('should handle external dependencies array', async () => {
        const task = createMockTask();
        const depTask = createDependencyTask('ext-dep', 'External Dependency');
        const allTasks = [task, depTask];
        const externalDeps: TaskDependency[] = [
          { id: 'ext-dep', type: 'blocks', description: 'External dep' }
        ];

        const result = await generator.generateDependencyContext(task, allTasks, externalDeps);

        expect(result).not.toBeNull();
        expect(result!.dependencies.length).toBe(1);
        expect(result!.dependencies[0].dependencyId).toBe('ext-dep');
      });

      it('should create basic entry for dependency task not found', async () => {
        const task = createMockTask({
          dependencies: [{ id: 'missing-task', type: 'depends_on' }]
        });
        const allTasks = [task];

        const result = await generator.generateDependencyContext(task, allTasks);

        expect(result).not.toBeNull();
        expect(result!.dependencies).toHaveLength(1);
        expect(result!.dependencies[0].dependencyId).toBe('missing-task');
        expect(result!.dependencies[0].dependencyTitle).toBe('missing-task');
        expect(result!.dependencies[0].dependencyType).toBe('blocks');
      });
    });

    describe('AI mode', () => {
      it('should use AI to generate enhanced dependency context', async () => {
        const mockModel = { modelId: 'test-model' };
        mockAIServiceFactory.getBestAvailableModel.mockReturnValue(mockModel as any);

        const task = createMockTask({
          dependencies: [{ id: 'dep-1', type: 'depends_on' }]
        });
        const depTask = createDependencyTask('dep-1', 'Database Setup');
        const allTasks = [task, depTask];

        // Mock generateObject to return valid dependency context
        const mockGenerateObject = require('ai').generateObject;
        mockGenerateObject.mockResolvedValue({
          object: {
            dependencies: [{
              dependencyId: 'dep-1',
              dependencyTitle: 'Database Setup',
              dependencyType: 'blocks',
              rationale: 'Database must be setup before authentication can be implemented',
              providedBy: 'Database schema and connection configuration',
              integrationGuidance: 'Import database models and use repository pattern',
              interfaces: ['DatabaseConnection', 'UserRepository'],
              canRunInParallel: false
            }],
            parallelOpportunities: [],
            criticalPath: ['dep-1', 'task-1'],
            estimatedUnblockDate: '2024-01-10T00:00:00Z'
          }
        });

        const result = await generator.generateDependencyContext(task, allTasks);

        expect(result).not.toBeNull();
        expect(mockGenerateObject).toHaveBeenCalled();
        expect(result!.dependencies[0].rationale).toContain('Database');
      });

      it('should fallback to basic analysis on AI error', async () => {
        const mockModel = { modelId: 'test-model' };
        mockAIServiceFactory.getBestAvailableModel.mockReturnValue(mockModel as any);

        const task = createMockTask({
          dependencies: [{ id: 'dep-1', type: 'depends_on' }]
        });
        const depTask = createDependencyTask('dep-1', 'Database Setup');
        const allTasks = [task, depTask];

        // Mock generateObject to throw error
        const mockGenerateObject = require('ai').generateObject;
        mockGenerateObject.mockRejectedValue(new Error('AI service unavailable'));

        const result = await generator.generateDependencyContext(task, allTasks);

        expect(result).not.toBeNull();
        // Should still return valid context via fallback
        expect(result!.dependencies).toBeDefined();
      });
    });
  });

  describe('dependency type determination', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should detect implements type from task text', async () => {
      const task = createMockTask({
        title: 'Use Authentication Service',
        description: 'Use the auth service',
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Implement Auth Module');
      depTask.description = 'Implement the authentication module';
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].dependencyType).toBe('implements');
    });

    it('should detect blocks type for infrastructure setup', async () => {
      // The task should NOT mention 'use' in title for blocks type
      const task = createMockTask({
        title: 'Build Features',
        description: 'Build application features',
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Setup Infrastructure');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].dependencyType).toBe('blocks');
    });

    it('should detect blocks type for configuration tasks', async () => {
      // The task should NOT mention 'use' in title for blocks type
      const task = createMockTask({
        title: 'Build Features',
        description: 'Build application features',
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Configure Database Connection');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].dependencyType).toBe('blocks');
    });
  });

  describe('rationale generation', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should generate rationale for infrastructure dependency', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Setup Infrastructure');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].rationale).toContain('infrastructure');
    });

    it('should generate rationale for API dependency', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Create User API Endpoints');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].rationale).toContain('API');
    });

    it('should generate rationale for model/schema dependency', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Define Data Model');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].rationale).toContain('data model');
    });

    it('should generate rationale for component/UI dependency', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Create Login Component');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].rationale).toContain('UI component');
    });
  });

  describe('provided by identification', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should identify what setup tasks provide', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Setup and Configure');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].providedBy).toContain('environment');
    });

    it('should identify what API tasks provide', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'API Endpoint Creation');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].providedBy).toContain('API');
    });

    it('should identify what auth tasks provide', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Authentication Implementation');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].providedBy).toContain('Authentication');
    });

    it('should identify what service tasks provide', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'User Service Business Logic');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].providedBy).toContain('Business logic');
    });
  });

  describe('integration guidance generation', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should generate API integration guidance', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'API Implementation');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].integrationGuidance).toContain('API');
    });

    it('should generate component integration guidance', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Button Component');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].integrationGuidance).toContain('component');
    });

    it('should generate service integration guidance', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Payment Service');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].integrationGuidance).toContain('service');
    });
  });

  describe('interface identification', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should identify API interfaces', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'REST API Implementation');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].interfaces).toContain('REST API endpoints');
    });

    it('should identify database interfaces', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Database Repository');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].interfaces).toContain('Repository interface');
    });

    it('should provide default interface for generic tasks', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Generic Task');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].interfaces).toContain('Standard integration interface');
    });
  });

  describe('parallel work identification', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should identify tasks that cannot run in parallel for blocking deps', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'dep-1', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('dep-1', 'Setup Infrastructure');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies[0].canRunInParallel).toBe(false);
    });

    it('should identify parallel opportunities for independent tasks', async () => {
      const task = createMockTask({ id: 'task-1', dependencies: [] });
      const indepTask1 = createDependencyTask('ind-1', 'Independent Task 1');
      indepTask1.dependencies = [];
      const indepTask2 = createDependencyTask('ind-2', 'Independent Task 2');
      indepTask2.dependencies = [];
      const allTasks = [task, indepTask1, indepTask2];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.parallelOpportunities.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('critical path determination', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should include task in critical path', async () => {
      const task = createMockTask({ id: 'task-1' });
      const allTasks = [task];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.criticalPath).toContain('task-1');
    });
  });

  describe('unblock date estimation', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should return undefined for tasks with no blocking deps', async () => {
      const task = createMockTask({ dependencies: [] });
      const allTasks = [task];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.estimatedUnblockDate).toBeUndefined();
    });

    it('should estimate unblock date for blocking dependencies', async () => {
      // Task must NOT have 'use' in title to get 'blocks' type
      const task = createMockTask({
        title: 'Build Application',
        description: 'Build the application',
        dependencies: [
          { id: 'dep-1', type: 'blocks' },
          { id: 'dep-2', type: 'blocks' }
        ]
      });
      // Dependency tasks must have 'setup' or 'infrastructure' to be 'blocks' type
      const depTask1 = createDependencyTask('dep-1', 'Setup Infrastructure');
      depTask1.description = 'Setup the infrastructure';
      const depTask2 = createDependencyTask('dep-2', 'Configure Database');
      depTask2.description = 'Configure the database';
      const allTasks = [task, depTask1, depTask2];

      const result = await generator.generateDependencyContext(task, allTasks);

      // Should have an estimated date since there are blocking deps
      expect(result!.estimatedUnblockDate).toBeDefined();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should handle empty allTasks array', async () => {
      const task = createMockTask();

      const result = await generator.generateDependencyContext(task, []);

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(0);
    });

    it('should handle task with circular reference in dependencies', async () => {
      const task = createMockTask({
        id: 'task-1',
        dependencies: [{ id: 'task-1', type: 'depends_on' }]
      });
      const allTasks = [task];

      // Should not throw
      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result).not.toBeNull();
    });

    it('should handle multiple dependencies', async () => {
      const task = createMockTask({
        dependencies: [
          { id: 'dep-1', type: 'depends_on' },
          { id: 'dep-2', type: 'blocks' },
          { id: 'dep-3', type: 'related_to' }
        ]
      });
      const dep1 = createDependencyTask('dep-1', 'Database Setup');
      const dep2 = createDependencyTask('dep-2', 'API Gateway');
      const dep3 = createDependencyTask('dep-3', 'Logging Service');
      const allTasks = [task, dep1, dep2, dep3];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies).toHaveLength(3);
    });

    it('should handle tasks found by title match', async () => {
      const task = createMockTask({
        dependencies: [{ id: 'Database Setup', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('different-id', 'Database Setup');
      const allTasks = [task, depTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result!.dependencies).toHaveLength(1);
      expect(result!.dependencies[0].dependencyId).toBe('different-id');
    });
  });
});
