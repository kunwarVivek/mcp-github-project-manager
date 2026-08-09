import { vi } from 'vitest';
/**
 * Unit tests for FeatureAnalysisService
 *
 * Tests AI-powered feature request analysis including recommendation,
 * priority, complexity extraction, and error handling.
 */

import { FeatureAnalysisService } from '../../../src/services/feature/FeatureAnalysisService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { generateObject } from 'ai';
import { TaskPriority, } from '../../../src/domain/ai-types';

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

/** Helper: build a generateObject response with defaults. */
function aiResponse(overrides: Partial<{
  analysis: string; recommendation: string; priority: string;
  complexity: number; estimatedEffort: number; risks: string[]; dependencies: string[];
}> = {}) {
  return {
    object: {
      analysis: overrides.analysis ?? 'Feature analysis text',
      recommendation: overrides.recommendation ?? 'modify',
      priority: overrides.priority ?? 'medium',
      complexity: overrides.complexity ?? 5,
      estimatedEffort: overrides.estimatedEffort ?? 40,
      risks: overrides.risks ?? ['Technical complexity', 'Integration challenges'],
      dependencies: overrides.dependencies ?? [],
    }
  } as unknown as ReturnType<typeof generateObject>;
}
const mockGetMainModel = vi.fn();
const mockGetBestAvailableModel = vi.fn();

describe('FeatureAnalysisService', () => {
  let service: FeatureAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    AIServiceFactory.getInstance.mockReturnValue({
      getMainModel: mockGetMainModel,
      getBestAvailableModel: mockGetBestAvailableModel
    } as any);
    service = new FeatureAnalysisService();
  });

  describe('constructor', () => {
    it('should create instance with default AIServiceFactory', () => {
      expect(service).toBeDefined();
      expect(AIServiceFactory.getInstance).toHaveBeenCalled();
    });

    it('should create instance with injected AIServiceFactory', () => {
      const mockFactory = {
        getMainModel: vi.fn().mockReturnValue({ id: 'mock' }),
        getBestAvailableModel: vi.fn()
      } as any;
      const customService = new FeatureAnalysisService(mockFactory);
      expect(customService).toBeDefined();
    });
  });

  describe('analyzeFeatureRequest', () => {
    const validParams = {
      featureIdea: 'User Authentication System',
      description: 'Implement comprehensive user authentication with login, registration, and MFA',
      requestedBy: 'product-manager'
    };

    describe('AI Path', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue({ id: 'test-model' });
      });

      it('should return analysis with all required fields', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({
          recommendation: 'approve', priority: 'high', complexity: 7, estimatedEffort: 56,
          risks: ['risk1'], dependencies: ['dep1']
        }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result).toHaveProperty('analysis');
        expect(result).toHaveProperty('recommendation');
        expect(result).toHaveProperty('priority');
        expect(result).toHaveProperty('complexity');
        expect(result).toHaveProperty('estimatedEffort');
        expect(result).toHaveProperty('risks');
        expect(result).toHaveProperty('dependencies');
      });

      it('should return "approve" recommendation from schema', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'approve' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('approve');
      });

      it('should return "reject" recommendation from schema', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'reject' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('reject');
      });

      it('should return "modify" recommendation from schema', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'modify' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('modify');
      });

      it('should map critical priority', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ priority: 'critical' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.CRITICAL);
      });

      it('should map high priority', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ priority: 'high' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.HIGH);
      });

      it('should map low priority', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ priority: 'low' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.LOW);
      });

      it('should map medium priority', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ priority: 'medium' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.MEDIUM);
      });

      it('should use complexity and estimatedEffort from schema', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ complexity: 8, estimatedEffort: 64 }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.complexity).toBe(8);
        expect(result.estimatedEffort).toBe(64);
      });

      it('should pass existing PRD to AI when provided', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'approve' }));

        const existingPRD = {
          id: 'prd-1',
          title: 'Existing PRD',
          features: [],
          version: '1.0.0',
          overview: 'Test overview',
          objectives: [],
          scope: { inScope: [], outOfScope: [], assumptions: [], constraints: [] },
          targetUsers: [],
          userJourney: '',
          technicalRequirements: [],
          timeline: '',
          milestones: [],
          successMetrics: [],
          aiGenerated: false,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          author: 'test',
          stakeholders: [],
          tags: []
        } as any;

        await service.analyzeFeatureRequest({
          ...validParams,
          existingPRD
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Existing PRD')
          })
        );
      });

      it('should pass business justification to AI', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'approve' }));

        await service.analyzeFeatureRequest({
          ...validParams,
          businessJustification: 'Required for Q1 compliance'
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Q1 compliance')
          })
        );
      });

      it('should pass target users to AI', async () => {
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'approve' }));

        await service.analyzeFeatureRequest({
          ...validParams,
          targetUsers: ['admin', 'end-user']
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('admin, end-user')
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
        await expect(service.analyzeFeatureRequest(validParams))
          .rejects.toThrow('AI service is not available');
      });

      it('should fall back to best available model', async () => {
        mockGetMainModel.mockReturnValue(null);
        mockGetBestAvailableModel.mockReturnValue({ id: 'backup-model' });
        mockGenerateObject.mockResolvedValue(aiResponse({ recommendation: 'approve' }));

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result).toBeDefined();
        expect(mockGetBestAvailableModel).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        mockGetMainModel.mockReturnValue({ id: 'test-model' });
      });

      it('should handle AI generation errors gracefully', async () => {
        mockGenerateObject.mockRejectedValue(new Error('API rate limit'));

        await expect(service.analyzeFeatureRequest(validParams))
          .rejects.toThrow();
      });
    });
  });

  describe('extractRecommendation', () => {
    it('should return "approve" when analysis contains "approve"', () => {
      expect(service.extractRecommendation('This should be approved')).toBe('approve');
      expect(service.extractRecommendation('APPROVE this feature')).toBe('approve');
    });

    it('should return "reject" when analysis contains "reject"', () => {
      expect(service.extractRecommendation('This should be rejected')).toBe('reject');
      expect(service.extractRecommendation('REJECT due to constraints')).toBe('reject');
    });

    it('should return "modify" as default', () => {
      expect(service.extractRecommendation('This needs changes')).toBe('modify');
      expect(service.extractRecommendation('')).toBe('modify');
    });
  });

  describe('extractPriority', () => {
    it('should extract critical priority', () => {
      expect(service.extractPriority('This is critical')).toBe(TaskPriority.CRITICAL);
    });

    it('should extract high priority', () => {
      expect(service.extractPriority('High priority feature')).toBe(TaskPriority.HIGH);
    });

    it('should extract low priority', () => {
      expect(service.extractPriority('Low priority item')).toBe(TaskPriority.LOW);
    });

    it('should default to medium priority', () => {
      expect(service.extractPriority('Standard feature')).toBe(TaskPriority.MEDIUM);
    });
  });

  describe('extractComplexity', () => {
    it('should extract numeric complexity', () => {
      expect(service.extractComplexity('complexity is 7')).toBe(7);
      expect(service.extractComplexity('Complexity: 3')).toBe(3);
    });

    it('should clamp complexity to minimum of 1', () => {
      expect(service.extractComplexity('complexity is 0')).toBe(1);
    });

    it('should clamp complexity to maximum of 10', () => {
      expect(service.extractComplexity('complexity is 15')).toBe(10);
    });

    it('should default to 5 when no complexity found', () => {
      expect(service.extractComplexity('No complexity mentioned')).toBe(5);
    });
  });

  describe('extractRisks', () => {
    it('should return default risks', () => {
      const risks = service.extractRisks('Any analysis');
      expect(risks).toContain('Technical complexity');
      expect(risks).toContain('Integration challenges');
      expect(risks).toContain('Resource constraints');
    });
  });

  describe('extractDependencies', () => {
    it('should return empty array by default', () => {
      const deps = service.extractDependencies('Any analysis');
      expect(deps).toEqual([]);
    });
  });
});
