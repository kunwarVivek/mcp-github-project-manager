/**
 * Logger DI Injection Tests
 *
 * Verifies that services properly accept ILogger via constructor injection
 * and that mocked loggers work correctly for testing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ILogger, NoopLogger } from '../../../infrastructure/logger';
import { TaskPriority, TaskStatus } from '../../../domain/ai-task-types';

// ---------------------------------------------------------------------------
// Mock Logger Factory
// ---------------------------------------------------------------------------

function createMockLogger(): ILogger & { calls: Record<string, Mock> } {
  const calls = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    debug: calls.debug,
    info: calls.info,
    warn: calls.warn,
    error: calls.error,
    calls,
  };
}

// ---------------------------------------------------------------------------
// Service Tests — Logger Injection
// ---------------------------------------------------------------------------

describe('Logger DI Injection', () => {
  describe('AIServiceFactory', () => {
    it('accepts ILogger via getInstance() and uses it', async () => {
      const mockLogger = createMockLogger();
      const { AIServiceFactory } = await import('../../../services/ai/AIServiceFactory');

      // Reset singleton for clean test
      // @ts-expect-error accessing private static for test reset
      AIServiceFactory.instance = undefined;

      const factory = AIServiceFactory.getInstance(mockLogger);

      // The logger should be used when parsing model config
      expect(mockLogger.calls.warn).toHaveBeenCalled();
    });

    it('falls back to Logger.getInstance() when no logger provided', async () => {
      const { AIServiceFactory } = await import('../../../services/ai/AIServiceFactory');

      // @ts-expect-error accessing private static for test reset
      AIServiceFactory.instance = undefined;

      // Should not throw when no logger provided
      const factory = AIServiceFactory.getInstance();
      expect(factory).toBeDefined();
    });
  });

  describe('AITaskProcessor', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getModel: vi.fn(() => null),
        getBestAvailableModel: vi.fn(() => null),
      };

      const { AITaskProcessor } = await import('../../../services/ai/AITaskProcessor');
      const processor = new AITaskProcessor(mockFactory as any, mockLogger);

      // Verify the logger was injected (check via testConnection which uses logger)
      const result = await processor.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('DuplicateDetectionService', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();

      const { DuplicateDetectionService } = await import('../../../services/ai/DuplicateDetectionService');
      const service = new DuplicateDetectionService(undefined, mockLogger);

      // Trigger fallback detection (no AI available)
      const result = await service.detectDuplicates({
        issueTitle: 'Test issue',
        issueDescription: 'Description',
        existingIssues: [],
      });

      // Should complete without error
      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('FeatureAnalysisService', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getMainModel: vi.fn(() => null),
        getBestAvailableModel: vi.fn(() => null),
      };

      const { FeatureAnalysisService } = await import('../../../services/feature/FeatureAnalysisService');
      const service = new FeatureAnalysisService(mockFactory as any, mockLogger);

      // Try to analyze without AI - should use logger for warning
      try {
        await service.analyzeFeatureRequest({
          featureIdea: 'Test feature',
          description: 'Description',
          requestedBy: 'test-user',
        });
      } catch {
        // Expected to throw since no AI model available
      }

      // Logger should have been called for the warning/error
      expect(mockLogger.calls.error).toHaveBeenCalled();
    });
  });

  describe('TaskLifecycleService', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getMainModel: vi.fn(() => null),
        getBestAvailableModel: vi.fn(() => null),
      };

      const { TaskLifecycleService } = await import('../../../services/feature/TaskLifecycleService');
      const service = new TaskLifecycleService(mockFactory as any, mockLogger);

      // Create initial state (should work without AI)
      const state = service.createInitialTaskLifecycleState({
        id: 'task-1',
        title: 'Test Task',
        description: 'Description',
        priority: TaskPriority.MEDIUM,
        complexity: 5,
        estimatedHours: 8,
        status: TaskStatus.PENDING,
        aiGenerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: [],
        dependencies: [],
        acceptanceCriteria: [],
        tags: [],
      });

      expect(state).toBeDefined();
      expect(state.taskId).toBe('task-1');
    });

    it('uses logger when AI is unavailable for getNextTaskActions', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getMainModel: vi.fn(() => null),
        getBestAvailableModel: vi.fn(() => null),
      };

      const { TaskLifecycleService } = await import('../../../services/feature/TaskLifecycleService');
      const service = new TaskLifecycleService(mockFactory as any, mockLogger);

      const state = service.createInitialTaskLifecycleState({
        id: 'task-1',
        title: 'Test Task',
        description: 'Description',
        priority: TaskPriority.MEDIUM,
        complexity: 5,
        estimatedHours: 8,
        status: TaskStatus.PENDING,
        aiGenerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: [],
        dependencies: [],
        acceptanceCriteria: [],
        tags: [],
      });

      try {
        await service.getNextTaskActions(state);
      } catch {
        // Expected to throw since no AI model available
      }

      // Logger should have been called for the error
      expect(mockLogger.calls.error).toHaveBeenCalled();
    });
  });

  describe('ContextualReferenceGenerator', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getBestAvailableModel: vi.fn(() => null),
      };

      const { ContextualReferenceGenerator } = await import('../../../services/context/ContextualReferenceGenerator');
      const generator = new ContextualReferenceGenerator(mockFactory as any, mockLogger);

      // Generate basic references (no AI)
      const refs = generator['generateBasicReferences'](
        { id: '1', title: 'Test', description: 'Desc', priority: TaskPriority.MEDIUM, complexity: 5 as any, estimatedHours: 8, status: TaskStatus.PENDING, aiGenerated: false, createdAt: '', updatedAt: '', subtasks: [], dependencies: [], acceptanceCriteria: [], tags: [] },
        'PRD content'
      );

      expect(refs).toBeDefined();
      expect(refs.prdSections).toBeDefined();
    });
  });

  describe('DependencyContextGenerator', () => {
    it('accepts ILogger via constructor', async () => {
      const mockLogger = createMockLogger();
      const mockFactory = {
        getBestAvailableModel: vi.fn(() => null),
      };

      const { DependencyContextGenerator } = await import('../../../services/context/DependencyContextGenerator');
      const generator = new DependencyContextGenerator(mockFactory as any, mockLogger);

      // Generate basic dependency context (no AI)
      const task = {
        id: '1',
        title: 'Test Task',
        description: 'Description',
        priority: TaskPriority.MEDIUM,
        complexity: 5 as any,
        estimatedHours: 8,
        status: TaskStatus.PENDING,
        aiGenerated: false,
        createdAt: '',
        updatedAt: '',
        subtasks: [],
        dependencies: [],
        acceptanceCriteria: [],
        tags: [],
      };

      const ctx = generator['generateBasicDependencyContext'](task, [task], []);

      expect(ctx).toBeDefined();
      expect(ctx.dependencies).toBeDefined();
    });
  });

  describe('NoopLogger', () => {
    it('implements ILogger interface correctly', () => {
      const noop = new NoopLogger();

      // Should not throw when calling any method
      expect(() => noop.debug('test')).not.toThrow();
      expect(() => noop.info('test')).not.toThrow();
      expect(() => noop.warn('test')).not.toThrow();
      expect(() => noop.error('test')).not.toThrow();
    });

    it('can be used as a mock logger in tests', () => {
      const noop = new NoopLogger();

      // Verify it satisfies ILogger
      const logger: ILogger = noop;
      expect(logger).toBeDefined();
    });
  });

  describe('Mock Logger Patterns', () => {
    it('mock logger captures all calls for verification', async () => {
      const mockLogger = createMockLogger();

      // Simulate service calls
      mockLogger.info('Starting process');
      mockLogger.warn('Low memory');
      mockLogger.error('Failed to connect', new Error('timeout'));
      mockLogger.debug('Details:', { key: 'value' });

      // Verify calls
      expect(mockLogger.calls.info).toHaveBeenCalledWith('Starting process');
      expect(mockLogger.calls.warn).toHaveBeenCalledWith('Low memory');
      expect(mockLogger.calls.error).toHaveBeenCalledWith('Failed to connect', expect.any(Error));
      expect(mockLogger.calls.debug).toHaveBeenCalledWith('Details:', { key: 'value' });
    });

    it('mock logger can be reset between tests', () => {
      const mockLogger = createMockLogger();

      mockLogger.info('first call');
      expect(mockLogger.calls.info).toHaveBeenCalledTimes(1);

      // Reset
      mockLogger.calls.info.mockClear();

      mockLogger.info('second call');
      expect(mockLogger.calls.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.calls.info).toHaveBeenCalledWith('second call');
    });
  });
});
