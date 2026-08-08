import { vi } from 'vitest';
/**
 * Unit tests for FeatureExpansionService
 *
 * Tests feature-to-task expansion, risk assessment, milestone suggestion,
 * and dependency detection.
 */

import { FeatureExpansionService } from '../../../src/services/feature/FeatureExpansionService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { TaskGenerationService } from '../../../src/services/TaskGenerationService';
import { generateObject } from 'ai';
import {
  FeatureRequirement,
  AITask,
  TaskStatus,
  TaskPriority,
  TaskComplexity
} from '../../../src/domain/ai-types';

// Mock dependencies
vi.mock('../../../src/services/ai/AIServiceFactory', () => {
  const mockInstance = {
    getModel: vi.fn(),
    getMainModel: vi.fn(),
    getFallbackModel: vi.fn(),
    getPRDModel: vi.fn(),
    getResearchModel: vi.fn(),
    getBestAvailableModel: vi.fn(),
    isAIAvailable: vi.fn(),
    getConfiguration: vi.fn(),
    validateConfiguration: vi.fn(),
  };
  return {
    AIServiceFactory: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
      instance: undefined,
    },
  };
});
vi.mock('../../../src/services/TaskGenerationService', () => ({
      TaskGenerationService: vi.fn().mockImplementation(function() { return ({
        generateTasksFromPRD: vi.fn(),
        generateSubtasks: vi.fn(),
      })),
    }));
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

const mockGenerateObject = generateObject as MockedFunction<typeof generateObject>;
const mockGetMainModel = vi.fn();
const mockGetBestAvailableModel = vi.fn();
const mockDetectTaskDependencies = vi.fn();

describe('FeatureExpansionService', () => {
  let service: FeatureExpansionService;
  let mockTaskService: Mocked<TaskGenerationService>;

  const mockFeature: FeatureRequirement = {
    id: 'feat-1',
    title: 'User Authentication',
    description: 'Implement OAuth and MFA authentication',
    priority: TaskPriority.HIGH,
    userStories: [
      'As a user, I want to login with OAuth',
      'As a user, I want to enable MFA'
    ],
    acceptanceCriteria: [
      'OAuth login works',
      'MFA can be enabled',
      'Session management works'
    ],
    estimatedComplexity: 7,
    dependencies: []
  };

  const mockAITasks: AITask[] = [
    {
      id: 'task-1',
      title: 'Implement OAuth Provider',
      description: 'Set up OAuth integration',
      priority: TaskPriority.HIGH,
      complexity: 6 as TaskComplexity,
      estimatedHours: 16,
      status: TaskStatus.PENDING,
      tags: ['auth'],
      dependencies: [],
      subtasks: [],
      acceptanceCriteria: [],
      aiGenerated: true,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z'
    },
    {
      id: 'task-2',
      title: 'Implement MFA',
      description: 'Add multi-factor authentication',
      priority: TaskPriority.HIGH,
      complexity: 8 as TaskComplexity,
      estimatedHours: 24,
      status: TaskStatus.PENDING,
      tags: ['auth', 'security'],
      dependencies: [{ id: 'task-1', type: 'blocks' }],
      subtasks: [],
      acceptanceCriteria: [],
      aiGenerated: true,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    AIServiceFactory.getInstance.mockReturnValue({
      getMainModel: mockGetMainModel,
      getBestAvailableModel: mockGetBestAvailableModel
    } as any);

    mockTaskService = {
      detectTaskDependencies: mockDetectTaskDependencies
    } as any;

    service = new FeatureExpansionService(undefined, mockTaskService);
  });

  describe('constructor', () => {
    it('should create instance with injected services', () => {
      expect(service).toBeDefined();
    });

    it('should create instance with default services', () => {
      const defaultService = new FeatureExpansionService();
      expect(defaultService).toBeDefined();
    });
  });

  describe('expandFeatureToTasks', () => {
    describe('AI Path', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue({ id: 'test-model' });
        mockGenerateObject.mockResolvedValue({
          object: mockAITasks
        } as any);
        mockDetectTaskDependencies.mockImplementation((tasks) => Promise.resolve(tasks));
      });

      it('should return expansion result with all required fields', async () => {
        const result = await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(result).toHaveProperty('feature');
        expect(result).toHaveProperty('tasks');
        expect(result).toHaveProperty('dependencies');
        expect(result).toHaveProperty('estimatedEffort');
        expect(result).toHaveProperty('suggestedMilestone');
        expect(result).toHaveProperty('riskAssessment');
      });

      it('should return tasks with enriched metadata', async () => {
        const result = await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(result.tasks).toHaveLength(2);
        result.tasks.forEach(task => {
          expect(task).toHaveProperty('id');
          expect(task).toHaveProperty('status', TaskStatus.PENDING);
          expect(task).toHaveProperty('aiGenerated', true);
          expect(task).toHaveProperty('createdAt');
          expect(task).toHaveProperty('updatedAt');
          expect(task).toHaveProperty('sourcePRD', 'feature-feat-1');
          expect(task.tags).toContain('feature-expansion');
          expect(task.tags).toContain('feature-feat-1');
        });
      });

      it('should calculate total estimated effort', async () => {
        const result = await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(result.estimatedEffort).toBe(40); // 16 + 24
      });

      it('should call task service for dependency detection', async () => {
        await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(mockDetectTaskDependencies).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'task-1' }),
            expect.objectContaining({ id: 'task-2' })
          ])
        );
      });

      it('should pass feature details to AI prompt', async () => {
        await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('User Authentication')
          })
        );
      });

      it('should pass system context when provided', async () => {
        await service.expandFeatureToTasks({
          feature: mockFeature,
          systemContext: { techStack: 'Node.js, React' }
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Node.js')
          })
        );
      });

      it('should pass integration points when provided', async () => {
        await service.expandFeatureToTasks({
          feature: mockFeature,
          integrationPoints: ['GitHub OAuth', 'Auth0']
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('GitHub OAuth')
          })
        );
      });
    });

    describe('Fallback Path', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue(null);
        mockGetBestAvailableModel.mockReturnValue(null);
      });

      it('should throw error when AI model is unavailable', async () => {
        await expect(service.expandFeatureToTasks({
          feature: mockFeature
        })).rejects.toThrow('AI service is not available');
      });

      it('should fall back to best available model', async () => {
        mockGetMainModel.mockReturnValue(null);
        mockGetBestAvailableModel.mockReturnValue({ id: 'backup-model' });
        mockGenerateObject.mockResolvedValue({
          object: mockAITasks
        } as any);
        mockDetectTaskDependencies.mockImplementation((tasks) => Promise.resolve(tasks));

        const result = await service.expandFeatureToTasks({
          feature: mockFeature
        });

        expect(result).toBeDefined();
        expect(mockGetBestAvailableModel).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue({ id: 'test-model' });
      });

      it('should handle AI generation errors', async () => {
        mockGenerateObject.mockRejectedValue(new Error('API error'));

        await expect(service.expandFeatureToTasks({
          feature: mockFeature
        })).rejects.toThrow();
      });

      it('should handle task dependency detection errors', async () => {
        mockGenerateObject.mockResolvedValue({
          object: mockAITasks
        } as any);
        mockDetectTaskDependencies.mockRejectedValue(new Error('Detection failed'));

        await expect(service.expandFeatureToTasks({
          feature: mockFeature
        })).rejects.toThrow('Detection failed');
      });
    });
  });

  describe('assessImplementationRisks', () => {
    it('should return low risk for simple tasks', () => {
      const simpleTasks: AITask[] = [
        { ...mockAITasks[0], complexity: 3 as TaskComplexity },
        { ...mockAITasks[1], complexity: 4 as TaskComplexity }
      ];

      const result = service.assessImplementationRisks(simpleTasks, mockFeature);

      expect(result.level).toBe('low');
      expect(result.factors).toBeDefined();
      expect(result.mitigations).toBeDefined();
    });

    it('should return medium risk when 10-30% tasks are high complexity', () => {
      // 2 out of 10 = 20% > 10% but <= 30%
      const tasks: AITask[] = [
        { ...mockAITasks[0], complexity: 8 as TaskComplexity },
        { ...mockAITasks[1], complexity: 7 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-3', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-4', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-5', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-6', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-7', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-8', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-9', complexity: 3 as TaskComplexity },
        { ...mockAITasks[0], id: 'task-10', complexity: 3 as TaskComplexity }
      ];

      const result = service.assessImplementationRisks(tasks, mockFeature);

      expect(result.level).toBe('medium');
    });

    it('should return high risk when >30% tasks are high complexity', () => {
      const tasks: AITask[] = [
        { ...mockAITasks[0], complexity: 8 as TaskComplexity },
        { ...mockAITasks[1], complexity: 9 as TaskComplexity }
      ];

      const result = service.assessImplementationRisks(tasks, mockFeature);

      expect(result.level).toBe('high');
    });

    it('should include feature complexity in factors', () => {
      const result = service.assessImplementationRisks(mockAITasks, mockFeature);

      expect(result.factors.some(f => f.includes('7/10'))).toBe(true);
    });

    it('should include mitigations', () => {
      const result = service.assessImplementationRisks(mockAITasks, mockFeature);

      expect(result.mitigations.length).toBeGreaterThan(0);
      expect(result.mitigations.some(m => m.includes('Break down'))).toBe(true);
    });
  });

  describe('extractTaskDependencies', () => {
    it('should extract all dependencies from tasks', () => {
      const deps = service.extractTaskDependencies(mockAITasks);

      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe('task-1');
    });

    it('should return empty array when no dependencies', () => {
      const tasksWithoutDeps = mockAITasks.map(t => ({
        ...t,
        dependencies: []
      }));

      const deps = service.extractTaskDependencies(tasksWithoutDeps);

      expect(deps).toEqual([]);
    });
  });

  describe('suggestMilestone', () => {
    it('should suggest "Current Sprint" for critical priority', () => {
      expect(service.suggestMilestone(100, TaskPriority.CRITICAL)).toBe('Current Sprint');
    });

    it('should suggest "Next Sprint" for low effort', () => {
      expect(service.suggestMilestone(30, TaskPriority.HIGH)).toBe('Next Sprint');
    });

    it('should suggest "Current Quarter" for medium effort', () => {
      expect(service.suggestMilestone(80, TaskPriority.MEDIUM)).toBe('Current Quarter');
    });

    it('should suggest "Next Quarter" for high effort', () => {
      expect(service.suggestMilestone(150, TaskPriority.LOW)).toBe('Next Quarter');
    });

    it('should handle boundary values', () => {
      expect(service.suggestMilestone(40, TaskPriority.MEDIUM)).toBe('Next Sprint');
      expect(service.suggestMilestone(41, TaskPriority.MEDIUM)).toBe('Current Quarter');
      expect(service.suggestMilestone(120, TaskPriority.MEDIUM)).toBe('Current Quarter');
      expect(service.suggestMilestone(121, TaskPriority.MEDIUM)).toBe('Next Quarter');
    });
  });
});
