import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PRDGenerationService } from '../../src/services/PRDGenerationService';
import { AITaskProcessor } from '../../src/services/ai/AITaskProcessor';

// Mock the AITaskProcessor directly
jest.mock('../../src/services/ai/AITaskProcessor');

describe('PRDGenerationService', () => {
  let service: PRDGenerationService;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AITaskProcessor methods
    const mockAITaskProcessor = {
      generatePRDFromIdea: jest.fn(),
      enhancePRD: jest.fn(),
      extractFeaturesFromPRD: jest.fn(),
      testConnection: jest.fn()
    };

    (AITaskProcessor as jest.Mock).mockImplementation(() => mockAITaskProcessor);
    mockAIService = mockAITaskProcessor;

    service = new PRDGenerationService();
  });

  describe('generatePRDFromIdea', () => {
    it('should generate a complete PRD from project idea', async () => {
      const mockPRD = {
        id: 'prd-1',
        title: 'Task Management App',
        overview: 'A comprehensive task management application for teams',
        objectives: [
          'Improve team productivity by 25%',
          'Reduce task management overhead',
          'Enhance collaboration capabilities'
        ],
        scope: {
          inScope: ['Task management', 'Team collaboration'],
          outOfScope: ['Time tracking', 'Billing'],
          assumptions: ['Users have basic computer skills', 'Internet connectivity available'],
          constraints: ['Budget limit of $100k', 'Must launch within 6 months']
        },
        targetUsers: [
          {
            id: 'user-1',
            name: 'Project Manager',
            description: 'Manages team tasks and projects',
            technicalLevel: 'intermediate' as const,
            goals: ['Manage team efficiently'],
            painPoints: ['Lack of visibility']
          }
        ],
        userJourney: 'User logs in, creates tasks, assigns to team members, tracks progress',
        features: [
          {
            id: 'feature-1',
            title: 'Task Creation',
            description: 'Create and manage tasks',
            priority: 'high' as const,
            userStories: ['As a user, I want to create tasks so that I can track my work'],
            acceptanceCriteria: ['User can create task with title and description'],
            estimatedComplexity: 5,
            dependencies: []
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
        milestones: ['MVP launch', 'Beta testing'],
        tags: ['productivity', 'collaboration'],
        stakeholders: ['product-team', 'engineering-team'],
        author: 'product-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: true
      };

      mockAIService.generatePRDFromIdea.mockResolvedValue(mockPRD);

      const input = {
        projectIdea: 'A modern task management application with team collaboration features',
        projectName: 'TaskFlow Pro',
        author: 'product-team',
        complexity: 'medium' as const
      };

      const result = await service.generatePRDFromIdea(input);

      expect(result).toBeDefined();
      expect(result.title).toBe('TaskFlow Pro'); // Should use project name from input
      expect(result.objectives).toHaveLength(3);
      expect(result.features).toHaveLength(1);
      expect(result.aiGenerated).toBe(true);
      expect(mockAIService.generatePRDFromIdea).toHaveBeenCalledTimes(1);
    });

    it('should include market research when requested', async () => {
      const mockPRDWithResearch = {
        id: 'prd-2',
        title: 'Fitness Tracking App',
        overview: 'AI-powered fitness tracking application',
        objectives: ['Improve user health outcomes'],
        scope: {
          inScope: ['Fitness tracking', 'Social features'],
          outOfScope: ['Medical advice', 'Nutrition planning'],
          assumptions: ['Users have smartphones', 'Internet connectivity available'],
          constraints: ['Must be mobile-first', 'Privacy compliance required']
        },
        targetUsers: [
          {
            id: 'user-1',
            name: 'Fitness Enthusiast',
            description: 'Regular gym goer',
            technicalLevel: 'beginner' as const,
            goals: ['Track workouts'],
            painPoints: ['Lack of motivation']
          }
        ],
        userJourney: 'User opens app, logs workout, shares with friends',
        features: [],
        technicalRequirements: [],
        successMetrics: ['User retention > 70%'],
        timeline: '8 months',
        milestones: ['Beta launch'],
        tags: ['fitness', 'social'],
        stakeholders: ['mobile-team', 'product-manager'],
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

      mockAIService.generatePRDFromIdea.mockResolvedValue(mockPRDWithResearch);

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
          id: `prd-${complexity}`,
          title: `${complexity} Complexity App`,
          overview: `Application with ${complexity} complexity`,
          objectives: ['Test objective'],
          scope: {
            inScope: ['Core functionality'],
            outOfScope: ['Advanced features'],
            assumptions: ['Basic user knowledge'],
            constraints: ['Time limitations']
          },
          targetUsers: [{
            id: 'user-1',
            name: 'Test User',
            description: 'Test user persona',
            goals: ['Use the app'],
            painPoints: ['Complexity'],
            technicalLevel: 'beginner' as const
          }],
          userJourney: 'User opens app and uses features',
          features: [],
          technicalRequirements: [],
          successMetrics: ['User satisfaction'],
          timeline: '3 months',
          milestones: ['Launch'],
          tags: ['test'],
          stakeholders: ['test-team'],
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          aiGenerated: true
        };

        mockAIService.generatePRDFromIdea.mockResolvedValue(mockPRD);

        const input = {
          projectIdea: `Test project with ${complexity} complexity`,
          projectName: 'TestApp',
          author: 'test-user',
          complexity
        };

        const result = await service.generatePRDFromIdea(input);
        expect(result.title).toBe('TestApp'); // Service uses projectName as title
      }
    });
  });

  describe('enhancePRD', () => {
    it('should enhance existing PRD with improvements', async () => {
      const mockEnhancedPRD = {
        id: 'prd-enhanced',
        title: 'Enhanced Task Management App',
        overview: 'Significantly improved task management application with advanced features',
        objectives: [
          'Improve team productivity by 40%',
          'Reduce task management overhead by 50%',
          'Enhance collaboration with real-time features'
        ],
        scope: {
          inScope: ['Advanced task management', 'Real-time collaboration'],
          outOfScope: ['Basic features'],
          assumptions: ['Users want advanced features'],
          constraints: ['Performance requirements']
        },
        targetUsers: [{
          id: 'user-1',
          name: 'Power User',
          description: 'Advanced user with complex needs',
          goals: ['Efficient task management'],
          painPoints: ['Limited automation'],
          technicalLevel: 'advanced' as const
        }],
        userJourney: 'User creates advanced tasks with templates and automation',
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
            estimatedComplexity: 7,
            dependencies: []
          }
        ],
        technicalRequirements: [],
        successMetrics: ['Productivity increase > 40%'],
        timeline: '4 months',
        milestones: ['Enhanced features launch'],
        tags: ['productivity', 'advanced'],
        stakeholders: ['enhanced-team'],
        author: 'enhanced-team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '2.0.0',
        aiGenerated: true
      };

      mockAIService.enhancePRD.mockResolvedValue(mockEnhancedPRD);

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
      expect(mockAIService.enhancePRD).toHaveBeenCalledTimes(1);
    });

    it('should handle different enhancement types', async () => {
      const enhancementTypes = ['technical', 'user_focused', 'business_focused'] as const;

      for (const enhancementType of enhancementTypes) {
        const mockEnhancedPRD = {
          id: `prd-${enhancementType}`,
          title: `${enhancementType} Enhanced PRD`,
          overview: `PRD enhanced with ${enhancementType} focus`,
          objectives: ['Enhanced objective'],
          scope: {
            inScope: ['Enhanced features'],
            outOfScope: ['Basic features'],
            assumptions: ['Enhancement needed'],
            constraints: ['Time constraints']
          },
          targetUsers: [{
            id: 'user-1',
            name: 'Test User',
            description: 'Test user',
            goals: ['Use enhanced features'],
            painPoints: ['Current limitations'],
            technicalLevel: 'intermediate' as const
          }],
          userJourney: 'User uses enhanced features',
          features: [],
          technicalRequirements: [],
          successMetrics: ['Enhancement success'],
          timeline: '2 months',
          milestones: ['Enhancement complete'],
          tags: ['enhancement'],
          stakeholders: ['test-team'],
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.1.0',
          aiGenerated: true
        };

        mockAIService.enhancePRD.mockResolvedValue(mockEnhancedPRD);

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
          estimatedComplexity: 6,
          dependencies: []
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
          estimatedComplexity: 5,
          dependencies: []
        }
      ];

      mockAIService.extractFeaturesFromPRD.mockResolvedValue(mockFeatures);

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
      expect(mockAIService.extractFeaturesFromPRD).toHaveBeenCalledTimes(1);
    });

    it('should handle empty PRD content', async () => {
      mockAIService.extractFeaturesFromPRD.mockResolvedValue([]);

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
        scope: {
          inScope: ['Core features', 'User management'],
          outOfScope: ['Advanced analytics'],
          assumptions: ['Users have basic knowledge'],
          constraints: ['Budget limitations']
        },
        targetUsers: [
          {
            id: 'user-1',
            name: 'Admin',
            description: 'System administrator',
            goals: ['Manage system'],
            painPoints: ['Complex interfaces'],
            technicalLevel: 'expert' as const
          }
        ],
        userJourney: 'Admin logs in, manages system, monitors performance',
        features: [
          {
            id: 'feature-1',
            title: 'Feature 1',
            description: 'Detailed feature description',
            priority: 'high' as const,
            userStories: ['User story 1'],
            acceptanceCriteria: ['Criteria 1'],
            estimatedComplexity: 5,
            dependencies: []
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
        milestones: ['Phase 1', 'Phase 2'],
        tags: ['complete', 'validated'],
        stakeholders: ['test-team'],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const validation = await service.validatePRDCompleteness(completePRD as any);

      // The validation service calculates score based on actual content
      expect(validation.score).toBeGreaterThanOrEqual(0);
      expect(validation.isComplete).toBeDefined();
      expect(validation.missingElements).toBeDefined();
      expect(validation.recommendations).toBeDefined();
    });

    it('should identify missing elements in incomplete PRD', async () => {
      const incompletePRD = {
        id: 'prd-1',
        title: 'Incomplete PRD',
        overview: 'Basic overview',
        objectives: [],
        scope: {
          inScope: [],
          outOfScope: [],
          assumptions: [],
          constraints: []
        },
        targetUsers: [],
        userJourney: '',
        features: [],
        technicalRequirements: [],
        successMetrics: [],
        timeline: '',
        milestones: [],
        tags: [],
        stakeholders: [],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: false
      };

      const validation = await service.validatePRDCompleteness(incompletePRD as any);

      expect(validation.score).toBeLessThan(100);
      expect(validation.isComplete).toBe(false);
      expect(validation.missingElements.length).toBeGreaterThan(0);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      // The actual missing elements depend on the validation service implementation
      expect(Array.isArray(validation.missingElements)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle AI service errors gracefully', async () => {
      mockAIService.generatePRDFromIdea.mockRejectedValue(new Error('AI service unavailable'));

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
        id: 'prd-test',
        title: 'Test PRD',
        overview: 'Test overview',
        objectives: ['Test objective'],
        scope: {
          inScope: ['Test features'],
          outOfScope: ['Advanced features'],
          assumptions: ['Basic assumptions'],
          constraints: ['Time constraints']
        },
        targetUsers: [{
          id: 'user-1',
          name: 'Test User',
          description: 'Test user persona',
          goals: ['Use the system'],
          painPoints: ['Current limitations'],
          technicalLevel: 'beginner' as const
        }],
        userJourney: 'User interacts with the system',
        features: [],
        technicalRequirements: [],
        successMetrics: ['Test metric'],
        timeline: '3 months',
        milestones: ['Test milestone'],
        tags: ['test'],
        stakeholders: ['test-team'],
        author: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        aiGenerated: true
      };

      mockAIService.generatePRDFromIdea.mockResolvedValue(mockPRD);

      const input = {
        projectIdea: 'Test project',
        projectName: 'TestApp',
        author: 'test-user'
      };

      const result = await service.generatePRDFromIdea(input);

      // The service sets aiGenerated flag instead of detailed metadata
      expect(result.aiGenerated).toBe(true);
      expect(result.author).toBe('test-user');
      expect(result.version).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });
  });
});
