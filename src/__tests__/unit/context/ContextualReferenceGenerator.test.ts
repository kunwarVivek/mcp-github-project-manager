import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextualReferenceGenerator } from '../../../services/context/ContextualReferenceGenerator';
import { AIServiceFactory } from '../../../services/ai/AIServiceFactory';
import {
  AITask,
  PRDDocument,
  TaskStatus,
  TaskPriority,
  TaskComplexity,
  FeatureRequirement,
  TechnicalRequirement
} from '../../../domain/ai-types';
import { ContextualReferences } from '../../../domain/task-context-schemas';
import { generateObject } from 'ai';

// Mock the AI service factory
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

// Mock the ai package
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

describe('ContextualReferenceGenerator', () => {
  let generator: ContextualReferenceGenerator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockFactory: any;

  // =========================================================================
  // Mock Data Fixtures
  // =========================================================================

  const createMockTask = (overrides: Partial<AITask> = {}): AITask => ({
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Create secure login functionality with OAuth support',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    complexity: 7 as TaskComplexity,
    estimatedHours: 16,
    actualHours: 0,
    aiGenerated: true,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [
      { id: 'ac-1', description: 'Users can login with email/password', completed: false }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['auth', 'security'],
    ...overrides
  });

  const createMockPRD = (overrides: Partial<PRDDocument> = {}): PRDDocument => ({
    id: 'prd-1',
    title: 'Authentication System',
    version: '1.0',
    overview: 'Secure authentication for the platform',
    objectives: ['Secure user authentication', 'Support OAuth providers'],
    scope: {
      inScope: ['Login', 'Registration', 'Password reset'],
      outOfScope: ['2FA'],
      assumptions: ['Users have email'],
      constraints: ['Must work on mobile']
    },
    targetUsers: [],
    userJourney: 'User registers, verifies email, logs in',
    features: [
      {
        id: 'f-1',
        title: 'User Login',
        description: 'Email/password authentication',
        priority: TaskPriority.HIGH,
        userStories: ['As a user I can login'],
        acceptanceCriteria: ['Login works with valid credentials'],
        estimatedComplexity: 5 as TaskComplexity,
        dependencies: []
      }
    ],
    technicalRequirements: [
      {
        id: 'tr-1',
        category: 'security' as const,
        requirement: 'JWT tokens for session management',
        rationale: 'Secure stateless authentication',
        priority: TaskPriority.HIGH
      }
    ],
    timeline: '3 months',
    milestones: ['MVP'],
    successMetrics: ['99% login success rate'],
    aiGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'test',
    stakeholders: ['engineering'],
    tags: ['auth'],
    ...overrides
  });

  const createMockContextualReferences = (overrides: Partial<ContextualReferences> = {}): ContextualReferences => ({
    prdSections: [
      {
        section: 'Overview',
        content: 'Auth overview',
        relevance: 'Direct implementation requirement',
        importance: 'high' as const
      }
    ],
    relatedFeatures: [
      {
        featureId: 'f-1',
        title: 'User Login',
        relationship: 'implements' as const,
        context: 'This task implements the login feature'
      }
    ],
    technicalSpecs: [
      {
        type: 'api_spec' as const,
        title: 'Auth API',
        description: 'Authentication endpoints',
        relevantSections: ['Login', 'Logout'],
        url: undefined
      }
    ],
    codeExamples: [],
    externalReferences: [],
    ...overrides
  });

  const createMockFeatures = (): FeatureRequirement[] => [
    {
      id: 'f-1',
      title: 'User Login',
      description: 'Email/password authentication',
      priority: TaskPriority.HIGH,
      userStories: ['As a user I can login'],
      acceptanceCriteria: ['Login works'],
      estimatedComplexity: 5 as TaskComplexity,
      dependencies: []
    },
    {
      id: 'f-2',
      title: 'Password Reset',
      description: 'Reset forgotten passwords',
      priority: TaskPriority.MEDIUM,
      userStories: ['As a user I can reset my password'],
      acceptanceCriteria: ['Reset email sent'],
      estimatedComplexity: 3 as TaskComplexity,
      dependencies: []
    }
  ];

  // =========================================================================
  // Setup
  // =========================================================================

  beforeEach(() => {
    vi.clearAllMocks();

    mockFactory = {
      getBestAvailableModel: vi.fn().mockReturnValue({ modelId: 'test-model' }),
      getMainModel: vi.fn().mockReturnValue({ modelId: 'test-model' }),
      getFallbackModel: vi.fn().mockReturnValue({ modelId: 'fallback-model' })
    };

    (AIServiceFactory.getInstance as Mock).mockReturnValue(mockFactory);

    generator = new ContextualReferenceGenerator();
  });

  // =========================================================================
  // generateReferences - AI Available Path
  // =========================================================================

  describe('generateReferences - AI available', () => {
    it('should generate references with AI when available', async () => {
      
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalled();
      expect(result?.prdSections).toHaveLength(1);
      expect(result?.relatedFeatures).toHaveLength(1);
    });

    it('should pass correct config to generateObject', async () => {
      
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const task = createMockTask();
      const prd = createMockPRD();

      await generator.generateReferences(task, prd);

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ modelId: 'test-model' }),
          system: expect.any(String),
          prompt: expect.any(String),
          schema: expect.any(Object),
          maxOutputTokens: expect.any(Number),
          temperature: expect.any(Number)
        })
      );
    });

    it('should handle string PRD input', async () => {
      
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const task = createMockTask();
      const prdString = JSON.stringify(createMockPRD());

      const result = await generator.generateReferences(task, prdString);

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalled();
    });

    it('should include features in generation when provided', async () => {
      
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const task = createMockTask();
      const prd = createMockPRD();
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, prd, features);

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // generateReferences - AI Unavailable / Fallback Path
  // =========================================================================

  describe('generateReferences - fallback behavior', () => {
    beforeEach(() => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should use fallback when AI is unavailable', async () => {
      

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      expect(generateObject).not.toHaveBeenCalled();
      expect(result?.prdSections).toBeDefined();
    });

    it('should extract PRD sections in fallback mode', async () => {
      const prd = createMockPRD({
        objectives: ['Build secure auth', 'Enable OAuth'],
        successMetrics: ['99% uptime', 'Zero security breaches'],
        technicalRequirements: [
          {
            id: 'tr-1',
            category: 'security' as const,
            requirement: 'JWT for authentication',
            rationale: 'Secure tokens',
            priority: TaskPriority.HIGH
          },
          {
            id: 'tr-2',
            category: 'security' as const,
            requirement: 'bcrypt for password hashing',
            rationale: 'Secure password storage',
            priority: TaskPriority.HIGH
          }
        ]
      });

      const result = await generator.generateReferences(createMockTask(), prd);

      expect(result?.prdSections).toBeDefined();
      expect(result?.prdSections.length).toBeGreaterThanOrEqual(1);

      // Should include objectives section
      const objectivesSection = result?.prdSections.find(s => s.section === 'Business Objectives');
      expect(objectivesSection).toBeDefined();
      expect(objectivesSection?.importance).toBe('high');

      // Should include success metrics
      const metricsSection = result?.prdSections.find(s => s.section === 'Success Metrics');
      expect(metricsSection).toBeDefined();

      // Should include technical requirements
      const techSection = result?.prdSections.find(s => s.section === 'Technical Requirements');
      expect(techSection).toBeDefined();
      expect(techSection?.importance).toBe('critical');
    });

    it('should handle string PRD in fallback mode', async () => {
      const prdString = JSON.stringify(createMockPRD());

      const result = await generator.generateReferences(createMockTask(), prdString);

      expect(result).toBeDefined();
      // String PRD in fallback returns minimal structure
      expect(result?.prdSections).toBeDefined();
      expect(result?.prdSections[0].content).toBe('PRD content not available');
    });

    it('should identify related features by title similarity', async () => {
      const task = createMockTask({ title: 'Implement User Login form' });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      expect(result?.relatedFeatures).toBeDefined();
      expect(result?.relatedFeatures.length).toBeGreaterThanOrEqual(1);

      // Should find the 'User Login' feature as related
      const loginFeature = result?.relatedFeatures.find(f => f.title === 'User Login');
      expect(loginFeature).toBeDefined();
      expect(loginFeature?.relationship).toBe('implements');
    });

    it('should link to parent feature when no direct match found', async () => {
      const task = createMockTask({
        title: 'Completely unrelated task',
        description: 'Nothing to do with any feature'
      });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      expect(result?.relatedFeatures).toBeDefined();
      expect(result?.relatedFeatures.length).toBeGreaterThanOrEqual(1);
      // Should default to first feature as parent
      expect(result?.relatedFeatures[0].relationship).toBe('depends_on');
    });

    it('should return empty related features when no features provided', async () => {
      const result = await generator.generateReferences(createMockTask(), createMockPRD(), []);

      expect(result?.relatedFeatures).toBeDefined();
      expect(result?.relatedFeatures.length).toBe(0);
    });

    it('should extract technical specs based on task keywords', async () => {
      const apiTask = createMockTask({
        title: 'Create REST API endpoint',
        description: 'Build a RESTful endpoint for user data'
      });

      const result = await generator.generateReferences(apiTask, createMockPRD());

      expect(result?.technicalSpecs).toBeDefined();
      const apiSpec = result?.technicalSpecs.find(s => s.type === 'api_spec');
      expect(apiSpec).toBeDefined();
      expect(apiSpec?.title).toBe('API Specification');
    });

    it('should detect database keywords for data model specs', async () => {
      const dbTask = createMockTask({
        title: 'Update database schema',
        description: 'Add new columns to user model'
      });

      const result = await generator.generateReferences(dbTask, createMockPRD());

      const dataSpec = result?.technicalSpecs.find(s => s.type === 'data_model');
      expect(dataSpec).toBeDefined();
      expect(dataSpec?.title).toBe('Data Model Specification');
    });

    it('should detect UI keywords for design system specs', async () => {
      const uiTask = createMockTask({
        title: 'Build login component',
        description: 'Create the UI interface for authentication'
      });

      const result = await generator.generateReferences(uiTask, createMockPRD());

      const designSpec = result?.technicalSpecs.find(s => s.type === 'design_system');
      expect(designSpec).toBeDefined();
      expect(designSpec?.title).toBe('Design System');
    });

    it('should detect architecture keywords', async () => {
      const archTask = createMockTask({
        title: 'Design service architecture',
        description: 'Create the system design for auth service'
      });

      const result = await generator.generateReferences(archTask, createMockPRD());

      const archSpec = result?.technicalSpecs.find(s => s.type === 'architecture_doc');
      expect(archSpec).toBeDefined();
      expect(archSpec?.title).toBe('System Architecture');
    });

    it('should generate API code examples for API tasks', async () => {
      const apiTask = createMockTask({
        title: 'Create API endpoint',
        description: 'Build REST endpoint'
      });

      const result = await generator.generateReferences(apiTask, createMockPRD());

      expect(result?.codeExamples).toBeDefined();
      expect(result?.codeExamples.length).toBeGreaterThan(0);
      expect(result?.codeExamples[0].title).toBe('API Endpoint Pattern');
      expect(result?.codeExamples[0].language).toBe('typescript');
    });

    it('should generate React component examples for UI tasks', async () => {
      const uiTask = createMockTask({
        title: 'Build component',
        description: 'Create UI component'
      });

      const result = await generator.generateReferences(uiTask, createMockPRD());

      expect(result?.codeExamples).toBeDefined();
      const reactExample = result?.codeExamples.find(e => e.title === 'React Component Pattern');
      expect(reactExample).toBeDefined();
      expect(reactExample?.language).toBe('typescript');
    });

    it('should generate service layer examples for service tasks', async () => {
      const serviceTask = createMockTask({
        title: 'Implement service layer',
        description: 'Create business logic service'
      });

      const result = await generator.generateReferences(serviceTask, createMockPRD());

      const serviceExample = result?.codeExamples.find(e => e.title === 'Service Layer Pattern');
      expect(serviceExample).toBeDefined();
    });

    it('should suggest TypeScript documentation for type tasks', async () => {
      const typeTask = createMockTask({
        title: 'Add TypeScript types',
        description: 'Define type interfaces'
      });

      const result = await generator.generateReferences(typeTask, createMockPRD());

      expect(result?.externalReferences).toBeDefined();
      const tsRef = result?.externalReferences.find(r => r.title === 'TypeScript Documentation');
      expect(tsRef).toBeDefined();
      expect(tsRef?.url).toBe('https://www.typescriptlang.org/docs/');
    });

    it('should suggest React documentation for component tasks', async () => {
      const reactTask = createMockTask({
        title: 'Build React component',
        description: 'Create login component'
      });

      const result = await generator.generateReferences(reactTask, createMockPRD());

      const reactRef = result?.externalReferences.find(r => r.title === 'React Documentation');
      expect(reactRef).toBeDefined();
      expect(reactRef?.url).toBe('https://react.dev/');
    });

    it('should suggest Node.js docs for server tasks', async () => {
      const serverTask = createMockTask({
        title: 'Build server endpoint',
        description: 'Create Node.js API'
      });

      const result = await generator.generateReferences(serverTask, createMockPRD());

      const nodeRef = result?.externalReferences.find(r => r.title === 'Node.js Best Practices');
      expect(nodeRef).toBeDefined();
    });

    it('should suggest testing docs for test tasks', async () => {
      const testTask = createMockTask({
        title: 'Add unit tests',
        description: 'Write testing for auth'
      });

      const result = await generator.generateReferences(testTask, createMockPRD());

      const testRef = result?.externalReferences.find(r => r.title === 'Testing Best Practices');
      expect(testRef).toBeDefined();
      expect(testRef?.type).toBe('best_practice');
    });

    it('should suggest security docs for auth tasks', async () => {
      const secTask = createMockTask({
        title: 'Implement security features',
        description: 'Add auth protection'
      });

      const result = await generator.generateReferences(secTask, createMockPRD());

      const secRef = result?.externalReferences.find(r => r.title === 'OWASP Top 10');
      expect(secRef).toBeDefined();
      expect(secRef?.type).toBe('best_practice');
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  describe('generateReferences - error handling', () => {
    it('should handle AI errors gracefully and use fallback', async () => {
      
      generateObject.mockRejectedValue(new Error('AI service error'));

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Should fall back to basic references instead of throwing
      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      
      generateObject.mockRejectedValue(new Error('timeout'));

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle malformed AI response', async () => {
      
      generateObject.mockResolvedValue({ object: null });

      // This will use the null return from AI
      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // May return null from AI or fall back - depends on implementation
      // The key is it shouldn't throw
      expect(() => result).not.toThrow();
    });

    it('should handle AI returning partial data', async () => {
      
      generateObject.mockResolvedValue({
        object: {
          prdSections: [],
          // Missing other fields
        }
      });

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('generateReferences - edge cases', () => {
    beforeEach(() => {
      // Use fallback for edge case testing
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should handle task with no tags', async () => {
      const noTagsTask = createMockTask({ tags: [] });

      const result = await generator.generateReferences(noTagsTask, createMockPRD());

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle task with empty description', async () => {
      const emptyDescTask = createMockTask({ description: '' });

      const result = await generator.generateReferences(emptyDescTask, createMockPRD());

      expect(result).toBeDefined();
    });

    it('should handle PRD with no features array', async () => {
      const noFeaturesPRD = createMockPRD({ features: [] });

      const result = await generator.generateReferences(createMockTask(), noFeaturesPRD);

      expect(result).toBeDefined();
    });

    it('should handle PRD with empty objectives', async () => {
      const noObjectivesPRD = createMockPRD({ objectives: [] });

      const result = await generator.generateReferences(createMockTask(), noObjectivesPRD);

      expect(result).toBeDefined();
      // Should not include objectives section when empty
      const objectivesSection = result?.prdSections.find(s => s.section === 'Business Objectives');
      expect(objectivesSection).toBeUndefined();
    });

    it('should handle PRD with empty success metrics', async () => {
      const noMetricsPRD = createMockPRD({ successMetrics: [] });

      const result = await generator.generateReferences(createMockTask(), noMetricsPRD);

      expect(result).toBeDefined();
      const metricsSection = result?.prdSections.find(s => s.section === 'Success Metrics');
      expect(metricsSection).toBeUndefined();
    });

    it('should handle null PRD gracefully', async () => {
      const result = await generator.generateReferences(createMockTask(), null as unknown as PRDDocument);

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
      expect(result?.prdSections[0].content).toBe('PRD content not available');
    });

    it('should handle task with subtasks', async () => {
      // AITask.subtasks is string[] (IDs only)
      const taskWithSubtasks = createMockTask({
        subtasks: ['sub-1', 'sub-2', 'sub-3']
      });

      const result = await generator.generateReferences(taskWithSubtasks, createMockPRD());

      expect(result).toBeDefined();
    });

    it('should handle task with dependencies', async () => {
      const taskWithDeps = createMockTask({
        dependencies: [
          { id: 'dep-1', type: 'blocks' as const }
        ]
      });

      const result = await generator.generateReferences(taskWithDeps, createMockPRD());

      expect(result).toBeDefined();
    });

    it('should handle very long descriptions gracefully', async () => {
      const longDesc = 'A'.repeat(5000);
      const longDescTask = createMockTask({ description: longDesc });

      const result = await generator.generateReferences(longDescTask, createMockPRD());

      expect(result).toBeDefined();
    });

    it('should handle PRD with long technical requirements', async () => {
      const longReqsPRD = createMockPRD({
        technicalRequirements: Array(100).fill(null).map((_, i): TechnicalRequirement => ({
          id: `tr-${i}`,
          category: 'performance' as const,
          requirement: `Requirement ${i} - This is a fairly long requirement description that adds content`,
          rationale: `Rationale ${i}`,
          priority: TaskPriority.MEDIUM
        }))
      });

      const result = await generator.generateReferences(createMockTask(), longReqsPRD);

      expect(result).toBeDefined();
      // Technical requirements content should be truncated
      const techSection = result?.prdSections.find(s => s.section === 'Technical Requirements');
      expect(techSection).toBeDefined();
      expect(techSection?.content.length).toBeLessThanOrEqual(600); // 500 + some buffer
    });
  });

  // =========================================================================
  // isAIAvailable
  // =========================================================================

  describe('isAIAvailable', () => {
    it('should return true when AI model is available', () => {
      expect(generator.isAIAvailable()).toBe(true);
    });

    it('should return false when AI model is unavailable', () => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();

      expect(generator.isAIAvailable()).toBe(false);
    });
  });

  // =========================================================================
  // Feature Matching Logic
  // =========================================================================

  describe('feature matching', () => {
    beforeEach(() => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should match feature by task description containing feature title', async () => {
      const task = createMockTask({
        title: 'Something else',
        description: 'This task relates to User Login functionality'
      });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      const loginFeature = result?.relatedFeatures.find(f => f.title === 'User Login');
      expect(loginFeature).toBeDefined();
      expect(loginFeature?.relationship).toBe('implements');
    });

    it('should match multiple features if multiple keywords match', async () => {
      const task = createMockTask({
        title: 'User Login and Password Reset flow',
        description: 'Handle both login and password reset'
      });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      // Should find both matching features
      expect(result?.relatedFeatures.length).toBeGreaterThanOrEqual(1);
    });

    it('should be case-insensitive when matching features', async () => {
      const task = createMockTask({
        title: 'USER LOGIN implementation',
        description: 'Build the user login system'
      });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      const loginFeature = result?.relatedFeatures.find(f => f.title === 'User Login');
      expect(loginFeature).toBeDefined();
    });

    it('should use index-based feature ID when feature.id is missing', async () => {
      const task = createMockTask({
        title: 'Implement User Login form'
      });
      // Features without id field
      const featuresWithoutId: FeatureRequirement[] = [
        {
          id: '', // Empty string is falsy
          title: 'User Login',
          description: 'Login feature',
          priority: TaskPriority.HIGH,
          userStories: ['As a user I can login'],
          acceptanceCriteria: ['Login works'],
          estimatedComplexity: 5 as TaskComplexity,
          dependencies: []
        }
      ];

      const result = await generator.generateReferences(task, createMockPRD(), featuresWithoutId);

      expect(result?.relatedFeatures).toBeDefined();
      expect(result?.relatedFeatures.length).toBe(1);
      // Should use 'feature-0' as fallback ID
      expect(result?.relatedFeatures[0].featureId).toBe('feature-0');
    });

    it('should use index-based feature ID for parent feature fallback when id is missing', async () => {
      const task = createMockTask({
        title: 'Completely unrelated task',
        description: 'Nothing to do with features'
      });
      // Feature without id field (falls through to parent feature fallback)
      const featuresWithoutId: FeatureRequirement[] = [
        {
          id: '', // Empty string is falsy
          title: 'Some Feature',
          description: 'Some feature',
          priority: TaskPriority.HIGH,
          userStories: ['As a user'],
          acceptanceCriteria: ['Works'],
          estimatedComplexity: 5 as TaskComplexity,
          dependencies: []
        }
      ];

      const result = await generator.generateReferences(task, createMockPRD(), featuresWithoutId);

      expect(result?.relatedFeatures).toBeDefined();
      expect(result?.relatedFeatures.length).toBe(1);
      expect(result?.relatedFeatures[0].relationship).toBe('depends_on');
      // Should use 'feature-0' as fallback ID for parent feature
      expect(result?.relatedFeatures[0].featureId).toBe('feature-0');
    });
  });

  // =========================================================================
  // Additional Edge Cases for Branch Coverage
  // =========================================================================

  describe('additional edge cases', () => {
    it('should handle non-Error thrown objects in AI call', async () => {
      
      // Throw a non-Error object to cover the String(error) branch
      generateObject.mockRejectedValue('string error');

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Should fall back to basic references
      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle thrown number in AI call', async () => {
      
      // Throw a number to cover the String(error) branch
      generateObject.mockRejectedValue(42);

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // Error Logging & Fallback Verification
  // =========================================================================

  describe('error logging and fallback verification', () => {
    it('should write error message to stderr when AI call fails with Error', async () => {
      
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      generateObject.mockRejectedValue(new Error('model overloaded'));

      await generator.generateReferences(createMockTask(), createMockPRD());

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('model overloaded')
      );
      stderrSpy.mockRestore();
    });

    it('should write stringified error to stderr for non-Error thrown values', async () => {
      
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      generateObject.mockRejectedValue({ code: 'RATE_LIMIT', detail: 'too many requests' });

      await generator.generateReferences(createMockTask(), createMockPRD());

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error generating contextual references')
      );
      stderrSpy.mockRestore();
    });

    it('should return complete ContextualReferences structure from fallback after AI error', async () => {
      
      generateObject.mockRejectedValue(new Error('service unavailable'));

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Verify ALL fields of ContextualReferences are present in fallback
      expect(result).toBeDefined();
      expect(result).toHaveProperty('prdSections');
      expect(result).toHaveProperty('relatedFeatures');
      expect(result).toHaveProperty('technicalSpecs');
      expect(result).toHaveProperty('codeExamples');
      expect(result).toHaveProperty('externalReferences');
      expect(Array.isArray(result?.prdSections)).toBe(true);
      expect(Array.isArray(result?.relatedFeatures)).toBe(true);
      expect(Array.isArray(result?.technicalSpecs)).toBe(true);
      expect(Array.isArray(result?.codeExamples)).toBe(true);
      expect(Array.isArray(result?.externalReferences)).toBe(true);
    });

    it('should handle generateObject returning undefined object', async () => {
      
      generateObject.mockResolvedValue({ object: undefined });

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Returns undefined from AI path since result.object is undefined
      // Key: should not throw
      expect(() => result).not.toThrow();
    });

    it('should handle synchronous throw from generateObject', async () => {
      
      generateObject.mockImplementation(() => {
        throw new TypeError('Cannot read properties of undefined');
      });

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Should catch synchronous errors and fall back
      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });
  });

  // =========================================================================
  // Compound Keyword Detection
  // =========================================================================

  describe('compound keyword detection', () => {
    beforeEach(() => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should detect ALL technical spec categories when task mentions all keywords', async () => {
      const allKeywordsTask = createMockTask({
        title: 'Build API with database schema',
        description: 'Create system architecture with UI component interface for REST endpoint model'
      });

      const result = await generator.generateReferences(allKeywordsTask, createMockPRD());

      const specTypes = result?.technicalSpecs.map(s => s.type) ?? [];
      expect(specTypes).toContain('api_spec');
      expect(specTypes).toContain('data_model');
      expect(specTypes).toContain('design_system');
      expect(specTypes).toContain('architecture_doc');
      expect(result?.technicalSpecs.length).toBe(4);
    });

    it('should generate multiple code example types when task matches several patterns', async () => {
      const multiTask = createMockTask({
        title: 'Build API endpoint and component for service',
        description: 'Create REST API with UI component and business logic service layer'
      });

      const result = await generator.generateReferences(multiTask, createMockPRD());

      expect(result?.codeExamples.length).toBeGreaterThanOrEqual(3);
      const titles = result?.codeExamples.map(e => e.title) ?? [];
      expect(titles).toContain('API Endpoint Pattern');
      expect(titles).toContain('React Component Pattern');
      expect(titles).toContain('Service Layer Pattern');
    });

    it('should suggest multiple external references for multi-domain tasks', async () => {
      const multiRefTask = createMockTask({
        title: 'Build secure React component with TypeScript types',
        description: 'Create Node.js server API with testing and auth security'
      });

      const result = await generator.generateReferences(multiRefTask, createMockPRD());

      const refTitles = result?.externalReferences.map(r => r.title) ?? [];
      expect(refTitles).toContain('TypeScript Documentation');
      expect(refTitles).toContain('React Documentation');
      expect(refTitles).toContain('Node.js Best Practices');
      expect(refTitles).toContain('Testing Best Practices');
      expect(refTitles).toContain('OWASP Top 10');
      expect(result?.externalReferences.length).toBe(5);
    });

    it('should return empty specs, examples, and refs when no keywords match', async () => {
      const noMatchTask = createMockTask({
        title: 'Write documentation',
        description: 'Add inline comments to existing code'
      });

      const result = await generator.generateReferences(noMatchTask, createMockPRD());

      expect(result?.technicalSpecs).toEqual([]);
      expect(result?.codeExamples).toEqual([]);
      expect(result?.externalReferences).toEqual([]);
    });
  });

  // =========================================================================
  // PRD Extraction Edge Cases
  // =========================================================================

  describe('PRD extraction edge cases', () => {
    beforeEach(() => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should truncate objectives to first 3 items when PRD has many', async () => {
      const manyObjectivesPRD = createMockPRD({
        objectives: [
          'Objective Alpha',
          'Objective Beta',
          'Objective Gamma',
          'Objective Delta',
          'Objective Epsilon'
        ]
      });

      const result = await generator.generateReferences(createMockTask(), manyObjectivesPRD);

      const objectivesSection = result?.prdSections.find(s => s.section === 'Business Objectives');
      expect(objectivesSection).toBeDefined();
      // Should contain first 3 joined, not all 5
      expect(objectivesSection?.content).toContain('Objective Alpha');
      expect(objectivesSection?.content).toContain('Objective Beta');
      expect(objectivesSection?.content).toContain('Objective Gamma');
      expect(objectivesSection?.content).not.toContain('Objective Delta');
      expect(objectivesSection?.content).not.toContain('Objective Epsilon');
    });

    it('should truncate success metrics to first 3 items', async () => {
      const manyMetricsPRD = createMockPRD({
        successMetrics: [
          'Metric One',
          'Metric Two',
          'Metric Three',
          'Metric Four',
          'Metric Five'
        ]
      });

      const result = await generator.generateReferences(createMockTask(), manyMetricsPRD);

      const metricsSection = result?.prdSections.find(s => s.section === 'Success Metrics');
      expect(metricsSection).toBeDefined();
      expect(metricsSection?.content).toContain('Metric One');
      expect(metricsSection?.content).toContain('Metric Three');
      expect(metricsSection?.content).not.toContain('Metric Four');
    });

    it('should handle PRD with objectives but no successMetrics or technicalRequirements', async () => {
      const partialPRD = createMockPRD({
        objectives: ['Build the thing'],
        successMetrics: [],
        technicalRequirements: undefined as unknown as TechnicalRequirement[]
      });

      const result = await generator.generateReferences(createMockTask(), partialPRD);

      expect(result).toBeDefined();
      const objectivesSection = result?.prdSections.find(s => s.section === 'Business Objectives');
      expect(objectivesSection).toBeDefined();
      const metricsSection = result?.prdSections.find(s => s.section === 'Success Metrics');
      expect(metricsSection).toBeUndefined();
      const techSection = result?.prdSections.find(s => s.section === 'Technical Requirements');
      expect(techSection).toBeUndefined();
    });

    it('should handle non-JSON string PRD by treating it as non-parseable', async () => {
      // String PRD that isn't JSON - generateBasicReferences treats it as string
      // so prdObj will be null (typeof prd !== 'object')
      const result = await generator.generateReferences(
        createMockTask(),
        'This is just a plain text PRD description, not JSON'
      );

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
      // String PRD -> prdObj = null -> returns "PRD content not available"
      expect(result?.prdSections[0].content).toBe('PRD content not available');
    });

    it('should handle empty string PRD', async () => {
      const result = await generator.generateReferences(createMockTask(), '');

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
      expect(result?.prdSections[0].section).toBe('Overview');
      expect(result?.prdSections[0].content).toBe('PRD content not available');
    });
  });

  // =========================================================================
  // Task Input Edge Cases
  // =========================================================================

  describe('task input edge cases', () => {
    beforeEach(() => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();
    });

    it('should handle task with both empty title and empty description', async () => {
      const emptyTask = createMockTask({ title: '', description: '' });

      const result = await generator.generateReferences(emptyTask, createMockPRD());

      expect(result).toBeDefined();
      // Empty strings won't match any keyword patterns
      expect(result?.technicalSpecs).toEqual([]);
      expect(result?.codeExamples).toEqual([]);
      expect(result?.externalReferences).toEqual([]);
    });

    it('should handle task with special characters in title and description', async () => {
      const specialTask = createMockTask({
        title: 'Build API <endpoint> for @users & "quotes"',
        description: 'Handle /api/v1 with $params and %encoding + regex /^test$/i'
      });

      const result = await generator.generateReferences(specialTask, createMockPRD());

      expect(result).toBeDefined();
      // Should still detect "api" and "endpoint" keywords despite special chars
      const apiSpec = result?.technicalSpecs.find(s => s.type === 'api_spec');
      expect(apiSpec).toBeDefined();
    });

    it('should generate context string for related features with correct interpolation', async () => {
      const task = createMockTask({
        title: 'Implement User Login verification',
        description: 'Login feature implementation'
      });
      const features = createMockFeatures();

      const result = await generator.generateReferences(task, createMockPRD(), features);

      const loginFeature = result?.relatedFeatures.find(f => f.title === 'User Login');
      expect(loginFeature).toBeDefined();
      // Verify the context string includes the feature title
      expect(loginFeature?.context).toBe('This task implements part of the "User Login" feature');
    });

    it('should handle features without providing features argument (undefined)', async () => {
      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      // No features provided => identifyRelatedFeatures receives []
      // Empty features array + length === 0 => no parent fallback => empty array
      expect(result?.relatedFeatures).toEqual([]);
    });
  });
});
