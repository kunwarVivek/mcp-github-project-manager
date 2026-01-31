import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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

// Mock the AI service factory
jest.mock('../../../services/ai/AIServiceFactory');

// Mock the ai package
jest.mock('ai', () => ({
  generateObject: jest.fn()
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
    jest.clearAllMocks();

    mockFactory = {
      getBestAvailableModel: jest.fn().mockReturnValue({ modelId: 'test-model' }),
      getMainModel: jest.fn().mockReturnValue({ modelId: 'test-model' }),
      getFallbackModel: jest.fn().mockReturnValue({ modelId: 'fallback-model' })
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    generator = new ContextualReferenceGenerator();
  });

  // =========================================================================
  // generateReferences - AI Available Path
  // =========================================================================

  describe('generateReferences - AI available', () => {
    it('should generate references with AI when available', async () => {
      const { generateObject } = require('ai');
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalled();
      expect(result?.prdSections).toHaveLength(1);
      expect(result?.relatedFeatures).toHaveLength(1);
    });

    it('should pass correct config to generateObject', async () => {
      const { generateObject } = require('ai');
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
          maxTokens: expect.any(Number),
          temperature: expect.any(Number)
        })
      );
    });

    it('should handle string PRD input', async () => {
      const { generateObject } = require('ai');
      const mockReferences = createMockContextualReferences();
      generateObject.mockResolvedValue({ object: mockReferences });

      const task = createMockTask();
      const prdString = JSON.stringify(createMockPRD());

      const result = await generator.generateReferences(task, prdString);

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalled();
    });

    it('should include features in generation when provided', async () => {
      const { generateObject } = require('ai');
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
      const { generateObject } = require('ai');

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
      const { generateObject } = require('ai');
      generateObject.mockRejectedValue(new Error('AI service error'));

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Should fall back to basic references instead of throwing
      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      const { generateObject } = require('ai');
      generateObject.mockRejectedValue(new Error('timeout'));

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle malformed AI response', async () => {
      const { generateObject } = require('ai');
      generateObject.mockResolvedValue({ object: null });

      // This will use the null return from AI
      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // May return null from AI or fall back - depends on implementation
      // The key is it shouldn't throw
      expect(() => result).not.toThrow();
    });

    it('should handle AI returning partial data', async () => {
      const { generateObject } = require('ai');
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
      const { generateObject } = require('ai');
      // Throw a non-Error object to cover the String(error) branch
      generateObject.mockRejectedValue('string error');

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      // Should fall back to basic references
      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle thrown number in AI call', async () => {
      const { generateObject } = require('ai');
      // Throw a number to cover the String(error) branch
      generateObject.mockRejectedValue(42);

      const result = await generator.generateReferences(createMockTask(), createMockPRD());

      expect(result).toBeDefined();
    });
  });
});
