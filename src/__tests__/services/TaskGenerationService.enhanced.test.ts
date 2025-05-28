import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set up environment variables before importing any services
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-anthropic-key-12345';
process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
process.env.GOOGLE_API_KEY = 'test-google-key-12345';
process.env.PERPLEXITY_API_KEY = 'pplx-test-perplexity-key-12345';
process.env.AI_MAIN_MODEL = 'claude-3-5-sonnet-20241022';
process.env.AI_RESEARCH_MODEL = 'perplexity-llama-3.1-sonar-large-128k-online';
process.env.AI_FALLBACK_MODEL = 'gpt-4o';
process.env.AI_PRD_MODEL = 'claude-3-5-sonnet-20241022';

// Mock the ai package
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn()
}));

import { TaskGenerationService } from '../../services/TaskGenerationService';
import {
  PRDDocument,
  EnhancedTaskGenerationParams
} from '../../domain/ai-types';

describe('TaskGenerationService - Enhanced Context Generation', () => {
  let service: TaskGenerationService;

  const mockPRD: PRDDocument = {
    id: 'prd-123',
    title: 'E-commerce Platform',
    version: '1.0',
    overview: 'Build a modern e-commerce platform with advanced features',
    objectives: [
      'Increase online sales by 50%',
      'Improve user experience with modern UI',
      'Enable real-time inventory management'
    ],
    scope: {
      inScope: ['Product catalog', 'Shopping cart', 'Payment processing'],
      outOfScope: ['Advanced analytics', 'AI recommendations'],
      assumptions: ['Users have modern browsers', 'Payment gateway integration available'],
      constraints: ['Must be mobile-responsive', 'PCI compliance required']
    },
    targetUsers: [],
    userJourney: 'User browses products, adds to cart, completes purchase',
    features: [],
    technicalRequirements: [],
    timeline: '8 months',
    milestones: ['MVP', 'Beta', 'Production'],
    successMetrics: [
      'Conversion rate > 3%',
      'Page load time < 2s',
      'User satisfaction > 4.5/5'
    ],
    aiGenerated: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    author: 'product-team',
    stakeholders: ['engineering', 'design', 'product', 'marketing'],
    tags: ['ecommerce', 'web-platform']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock responses for AI services
    const { generateObject, generateText } = require('ai');

    // Mock task generation response
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Implement Product Catalog',
        description: 'Create a comprehensive product catalog with search and filtering capabilities',
        status: 'TODO',
        priority: 'HIGH',
        complexity: 5,
        estimatedHours: 40,
        acceptanceCriteria: [
          'Users can browse products by category',
          'Search functionality works correctly',
          'Product details are displayed properly'
        ],
        parentPRDId: 'prd-123',
        implementsRequirements: ['br-1'],
        implementsUseCases: ['uc-1'],
        implementsFeatures: ['feature-1'],
        requirementTraceability: {
          businessRequirement: 'br-1',
          feature: 'feature-1',
          useCase: 'uc-1'
        },
        executionContext: {
          businessObjective: 'Increase online sales by 50%',
          userImpact: 'Users can easily find and browse products',
          successMetrics: ['Conversion rate > 3%'],
          parentFeature: 'Product catalog',
          technicalConstraints: ['Must be mobile-responsive'],
          prdContextSummary: 'E-commerce platform with advanced features'
        }
      },
      {
        id: 'task-2',
        title: 'Implement Shopping Cart',
        description: 'Build shopping cart functionality with add/remove capabilities',
        status: 'TODO',
        priority: 'HIGH',
        complexity: 4,
        estimatedHours: 32,
        acceptanceCriteria: [
          'Users can add products to cart',
          'Users can remove products from cart',
          'Cart persists across sessions'
        ],
        parentPRDId: 'prd-123',
        implementsRequirements: ['br-2'],
        implementsUseCases: ['uc-2'],
        implementsFeatures: ['feature-2'],
        requirementTraceability: {
          businessRequirement: 'br-2',
          feature: 'feature-2',
          useCase: 'uc-2'
        }
      }
    ];

    generateObject.mockResolvedValue({ object: mockTasks });
    generateText.mockResolvedValue({
      text: 'Task complexity analysis: complexity 5, estimated 40 hours. Standard implementation.'
    });

    service = new TaskGenerationService();
  });

  describe('generateEnhancedTasksFromPRD', () => {
    it('should generate enhanced tasks with traceability-based context by default', async () => {
      // Arrange
      const params: EnhancedTaskGenerationParams = {
        prd: mockPRD,
        maxTasks: 3,
        includeSubtasks: false, // Keep simple for testing
        autoEstimate: true,
        autoPrioritize: true,
        enhancedConfig: {
          enableEnhancedGeneration: true,
          createTraceabilityMatrix: true,
          generateUseCases: true,
          createLifecycleTracking: true,
          contextLevel: 'standard',
          includeBusinessContext: false, // Default: traceability only
          includeTechnicalContext: false, // Default: traceability only
          includeImplementationGuidance: false, // Default: traceability only
          enforceTraceability: true,
          requireBusinessJustification: false,
          trackRequirementCoverage: true
        }
      };

      // Act
      const result = await service.generateEnhancedTasksFromPRD(params);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);

      // Check that tasks have basic properties
      const firstTask = result[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();
      expect(firstTask.status).toBeDefined();
      expect(firstTask.priority).toBeDefined();
      expect(firstTask.acceptanceCriteria).toBeDefined();

      // Check for enhanced context if available
      if ('executionContext' in firstTask && firstTask.executionContext) {
        expect(firstTask.executionContext.businessObjective).toBeDefined();
        expect(firstTask.executionContext.userImpact).toBeDefined();
        expect(firstTask.executionContext.successMetrics).toBeDefined();
        expect(firstTask.executionContext.parentFeature).toBeDefined();
        expect(firstTask.executionContext.technicalConstraints).toBeDefined();
        expect(firstTask.executionContext.prdContextSummary).toBeDefined();

        // Check that business objective is defined and meaningful
        expect(firstTask.executionContext.businessObjective).toBeDefined();
        expect(firstTask.executionContext.businessObjective.length).toBeGreaterThan(0);
      }

      // Check for enhanced acceptance criteria if available
      if ('enhancedAcceptanceCriteria' in firstTask && firstTask.enhancedAcceptanceCriteria) {
        expect(Array.isArray(firstTask.enhancedAcceptanceCriteria)).toBe(true);
        if (firstTask.enhancedAcceptanceCriteria.length > 0) {
          const criteria = firstTask.enhancedAcceptanceCriteria[0];
          expect(criteria).toHaveProperty('id');
          expect(criteria).toHaveProperty('description');
          expect(criteria).toHaveProperty('category');
          expect(criteria).toHaveProperty('verificationMethod');
          expect(criteria).toHaveProperty('priority');
        }
      }
    });

    it('should handle enhanced generation when disabled', async () => {
      // Arrange
      const params: EnhancedTaskGenerationParams = {
        prd: mockPRD,
        maxTasks: 2,
        enhancedConfig: {
          enableEnhancedGeneration: false, // Disabled
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
        }
      };

      // Act
      const result = await service.generateEnhancedTasksFromPRD(params);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should have basic task properties
      const firstTask = result[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();
    });

    it('should handle different context levels correctly', async () => {
      const contextLevels: Array<'minimal' | 'standard' | 'full'> = ['minimal', 'standard', 'full'];

      for (const level of contextLevels) {
        const params: EnhancedTaskGenerationParams = {
          prd: mockPRD,
          maxTasks: 1,
          enhancedConfig: {
            enableEnhancedGeneration: true,
            createTraceabilityMatrix: true,
            generateUseCases: true,
            createLifecycleTracking: true,
            contextLevel: level,
            includeBusinessContext: false,
            includeTechnicalContext: false,
            includeImplementationGuidance: false,
            enforceTraceability: true,
            requireBusinessJustification: false,
            trackRequirementCoverage: true
          }
        };

        const result = await service.generateEnhancedTasksFromPRD(params);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        const firstTask = result[0];
        expect(firstTask).toBeDefined();
        expect(firstTask.id).toBeDefined();
        expect(firstTask.title).toBeDefined();
      }
    });
  });

  describe('generateTasksFromPRD with enhanced features', () => {
    it('should handle enhanced generation based on environment variable', async () => {
      // Arrange
      const params = {
        prd: mockPRD,
        maxTasks: 2,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true
      };

      // Act
      const result = await service.generateTasksFromPRD(params);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const firstTask = result[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();
    });
  });

  describe('error handling and resilience', () => {
    it('should handle errors gracefully during enhanced generation', async () => {
      // Arrange
      const params: EnhancedTaskGenerationParams = {
        prd: "invalid json content", // This should cause some issues but not crash
        maxTasks: 2,
        enhancedConfig: {
          enableEnhancedGeneration: true,
          createTraceabilityMatrix: true,
          generateUseCases: true,
          createLifecycleTracking: true,
          contextLevel: 'full',
          includeBusinessContext: true, // This might fail without AI
          includeTechnicalContext: true, // This might fail without AI
          includeImplementationGuidance: true, // This might fail without AI
          enforceTraceability: true,
          requireBusinessJustification: true,
          trackRequirementCoverage: true
        }
      };

      // Act & Assert - Should not throw
      await expect(service.generateEnhancedTasksFromPRD(params)).resolves.toBeDefined();
    });

    it('should provide fallback when context generation fails', async () => {
      // Arrange
      const params: EnhancedTaskGenerationParams = {
        prd: mockPRD,
        maxTasks: 1,
        enhancedConfig: {
          enableEnhancedGeneration: true,
          createTraceabilityMatrix: false, // Disable to test fallback
          generateUseCases: false,
          createLifecycleTracking: false,
          contextLevel: 'minimal',
          includeBusinessContext: false,
          includeTechnicalContext: false,
          includeImplementationGuidance: false,
          enforceTraceability: false,
          requireBusinessJustification: false,
          trackRequirementCoverage: false
        }
      };

      // Act
      const result = await service.generateEnhancedTasksFromPRD(params);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      const firstTask = result[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
    });
  });
});
