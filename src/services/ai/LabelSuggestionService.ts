/**
 * Label Suggestion AI Service
 *
 * AI service for suggesting issue labels with tiered confidence grouping.
 * Implements requirement AI-18: Multi-tier label suggestions with rationale.
 *
 * Features:
 * - Suggests labels grouped by confidence tier (high/medium/low)
 * - Provides rationale for each label suggestion
 * - Learns from issue history patterns
 * - Falls back to keyword matching when AI unavailable
 * - Supports new label proposals when existing labels don't fit
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  LabelSuggestion,
  LabelSuggestionResult,
  LabelSuggestionConfig,
  NewLabelProposal,
  RepositoryLabel
} from '../../domain/issue-intelligence-types';
import { SectionConfidence, ConfidenceFactors, ConfidenceTier } from '../../domain/ai-types';
import {
  LABEL_SUGGESTION_SYSTEM_PROMPT,
  formatLabelPrompt
} from './prompts/IssueIntelligencePrompts';

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for a single label suggestion from AI.
 */
const AILabelSuggestionSchema = z.object({
  label: z.string(),
  isExisting: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  matchedPatterns: z.array(z.string())
});

/**
 * Schema for a new label proposal from AI.
 */
const AINewLabelProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  color: z.string(),
  rationale: z.string()
});

/**
 * Schema for AI label suggestion response.
 */
const AILabelResponseSchema = z.object({
  suggestions: z.array(AILabelSuggestionSchema),
  newLabelProposals: z.array(AINewLabelProposalSchema).optional(),
  overallConfidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

/**
 * Type for AI label response.
 */
type AILabelResponse = z.infer<typeof AILabelResponseSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for label suggestions.
 */
const DEFAULT_CONFIG: LabelSuggestionConfig = {
  preferExisting: true,
  maxSuggestions: 10,
  includeNewProposals: true,
  confidenceThresholds: {
    high: 0.8,
    medium: 0.5
  }
};

// ============================================================================
// LabelSuggestionService Implementation
// ============================================================================

/**
 * AI service for label suggestions with tiered confidence grouping.
 */
export class LabelSuggestionService {
  private aiFactory: AIServiceFactory;
  private config: LabelSuggestionConfig;

  constructor(config?: Partial<LabelSuggestionConfig>) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      confidenceThresholds: {
        ...DEFAULT_CONFIG.confidenceThresholds,
        ...config?.confidenceThresholds
      }
    };
  }

  /**
   * Suggest labels for an issue with tiered confidence grouping.
   *
   * @param params - Label suggestion parameters
   * @returns Label suggestions grouped by confidence tier
   */
  async suggestLabels(params: {
    issueTitle: string;
    issueDescription: string;
    existingLabels: Array<{ name: string; description?: string; color?: string }>;
    issueHistory?: Array<{ labels: string[]; title: string }>;
  }): Promise<LabelSuggestionResult> {
    // Get AI model
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      // Fallback when AI unavailable
      return this.getFallbackSuggestions(params);
    }

    try {
      const result = await generateObject({
        model,
        system: LABEL_SUGGESTION_SYSTEM_PROMPT,
        prompt: formatLabelPrompt({
          issueTitle: params.issueTitle,
          issueDescription: params.issueDescription,
          existingLabels: params.existingLabels,
          issueHistory: params.issueHistory
        }),
        schema: AILabelResponseSchema,
        temperature: 0.3 // Low temperature for consistent labeling
      });

      return this.formatLabelResult(result.object, params);
    } catch (error) {
      // Fallback on AI error
      console.error('Label suggestion AI call failed:', error);
      return this.getFallbackSuggestions(params);
    }
  }

  /**
   * Format AI result into tiered LabelSuggestionResult structure.
   */
  private formatLabelResult(
    aiResult: AILabelResponse,
    params: { issueTitle: string; issueDescription: string; existingLabels: Array<{ name: string }> }
  ): LabelSuggestionResult {
    const { high, medium } = this.config.confidenceThresholds;

    // Sort suggestions into tiers
    const highTier: LabelSuggestion[] = [];
    const mediumTier: LabelSuggestion[] = [];
    const lowTier: LabelSuggestion[] = [];

    for (const suggestion of aiResult.suggestions) {
      const labelSuggestion: LabelSuggestion = {
        label: suggestion.label,
        isExisting: suggestion.isExisting,
        confidence: suggestion.confidence,
        rationale: suggestion.rationale,
        matchedPatterns: suggestion.matchedPatterns
      };

      if (suggestion.confidence >= high) {
        highTier.push(labelSuggestion);
      } else if (suggestion.confidence >= medium) {
        mediumTier.push(labelSuggestion);
      } else {
        lowTier.push(labelSuggestion);
      }
    }

    // Sort each tier by confidence (descending)
    highTier.sort((a, b) => b.confidence - a.confidence);
    mediumTier.sort((a, b) => b.confidence - a.confidence);
    lowTier.sort((a, b) => b.confidence - a.confidence);

    // Apply max suggestions limit across all tiers
    const allSuggestions = [...highTier, ...mediumTier, ...lowTier];
    const totalCount = Math.min(allSuggestions.length, this.config.maxSuggestions);

    // Rebuild tiers with limit
    let remaining = totalCount;
    const limitedHigh = highTier.slice(0, remaining);
    remaining -= limitedHigh.length;
    const limitedMedium = mediumTier.slice(0, remaining);
    remaining -= limitedMedium.length;
    const limitedLow = lowTier.slice(0, remaining);

    // Filter new label proposals if not included
    let newLabelProposals: NewLabelProposal[] | undefined;
    if (this.config.includeNewProposals && aiResult.newLabelProposals?.length) {
      newLabelProposals = aiResult.newLabelProposals;
    }

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(
      aiResult.overallConfidence,
      allSuggestions,
      params
    );

    return {
      high: limitedHigh,
      medium: limitedMedium,
      low: limitedLow,
      newLabelProposals,
      confidence
    };
  }

  /**
   * Calculate overall confidence for label suggestions.
   */
  private calculateOverallConfidence(
    aiConfidence: number,
    suggestions: LabelSuggestion[],
    params: { issueTitle: string; issueDescription: string; existingLabels: Array<{ name: string }> }
  ): SectionConfidence {
    // Calculate input completeness
    const descriptionLength = (params.issueDescription || '').length;
    const inputCompleteness = Math.min(1, descriptionLength / 300);

    // Calculate pattern match score based on suggestion quality
    const avgSuggestionConfidence = suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
      : 0.5;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment: aiConfidence,
      patternMatch: avgSuggestionConfidence
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);

    return {
      sectionId: 'label-suggestion',
      sectionName: 'Label Suggestions',
      score,
      tier,
      factors,
      reasoning: `Generated ${suggestions.length} label suggestions from ${params.existingLabels.length} available labels`,
      needsReview: score < 70
    };
  }

  /**
   * Generate fallback suggestions using keyword matching when AI is unavailable.
   */
  private getFallbackSuggestions(params: {
    issueTitle: string;
    issueDescription: string;
    existingLabels: Array<{ name: string; description?: string; color?: string }>;
  }): LabelSuggestionResult {
    // Use keyword matching for basic suggestions
    const suggestions = this.keywordMatchLabels(params, 0.3);

    // Sort into tiers (all will likely be low/medium for fallback)
    const { high, medium } = this.config.confidenceThresholds;
    const highTier = suggestions.filter(s => s.confidence >= high);
    const mediumTier = suggestions.filter(s => s.confidence >= medium && s.confidence < high);
    const lowTier = suggestions.filter(s => s.confidence < medium);

    // Low confidence factors for fallback
    const factors: ConfidenceFactors = {
      inputCompleteness: Math.min(1, (params.issueDescription?.length || 0) / 300),
      aiSelfAssessment: 0.4, // AI unavailable
      patternMatch: 0.3 // Basic keyword matching
    };

    const score = 40; // Fixed low score for fallback
    const tier: ConfidenceTier = 'low';

    return {
      high: highTier,
      medium: mediumTier,
      low: lowTier,
      // No new label proposals in fallback mode
      confidence: {
        sectionId: 'label-suggestion-fallback',
        sectionName: 'Label Suggestions (Fallback)',
        score,
        tier,
        factors,
        reasoning: 'AI unavailable, using keyword matching',
        needsReview: true
      }
    };
  }

  /**
   * Match labels using keyword overlap with issue content.
   *
   * @param params - Issue content and available labels
   * @param minScore - Minimum score threshold to include
   * @returns Array of label suggestions above threshold
   */
  private keywordMatchLabels(
    params: {
      issueTitle: string;
      issueDescription: string;
      existingLabels: Array<{ name: string; description?: string }>;
    },
    minScore: number
  ): LabelSuggestion[] {
    const suggestions: LabelSuggestion[] = [];

    // Extract keywords from issue content
    const issueText = `${params.issueTitle} ${params.issueDescription || ''}`.toLowerCase();
    const issueWords = this.extractKeywords(issueText);

    for (const label of params.existingLabels) {
      // Extract keywords from label name and description
      const labelText = `${label.name} ${label.description || ''}`.toLowerCase();
      const labelWords = this.extractKeywords(labelText);

      // Calculate overlap score
      const matchedPatterns: string[] = [];
      let matchCount = 0;

      for (const labelWord of labelWords) {
        if (issueWords.has(labelWord) || this.fuzzyMatch(labelWord, issueWords)) {
          matchCount++;
          matchedPatterns.push(labelWord);
        }
      }

      // Calculate confidence based on match ratio
      const confidence = labelWords.size > 0
        ? Math.min(0.8, matchCount / labelWords.size) // Cap at 0.8 for keyword matching
        : 0;

      if (confidence >= minScore && matchedPatterns.length > 0) {
        suggestions.push({
          label: label.name,
          isExisting: true,
          confidence,
          rationale: `Keyword match: ${matchedPatterns.slice(0, 3).join(', ')}`,
          matchedPatterns
        });
      }
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract meaningful keywords from text.
   */
  private extractKeywords(text: string): Set<string> {
    // Common stop words to filter out
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
      'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
      'that', 'these', 'those', 'it', 'its', 'we', 'you', 'they'
    ]);

    // Extract words, filter stop words, and require minimum length
    const words = text
      .replace(/[^a-z0-9-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !stopWords.has(word));

    return new Set(words);
  }

  /**
   * Check for fuzzy match (simple prefix/suffix matching).
   */
  private fuzzyMatch(labelWord: string, issueWords: Set<string>): boolean {
    // Check if any issue word starts with or ends with the label word
    for (const issueWord of issueWords) {
      if (issueWord.startsWith(labelWord) || labelWord.startsWith(issueWord)) {
        return true;
      }
      if (issueWord.length >= 4 && labelWord.length >= 4) {
        // Check if they share a significant prefix (4+ chars)
        const prefix = this.longestCommonPrefix(issueWord, labelWord);
        if (prefix.length >= 4) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find longest common prefix between two strings.
   */
  private longestCommonPrefix(a: string, b: string): string {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }
    return a.substring(0, i);
  }
}
