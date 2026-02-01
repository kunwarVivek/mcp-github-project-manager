/**
 * Unit tests for IssueEnrichmentAIService
 *
 * Tests AI-powered issue enrichment with structured sections,
 * confidence scoring, and fallback behavior.
 */

import { IssueEnrichmentAIService } from '../../../src/services/ai/IssueEnrichmentAIService';
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

describe('IssueEnrichmentAIService', () => {
  let service: IssueEnrichmentAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    service = new IssueEnrichmentAIService();
  });

  describe('AI Path', () => {
    const mockModel = { id: 'test-model' };

    beforeEach(() => {
      mockGetModel.mockReturnValue(mockModel);
    });

    describe('enrichIssue', () => {
      it('should return enriched issue with all sections', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: '## Problem\nThe app crashes on login.\n\n## Solution\nFix auth flow.',
            sections: {
              problem: { content: 'The app crashes on login.', confidence: 0.9 },
              solution: { content: 'Fix auth flow.', confidence: 0.85 },
              context: { content: 'Mobile app login screen.', confidence: 0.8 },
              impact: { content: 'Users cannot access the app.', confidence: 0.9 },
              acceptanceCriteria: { content: 'Login works without crash.', confidence: 0.95 }
            },
            suggestedLabels: ['bug', 'auth', 'high-priority'],
            overallConfidence: 0.88
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'App crashes on login',
          issueDescription: 'When I try to login, the app crashes.'
        });

        expect(result.sections.problem).toBeDefined();
        expect(result.sections.solution).toBeDefined();
        expect(result.sections.context).toBeDefined();
        expect(result.sections.impact).toBeDefined();
        expect(result.sections.acceptanceCriteria).toBeDefined();
      });

      it('should calculate per-section confidence scores', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Enriched content',
            sections: {
              problem: { content: 'Problem content', confidence: 0.9 },
              solution: { content: 'Solution content', confidence: 0.8 }
            },
            suggestedLabels: [],
            overallConfidence: 0.85
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Test issue',
          issueDescription: 'Test description'
        });

        // Confidence is converted from 0-1 to 0-100
        expect(result.sections.problem?.confidence).toBe(90);
        expect(result.sections.solution?.confidence).toBe(80);
      });

      it('should preserve original when description is substantial (>200 chars)', async () => {
        const longDescription = 'A'.repeat(250) + ' This is a very detailed issue description.';

        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Enriched version',
            sections: {},
            suggestedLabels: [],
            overallConfidence: 0.8
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Test issue',
          issueDescription: longDescription
        });

        expect(result.preserveOriginal).toBe(true);
        expect(result.original.body).toBe(longDescription);
      });

      it('should not preserve original when description is short', async () => {
        const shortDescription = 'Fix bug.';

        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Enriched version with more detail',
            sections: { problem: { content: 'The bug causes issues', confidence: 0.8 } },
            suggestedLabels: ['bug'],
            overallConfidence: 0.7
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Bug fix',
          issueDescription: shortDescription
        });

        expect(result.preserveOriginal).toBe(false);
      });

      it('should include suggested labels', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Content',
            sections: {},
            suggestedLabels: ['bug', 'enhancement', 'docs'],
            overallConfidence: 0.8
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description'
        });

        expect(result.suggestedLabels).toEqual(['bug', 'enhancement', 'docs']);
      });

      it('should include suggested assignees when available', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Content',
            sections: {},
            suggestedLabels: [],
            suggestedAssignees: ['alice', 'bob'],
            overallConfidence: 0.8
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description'
        });

        expect(result.suggestedAssignees).toEqual(['alice', 'bob']);
      });

      it('should pass project context to AI when provided', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Context-aware content',
            sections: {},
            suggestedLabels: [],
            overallConfidence: 0.9
          }
        } as any);

        await service.enrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description',
          projectContext: 'This is a React application for e-commerce'
        });

        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('React')
          })
        );
      });

      it('should pass repository labels to AI when provided', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Content',
            sections: {},
            suggestedLabels: ['bug'],
            overallConfidence: 0.8
          }
        } as any);

        await service.enrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryLabels: ['bug', 'enhancement', 'documentation']
        });

        expect(mockGenerateObject).toHaveBeenCalled();
      });

      it('should calculate overall confidence from multiple factors', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Content',
            sections: {
              problem: { content: 'Problem', confidence: 0.9 },
              solution: { content: 'Solution', confidence: 0.8 }
            },
            suggestedLabels: [],
            overallConfidence: 0.85
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Test',
          issueDescription: 'A moderately detailed description for testing purposes.'
        });

        expect(result.overallConfidence).toBeDefined();
        expect(result.overallConfidence.score).toBeGreaterThan(0);
        expect(result.overallConfidence.score).toBeLessThanOrEqual(100);
        expect(result.overallConfidence.tier).toBeDefined();
      });

      it('should set needsReview based on confidence tier', async () => {
        mockGenerateObject.mockResolvedValue({
          object: {
            enrichedBody: 'Content',
            sections: {},
            suggestedLabels: [],
            overallConfidence: 0.4 // Low confidence
          }
        } as any);

        const result = await service.enrichIssue({
          issueTitle: 'Vague title',
          issueDescription: ''
        });

        // Low confidence should need review
        expect(result.overallConfidence.needsReview).toBeDefined();
      });
    });
  });

  describe('Fallback Path', () => {
    beforeEach(() => {
      mockGetModel.mockReturnValue(null);
      mockGetBestAvailableModel.mockReturnValue(null);
    });

    it('should return basic structure when model unavailable', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test issue',
        issueDescription: 'Test description'
      });

      expect(result.enrichedBody).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    it('should set low confidence (around 40) in fallback', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test issue',
        issueDescription: 'Test description'
      });

      // Fallback confidence should be lower
      expect(result.overallConfidence.score).toBeLessThanOrEqual(60);
    });

    it('should set needsReview: true in fallback', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description'
      });

      expect(result.overallConfidence.needsReview).toBe(true);
    });

    it('should still preserve original when description is substantial', async () => {
      const longDescription = 'A'.repeat(250);

      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: longDescription
      });

      expect(result.preserveOriginal).toBe(true);
    });

    it('should return empty suggested labels in fallback', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description'
      });

      expect(result.suggestedLabels).toEqual([]);
    });

    it('should fall back when AI call throws error', async () => {
      mockGetModel.mockReturnValue({ id: 'test-model' });
      mockGenerateObject.mockRejectedValue(new Error('API error'));

      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description'
      });

      expect(result).toBeDefined();
      expect(result.overallConfidence.needsReview).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetModel.mockReturnValue(null);
    });

    it('should handle empty description', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Title only',
        issueDescription: ''
      });

      expect(result.original.body).toBe('');
      expect(result.preserveOriginal).toBe(false);
    });

    it('should handle very long description', async () => {
      const veryLongDescription = 'A'.repeat(10000);

      const result = await service.enrichIssue({
        issueTitle: 'Long description test',
        issueDescription: veryLongDescription
      });

      expect(result.preserveOriginal).toBe(true);
    });

    it('should handle missing project context', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description'
        // No projectContext
      });

      expect(result).toBeDefined();
    });

    it('should handle special characters in title', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Bug: <script>alert("XSS")</script> & special chars "quotes"',
        issueDescription: 'Description'
      });

      expect(result.original.title).toContain('XSS');
    });

    it('should handle unicode characters', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test unicode: \u00e9\u00e8\u00ea',
        issueDescription: 'Description with emojis: \ud83d\ude00\ud83d\ude01'
      });

      expect(result.original.title).toContain('\u00e9');
    });

    it('should handle null-ish repository labels', async () => {
      const result = await service.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description',
        repositoryLabels: undefined
      });

      expect(result).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customService = new IssueEnrichmentAIService({
        preserveOriginal: false,
        suggestLabels: false
      });

      expect(customService).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const customService = new IssueEnrichmentAIService({
        suggestLabels: false
      });

      expect(customService).toBeDefined();
    });

    it('should handle includeSections config', async () => {
      mockGetModel.mockReturnValue(null);

      const customService = new IssueEnrichmentAIService({
        includeSections: ['problem', 'solution']
      });

      const result = await customService.enrichIssue({
        issueTitle: 'Test',
        issueDescription: 'Description'
      });

      expect(result).toBeDefined();
    });
  });
});
