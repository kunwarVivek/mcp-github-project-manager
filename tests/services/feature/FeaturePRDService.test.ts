import { vi } from 'vitest';
/**
 * Unit tests for FeaturePRDService
 *
 * Tests adding features to PRD documents, version incrementing,
 * and impact assessment.
 */

import { FeaturePRDService } from '../../../src/services/feature/FeaturePRDService';
import { FeatureAnalysisService } from '../../../src/services/feature/FeatureAnalysisService';
import { FeatureAdditionRequest, PRDDocument, TaskPriority } from '../../../src/domain/ai-types';

// Mock FeatureAnalysisService
vi.mock('../../../src/services/feature/FeatureAnalysisService', () => ({
      FeatureAnalysisService: vi.fn().mockImplementation(function() { return ({
        analyzeFeature: vi.fn(),
        getFeatureContext: vi.fn(),
      })),
    }));

const mockAnalyzeFeatureRequest = vi.fn();

describe('FeaturePRDService', () => {
  let service: FeaturePRDService;
  let mockAnalysisService: Mocked<FeatureAnalysisService>;

  const mockPRD: PRDDocument = {
    id: 'prd-1',
    title: 'Test PRD',
    version: '1.0.0',
    overview: 'Test PRD overview',
    objectives: ['Objective 1'],
    scope: {
      inScope: ['Feature 1'],
      outOfScope: [],
      assumptions: [],
      constraints: []
    },
    targetUsers: [],
    userJourney: 'User journey description',
    features: [
      {
        id: 'feat-1',
        title: 'Existing Feature',
        description: 'An existing feature',
        priority: TaskPriority.MEDIUM,
        userStories: ['As a user, I want existing feature'],
        acceptanceCriteria: ['Feature works'],
        estimatedComplexity: 5,
        dependencies: []
      }
    ],
    technicalRequirements: [],
    timeline: 'Q1 2024',
    milestones: ['Milestone 1'],
    successMetrics: ['Metric 1'],
    aiGenerated: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    author: 'test-author',
    stakeholders: ['stakeholder-1'],
    tags: ['test']
  } as any;

  const mockFeatureRequest: FeatureAdditionRequest = {
    id: 'req-1',
    featureIdea: 'New Authentication System',
    description: 'Implement comprehensive authentication with OAuth and MFA',
    requestedBy: 'product-manager',
    businessJustification: 'Required for security compliance',
    createdAt: '2024-01-15T00:00:00Z',
    status: 'pending'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    mockAnalysisService = {
      analyzeFeatureRequest: mockAnalyzeFeatureRequest
    } as any;

    service = new FeaturePRDService(mockAnalysisService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with injected analysis service', () => {
      expect(service).toBeDefined();
    });

    it('should create instance with default analysis service', () => {
      const defaultService = new FeaturePRDService();
      expect(defaultService).toBeDefined();
    });
  });

  describe('addFeatureToPRD', () => {
    describe('Successful Addition', () => {
      beforeEach(() => {
        mockAnalyzeFeatureRequest.mockResolvedValue({
          analysis: 'Feature analysis text',
          recommendation: 'approve',
          priority: TaskPriority.HIGH,
          complexity: 7,
          estimatedEffort: 56,
          risks: ['Technical complexity'],
          dependencies: []
        });
      });

      it('should add feature to PRD and return updated PRD', async () => {
        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(result.updatedPRD).toBeDefined();
        expect(result.updatedPRD.features).toHaveLength(2);
        expect(result.newFeature).toBeDefined();
        expect(result.impactAssessment).toBeDefined();
      });

      it('should create feature with correct properties', async () => {
        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(result.newFeature.title).toBe('New Authentication System');
        expect(result.newFeature.description).toBe(mockFeatureRequest.description);
        expect(result.newFeature.priority).toBe(TaskPriority.HIGH);
        expect(result.newFeature.estimatedComplexity).toBe(7);
        expect(result.newFeature.userStories).toHaveLength(1);
        expect(result.newFeature.userStories[0]).toContain('new authentication system');
        expect(result.newFeature.acceptanceCriteria).toHaveLength(3);
      });

      it('should increment PRD version', async () => {
        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(result.updatedPRD.version).toBe('1.1.0');
      });

      it('should update PRD timestamp', async () => {
        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(result.updatedPRD.updatedAt).toBe('2024-01-15T12:00:00.000Z');
      });

      it('should call analysis service with correct parameters', async () => {
        await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(mockAnalyzeFeatureRequest).toHaveBeenCalledWith({
          featureIdea: mockFeatureRequest.featureIdea,
          description: mockFeatureRequest.description,
          existingPRD: mockPRD,
          businessJustification: mockFeatureRequest.businessJustification,
          targetUsers: mockFeatureRequest.targetUsers,
          requestedBy: mockFeatureRequest.requestedBy
        });
      });

      it('should generate impact assessment', async () => {
        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        });

        expect(result.impactAssessment).toContain('New Authentication System');
        expect(result.impactAssessment).toContain('1'); // 1 existing feature
      });
    });

    describe('Auto-Approve Mode', () => {
      it('should skip approval check when autoApprove is true', async () => {
        mockAnalyzeFeatureRequest.mockResolvedValue({
          analysis: 'Feature needs modifications',
          recommendation: 'modify',
          priority: TaskPriority.MEDIUM,
          complexity: 5,
          estimatedEffort: 40,
          risks: [],
          dependencies: []
        });

        const result = await service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD,
          autoApprove: true
        });

        expect(result.updatedPRD).toBeDefined();
        expect(result.newFeature).toBeDefined();
      });

      it('should reject when not auto-approve and recommendation is not "approve"', async () => {
        mockAnalyzeFeatureRequest.mockResolvedValue({
          analysis: 'Feature should be rejected',
          recommendation: 'reject',
          priority: TaskPriority.LOW,
          complexity: 3,
          estimatedEffort: 24,
          risks: [],
          dependencies: []
        });

        await expect(service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD,
          autoApprove: false
        })).rejects.toThrow('Feature request not approved');
      });

      it('should reject when recommendation is "modify" and not auto-approve', async () => {
        mockAnalyzeFeatureRequest.mockResolvedValue({
          analysis: 'Feature needs changes',
          recommendation: 'modify',
          priority: TaskPriority.MEDIUM,
          complexity: 5,
          estimatedEffort: 40,
          risks: [],
          dependencies: []
        });

        await expect(service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        })).rejects.toThrow('Feature request not approved');
      });
    });

    describe('Error Handling', () => {
      it('should propagate analysis service errors', async () => {
        mockAnalyzeFeatureRequest.mockRejectedValue(new Error('AI service unavailable'));

        await expect(service.addFeatureToPRD({
          featureRequest: mockFeatureRequest,
          targetPRD: mockPRD
        })).rejects.toThrow('AI service unavailable');
      });
    });
  });

  describe('incrementVersion', () => {
    it('should increment minor version', () => {
      expect(service.incrementVersion('1.0.0')).toBe('1.1.0');
      expect(service.incrementVersion('2.3.0')).toBe('2.4.0');
      expect(service.incrementVersion('0.9.0')).toBe('0.10.0');
    });

    it('should return original version if not in semver format', () => {
      expect(service.incrementVersion('1.0')).toBe('1.0');
      expect(service.incrementVersion('version-1')).toBe('version-1');
      expect(service.incrementVersion('')).toBe('');
    });
  });

  describe('assessFeatureImpact', () => {
    it('should generate impact assessment with feature name', () => {
      const assessment = service.assessFeatureImpact({
        newFeature: {
          id: 'feat-new',
          title: 'New Feature',
          description: 'Description',
          priority: TaskPriority.MEDIUM,
          userStories: [],
          acceptanceCriteria: [],
          estimatedComplexity: 5,
          dependencies: []
        },
        existingFeatures: [],
        systemContext: {}
      });

      expect(assessment).toContain('New Feature');
      expect(assessment).toContain('0'); // 0 existing features
    });

    it('should include count of existing features', () => {
      const assessment = service.assessFeatureImpact({
        newFeature: {
          id: 'feat-new',
          title: 'New Feature',
          description: 'Description',
          priority: TaskPriority.MEDIUM,
          userStories: [],
          acceptanceCriteria: [],
          estimatedComplexity: 5,
          dependencies: []
        },
        existingFeatures: [mockPRD.features[0], mockPRD.features[0]],
        systemContext: {}
      });

      expect(assessment).toContain('2');
    });
  });
});
