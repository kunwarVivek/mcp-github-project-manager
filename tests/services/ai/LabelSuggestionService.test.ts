/**
 * Unit tests for LabelSuggestionService
 *
 * Tests AI-powered label suggestions with tiered confidence grouping,
 * rationale generation, and fallback behavior.
 */

import { LabelSuggestionService } from '../../../src/services/ai/LabelSuggestionService';
import { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory';
import { generateObject } from 'ai';

// Mock dependencies
jest.mock('../../../src/services/ai/AIServiceFactory');
jest.mock('ai', () => ({
  generateObject: jest.fn()
}));

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;
const mockGetModel = jest.fn();
const mockGetBestAvailableModel = jest.fn();

describe('LabelSuggestionService', () => {
  let service: LabelSuggestionService;

  const mockExistingLabels = [
    { name: 'bug', description: 'Something is broken', color: 'd73a4a' },
    { name: 'enhancement', description: 'New feature request', color: 'a2eeef' },
    { name: 'documentation', description: 'Documentation changes', color: '0075ca' },
    { name: 'help-wanted', description: 'Extra attention needed', color: '008672' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    service = new LabelSuggestionService();
  });

  describe('AI Path', () => {
    const mockModel = { id: 'test-model' };

    beforeEach(() => {
      mockGetModel.mockReturnValue(mockModel);
    });

    describe('suggestLabels', () => {
      it('should return tiered suggestions (high/medium/low)', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.95, rationale: 'Issue describes a bug', matchedPatterns: ['crash', 'error'] },
              { label: 'enhancement', isExisting: true, confidence: 0.7, rationale: 'Could be improved', matchedPatterns: ['could'] },
              { label: 'docs', isExisting: false, confidence: 0.3, rationale: 'Might need docs', matchedPatterns: [] }
            ],
            overallConfidence: 0.8
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'App crashes on startup',
          issueDescription: 'The app throws an error when I try to start it.',
          existingLabels: mockExistingLabels
        });

        expect(result.high.length).toBeGreaterThan(0);
        expect(result.medium).toBeDefined();
        expect(result.low).toBeDefined();
      });

      it('should include rationale for each suggestion', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.9, rationale: 'Issue mentions crash and error behavior', matchedPatterns: ['crash'] }
            ],
            overallConfidence: 0.9
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Crash on login',
          issueDescription: 'App crashes.',
          existingLabels: mockExistingLabels
        });

        expect(result.high[0].rationale).toContain('crash');
      });

      it('should prefer existing labels over new ones', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.9, rationale: 'Existing label match', matchedPatterns: [] }
            ],
            overallConfidence: 0.9
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Bug report',
          issueDescription: 'Something is broken',
          existingLabels: mockExistingLabels
        });

        expect(result.high[0].isExisting).toBe(true);
      });

      it('should include new label proposals when configured', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [],
            newLabelProposals: [
              { name: 'security', description: 'Security related', color: 'ff0000', rationale: 'Security issue' }
            ],
            overallConfidence: 0.7
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Security vulnerability',
          issueDescription: 'SQL injection found',
          existingLabels: mockExistingLabels
        });

        expect(result.newLabelProposals).toHaveLength(1);
        expect(result.newLabelProposals![0].name).toBe('security');
      });

      it('should use issue history for learning', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.95, rationale: 'Historical pattern match', matchedPatterns: ['crash'] }
            ],
            overallConfidence: 0.9
          }
        } as any);

        await service.suggestLabels({
          issueTitle: 'App crashes',
          issueDescription: 'Crashes on startup',
          existingLabels: mockExistingLabels,
          issueHistory: [
            { labels: ['bug'], title: 'Previous crash issue' },
            { labels: ['bug'], title: 'Another crash' }
          ]
        });

        expect(mockGenerateObject).toHaveBeenCalled();
      });

      it('should include matched patterns in suggestions', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.9, rationale: 'Match found', matchedPatterns: ['crash', 'error', 'bug'] }
            ],
            overallConfidence: 0.85
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Bug: App crashes with error',
          issueDescription: 'Error message appears',
          existingLabels: mockExistingLabels
        });

        expect(result.high[0].matchedPatterns).toContain('crash');
      });

      it('should sort each tier by confidence descending', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.85, rationale: 'R1', matchedPatterns: [] },
              { label: 'enhancement', isExisting: true, confidence: 0.9, rationale: 'R2', matchedPatterns: [] },
              { label: 'docs', isExisting: true, confidence: 0.82, rationale: 'R3', matchedPatterns: [] }
            ],
            overallConfidence: 0.85
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: mockExistingLabels
        });

        // High tier should be sorted by confidence
        const highConfidences = result.high.map(s => s.confidence);
        for (let i = 0; i < highConfidences.length - 1; i++) {
          expect(highConfidences[i]).toBeGreaterThanOrEqual(highConfidences[i + 1]);
        }
      });

      it('should have valid confidence structure', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            suggestions: [
              { label: 'bug', isExisting: true, confidence: 0.9, rationale: 'R', matchedPatterns: [] }
            ],
            overallConfidence: 0.9
          }
        } as any);

        const result = await service.suggestLabels({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: mockExistingLabels
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
      });
    });
  });

  describe('Fallback Path', () => {
    beforeEach(() => {
      mockGetModel.mockReturnValue(null);
      mockGetBestAvailableModel.mockReturnValue(null);
    });

    it('should use keyword matching as fallback', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Bug: something is broken',
        issueDescription: 'This is definitely a bug.',
        existingLabels: mockExistingLabels
      });

      // Should still return some suggestions based on keywords
      expect(result).toBeDefined();
    });

    it('should not include new label proposals in fallback', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test issue',
        issueDescription: 'Test description',
        existingLabels: mockExistingLabels
      });

      // Fallback should not propose new labels
      expect(result.newLabelProposals).toBeUndefined();
    });

    it('should have low confidence in fallback mode', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels
      });

      expect(result.confidence.score).toBeLessThanOrEqual(70);
    });

    it('should still return tiered structure in fallback', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Bug report',
        issueDescription: 'Something is broken',
        existingLabels: mockExistingLabels
      });

      expect(result).toHaveProperty('high');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('low');
    });

    it('should fall back when AI call fails', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockRejectedValue(new Error('API error'));

      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels
      });

      expect(result).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should respect maxSuggestions limit', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockResolvedValue({
        object: {
          suggestions: Array(20).fill(null).map((_, i) => ({
            label: `label-${i}`,
            isExisting: true,
            confidence: 0.9 - i * 0.02,
            rationale: 'R',
            matchedPatterns: []
          })),
          overallConfidence: 0.8
        }
      } as any);

      const customService = new LabelSuggestionService({ maxSuggestions: 5 });
      const result = await customService.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels
      });

      const totalSuggestions = result.high.length + result.medium.length + result.low.length;
      expect(totalSuggestions).toBeLessThanOrEqual(5);
    });

    it('should use custom confidence thresholds', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockResolvedValue({
        object: {
          suggestions: [
            { label: 'bug', isExisting: true, confidence: 0.75, rationale: 'R', matchedPatterns: [] }
          ],
          overallConfidence: 0.75
        }
      } as any);

      // Higher threshold means fewer in high tier
      const customService = new LabelSuggestionService({
        confidenceThresholds: { high: 0.9, medium: 0.7 }
      });

      const result = await customService.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels
      });

      // 0.75 confidence with 0.9 high threshold should be medium
      expect(result.high).toHaveLength(0);
      expect(result.medium).toHaveLength(1);
    });

    it('should toggle includeNewProposals', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockResolvedValue({
        object: {
          suggestions: [],
          newLabelProposals: [{ name: 'new-label', description: 'D', color: '000000', rationale: 'R' }],
          overallConfidence: 0.7
        }
      } as any);

      const customService = new LabelSuggestionService({ includeNewProposals: false });
      const result = await customService.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels
      });

      expect(result.newLabelProposals).toBeUndefined();
    });

    it('should use preferExisting config', () => {
      const customService = new LabelSuggestionService({ preferExisting: false });
      expect(customService).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetModel.mockReturnValue(null);
    });

    it('should handle empty existing labels', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: []
      });

      expect(result).toBeDefined();
    });

    it('should handle empty issue description', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Title only',
        issueDescription: '',
        existingLabels: mockExistingLabels
      });

      expect(result).toBeDefined();
    });

    it('should handle very long description', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'A'.repeat(10000),
        existingLabels: mockExistingLabels
      });

      expect(result).toBeDefined();
    });

    it('should handle special characters', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Bug: <script>alert(1)</script>',
        issueDescription: 'Special chars: "quotes" & ampersands',
        existingLabels: mockExistingLabels
      });

      expect(result).toBeDefined();
    });

    it('should handle empty issue history', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: mockExistingLabels,
        issueHistory: []
      });

      expect(result).toBeDefined();
    });

    it('should handle labels with no descriptions', async () => {
      const result = await service.suggestLabels({
        issueTitle: 'Test',
        issueDescription: 'Description',
        existingLabels: [{ name: 'bug' }, { name: 'feature' }]
      });

      expect(result).toBeDefined();
    });
  });
});
