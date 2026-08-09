import { vi } from 'vitest';
/**
 * Unit tests for TaskLifecycleService
 *
 * Tests task lifecycle state management, progress calculation,
 * phase determination, and AI-powered recommendations.
 */

import { TaskLifecycleService } from '../../../src/services/feature/TaskLifecycleService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { generateObject } from 'ai';
import type {
  TaskLifecycleState,
  TaskPhaseStatus
} from '../../../src/domain/feature-lifecycle-types';
import { type AITask, TaskPriority, TaskStatus, type TaskComplexity } from '../../../src/domain/ai-types';

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
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

const mockGenerateObject = generateObject as MockedFunction<typeof generateObject>;
const mockGetMainModel = vi.fn();
const mockGetBestAvailableModel = vi.fn();

describe('TaskLifecycleService', () => {
  let service: TaskLifecycleService;

  const mockTask: AITask = {
    id: 'task-1',
    title: 'Implement OAuth',
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    AIServiceFactory.getInstance.mockReturnValue({
      getMainModel: mockGetMainModel,
      getBestAvailableModel: mockGetBestAvailableModel
    } as any);

    service = new TaskLifecycleService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default AIServiceFactory', () => {
      expect(service).toBeDefined();
      expect(AIServiceFactory.getInstance).toHaveBeenCalled();
    });

    it('should create instance with injected AIServiceFactory', () => {
      const mockFactory = {
        getMainModel: vi.fn(),
        getBestAvailableModel: vi.fn()
      } as any;
      const customService = new TaskLifecycleService(mockFactory);
      expect(customService).toBeDefined();
    });
  });

  describe('createInitialTaskLifecycleState', () => {
    it('should create lifecycle state with correct task ID', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.taskId).toBe('task-1');
    });

    it('should set current phase to "planning"', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.currentPhase).toBe('planning');
    });

    it('should initialize all phases as "not_started"', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.phases.planning.status).toBe('not_started');
      expect(state.phases.development.status).toBe('not_started');
      expect(state.phases.testing.status).toBe('not_started');
      expect(state.phases.review.status).toBe('not_started');
      expect(state.phases.deployment.status).toBe('not_started');
    });

    it('should set progress percentage to 0', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.progressPercentage).toBe(0);
    });

    it('should set empty blockers array', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.blockers).toEqual([]);
    });

    it('should calculate estimated completion based on estimated hours', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      const expectedCompletion = new Date(
        Date.now() + 16 * 60 * 60 * 1000
      ).toISOString();

      expect(state.estimatedCompletion).toBe(expectedCompletion);
    });

    it('should set undefined for optional phase properties', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.phases.planning.startedAt).toBeUndefined();
      expect(state.phases.planning.completedAt).toBeUndefined();
      expect(state.phases.planning.assignee).toBeUndefined();
      expect(state.phases.planning.notes).toBeUndefined();
    });

    it('should initialize artifacts as empty array', () => {
      const state = service.createInitialTaskLifecycleState(mockTask);

      expect(state.phases.planning.artifacts).toEqual([]);
    });
  });

  describe('updateTaskLifecycle', () => {
    const initialState: TaskLifecycleState = {
      taskId: 'task-1',
      currentPhase: 'planning',
      phases: {
        planning: { status: 'not_started', artifacts: [] },
        development: { status: 'not_started', artifacts: [] },
        testing: { status: 'not_started', artifacts: [] },
        review: { status: 'not_started', artifacts: [] },
        deployment: { status: 'not_started', artifacts: [] }
      },
      blockers: [],
      progressPercentage: 0,
      estimatedCompletion: '2024-01-16T12:00:00Z'
    };

    describe('Phase Updates', () => {
      it('should update phase status to "in_progress"', async () => {
        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'in_progress'
          }
        });

        expect(result.phases.planning.status).toBe('in_progress');
      });

      it('should set startedAt when status changes to "in_progress"', async () => {
        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'in_progress'
          }
        });

        expect(result.phases.planning.startedAt).toBe('2024-01-15T12:00:00.000Z');
      });

      it('should set completedAt when status changes to "completed"', async () => {
        const inProgressState = {
          ...initialState,
          phases: {
            ...initialState.phases,
            planning: {
              ...initialState.phases.planning,
              status: 'in_progress' as TaskPhaseStatus,
              startedAt: '2024-01-15T10:00:00Z'
            }
          }
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: inProgressState,
          updateData: {
            phase: 'planning',
            status: 'completed'
          }
        });

        expect(result.phases.planning.completedAt).toBe('2024-01-15T12:00:00.000Z');
      });

      it('should update assignee', async () => {
        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'in_progress',
            assignee: 'alice'
          }
        });

        expect(result.phases.planning.assignee).toBe('alice');
      });

      it('should update notes', async () => {
        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'in_progress',
            notes: 'Starting research'
          }
        });

        expect(result.phases.planning.notes).toBe('Starting research');
      });

      it('should update artifacts', async () => {
        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'completed',
            artifacts: ['doc-1.md', 'design.pdf']
          }
        });

        expect(result.phases.planning.artifacts).toEqual(['doc-1.md', 'design.pdf']);
      });

      it('should reject invalid status', async () => {
        await expect(service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: {
            phase: 'planning',
            status: 'invalid_status'
          }
        })).rejects.toThrow('Invalid status');
      });
    });

    describe('Blocker Updates', () => {
      it('should update blockers', async () => {
        const blockers = [
          {
            id: 'blocker-1',
            type: 'dependency' as const,
            description: 'Waiting for API',
            severity: 'high' as const,
            reportedAt: '2024-01-15T00:00:00Z'
          }
        ];

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: initialState,
          updateData: { blockers }
        });

        expect(result.blockers).toEqual(blockers);
      });
    });

    describe('Progress Calculation', () => {
      it('should calculate 0% progress when no phases completed', async () => {
        const freshState: TaskLifecycleState = {
          taskId: 'task-1',
          currentPhase: 'planning',
          phases: {
            planning: { status: 'not_started', artifacts: [] },
            development: { status: 'not_started', artifacts: [] },
            testing: { status: 'not_started', artifacts: [] },
            review: { status: 'not_started', artifacts: [] },
            deployment: { status: 'not_started', artifacts: [] }
          },
          blockers: [],
          progressPercentage: 0,
          estimatedCompletion: '2024-01-16T12:00:00Z'
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: freshState,
          updateData: {}
        });

        expect(result.progressPercentage).toBe(0);
      });

      it('should calculate 20% progress when 1 of 5 phases completed', async () => {
        const stateWithCompletedPlanning: TaskLifecycleState = {
          taskId: 'task-1',
          currentPhase: 'planning',
          phases: {
            planning: { status: 'completed', artifacts: [] },
            development: { status: 'not_started', artifacts: [] },
            testing: { status: 'not_started', artifacts: [] },
            review: { status: 'not_started', artifacts: [] },
            deployment: { status: 'not_started', artifacts: [] }
          },
          blockers: [],
          progressPercentage: 0,
          estimatedCompletion: '2024-01-16T12:00:00Z'
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: stateWithCompletedPlanning,
          updateData: {}
        });

        expect(result.progressPercentage).toBe(20);
      });

      it('should calculate 100% progress when all phases completed', async () => {
        const allCompletedState: TaskLifecycleState = {
          taskId: 'task-1',
          currentPhase: 'planning',
          phases: {
            planning: { status: 'completed', artifacts: [] },
            development: { status: 'completed', artifacts: [] },
            testing: { status: 'completed', artifacts: [] },
            review: { status: 'completed', artifacts: [] },
            deployment: { status: 'completed', artifacts: [] }
          },
          blockers: [],
          progressPercentage: 0,
          estimatedCompletion: '2024-01-16T12:00:00Z'
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: allCompletedState,
          updateData: {}
        });

        expect(result.progressPercentage).toBe(100);
      });
    });

    describe('Phase Determination', () => {
      it('should determine current phase as first non-completed phase', async () => {
        const stateWithCompletedPlanning = {
          ...initialState,
          phases: {
            ...initialState.phases,
            planning: {
              ...initialState.phases.planning,
              status: 'completed' as TaskPhaseStatus
            }
          }
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: stateWithCompletedPlanning,
          updateData: {}
        });

        expect(result.currentPhase).toBe('development');
      });

      it('should determine "completed" when all phases are completed', async () => {
        const allCompletedState = {
          ...initialState,
          phases: {
            planning: { ...initialState.phases.planning, status: 'completed' as TaskPhaseStatus },
            development: { ...initialState.phases.development, status: 'completed' as TaskPhaseStatus },
            testing: { ...initialState.phases.testing, status: 'completed' as TaskPhaseStatus },
            review: { ...initialState.phases.review, status: 'completed' as TaskPhaseStatus },
            deployment: { ...initialState.phases.deployment, status: 'completed' as TaskPhaseStatus }
          }
        };

        const result = await service.updateTaskLifecycle({
          taskId: 'task-1',
          currentState: allCompletedState,
          updateData: {}
        });

        expect(result.currentPhase).toBe('completed');
      });
    });
  });

  describe('getNextTaskActions', () => {
    const mockLifecycle: TaskLifecycleState = {
      taskId: 'task-1',
      currentPhase: 'development',
      phases: {
        planning: { status: 'completed', artifacts: [] },
        development: { status: 'in_progress', artifacts: [] },
        testing: { status: 'not_started', artifacts: [] },
        review: { status: 'not_started', artifacts: [] },
        deployment: { status: 'not_started', artifacts: [] }
      },
      blockers: [
        {
          id: 'blocker-1',
          type: 'dependency',
          description: 'Waiting for API',
          severity: 'high',
          reportedAt: '2024-01-15T00:00:00Z'
        }
      ],
      progressPercentage: 40,
      estimatedCompletion: '2024-01-17T12:00:00Z'
    };

    describe('AI Path', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue({ id: 'test-model' });
        // partial mock — only fields consumed by getNextTaskActions
        mockGenerateObject.mockResolvedValue({ object: {
          nextActions: ['Focus on core functionality first', 'Implement comprehensive testing'],
          recommendations: ['Focus on core functionality first', 'Implement comprehensive testing'],
        }} as unknown as Parameters<typeof mockGenerateObject.mockResolvedValue>[0]);
      });

      it('should return actions with all required fields', async () => {
        const result = await service.getNextTaskActions(mockLifecycle);

        expect(result).toHaveProperty('nextActions');
        expect(result).toHaveProperty('blockers');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('estimatedCompletion');
      });

      it('should extract blockers from lifecycle', async () => {
        const result = await service.getNextTaskActions(mockLifecycle);

        expect(result.blockers).toContain('Waiting for API');
      });

      it('should calculate estimated completion', async () => {
        const result = await service.getNextTaskActions(mockLifecycle);

        expect(result.estimatedCompletion).toBeDefined();
        const completionDate = new Date(result.estimatedCompletion);
        expect(completionDate.getTime()).toBeGreaterThan(Date.now());
      });

      it('should pass lifecycle data to AI prompt', async () => {
        await service.getNextTaskActions(mockLifecycle);

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('task-1')
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
        await expect(service.getNextTaskActions(mockLifecycle))
          .rejects.toThrow('AI service is not available');
      });

      it('should fall back to best available model', async () => {
        mockGetMainModel.mockReturnValue(null);
        mockGetBestAvailableModel.mockReturnValue({ id: 'backup-model' });
        // partial mock — only fields consumed by getNextTaskActions
        mockGenerateObject.mockResolvedValue({ object: {
          nextActions: ['Continue with current tasks'],
          recommendations: ['Continue with current tasks'],
        }} as unknown as Parameters<typeof mockGenerateObject.mockResolvedValue>[0]);

        const result = await service.getNextTaskActions(mockLifecycle);

        expect(result).toBeDefined();
        expect(mockGetBestAvailableModel).toHaveBeenCalled();
      });
    });
  });

  describe('calculateTaskProgress', () => {
    it('should return 0 when no phases completed', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'planning',
        phases: {
          planning: { status: 'not_started', artifacts: [] },
          development: { status: 'not_started', artifacts: [] },
          testing: { status: 'not_started', artifacts: [] },
          review: { status: 'not_started', artifacts: [] },
          deployment: { status: 'not_started', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 0,
        estimatedCompletion: ''
      };

      expect(service.calculateTaskProgress(state)).toBe(0);
    });

    it('should return 100 when all phases completed', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'completed',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'completed', artifacts: [] },
          testing: { status: 'completed', artifacts: [] },
          review: { status: 'completed', artifacts: [] },
          deployment: { status: 'completed', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 100,
        estimatedCompletion: ''
      };

      expect(service.calculateTaskProgress(state)).toBe(100);
    });

    it('should calculate correct percentage for partial completion', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'testing',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'completed', artifacts: [] },
          testing: { status: 'in_progress', artifacts: [] },
          review: { status: 'not_started', artifacts: [] },
          deployment: { status: 'not_started', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 40,
        estimatedCompletion: ''
      };

      expect(service.calculateTaskProgress(state)).toBe(40);
    });
  });

  describe('determineCurrentPhase', () => {
    it('should return "planning" when planning is not completed', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'planning',
        phases: {
          planning: { status: 'not_started', artifacts: [] },
          development: { status: 'not_started', artifacts: [] },
          testing: { status: 'not_started', artifacts: [] },
          review: { status: 'not_started', artifacts: [] },
          deployment: { status: 'not_started', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 0,
        estimatedCompletion: ''
      };

      expect(service.determineCurrentPhase(state)).toBe('planning');
    });

    it('should return "development" when planning is completed', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'development',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'not_started', artifacts: [] },
          testing: { status: 'not_started', artifacts: [] },
          review: { status: 'not_started', artifacts: [] },
          deployment: { status: 'not_started', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 20,
        estimatedCompletion: ''
      };

      expect(service.determineCurrentPhase(state)).toBe('development');
    });

    it('should return "completed" when all phases are completed', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'completed',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'completed', artifacts: [] },
          testing: { status: 'completed', artifacts: [] },
          review: { status: 'completed', artifacts: [] },
          deployment: { status: 'completed', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 100,
        estimatedCompletion: ''
      };

      expect(service.determineCurrentPhase(state)).toBe('completed');
    });
  });

  describe('calculateEstimatedCompletion', () => {
    it('should calculate completion based on remaining work', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'development',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'in_progress', artifacts: [] },
          testing: { status: 'not_started', artifacts: [] },
          review: { status: 'not_started', artifacts: [] },
          deployment: { status: 'not_started', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 40,
        estimatedCompletion: ''
      };

      const result = service.calculateEstimatedCompletion(state);
      const completionDate = new Date(result);
      const expectedDays = (100 - 40) / 100 * 5; // 3 days

      expect(completionDate.getTime()).toBeCloseTo(
        Date.now() + expectedDays * 24 * 60 * 60 * 1000,
        -3 // within 1 second
      );
    });

    it('should return near-now for 100% completion', () => {
      const state: TaskLifecycleState = {
        taskId: 'task-1',
        currentPhase: 'completed',
        phases: {
          planning: { status: 'completed', artifacts: [] },
          development: { status: 'completed', artifacts: [] },
          testing: { status: 'completed', artifacts: [] },
          review: { status: 'completed', artifacts: [] },
          deployment: { status: 'completed', artifacts: [] }
        },
        blockers: [],
        progressPercentage: 100,
        estimatedCompletion: ''
      };

      const result = service.calculateEstimatedCompletion(state);
      const completionDate = new Date(result);

      expect(completionDate.getTime()).toBeCloseTo(Date.now(), -3);
    });
  });

  describe('extractNextActions', () => {
    it('should return default next actions', () => {
      const actions = service.extractNextActions('Any analysis');

      expect(actions).toContain('Review requirements');
      expect(actions).toContain('Start implementation');
      expect(actions).toContain('Set up testing environment');
    });
  });

  describe('extractRecommendations', () => {
    it('should return default recommendations', () => {
      const recommendations = service.extractRecommendations('Any analysis');

      expect(recommendations).toContain('Focus on core functionality first');
      expect(recommendations).toContain('Implement comprehensive testing');
      expect(recommendations).toContain('Plan for gradual rollout');
    });
  });
});
