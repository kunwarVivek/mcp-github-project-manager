import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskContextGenerationService } from '../../services/TaskContextGenerationService';
import {
  AITask,
  PRDDocument,
  EnhancedTaskGenerationConfig,
  TaskStatus,
  TaskPriority,
  TaskComplexity
} from '../../domain/ai-types';

describe('TaskContextGenerationService', () => {
  let service: TaskContextGenerationService;

  const mockTask: AITask = {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Create secure login and registration functionality',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    complexity: 7 as TaskComplexity,
    estimatedHours: 16,
    actualHours: 0,
    aiGenerated: true,
    parentTaskId: undefined,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [
      { id: 'ac-1', description: 'User can register with email and password', completed: false },
      { id: 'ac-2', description: 'User can login with valid credentials', completed: false }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tags: ['authentication', 'security'],
    sourcePRD: 'prd-123'
  };

  const mockPRD: PRDDocument = {
    id: 'prd-123',
    title: 'Task Management App',
    version: '1.0',
    overview: 'Build a comprehensive task management application',
    objectives: ['Improve team productivity by 30%', 'Enable real-time collaboration'],
    scope: {
      inScope: ['User management', 'Task tracking'],
      outOfScope: ['Advanced analytics'],
      assumptions: ['Users have modern browsers'],
      constraints: ['Must be mobile-responsive']
    },
    targetUsers: [],
    userJourney: 'User registers, creates tasks, collaborates with team',
    features: [],
    technicalRequirements: [],
    timeline: '6 months',
    milestones: ['MVP', 'Beta', 'Production'],
    successMetrics: ['User adoption > 1000', 'Task completion rate > 80%'],
    aiGenerated: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    author: 'product-team',
    stakeholders: ['engineering', 'design', 'product'],
    tags: ['productivity', 'collaboration']
  };

  beforeEach(() => {
    service = new TaskContextGenerationService();
  });

  describe('generateTaskContext', () => {
    it('should generate traceability-based context when AI is not available', async () => {
      // Arrange
      const config: EnhancedTaskGenerationConfig = {
        enableEnhancedGeneration: true,
        createTraceabilityMatrix: true,
        generateUseCases: true,
        createLifecycleTracking: true,
        contextLevel: 'standard',
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false,
        enforceTraceability: true,
        requireBusinessJustification: false,
        trackRequirementCoverage: true
      };

      // Act
      const result = await service.generateTaskContext(mockTask, mockPRD, config);

      // Assert
      expect(result).toBeDefined();
      expect(result.businessObjective).toBeDefined();
      expect(result.businessObjective).toContain('Improve team productivity by 30%');
      expect(result.userImpact).toBeDefined();
      expect(result.successMetrics).toBeDefined();
      expect(Array.isArray(result.successMetrics)).toBe(true);
      expect(result.successMetrics.length).toBeGreaterThan(0);
      expect(result.parentFeature).toBeDefined();
      expect(result.parentFeature.title).toBeDefined();
      expect(result.technicalConstraints).toBeDefined();
      expect(result.architecturalDecisions).toBeDefined();
      expect(result.integrationPoints).toBeDefined();
      expect(result.dataRequirements).toBeDefined();
      expect(result.prdContextSummary).toBeDefined();
      expect(result.prdContextSummary.relevantObjectives).toContain('Improve team productivity by 30%');
    });

    it('should handle string PRD input correctly', async () => {
      // Arrange
      const prdString = JSON.stringify(mockPRD);
      const config: EnhancedTaskGenerationConfig = {
        enableEnhancedGeneration: true,
        createTraceabilityMatrix: false,
        generateUseCases: false,
        createLifecycleTracking: false,
        contextLevel: 'minimal',
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false,
        enforceTraceability: false,
        requireBusinessJustification: false,
        trackRequirementCoverage: false
      };

      // Act
      const result = await service.generateTaskContext(mockTask, prdString, config);

      // Assert
      expect(result).toBeDefined();
      expect(result.businessObjective).toBeDefined();
      expect(result.userImpact).toBeDefined();
      expect(result.successMetrics).toBeDefined();
      expect(result.parentFeature).toBeDefined();
    });

    it('should provide minimal context as fallback for invalid PRD', async () => {
      // Arrange
      const invalidPRD = "invalid json content";
      const config: EnhancedTaskGenerationConfig = {
        enableEnhancedGeneration: true,
        createTraceabilityMatrix: false,
        generateUseCases: false,
        createLifecycleTracking: false,
        contextLevel: 'minimal',
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false,
        enforceTraceability: false,
        requireBusinessJustification: false,
        trackRequirementCoverage: false
      };

      // Act
      const result = await service.generateTaskContext(mockTask, invalidPRD, config);

      // Assert
      expect(result).toBeDefined();
      expect(result.businessObjective).toBeDefined();
      expect(result.businessObjective.length).toBeGreaterThan(0);
      expect(result.userImpact).toBeDefined();
      expect(result.userImpact.length).toBeGreaterThan(0);
      expect(result.successMetrics).toBeDefined();
      expect(Array.isArray(result.successMetrics)).toBe(true);
      expect(result.parentFeature).toBeDefined();
      expect(result.parentFeature.title).toBeDefined();
    });
  });

  describe('isAIContextAvailable', () => {
    it('should return a boolean value', () => {
      // Act
      const result = service.isAIContextAvailable();

      // Assert
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getDefaultContextConfig', () => {
    it('should return default configuration', () => {
      // Act
      const result = service.getDefaultContextConfig();

      // Assert
      expect(result).toBeDefined();
      expect(result.enableEnhancedGeneration).toBeDefined();
      expect(result.contextLevel).toBeDefined();
      expect(result.includeBusinessContext).toBeDefined();
      expect(result.includeTechnicalContext).toBeDefined();
      expect(result.includeImplementationGuidance).toBeDefined();
      expect(result.enforceTraceability).toBeDefined();
      expect(result.requireBusinessJustification).toBeDefined();
      expect(result.trackRequirementCoverage).toBeDefined();
      expect(['minimal', 'standard', 'full']).toContain(result.contextLevel);
    });
  });

  describe('generateImplementationGuidance', () => {
    it('should return null when AI is not available', async () => {
      // Act
      const result = await service.generateImplementationGuidance(mockTask);

      // Assert - Should return null when AI is not available
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and provide fallback context', async () => {
      // Arrange
      const config: EnhancedTaskGenerationConfig = {
        enableEnhancedGeneration: true,
        createTraceabilityMatrix: true,
        generateUseCases: true,
        createLifecycleTracking: true,
        contextLevel: 'full',
        includeBusinessContext: true, // This might fail if no AI
        includeTechnicalContext: true, // This might fail if no AI
        includeImplementationGuidance: true, // This might fail if no AI
        enforceTraceability: true,
        requireBusinessJustification: true,
        trackRequirementCoverage: true
      };

      // Act - This should not throw even if AI services are unavailable
      const result = await service.generateTaskContext(mockTask, mockPRD, config);

      // Assert
      expect(result).toBeDefined();
      expect(result.businessObjective).toBeDefined();
      expect(result.userImpact).toBeDefined();
      expect(result.successMetrics).toBeDefined();
      expect(result.parentFeature).toBeDefined();
    });

    it('should handle different context levels', async () => {
      const contextLevels: Array<'minimal' | 'standard' | 'full'> = ['minimal', 'standard', 'full'];

      for (const level of contextLevels) {
        const config: EnhancedTaskGenerationConfig = {
          enableEnhancedGeneration: true,
          createTraceabilityMatrix: false,
          generateUseCases: false,
          createLifecycleTracking: false,
          contextLevel: level,
          includeBusinessContext: false,
          includeTechnicalContext: false,
          includeImplementationGuidance: false,
          enforceTraceability: false,
          requireBusinessJustification: false,
          trackRequirementCoverage: false
        };

        const result = await service.generateTaskContext(mockTask, mockPRD, config);

        expect(result).toBeDefined();
        expect(result.businessObjective).toBeDefined();
        expect(result.parentFeature).toBeDefined();
      }
    });
  });
});
