import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PRDGenerationService } from '../../src/services/PRDGenerationService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';

// Mock the AI service factory
jest.mock('../../src/services/ai/AIServiceFactory');

describe('PRDGenerationService', () => {
  let service: PRDGenerationService;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI service
    mockAIService = {
      generateObject: jest.fn(),
      generateText: jest.fn()
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getPRDModel: jest.fn().mockReturnValue(mockAIService),
      getMainModel: jest.fn().mockReturnValue(mockAIService),
      getResearchModel: jest.fn().mockReturnValue(mockAIService)
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    service = new PRDGenerationService();
  });

  describe('generatePRDFromIdea', () => {
    it('should generate a complete PRD from project idea', async () => {
      const mockPRD = {
        title: 'Task Management App',
        overview: 'A comprehensive task management application for teams',
        objectives: [
          'Improve team productivity by 25%',
          'Reduce task management overhead',
          'Enhance collaboration capabilities'
        ],
        targetUsers: [
          {
            name: 'Project Manager',
            description: 'Manages team tasks and projects',
            technicalLevel: 'intermediate' as const
          }
        ],
        features: [
          {
            id: 'feature-1',
            title: 'Task Creation',
            description: 'Create and manage tasks',
            priority: 'high' as const,
            userStories: ['As a user, I want to create tasks so that I can track my work'],
            acceptanceCriteria: ['User can create task with title and description'],
            estimatedComplexity: 5
          }
        ],
        technicalRequirements: [
          {
            id: 'req-1',
            category: 'performance',
            requirement: 'System must handle 1000 concurrent users',
            priority: 'high' as const,
            rationale: 'Business requirement for scalability'
          }
        ],
        successMetrics: ['User adoption > 80%', 'Task completion rate increase by 20%'],
        timeline: '6 months',
        author: 'product-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: true
      };

      mockAIService.generateObject.mockResolvedValue(mockPRD);

      const input = {
        projectIdea: 'A modern task management application with team collaboration features',
        projectName: 'TaskFlow Pro',
        author: 'product-team',
        complexity: 'medium' as const
      };

      const result = await service.generatePRDFromIdea(input);

      expect(result).toBeDefined();
      expect(result.title).toBe('Task Management App');
      expect(result.objectives).toHaveLength(3);
      expect(result.features).toHaveLength(1);
      expect(result.aiGenerated).toBe(true);
      expect(result.aiMetadata).toBeDefined();
      expect(result.aiMetadata?.generatedBy).toBe('prd-generation-service');
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });

    it('should include market research when requested', async () => {
      const mockPRDWithResearch = {
        title: 'Fitness Tracking App',
        overview: 'AI-powered fitness tracking application',
        objectives: ['Improve user health outcomes'],
        features: [],
        marketResearch: {
          competitorAnalysis: ['MyFitnessPal', 'Strava', 'Fitbit'],
          marketSize: 'Large and growing fitness tech market',
          trends: ['Wearable integration', 'AI coaching', 'Social features']
        },
        author: 'mobile-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: true
      };

      mockAIService.generateObject.mockResolvedValue(mockPRDWithResearch);

      const input = {
        projectIdea: 'AI-powered fitness tracking app with social features',
        projectName: 'FitAI',
        author: 'mobile-team',
        includeResearch: true,
        industryContext: 'health and fitness'
      };

      const result = await service.generatePRDFromIdea(input);

      expect(result.marketResearch).toBeDefined();
      expect(result.marketResearch?.competitorAnalysis).toContain('MyFitnessPal');
      expect(result.marketResearch?.trends).toContain('AI coaching');
    });

    it('should handle different complexity levels', async () => {
      const complexityLevels = ['low', 'medium', 'high'] as const;

      for (const complexity of complexityLevels) {
        const mockPRD = {
          title: `${complexity} Complexity App`,
          overview: `Application with ${complexity} complexity`,
          objectives: ['Test objective'],
          features: [],
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          aiGenerated: true
        };

        mockAIService.generateObject.mockResolvedValue(mockPRD);

        const input = {
          projectIdea: `Test project with ${complexity} complexity`,
          projectName: 'TestApp',
          author: 'test-user',
          complexity
        };

        const result = await service.generatePRDFromIdea(input);
        expect(result.title).toBe(`${complexity} Complexity App`);
      }
    });
  });

  describe('enhancePRD', () => {
    it('should enhance existing PRD with improvements', async () => {
      const mockEnhancedPRD = {
        title: 'Enhanced Task Management App',
        overview: 'Significantly improved task management application with advanced features',
        objectives: [
          'Improve team productivity by 40%',
          'Reduce task management overhead by 50%',
          'Enhance collaboration with real-time features'
        ],
        features: [
          {
            id: 'feature-1',
            title: 'Advanced Task Creation',
            description: 'Enhanced task creation with templates and automation',
            priority: 'critical' as const,
            userStories: [
              'As a user, I want to create tasks from templates',
              'As a user, I want automated task suggestions'
            ],
            acceptanceCriteria: [
              'User can select from predefined templates',
              'System suggests tasks based on project context'
            ],
            estimatedComplexity: 7
          }
        ],
        author: 'enhanced-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '2.0.0',
        aiGenerated: true
      };

      mockAIService.generateObject.mockResolvedValue(mockEnhancedPRD);

      const input = {
        currentPRD: 'Basic PRD content with minimal features',
        enhancementType: 'comprehensive' as const,
        focusAreas: ['user experience', 'automation', 'scalability']
      };

      const result = await service.enhancePRD(input);

      expect(result.title).toBe('Enhanced Task Management App');
      expect(result.objectives).toHaveLength(3);
      expect(result.features[0].estimatedComplexity).toBe(7);
      expect(result.version).toBe('2.0.0');
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });

    it('should handle different enhancement types', async () => {
      const enhancementTypes = ['technical', 'user_focused', 'business_focused'] as const;

      for (const enhancementType of enhancementTypes) {
        const mockEnhancedPRD = {
          title: `${enhancementType} Enhanced PRD`,
          overview: `PRD enhanced with ${enhancementType} focus`,
          objectives: ['Enhanced objective'],
          features: [],
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.1.0',
          aiGenerated: true
        };

        mockAIService.generateObject.mockResolvedValue(mockEnhancedPRD);

        const input = {
          currentPRD: 'Basic PRD content',
          enhancementType,
          focusAreas: ['improvement']
        };

        const result = await service.enhancePRD(input);
        expect(result.title).toBe(`${enhancementType} Enhanced PRD`);
      }
    });
  });

  describe('extractFeaturesFromPRD', () => {
    it('should extract features from PRD content', async () => {
      const mockFeatures = [
        {
          id: 'feature-1',
          title: 'User Authentication',
          description: 'Secure user login and registration system',
          priority: 'critical' as const,
          userStories: [
            'As a user, I want to register with email so that I can access the system',
            'As a user, I want to login securely so that my data is protected'
          ],
          acceptanceCriteria: [
            'User can register with valid email and password',
            'User can login with correct credentials',
            'System enforces password complexity requirements'
          ],
          estimatedComplexity: 6
        },
        {
          id: 'feature-2',
          title: 'Task Management',
          description: 'Core task creation and management functionality',
          priority: 'high' as const,
          userStories: [
            'As a user, I want to create tasks so that I can track my work',
            'As a user, I want to edit tasks so that I can update information'
          ],
          acceptanceCriteria: [
            'User can create task with title and description',
            'User can edit existing tasks',
            'User can delete tasks they created'
          ],
          estimatedComplexity: 5
        }
      ];

      mockAIService.generateObject.mockResolvedValue({ features: mockFeatures });

      const prdContent = `
        # Task Management Application PRD

        ## Features
        - User authentication and authorization
        - Task creation and management
        - Team collaboration tools
        - Real-time notifications
      `;

      const result = await service.extractFeaturesFromPRD(prdContent);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('User Authentication');
      expect(result[0].priority).toBe('critical');
      expect(result[0].userStories).toHaveLength(2);
      expect(result[1].title).toBe('Task Management');
      expect(result[1].estimatedComplexity).toBe(5);
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });

    it('should handle empty PRD content', async () => {
      mockAIService.generateObject.mockResolvedValue({ features: [] });

      const result = await service.extractFeaturesFromPRD('');

      expect(result).toHaveLength(0);
    });
  });

  describe('validatePRDCompleteness', () => {
    it('should validate complete PRD with high score', async () => {
      const completePRD = {
        id: 'prd-1',
        title: 'Complete PRD',
        overview: 'Comprehensive overview of the project',
        objectives: ['Objective 1', 'Objective 2', 'Objective 3'],
        targetUsers: [
          {
            name: 'Admin',
            description: 'System administrator',
            technicalLevel: 'expert' as const
          }
        ],
        features: [
          {
            id: 'feature-1',
            title: 'Feature 1',
            description: 'Detailed feature description',
            priority: 'high' as const,
            userStories: ['User story 1'],
            acceptanceCriteria: ['Criteria 1'],
            estimatedComplexity: 5
          }
        ],
        technicalRequirements: [
          {
            id: 'req-1',
            category: 'performance',
            requirement: 'System must be fast',
            priority: 'high' as const,
            rationale: 'User experience requirement'
          }
        ],
        successMetrics: ['Metric 1', 'Metric 2'],
        timeline: '6 months',
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const validation = await service.validatePRDCompleteness(completePRD as any);

      expect(validation.score).toBeGreaterThan(80);
      expect(validation.isComplete).toBe(true);
      expect(validation.missingElements).toHaveLength(0);
      expect(validation.recommendations).toHaveLength(0);
    });

    it('should identify missing elements in incomplete PRD', async () => {
      const incompletePRD = {
        id: 'prd-1',
        title: 'Incomplete PRD',
        overview: 'Basic overview',
        objectives: [],
        targetUsers: [],
        features: [],
        technicalRequirements: [],
        successMetrics: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const validation = await service.validatePRDCompleteness(incompletePRD as any);

      expect(validation.score).toBeLessThan(50);
      expect(validation.isComplete).toBe(false);
      expect(validation.missingElements.length).toBeGreaterThan(0);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.missingElements).toContain('objectives');
      expect(validation.missingElements).toContain('features');
      expect(validation.missingElements).toContain('successMetrics');
    });
  });

  describe('error handling', () => {
    it('should handle AI service errors gracefully', async () => {
      mockAIService.generateObject.mockRejectedValue(new Error('AI service unavailable'));

      const input = {
        projectIdea: 'Test project',
        projectName: 'TestApp',
        author: 'test-user'
      };

      await expect(service.generatePRDFromIdea(input)).rejects.toThrow('AI service unavailable');
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        projectIdea: '', // Too short
        projectName: '',
        author: ''
      };

      await expect(service.generatePRDFromIdea(invalidInput)).rejects.toThrow();
    });
  });

  describe('AI metadata tracking', () => {
    it('should include AI metadata in generated PRDs', async () => {
      const mockPRD = {
        title: 'Test PRD',
        overview: 'Test overview',
        objectives: ['Test objective'],
        features: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: true
      };

      mockAIService.generateObject.mockResolvedValue(mockPRD);

      const input = {
        projectIdea: 'Test project',
        projectName: 'TestApp',
        author: 'test-user'
      };

      const result = await service.generatePRDFromIdea(input);

      expect(result.aiMetadata).toBeDefined();
      expect(result.aiMetadata?.generatedBy).toBe('prd-generation-service');
      expect(result.aiMetadata?.confidence).toBeGreaterThan(0);
      expect(result.aiMetadata?.version).toBeDefined();
      expect(result.aiMetadata?.generatedAt).toBeDefined();
    });
  });
});
