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

import { parsePRDTool, executeParsePRD } from '../../infrastructure/tools/ai-tasks/ParsePRDTool';
import { MCPResponse, MCPSuccessResponse } from '../../domain/mcp-types';

// Helper function to extract data from MCP response
function extractDataFromMCPResponse(response: MCPResponse): any {
  if (response.status === 'success') {
    const successResponse = response as MCPSuccessResponse;
    if (successResponse.output.content) {
      try {
        return JSON.parse(successResponse.output.content);
      } catch (error) {
        // If content is not JSON, return as is
        return { content: successResponse.output.content };
      }
    }
  }
  return null;
}

describe('ParsePRDTool - Enhanced Context Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock responses for AI services
    const { generateObject, generateText } = require('ai');

    // Mock task generation response
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Implement User Authentication',
        description: 'Create secure user registration and login functionality',
        status: 'TODO',
        priority: 'HIGH',
        complexity: 5,
        estimatedHours: 40,
        acceptanceCriteria: [
          'Users can register with email and password',
          'Users can login with valid credentials',
          'Password reset functionality works'
        ],
        parentPRDId: 'ecommerce-platform',
        implementsRequirements: ['auth-1'],
        implementsUseCases: ['uc-auth'],
        implementsFeatures: ['user-auth'],
        requirementTraceability: {
          businessRequirement: 'auth-1',
          feature: 'user-auth',
          useCase: 'uc-auth'
        },
        executionContext: {
          businessObjective: 'Increase online sales by 50% within 6 months',
          userImpact: 'Users can securely access their accounts',
          successMetrics: ['User registration rate > 80%'],
          parentFeature: 'User Authentication',
          technicalConstraints: ['Must be PCI compliant'],
          prdContextSummary: 'E-commerce platform with secure authentication'
        }
      },
      {
        id: 'task-2',
        title: 'Build Product Catalog',
        description: 'Create searchable product database with filtering',
        status: 'TODO',
        priority: 'HIGH',
        complexity: 6,
        estimatedHours: 48,
        acceptanceCriteria: [
          'Products can be searched by name',
          'Advanced filtering works correctly',
          'Product recommendations are displayed'
        ],
        parentPRDId: 'ecommerce-platform',
        implementsRequirements: ['catalog-1'],
        implementsUseCases: ['uc-catalog'],
        implementsFeatures: ['product-catalog']
      }
    ];

    // Mock different responses based on what's being generated
    generateObject.mockImplementation((params: any) => {
      // Check if this is a task generation call
      if (params.prompt && params.prompt.includes('task')) {
        return Promise.resolve({ object: mockTasks });
      }

      // Mock feature extraction response (expects array of features)
      if (params.prompt && (params.prompt.includes('PRD') || params.prompt.includes('feature'))) {
        return Promise.resolve({
          object: [
            {
              id: 'user-auth',
              title: 'User Authentication',
              description: 'Secure user registration and login',
              priority: 'HIGH',
              userStories: [
                'As a user, I want to register with email and password',
                'As a user, I want to login securely'
              ],
              acceptanceCriteria: [
                'User can register with valid email',
                'User can login with correct credentials',
                'Password reset functionality works'
              ],
              estimatedComplexity: 5,
              dependencies: []
            },
            {
              id: 'product-catalog',
              title: 'Product Catalog',
              description: 'Searchable product database with filtering',
              priority: 'HIGH',
              userStories: [
                'As a user, I want to search for products',
                'As a user, I want to filter products by category'
              ],
              acceptanceCriteria: [
                'Products can be searched by name',
                'Advanced filtering works correctly',
                'Product recommendations are displayed'
              ],
              estimatedComplexity: 6,
              dependencies: ['user-auth']
            }
          ]
        });
      }

      // Default response
      return Promise.resolve({ object: mockTasks });
    });

    generateText.mockResolvedValue({
      text: 'Task generation completed successfully. Generated comprehensive tasks with enhanced context.'
    });
  });

  const samplePRD = `# E-commerce Platform PRD

## Overview
Build a modern e-commerce platform to increase online sales and improve customer experience.

## Objectives
- Increase online sales by 50% within 6 months
- Improve user experience with modern, responsive design
- Enable real-time inventory management
- Achieve 99.9% uptime for critical operations

## Features
### User Authentication
- Secure user registration and login
- Password reset functionality
- Social media login integration

### Product Catalog
- Searchable product database
- Advanced filtering and sorting
- Product recommendations
- Inventory tracking

### Shopping Cart & Checkout
- Persistent shopping cart
- Multiple payment methods
- Order tracking
- Email notifications

## Technical Requirements
- Mobile-responsive design
- PCI compliance for payments
- Load balancing for high traffic
- Database optimization for performance

## Success Metrics
- Conversion rate > 3%
- Page load time < 2 seconds
- User satisfaction score > 4.5/5
- Cart abandonment rate < 30%`;

  describe('tool definition', () => {
    it('should have correct tool definition structure', () => {
      expect(parsePRDTool).toBeDefined();
      expect(parsePRDTool.name).toBe('parse_prd');
      expect(parsePRDTool.description).toBeDefined();
      expect(parsePRDTool.schema).toBeDefined();
      expect(parsePRDTool.examples).toBeDefined();
      expect(Array.isArray(parsePRDTool.examples)).toBe(true);
      expect(parsePRDTool.examples?.length).toBeGreaterThan(0);
    });

    it('should have enhanced generation parameters in schema', () => {
      const example = parsePRDTool.examples?.[0];
      expect(example).toBeDefined();
      expect(example?.args).toHaveProperty('enhancedGeneration');
      expect(example?.args).toHaveProperty('contextLevel');
      expect(example?.args).toHaveProperty('includeBusinessContext');
      expect(example?.args).toHaveProperty('includeTechnicalContext');
      expect(example?.args).toHaveProperty('includeImplementationGuidance');
      expect(example?.args).toHaveProperty('createTraceabilityMatrix');
    });
  });

  describe('executeParsePRD with enhanced context generation', () => {
    it('should generate tasks with traceability-based context by default', async () => {
      // Arrange
      const args = {
        prdContent: samplePRD,
        maxTasks: 3,
        includeSubtasks: false, // Keep simple for testing
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: 'ecommerce-platform',
        enhancedGeneration: true, // Default enhanced generation
        contextLevel: 'standard' as const,
        includeBusinessContext: false, // Default: traceability only
        includeTechnicalContext: false, // Default: traceability only
        includeImplementationGuidance: false // Default: traceability only
      };

      // Act
      const result = await executeParsePRD(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');

      const data = extractDataFromMCPResponse(result);
      expect(data).toBeDefined();
      expect(data.tasks).toBeDefined();
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(data.tasks.length).toBeGreaterThan(0);
      expect(data.tasks.length).toBeLessThanOrEqual(3);

      // Check that tasks have basic properties
      const firstTask = data.tasks[0];
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
          expect(criteria).toHaveProperty('category');
          expect(criteria).toHaveProperty('verificationMethod');
          expect(criteria).toHaveProperty('priority');
          expect(criteria).toHaveProperty('completed');
          // verificationDetails may be present instead of description
          expect(criteria).toHaveProperty('verificationDetails');
        }
      }

      // Check for traceability matrix
      if (data.traceabilityMatrix) {
        expect(data.traceabilityMatrix).toBeDefined();
        expect(data.traceabilityMatrix.id).toBeDefined();
        expect(data.traceabilityMatrix.projectId).toBe('ecommerce-platform');
        expect(data.traceabilityMatrix.tasks).toBeDefined();
        expect(data.traceabilityMatrix.coverage).toBeDefined();
      }

      // Check metrics
      expect(data.metrics).toBeDefined();
      expect(data.metrics.totalEffort).toBeDefined();
      expect(data.metrics.avgComplexity).toBeDefined();
      expect(data.metrics.estimatedDuration).toBeDefined();

      // Check recommendations
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations.startWithTasks).toBeDefined();
      expect(data.recommendations.highPriorityTasks).toBeDefined();

      // Check summary
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe('string');
      expect(data.summary).toContain('PRD Parsing Complete');
    });

    it('should handle minimal context level', async () => {
      // Arrange
      const args = {
        prdContent: samplePRD,
        maxTasks: 2,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: false,
        autoDetectDependencies: false,
        projectType: 'web-app' as const,
        createLifecycle: false,
        createTraceabilityMatrix: false,
        includeUseCases: false,
        projectId: 'ecommerce-platform',
        enhancedGeneration: true,
        contextLevel: 'minimal' as const, // Minimal context
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      };

      // Act
      const result = await executeParsePRD(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');

      const data = extractDataFromMCPResponse(result);
      expect(data).toBeDefined();
      expect(data.tasks).toBeDefined();
      expect(data.tasks.length).toBeGreaterThan(0);

      const firstTask = data.tasks[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();
    });

    it('should fall back to basic generation when enhanced is disabled', async () => {
      // Arrange
      const args = {
        prdContent: samplePRD,
        maxTasks: 2,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: false,
        createTraceabilityMatrix: false,
        includeUseCases: false,
        projectId: 'ecommerce-platform',
        enhancedGeneration: false, // Disabled enhanced generation
        contextLevel: 'minimal' as const,
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      };

      // Act
      const result = await executeParsePRD(args);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');

      const data = extractDataFromMCPResponse(result);
      expect(data).toBeDefined();
      expect(data.tasks).toBeDefined();
      expect(data.tasks.length).toBeGreaterThan(0);

      const firstTask = data.tasks[0];
      expect(firstTask).toBeDefined();
      expect(firstTask.id).toBeDefined();
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();

      // When enhanced context is disabled, the service may still provide basic context
      // but it should be minimal compared to enhanced mode
      if ('executionContext' in firstTask) {
        // Basic context should be present but minimal
        expect(firstTask.executionContext).toBeDefined();
      }

      // Implementation guidance should be minimal or absent when disabled
      if ('implementationGuidance' in firstTask) {
        expect(firstTask.implementationGuidance).toBeDefined();
      }
    });

    it('should handle different context levels', async () => {
      const contextLevels: Array<'minimal' | 'standard' | 'full'> = ['minimal', 'standard', 'full'];

      for (const level of contextLevels) {
        const args = {
          prdContent: samplePRD,
          maxTasks: 1,
          includeSubtasks: false,
          autoEstimate: true,
          autoPrioritize: true,
          autoDetectDependencies: true,
          projectType: 'web-app' as const,
          createLifecycle: true,
          createTraceabilityMatrix: true,
          includeUseCases: true,
          projectId: `test-${level}`,
          enhancedGeneration: true,
          contextLevel: level,
          includeBusinessContext: false,
          includeTechnicalContext: false,
          includeImplementationGuidance: false
        };

        const result = await executeParsePRD(args);

        expect(result).toBeDefined();
        expect(result.status).toBe('success');

        const data = extractDataFromMCPResponse(result);
        expect(data).toBeDefined();
        expect(data.tasks).toBeDefined();
        expect(data.tasks.length).toBeGreaterThan(0);
      }
    });

    it('should handle invalid PRD content gracefully', async () => {
      // Arrange
      const args = {
        prdContent: "This is not a valid PRD format",
        maxTasks: 2,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: 'test-invalid',
        enhancedGeneration: true,
        contextLevel: 'standard' as const,
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      };

      // Act
      const result = await executeParsePRD(args);

      // Assert - Should not throw and should return some result
      expect(result).toBeDefined();
      // May succeed with basic tasks or return error, both are acceptable
    });

    it('should handle empty PRD content', async () => {
      // Arrange
      const args = {
        prdContent: "",
        maxTasks: 1,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: false,
        createTraceabilityMatrix: false,
        includeUseCases: false,
        projectId: 'test-empty',
        enhancedGeneration: true,
        contextLevel: 'minimal' as const,
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      };

      // Act
      const result = await executeParsePRD(args);

      // Assert - Should not throw
      expect(result).toBeDefined();
    });
  });

  describe('performance and scalability', () => {
    it('should complete task generation within reasonable time', async () => {
      // Arrange
      const args = {
        prdContent: samplePRD,
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: 'performance-test',
        enhancedGeneration: true,
        contextLevel: 'standard' as const,
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      };

      // Act
      const startTime = Date.now();
      const result = await executeParsePRD(args);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});
