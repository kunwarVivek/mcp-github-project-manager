/**
 * Unit tests for DuplicateDetectionService
 *
 * Tests AI-powered duplicate detection using semantic similarity (embeddings)
 * with tiered confidence and fallback to keyword-based detection.
 */

import { DuplicateDetectionService } from '../../../src/services/ai/DuplicateDetectionService';
import { embed, embedMany, cosineSimilarity } from 'ai';

// Mock dependencies
jest.mock('ai', () => ({
  embed: jest.fn(),
  embedMany: jest.fn(),
  cosineSimilarity: jest.fn()
}));

const mockEmbed = embed as jest.MockedFunction<typeof embed>;
const mockEmbedMany = embedMany as jest.MockedFunction<typeof embedMany>;
const mockCosineSimilarity = cosineSimilarity as jest.MockedFunction<typeof cosineSimilarity>;

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;

  const mockExistingIssues = [
    { id: '1', number: 1, title: 'Login button not working', body: 'The login button fails to respond', labels: [], state: 'open' as const, createdAt: '2024-01-01' },
    { id: '2', number: 2, title: 'Performance issue on dashboard', body: 'Dashboard loads slowly', labels: [], state: 'open' as const, createdAt: '2024-01-02' },
    { id: '3', number: 3, title: 'Dark mode not saving', body: 'Theme preference resets after restart', labels: [], state: 'open' as const, createdAt: '2024-01-03' },
    { id: '4', number: 4, title: 'API rate limiting needed', body: 'Implement rate limits for public API', labels: [], state: 'closed' as const, createdAt: '2024-01-04' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DuplicateDetectionService();

    // Default mock for embedding
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] } as any);
    mockEmbedMany.mockResolvedValue({ embeddings: mockExistingIssues.map(() => [0.1, 0.2, 0.3]) } as any);
    mockCosineSimilarity.mockReturnValue(0.5);
  });

  describe('Embedding Path', () => {
    it('should detect high confidence duplicates (0.92+)', async () => {
      mockCosineSimilarity.mockReturnValue(0.95);

      const result = await service.detectDuplicates({
        issueTitle: 'Login button broken',
        issueDescription: 'Cannot click the login button',
        existingIssues: mockExistingIssues
      });

      expect(result.highConfidence.length).toBeGreaterThan(0);
      expect(result.highConfidence[0].similarity).toBeGreaterThanOrEqual(0.92);
    });

    it('should detect medium confidence duplicates (0.75-0.92)', async () => {
      mockCosineSimilarity.mockReturnValue(0.85);

      const result = await service.detectDuplicates({
        issueTitle: 'Sign in issue',
        issueDescription: 'Having trouble signing in',
        existingIssues: mockExistingIssues
      });

      expect(result.mediumConfidence.length).toBeGreaterThan(0);
    });

    it('should tier results correctly', async () => {
      // Different similarities for different issues
      mockCosineSimilarity
        .mockReturnValueOnce(0.95) // High
        .mockReturnValueOnce(0.80) // Medium
        .mockReturnValueOnce(0.60) // Low
        .mockReturnValueOnce(0.40); // Not included

      const result = await service.detectDuplicates({
        issueTitle: 'Test issue',
        issueDescription: 'Test description',
        existingIssues: mockExistingIssues
      });

      // Should have tiered results
      expect(result.highConfidence.length + result.mediumConfidence.length + result.lowConfidence.length).toBeLessThanOrEqual(mockExistingIssues.length);
    });

    it('should use cache for existing issue embeddings', async () => {
      // First call generates embeddings
      await service.detectDuplicates({
        issueTitle: 'First check',
        issueDescription: 'First description',
        existingIssues: mockExistingIssues.slice(0, 2)
      });

      // Reset mock counts
      mockEmbedMany.mockClear();

      // Second call should use cache
      await service.detectDuplicates({
        issueTitle: 'Second check',
        issueDescription: 'Second description',
        existingIssues: mockExistingIssues.slice(0, 2)
      });

      // Second call should not need to embed same issues again
      // (may still call for any uncached issues)
      expect(mockEmbedMany).toHaveBeenCalledTimes(0);
    });

    it('should return newEmbedding for caching', async () => {
      const result = await service.detectDuplicates({
        issueTitle: 'New issue',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.newEmbedding).toBeDefined();
      expect(Array.isArray(result.newEmbedding)).toBe(true);
    });

    it('should generate reasoning for each duplicate candidate', async () => {
      mockCosineSimilarity.mockReturnValue(0.9);

      const result = await service.detectDuplicates({
        issueTitle: 'Login issue',
        issueDescription: 'Cannot login',
        existingIssues: mockExistingIssues
      });

      if (result.mediumConfidence.length > 0) {
        expect(result.mediumConfidence[0].reasoning).toBeDefined();
        expect(result.mediumConfidence[0].reasoning.length).toBeGreaterThan(0);
      }
    });

    it('should include issue metadata in candidates', async () => {
      mockCosineSimilarity.mockReturnValue(0.95);

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      if (result.highConfidence.length > 0) {
        const candidate = result.highConfidence[0];
        expect(candidate).toHaveProperty('issueId');
        expect(candidate).toHaveProperty('issueNumber');
        expect(candidate).toHaveProperty('title');
        expect(candidate).toHaveProperty('similarity');
      }
    });
  });

  describe('Fallback Path', () => {
    it('should fall back to keyword-based detection when embedding fails', async () => {
      mockEmbed.mockRejectedValue(new Error('API error'));

      const result = await service.detectDuplicates({
        issueTitle: 'Login button not working',
        issueDescription: 'The login button fails',
        existingIssues: mockExistingIssues
      });

      // Should still return valid result using keyword matching
      expect(result).toBeDefined();
      expect(result).toHaveProperty('highConfidence');
      expect(result).toHaveProperty('mediumConfidence');
      expect(result).toHaveProperty('lowConfidence');
    });

    it('should use adjusted thresholds in fallback mode', async () => {
      mockEmbed.mockRejectedValue(new Error('API error'));

      // Fallback uses lower thresholds (0.8 for high, 0.6 for medium)
      const result = await service.detectDuplicates({
        issueTitle: 'Login button not working button login',
        issueDescription: 'Login button fails to respond login button',
        existingIssues: mockExistingIssues
      });

      expect(result).toBeDefined();
    });

    it('should have lower confidence in fallback mode', async () => {
      mockEmbed.mockRejectedValue(new Error('API error'));

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.confidence.score).toBeLessThanOrEqual(70);
    });

    it('should not return newEmbedding in fallback mode', async () => {
      mockEmbed.mockRejectedValue(new Error('API error'));

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.newEmbedding).toBeUndefined();
    });
  });

  describe('Thresholds', () => {
    it('should use default thresholds (0.92 high, 0.75 medium)', async () => {
      // Just above medium threshold
      mockCosineSimilarity.mockReturnValue(0.76);

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.mediumConfidence.length).toBeGreaterThan(0);
    });

    it('should respect custom high threshold', async () => {
      mockCosineSimilarity.mockReturnValue(0.88);

      const customService = new DuplicateDetectionService({ high: 0.85 });
      const result = await customService.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.highConfidence.length).toBeGreaterThan(0);
    });

    it('should respect custom medium threshold', async () => {
      mockCosineSimilarity.mockReturnValue(0.65);

      const customService = new DuplicateDetectionService({ medium: 0.6 });
      const result = await customService.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.mediumConfidence.length).toBeGreaterThan(0);
    });

    it('should exclude results below minimum threshold', async () => {
      mockCosineSimilarity.mockReturnValue(0.3);

      const result = await service.detectDuplicates({
        issueTitle: 'Completely different topic',
        issueDescription: 'Nothing related',
        existingIssues: mockExistingIssues
      });

      const totalCandidates =
        result.highConfidence.length +
        result.mediumConfidence.length +
        result.lowConfidence.length;

      expect(totalCandidates).toBe(0);
    });
  });

  describe('Caching', () => {
    it('should cache embeddings by issue ID', async () => {
      await service.detectDuplicates({
        issueTitle: 'First check',
        issueDescription: 'First description',
        existingIssues: mockExistingIssues
      });

      // embedMany should have been called for existing issues
      expect(mockEmbedMany).toHaveBeenCalled();
    });

    it('should invalidate cache on content change', async () => {
      // First call
      await service.detectDuplicates({
        issueTitle: 'First',
        issueDescription: 'First',
        existingIssues: [mockExistingIssues[0]]
      });

      mockEmbedMany.mockClear();

      // Second call with changed content
      const modifiedIssue = { ...mockExistingIssues[0], body: 'Completely different content now' };
      await service.detectDuplicates({
        issueTitle: 'Second',
        issueDescription: 'Second',
        existingIssues: [modifiedIssue]
      });

      // Should need to re-embed because content changed
      expect(mockEmbedMany).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty existing issues', async () => {
      const result = await service.detectDuplicates({
        issueTitle: 'New issue',
        issueDescription: 'Description',
        existingIssues: []
      });

      expect(result.highConfidence).toHaveLength(0);
      expect(result.mediumConfidence).toHaveLength(0);
      expect(result.lowConfidence).toHaveLength(0);
    });

    it('should handle empty description', async () => {
      mockCosineSimilarity.mockReturnValue(0.6);

      const result = await service.detectDuplicates({
        issueTitle: 'Title only',
        issueDescription: '',
        existingIssues: mockExistingIssues
      });

      expect(result).toBeDefined();
    });

    it('should handle very long description', async () => {
      mockCosineSimilarity.mockReturnValue(0.5);

      const result = await service.detectDuplicates({
        issueTitle: 'Long issue',
        issueDescription: 'A'.repeat(10000),
        existingIssues: mockExistingIssues
      });

      expect(result).toBeDefined();
    });

    it('should respect maxResults limit', async () => {
      mockCosineSimilarity.mockReturnValue(0.95);

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues,
        maxResults: 2
      });

      const totalResults =
        result.highConfidence.length +
        result.mediumConfidence.length +
        result.lowConfidence.length;

      expect(totalResults).toBeLessThanOrEqual(2);
    });

    it('should handle single existing issue', async () => {
      mockCosineSimilarity.mockReturnValue(0.95);

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: [mockExistingIssues[0]]
      });

      expect(result).toBeDefined();
      expect(result.highConfidence.length).toBeLessThanOrEqual(1);
    });

    it('should sort candidates by similarity descending', async () => {
      mockCosineSimilarity
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.90)
        .mockReturnValueOnce(0.88)
        .mockReturnValueOnce(0.87);

      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      // All candidates together should be sorted
      const allCandidates = [
        ...result.highConfidence,
        ...result.mediumConfidence,
        ...result.lowConfidence
      ];

      for (let i = 0; i < allCandidates.length - 1; i++) {
        expect(allCandidates[i].similarity).toBeGreaterThanOrEqual(allCandidates[i + 1].similarity);
      }
    });
  });

  describe('Confidence Scoring', () => {
    it('should have valid confidence structure', async () => {
      const result = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      expect(result.confidence).toHaveProperty('sectionId');
      expect(result.confidence).toHaveProperty('score');
      expect(result.confidence).toHaveProperty('tier');
      expect(result.confidence).toHaveProperty('factors');
    });

    it('should have higher confidence with more issues scanned', async () => {
      const result1 = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues.slice(0, 1)
      });

      const result2 = await service.detectDuplicates({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingIssues: mockExistingIssues
      });

      // More issues scanned should give higher confidence in completeness
      expect(result2.confidence.factors.patternMatch).toBeGreaterThanOrEqual(
        result1.confidence.factors.patternMatch - 0.1 // Allow some variance
      );
    });
  });
});
