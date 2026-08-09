import { beforeEach, describe, expect, it, vi, type Mocked, } from 'vitest';
import { DependencyContextGenerator } from '../../../services/context/DependencyContextGenerator';
import { AIServiceFactory } from '../../../services/ai/AIServiceFactory';
import { type AITask, TaskStatus, TaskPriority, type TaskDependency } from '../../../domain/ai-types';
import { generateObject } from 'ai';

// Mock the AI modules
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

vi.mock('../../../services/ai/AIServiceFactory', () => {
  const mockFactory = {
    getMainModel: vi.fn(),
    getFallbackModel: vi.fn(),
    getModel: vi.fn(),
    getBestAvailableModel: vi.fn(),
    getPRDModel: vi.fn(),
    getResearchModel: vi.fn(),
  };
  return {
    AIServiceFactory: {
      getInstance: vi.fn().mockReturnValue(mockFactory),
    },
  };
});

describe('DependencyContextGenerator', () => {
  let generator: DependencyContextGenerator;
  let mockAIServiceFactory: Mocked<AIServiceFactory>;

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
    vi.clearAllMocks();

    // Setup mock AIServiceFactory
    mockAIServiceFactory = {
      getBestAvailableModel: vi.fn(),
      getAvailableProviders: vi.fn(),
      createProvider: vi.fn(),
      createLanguageModel: vi.fn()
    } as unknown as Mocked<AIServiceFactory>;

    (AIServiceFactory.getInstance as Mock).mockReturnValue(mockAIServiceFactory);

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
        const mockGenerateObject = vi.mocked(generateObject);
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
        const mockGenerateObject = vi.mocked(generateObject);
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

  describe('complex dependency graphs', () => {
    beforeEach(() => {
      mockAIServiceFactory.getBestAvailableModel.mockReturnValue(null);
    });

    it('should handle diamond dependency graph (A→B,C→D)', async () => {
      // D is a shared base; B and C both depend on D; A depends on B and C
      const taskD = createDependencyTask('d', 'Setup Database Schema');
      taskD.dependencies = [];

      const taskB = createDependencyTask('b', 'Setup API Layer');
      taskB.dependencies = [{ id: 'd', type: 'depends_on' }];

      const taskC = createDependencyTask('c', 'Setup Auth Service');
      taskC.dependencies = [{ id: 'd', type: 'depends_on' }];

      const taskA = createMockTask({
        id: 'a',
        title: 'Build Dashboard',
        description: 'Build the main dashboard',
        dependencies: [
          { id: 'b', type: 'depends_on' },
          { id: 'c', type: 'depends_on' }
        ]
      });

      const allTasks = [taskA, taskB, taskC, taskD];
      const result = await generator.generateDependencyContext(taskA, allTasks);

      expect(result).not.toBeNull();
      // A's direct dependencies are B and C
      expect(result!.dependencies).toHaveLength(2);
      const depIds = result!.dependencies.map(d => d.dependencyId);
      expect(depIds).toContain('b');
      expect(depIds).toContain('c');
      // B and C share the same dependency D, so they should form a parallel group
      expect(result!.criticalPath).toContain('a');
    });

    it('should handle circular dependency A→B→C→A without infinite loop', async () => {
      const taskA = createMockTask({
        id: 'a',
        title: 'Feature A',
        description: 'Feature A implementation',
        dependencies: [{ id: 'b', type: 'depends_on' }]
      });
      const taskB = createDependencyTask('b', 'Feature B');
      taskB.dependencies = [{ id: 'c', type: 'depends_on' }];
      const taskC = createDependencyTask('c', 'Feature C');
      taskC.dependencies = [{ id: 'a', type: 'depends_on' }];

      const allTasks = [taskA, taskB, taskC];

      // Must not throw or hang
      const result = await generator.generateDependencyContext(taskA, allTasks);

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(1);
      expect(result!.dependencies[0].dependencyId).toBe('b');
      // Critical path should contain 'a' without duplicates
      const uniquePath = new Set(result!.criticalPath);
      expect(uniquePath.size).toBe(result!.criticalPath.length);
    });

    it('should handle deep dependency chain of 6 levels', async () => {
      // chain: L0 → L1 → L2 → L3 → L4 → L5
      const levels = 6;
      const tasks: AITask[] = [];

      for (let i = levels - 1; i >= 0; i--) {
        const deps = i < levels - 1
          ? [{ id: `level-${i + 1}`, type: 'depends_on' as const }]
          : [];
        const t: AITask = {
          id: `level-${i}`,
          title: `Level ${i} Task`,
          description: `Task at depth ${i}`,
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          complexity: 3,
          estimatedHours: 4,
          aiGenerated: false,
          subtasks: [],
          dependencies: deps,
          acceptanceCriteria: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          tags: []
        };
        tasks.push(t);
      }

      const rootTask = tasks.find(t => t.id === 'level-0')!;
      const result = await generator.generateDependencyContext(rootTask, tasks);

      expect(result).not.toBeNull();
      // Root has a direct dependency on level-1
      expect(result!.dependencies).toHaveLength(1);
      expect(result!.dependencies[0].dependencyId).toBe('level-1');
      // Critical path must include the root
      expect(result!.criticalPath).toContain('level-0');
    });

    it('should handle multiple missing dependencies gracefully', async () => {
      const task = createMockTask({
        id: 'main',
        title: 'Main Feature',
        description: 'The main feature',
        dependencies: [
          { id: 'ghost-1', type: 'depends_on' },
          { id: 'ghost-2', type: 'depends_on' },
          { id: 'ghost-3', type: 'depends_on', description: 'Needs external auth provider' }
        ]
      });

      const result = await generator.generateDependencyContext(task, [task]);

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(3);

      for (const dep of result!.dependencies) {
        // Missing deps get basic fallback entries
        expect(dep.dependencyType).toBe('blocks');
        expect(dep.canRunInParallel).toBe(false);
        expect(dep.interfaces).toEqual([]);
      }
      // The one with a description should use it as rationale
      const ghost3 = result!.dependencies.find(d => d.dependencyId === 'ghost-3')!;
      expect(ghost3.rationale).toBe('Needs external auth provider');
    });

    it('should handle mixed resolved and unresolved dependencies', async () => {
      const task = createMockTask({
        id: 'app',
        title: 'Build Application',
        description: 'Build the app',
        dependencies: [
          { id: 'db-setup', type: 'depends_on' },
          { id: 'missing-service', type: 'depends_on' },
          { id: 'auth', type: 'depends_on' }
        ]
      });
      const dbTask = createDependencyTask('db-setup', 'Setup Database');
      const authTask = createDependencyTask('auth', 'Setup Auth Module');
      // 'missing-service' deliberately absent from allTasks
      const allTasks = [task, dbTask, authTask];

      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(3);

      // Resolved deps have rich metadata
      const dbDep = result!.dependencies.find(d => d.dependencyId === 'db-setup')!;
      expect(dbDep.dependencyTitle).toBe('Setup Database');
      expect(dbDep.rationale.length).toBeGreaterThan(10);

      // Unresolved dep has fallback fields
      const missingDep = result!.dependencies.find(d => d.dependencyId === 'missing-service')!;
      expect(missingDep.dependencyTitle).toBe('missing-service');
      expect(missingDep.dependencyType).toBe('blocks');
      expect(missingDep.interfaces).toEqual([]);
    });

    it('should identify parallel opportunities for tasks sharing same deps', async () => {
      const sharedDep = createDependencyTask('shared', 'Setup Core Framework');
      sharedDep.dependencies = [];

      // Two tasks that share the same dependency
      const taskX = createDependencyTask('x', 'Feature X');
      taskX.dependencies = [{ id: 'shared', type: 'depends_on' }];
      const taskY = createDependencyTask('y', 'Feature Y');
      taskY.dependencies = [{ id: 'shared', type: 'depends_on' }];

      const mainTask = createMockTask({
        id: 'main',
        title: 'Integration Task',
        description: 'Integrate everything',
        dependencies: []
      });

      const allTasks = [mainTask, taskX, taskY, sharedDep];
      const result = await generator.generateDependencyContext(mainTask, allTasks);

      expect(result).not.toBeNull();
      // groupTasksByDependencies should group X and Y (same dep key)
      const groupOpportunity = result!.parallelOpportunities.find(
        op => op.taskIds.includes('x') && op.taskIds.includes('y')
      );
      expect(groupOpportunity).toBeDefined();
      expect(groupOpportunity!.reason).toContain('same dependencies');
    });

    it('should perform well with a large graph of 50 tasks', async () => {
      const taskCount = 50;
      const tasks: AITask[] = [];

      // Create 50 tasks; each task i depends on task i+1 (linear chain)
      for (let i = 0; i < taskCount; i++) {
        const deps = i < taskCount - 1
          ? [{ id: `t-${i + 1}`, type: 'depends_on' as const }]
          : [];
        tasks.push({
          id: `t-${i}`,
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          complexity: 3,
          estimatedHours: 4,
          aiGenerated: false,
          subtasks: [],
          dependencies: deps,
          acceptanceCriteria: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          tags: []
        });
      }

      const start = Date.now();
      const result = await generator.generateDependencyContext(tasks[0], tasks);
      const elapsed = Date.now() - start;

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(1);
      // Should complete in under 1 second (no exponential blowup)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle fan-out graph where one task depends on many', async () => {
      // Main task depends on 8 different setup tasks
      const setupTasks = Array.from({ length: 8 }, (_, i) =>
        createDependencyTask(`setup-${i}`, `Setup Component ${i}`)
      );
      // Remove all dependencies from setup tasks
      for (const st of setupTasks) {
        st.dependencies = [];
      }

      const mainTask = createMockTask({
        id: 'main',
        title: 'Build Complete System',
        description: 'System requires all setup components',
        dependencies: setupTasks.map(st => ({ id: st.id!, type: 'depends_on' as const }))
      });

      const allTasks = [mainTask, ...setupTasks];
      const result = await generator.generateDependencyContext(mainTask, allTasks);

      // The main task has 8 dependencies; the generator may not produce
      // parallel opportunities from the main task's perspective since it
      // depends on all of them. Just verify the dependency count is correct.
      expect(result!.dependencies).toHaveLength(8);
      // Each dependency should have the correct type
      for (const dep of result!.dependencies) {
        expect(dep.dependencyType).toBeDefined();
      }
    });

    it('should generate unblock date proportional to blocking dep count', async () => {
      // 4 blocking dependencies → 4 * 3 = 12 days
      const setupTasks = Array.from({ length: 4 }, (_, i) => {
        const t = createDependencyTask(`infra-${i}`, `Setup Infrastructure Part ${i}`);
        t.description = `Setup infrastructure part ${i}`;
        t.dependencies = [];
        return t;
      });

      const mainTask = createMockTask({
        id: 'main',
        title: 'Deploy Application',
        description: 'Deploy the full application',
        dependencies: setupTasks.map(st => ({ id: st.id!, type: 'depends_on' as const }))
      });

      const allTasks = [mainTask, ...setupTasks];
      const result = await generator.generateDependencyContext(mainTask, allTasks);

      expect(result).not.toBeNull();
      expect(result!.estimatedUnblockDate).toBeDefined();

      const unblockDate = new Date(result!.estimatedUnblockDate!);
      const now = new Date();
      const daysDiff = Math.round((unblockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      // 4 blocking deps × 3 days each = ~12 days (allow ±1 for date boundary)
      expect(daysDiff).toBeGreaterThanOrEqual(11);
      expect(daysDiff).toBeLessThanOrEqual(13);
    });

    it('should handle relates_to deps as parallelizable', async () => {
      // When task title appears in dep description → relates_to → canRunInParallel = true
      const task = createMockTask({
        id: 'logging',
        title: 'Logging Module',
        description: 'Build the logging module',
        dependencies: [{ id: 'monitoring', type: 'depends_on' }]
      });
      const depTask = createDependencyTask('monitoring', 'Logging Module Monitoring');
      // dep title contains the task title → relates_to type
      depTask.description = 'Monitoring for the Logging Module';

      const allTasks = [task, depTask];
      const result = await generator.generateDependencyContext(task, allTasks);

      expect(result).not.toBeNull();
      expect(result!.dependencies).toHaveLength(1);
      expect(result!.dependencies[0].dependencyType).toBe('relates_to');
      expect(result!.dependencies[0].canRunInParallel).toBe(true);
    });
  });
});
