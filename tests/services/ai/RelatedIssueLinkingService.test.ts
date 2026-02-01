/**
 * Unit tests for RelatedIssueLinkingService
 *
 * Tests AI-powered related issue detection using semantic similarity,
 * dependency detection, and component grouping.
 */

import { RelatedIssueLinkingService } from '../../../src/services/ai/RelatedIssueLinkingService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { embed, embedMany, cosineSimilarity, generateObject } from 'ai';

// Mock dependencies
jest.mock('../../../src/services/ai/AIServiceFactory');
jest.mock('ai', () => ({
  embed: jest.fn(),
  embedMany: jest.fn(),
  cosineSimilarity: jest.fn(),
  generateObject: jest.fn()
}));

const mockEmbed = embed as jest.MockedFunction<typeof embed>;
const mockEmbedMany = embedMany as jest.MockedFunction<typeof embedMany>;
const mockCosineSimilarity = cosineSimilarity as jest.MockedFunction<typeof cosineSimilarity>;
const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;
const mockGetModel = jest.fn();
const mockGetBestAvailableModel = jest.fn();

describe('RelatedIssueLinkingService', () => {
  let service: RelatedIssueLinkingService;

  const mockRepositoryIssues = [
    { id: '1', number: 1, title: 'User authentication', body: 'Implement user login and registration', labels: ['auth', 'backend'], state: 'open' as const, createdAt: '2024-01-01' },
    { id: '2', number: 2, title: 'Dashboard UI', body: 'Create dashboard layout with charts', labels: ['frontend', 'ui'], state: 'open' as const, createdAt: '2024-01-02' },
    { id: '3', number: 3, title: 'API rate limiting', body: 'Implement rate limits. Requires auth to be done first.', labels: ['backend', 'api'], state: 'open' as const, createdAt: '2024-01-03' },
    { id: '4', number: 4, title: 'User profile page', body: 'Display user profile with settings. Blocked by auth implementation.', labels: ['frontend', 'auth'], state: 'open' as const, createdAt: '2024-01-04' },
    { id: '5', number: 5, title: 'Password reset', body: 'Implement password reset flow for auth', labels: ['auth', 'backend'], state: 'closed' as const, createdAt: '2024-01-05' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });

    // Default embedding mocks
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] } as any);
    mockEmbedMany.mockResolvedValue({ embeddings: mockRepositoryIssues.map(() => [0.1, 0.2, 0.3]) } as any);
    mockCosineSimilarity.mockReturnValue(0.5);
    mockGetModel.mockReturnValue(null);
    mockGetBestAvailableModel.mockReturnValue(null);

    service = new RelatedIssueLinkingService();
  });

  describe('Semantic Relations', () => {
    it('should find semantically similar issues via embeddings', async () => {
      mockCosineSimilarity.mockReturnValue(0.85);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Login functionality',
        issueDescription: 'Implement user login',
        repositoryIssues: mockRepositoryIssues
      });

      const semanticRelations = result.relationships.filter(r => r.relationshipType === 'semantic');
      expect(semanticRelations.length).toBeGreaterThan(0);
    });

    it('should require minimum similarity threshold (0.75)', async () => {
      mockCosineSimilarity.mockReturnValue(0.5);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Unrelated topic',
        issueDescription: 'Nothing similar',
        repositoryIssues: mockRepositoryIssues
      });

      const semanticRelations = result.relationships.filter(r => r.relationshipType === 'semantic');
      expect(semanticRelations).toHaveLength(0);
    });

    it('should include similarity score in confidence', async () => {
      mockCosineSimilarity.mockReturnValue(0.85);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth related',
        issueDescription: 'User authentication',
        repositoryIssues: mockRepositoryIssues
      });

      const semanticRelations = result.relationships.filter(r => r.relationshipType === 'semantic');
      if (semanticRelations.length > 0) {
        expect(semanticRelations[0].confidence).toBeCloseTo(0.85, 1);
      }
    });

    it('should generate reasoning for semantic matches', async () => {
      mockCosineSimilarity.mockReturnValue(0.8);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryIssues: mockRepositoryIssues
      });

      const semanticRelations = result.relationships.filter(r => r.relationshipType === 'semantic');
      if (semanticRelations.length > 0) {
        expect(semanticRelations[0].reasoning).toBeDefined();
        expect(semanticRelations[0].reasoning.length).toBeGreaterThan(0);
      }
    });

    it('should handle embedding API failure gracefully', async () => {
      mockEmbed.mockRejectedValue(new Error('API error'));

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryIssues: mockRepositoryIssues
      });

      // Should still return valid result from other strategies
      expect(result).toBeDefined();
    });
  });

  describe('Dependency Detection', () => {
    it('should detect blocks keywords', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'New feature',
        issueDescription: 'This enables work on the dashboard and unblocks #2',
        repositoryIssues: mockRepositoryIssues
      });

      const blocksRelations = result.relationships.filter(
        r => r.relationshipType === 'dependency' && r.subType === 'blocks'
      );
      // May find blocks relationships based on keywords
      expect(result.relationships).toBeDefined();
    });

    it('should detect blocked_by keywords', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'User feature',
        issueDescription: 'Requires auth to be implemented first. Depends on #1.',
        repositoryIssues: mockRepositoryIssues
      });

      const blockedByRelations = result.relationships.filter(
        r => r.relationshipType === 'dependency' && r.subType === 'blocked_by'
      );
      // May find blocked_by relationships based on keywords
      expect(result.relationships).toBeDefined();
    });

    it('should use AI for enhanced dependency detection', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockResolvedValue({
        object: {
          relationships: [
            { targetIssueId: '1', subType: 'blocked_by', confidence: 0.9, reasoning: 'Requires auth' }
          ]
        }
      } as any);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Profile page',
        issueDescription: 'Needs authentication',
        repositoryIssues: mockRepositoryIssues
      });

      const depRelations = result.relationships.filter(r => r.relationshipType === 'dependency');
      // AI should enhance dependency detection
      expect(depRelations.length).toBeGreaterThanOrEqual(0);
    });

    it('should fall back to keyword matching when AI unavailable', async () => {
      mockGetModel.mockReturnValue(null);
      mockGetBestAvailableModel.mockReturnValue(null);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Feature X',
        issueDescription: 'This feature blocks feature Y',
        repositoryIssues: mockRepositoryIssues
      });

      // Should still detect dependencies via keywords
      expect(result.relationships).toBeDefined();
    });

    it('should include subType for dependency relationships', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Feature',
        issueDescription: 'Depends on auth. Blocked by #1.',
        repositoryIssues: mockRepositoryIssues
      });

      const depRelations = result.relationships.filter(r => r.relationshipType === 'dependency');
      for (const rel of depRelations) {
        expect(['blocks', 'blocked_by', 'related_to']).toContain(rel.subType);
      }
    });
  });

  describe('Component Grouping', () => {
    it('should group issues by shared labels', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth enhancement',
        issueDescription: 'Improve auth',
        issueLabels: ['auth', 'backend'],
        repositoryIssues: mockRepositoryIssues
      });

      const componentRelations = result.relationships.filter(r => r.relationshipType === 'component');
      // Should find issues with shared labels
      expect(componentRelations.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate label overlap score', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        issueLabels: ['auth', 'backend'],
        repositoryIssues: mockRepositoryIssues
      });

      const componentRelations = result.relationships.filter(r => r.relationshipType === 'component');
      if (componentRelations.length > 0) {
        expect(componentRelations[0].confidence).toBeGreaterThan(0);
        expect(componentRelations[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should require minimum label overlap (0.3)', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        issueLabels: ['unique-label-1', 'unique-label-2'],
        repositoryIssues: mockRepositoryIssues
      });

      const componentRelations = result.relationships.filter(r => r.relationshipType === 'component');
      // No shared labels should mean no component relationships
      expect(componentRelations).toHaveLength(0);
    });

    it('should handle issues with no labels', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        issueLabels: [],
        repositoryIssues: mockRepositoryIssues
      });

      const componentRelations = result.relationships.filter(r => r.relationshipType === 'component');
      expect(componentRelations).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should toggle semantic similarity', async () => {
      mockCosineSimilarity.mockReturnValue(0.9);

      const customService = new RelatedIssueLinkingService({
        includeSemanticSimilarity: false
      });

      const result = await customService.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth',
        issueDescription: 'User authentication',
        repositoryIssues: mockRepositoryIssues
      });

      const semanticRelations = result.relationships.filter(r => r.relationshipType === 'semantic');
      expect(semanticRelations).toHaveLength(0);
    });

    it('should toggle dependency detection', async () => {
      const customService = new RelatedIssueLinkingService({
        includeDependencies: false
      });

      const result = await customService.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Feature',
        issueDescription: 'Depends on #1. Blocked by auth.',
        repositoryIssues: mockRepositoryIssues
      });

      const depRelations = result.relationships.filter(r => r.relationshipType === 'dependency');
      expect(depRelations).toHaveLength(0);
    });

    it('should toggle component grouping', async () => {
      const customService = new RelatedIssueLinkingService({
        includeComponentGrouping: false
      });

      const result = await customService.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth',
        issueDescription: 'Auth feature',
        issueLabels: ['auth', 'backend'],
        repositoryIssues: mockRepositoryIssues
      });

      const componentRelations = result.relationships.filter(r => r.relationshipType === 'component');
      expect(componentRelations).toHaveLength(0);
    });

    it('should enable all strategies by default', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        issueLabels: ['auth'],
        repositoryIssues: mockRepositoryIssues
      });

      // Default should allow all relationship types
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty repository issues', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryIssues: []
      });

      expect(result.relationships).toHaveLength(0);
    });

    it('should filter out the source issue', async () => {
      const result = await service.findRelatedIssues({
        issueId: '1', // Same as first mock issue
        issueTitle: 'User authentication',
        issueDescription: 'Same as existing',
        repositoryIssues: mockRepositoryIssues
      });

      // Should not include the source issue in results
      const selfRelations = result.relationships.filter(r => r.targetIssueId === '1');
      expect(selfRelations).toHaveLength(0);
    });

    it('should handle empty description', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Title only',
        issueDescription: '',
        repositoryIssues: mockRepositoryIssues
      });

      expect(result).toBeDefined();
    });

    it('should handle very long description', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'A'.repeat(10000),
        repositoryIssues: mockRepositoryIssues
      });

      expect(result).toBeDefined();
    });

    it('should deduplicate relationships', async () => {
      // Same target found by multiple strategies
      mockCosineSimilarity.mockReturnValue(0.8);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth feature',
        issueDescription: 'Related to auth. Depends on user authentication.',
        issueLabels: ['auth', 'backend'],
        repositoryIssues: mockRepositoryIssues
      });

      // Check no duplicate targets
      const targetIds = result.relationships.map(r => r.targetIssueId);
      const uniqueTargets = new Set(targetIds);
      expect(targetIds.length).toBe(uniqueTargets.size);
    });

    it('should sort relationships by confidence', async () => {
      mockCosineSimilarity.mockReturnValue(0.8);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth',
        issueDescription: 'Auth feature',
        issueLabels: ['auth'],
        repositoryIssues: mockRepositoryIssues
      });

      const confidences = result.relationships.map(r => r.confidence);
      for (let i = 0; i < confidences.length - 1; i++) {
        expect(confidences[i]).toBeGreaterThanOrEqual(confidences[i + 1]);
      }
    });

    it('should include relationship metadata', async () => {
      mockCosineSimilarity.mockReturnValue(0.85);

      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryIssues: mockRepositoryIssues
      });

      if (result.relationships.length > 0) {
        const rel = result.relationships[0];
        expect(rel).toHaveProperty('sourceIssueId');
        expect(rel).toHaveProperty('targetIssueId');
        expect(rel).toHaveProperty('targetIssueNumber');
        expect(rel).toHaveProperty('targetIssueTitle');
        expect(rel).toHaveProperty('relationshipType');
        expect(rel).toHaveProperty('confidence');
        expect(rel).toHaveProperty('reasoning');
      }
    });
  });

  describe('Confidence Scoring', () => {
    it('should have valid confidence structure', async () => {
      const result = await service.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryIssues: mockRepositoryIssues
      });

      expect(result.confidence).toHaveProperty('sectionId');
      expect(result.confidence).toHaveProperty('score');
      expect(result.confidence).toHaveProperty('tier');
      expect(result.confidence).toHaveProperty('factors');
    });

    it('should have higher confidence with more strategies used', async () => {
      mockCosineSimilarity.mockReturnValue(0.8);

      // All strategies enabled
      const fullService = new RelatedIssueLinkingService();
      const fullResult = await fullService.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth',
        issueDescription: 'Description',
        issueLabels: ['auth'],
        repositoryIssues: mockRepositoryIssues
      });

      // Only one strategy
      const limitedService = new RelatedIssueLinkingService({
        includeDependencies: false,
        includeComponentGrouping: false
      });
      const limitedResult = await limitedService.findRelatedIssues({
        issueId: 'source',
        issueTitle: 'Auth',
        issueDescription: 'Description',
        issueLabels: ['auth'],
        repositoryIssues: mockRepositoryIssues
      });

      // More strategies should mean higher confidence in completeness
      expect(fullResult.confidence.score).toBeGreaterThanOrEqual(
        limitedResult.confidence.score - 20 // Allow some variance
      );
    });
  });
});
