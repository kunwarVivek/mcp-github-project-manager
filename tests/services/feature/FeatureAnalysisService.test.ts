import { vi } from 'vitest';
/**
 * Unit tests for FeatureAnalysisService
 *
 * Tests AI-powered feature request analysis including recommendation,
 * priority, complexity extraction, and error handling.
 */

import { FeatureAnalysisService } from '../../../src/services/feature/FeatureAnalysisService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { generateText } from 'ai';
import { TaskPriority, TaskComplexity } from '../../../src/domain/ai-types';

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
  generateText: vi.fn()
}));

const mockGenerateText = generateText as MockedFunction<typeof generateText>;
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
        mockGenerateText.mockResolvedValue({
          text: 'This feature should be approved. It has high priority and complexity 7.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result).toHaveProperty('analysis');
        expect(result).toHaveProperty('recommendation');
        expect(result).toHaveProperty('priority');
        expect(result).toHaveProperty('complexity');
        expect(result).toHaveProperty('estimatedEffort');
        expect(result).toHaveProperty('risks');
        expect(result).toHaveProperty('dependencies');
      });

      it('should extract "approve" recommendation', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This feature should be approved for implementation.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('approve');
      });

      it('should extract "reject" recommendation', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This feature should be rejected due to resource constraints.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('reject');
      });

      it('should extract "modify" recommendation as default', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This feature needs some changes before implementation.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.recommendation).toBe('modify');
      });

      it('should extract critical priority', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This is a critical feature that must be implemented immediately.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.CRITICAL);
      });

      it('should extract high priority', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This is a high priority feature for the next release.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.HIGH);
      });

      it('should extract low priority', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This is a low priority feature that can wait.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.LOW);
      });

      it('should default to medium priority', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This feature should be implemented.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.priority).toBe(TaskPriority.MEDIUM);
      });

      it('should extract complexity from analysis', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'The complexity of this feature is 8 out of 10.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.complexity).toBe(8);
        expect(result.estimatedEffort).toBe(64); // 8 * 8 hours
      });

      it('should default complexity to 5 when not found', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This feature needs implementation.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.complexity).toBe(5);
        expect(result.estimatedEffort).toBe(40); // 5 * 8 hours
      });

      it('should clamp complexity between 1 and 10', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'The complexity is 15 out of 10.'
        } as any);

        const result = await service.analyzeFeatureRequest(validParams);

        expect(result.complexity).toBe(10);
      });

      it('should pass existing PRD to AI when provided', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Feature approved.'
        } as any);

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

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Existing PRD')
          })
        );
      });

      it('should pass business justification to AI', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Feature approved.'
        } as any);

        await service.analyzeFeatureRequest({
          ...validParams,
          businessJustification: 'Required for Q1 compliance'
        });

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Q1 compliance')
          })
        );
      });

      it('should pass target users to AI', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Feature approved.'
        } as any);

        await service.analyzeFeatureRequest({
          ...validParams,
          targetUsers: ['admin', 'end-user']
        });

        expect(mockGenerateText).toHaveBeenCalledWith(
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
        mockGenerateText.mockResolvedValue({
          text: 'Feature approved.'
        } as any);

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
        mockGenerateText.mockRejectedValue(new Error('API rate limit'));

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
