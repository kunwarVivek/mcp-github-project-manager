/**
 * Issue Enrichment AI Service
 *
 * AI service for enhancing issues with structured sections and quality improvements.
 * Implements requirement AI-17: Issue enrichment with structured sections.
 *
 * Features:
 * - Generates structured sections (Problem, Solution, Context, Impact, Acceptance Criteria)
 * - Provides per-section confidence scores
 * - Preserves original content when substantial (>200 chars)
 * - Falls back to basic structure when AI unavailable
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  EnrichedIssue,
  EnrichedIssueSections,
  EnrichedSection,
  IssueEnrichmentConfig
} from '../../domain/issue-intelligence-types';
import { SectionConfidence, ConfidenceFactors, ConfidenceTier } from '../../domain/ai-types';
import {
  ENRICHMENT_SYSTEM_PROMPT,
  formatEnrichmentPrompt
} from './prompts/IssueIntelligencePrompts';

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for a single enriched section from AI.
 */
const AIEnrichedSectionSchema = z.object({
  content: z.string(),
  confidence: z.number().min(0).max(1)
});

/**
 * Schema for AI enrichment response.
 */
const AIEnrichmentResponseSchema = z.object({
  enrichedBody: z.string(),
  sections: z.object({
    problem: AIEnrichedSectionSchema.optional(),
    solution: AIEnrichedSectionSchema.optional(),
    context: AIEnrichedSectionSchema.optional(),
    impact: AIEnrichedSectionSchema.optional(),
    acceptanceCriteria: AIEnrichedSectionSchema.optional()
  }),
  suggestedLabels: z.array(z.string()),
  suggestedAssignees: z.array(z.string()).optional(),
  overallConfidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

/**
 * Type for AI enrichment response.
 */
type AIEnrichmentResponse = z.infer<typeof AIEnrichmentResponseSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for issue enrichment.
 */
const DEFAULT_ENRICHMENT_CONFIG: IssueEnrichmentConfig = {
  preserveOriginal: true,
  includeSections: ['problem', 'solution', 'context', 'impact', 'acceptanceCriteria'],
  suggestLabels: true,
  suggestAssignees: false
};

/**
 * Threshold for considering original description substantial.
 */
const SUBSTANTIAL_DESCRIPTION_LENGTH = 200;

// ============================================================================
// IssueEnrichmentAIService Implementation
// ============================================================================

/**
 * AI service for issue enrichment with structured sections and confidence scoring.
 */
export class IssueEnrichmentAIService {
  private aiFactory: AIServiceFactory;
  private config: IssueEnrichmentConfig;

  constructor(config?: Partial<IssueEnrichmentConfig>) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.config = { ...DEFAULT_ENRICHMENT_CONFIG, ...config };
  }

  /**
   * Enrich an issue with structured sections and AI-generated content.
   *
   * @param params - Issue enrichment parameters
   * @returns Enriched issue with structured sections and confidence scores
   */
  async enrichIssue(params: {
    issueTitle: string;
    issueDescription: string;
    projectContext?: string;
    repositoryLabels?: string[];
  }): Promise<EnrichedIssue> {
    // Determine if original description is substantial
    const preserveOriginal = (params.issueDescription?.length || 0) > SUBSTANTIAL_DESCRIPTION_LENGTH;

    // Get AI model
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      // Fallback when AI unavailable
      return this.getFallbackEnrichment({
        ...params,
        preserveOriginal
      });
    }

    try {
      const result = await generateObject({
        model,
        system: ENRICHMENT_SYSTEM_PROMPT,
        prompt: formatEnrichmentPrompt({
          issueTitle: params.issueTitle,
          issueDescription: params.issueDescription,
          projectContext: params.projectContext,
          preserveOriginal,
          repositoryLabels: params.repositoryLabels
        }),
        schema: AIEnrichmentResponseSchema,
        temperature: 0.4 // Balanced for consistent enrichment with some creativity
      });

      return this.formatEnrichmentResult(result.object, params, preserveOriginal);
    } catch (error) {
      // Fallback on AI error
      console.error('Issue enrichment AI call failed:', error);
      return this.getFallbackEnrichment({
        ...params,
        preserveOriginal
      });
    }
  }

  /**
   * Format AI result into EnrichedIssue structure.
   */
  private formatEnrichmentResult(
    aiResult: AIEnrichmentResponse,
    params: { issueTitle: string; issueDescription: string },
    preserveOriginal: boolean
  ): EnrichedIssue {
    // Convert AI sections to typed sections with 0-100 confidence
    const sections: EnrichedIssueSections = {};

    const aiSections = aiResult.sections;
    if (aiSections.problem?.content) {
      sections.problem = this.convertSection(aiSections.problem as { content: string; confidence: number });
    }
    if (aiSections.solution?.content) {
      sections.solution = this.convertSection(aiSections.solution as { content: string; confidence: number });
    }
    if (aiSections.context?.content) {
      sections.context = this.convertSection(aiSections.context as { content: string; confidence: number });
    }
    if (aiSections.impact?.content) {
      sections.impact = this.convertSection(aiSections.impact as { content: string; confidence: number });
    }
    if (aiSections.acceptanceCriteria?.content) {
      sections.acceptanceCriteria = this.convertSection(aiSections.acceptanceCriteria as { content: string; confidence: number });
    }

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      aiResult.overallConfidence,
      sections,
      params.issueDescription
    );

    return {
      original: {
        title: params.issueTitle,
        body: params.issueDescription
      },
      preserveOriginal,
      enrichedBody: aiResult.enrichedBody,
      sections,
      suggestedLabels: aiResult.suggestedLabels,
      suggestedAssignees: aiResult.suggestedAssignees,
      overallConfidence
    };
  }

  /**
   * Convert AI section (0-1 confidence) to typed section (0-100 confidence).
   */
  private convertSection(aiSection: { content: string; confidence: number }): EnrichedSection {
    return {
      content: aiSection.content,
      confidence: Math.round(aiSection.confidence * 100)
    };
  }

  /**
   * Calculate overall confidence for enrichment.
   */
  private calculateOverallConfidence(
    aiConfidence: number,
    sections: EnrichedIssueSections,
    originalDescription: string
  ): SectionConfidence {
    // Calculate input completeness based on original description
    const inputCompleteness = this.calculateInputCompleteness(originalDescription);

    // Calculate section coverage (how many sections were generated)
    const sectionKeys = Object.keys(sections);
    const sectionCoverage = sectionKeys.length / 5; // 5 possible sections

    // Average section confidence
    const sectionConfidences = sectionKeys.map(key =>
      (sections[key as keyof EnrichedIssueSections]?.confidence || 0) / 100
    );
    const avgSectionConfidence = sectionConfidences.length > 0
      ? sectionConfidences.reduce((a, b) => a + b, 0) / sectionConfidences.length
      : 0.5;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment: aiConfidence,
      patternMatch: (sectionCoverage + avgSectionConfidence) / 2
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);

    return {
      sectionId: 'enrichment',
      sectionName: 'Issue Enrichment',
      score,
      tier,
      factors,
      reasoning: `Enrichment based on ${originalDescription.length} char description, generated ${sectionKeys.length}/5 sections`,
      needsReview: score < 70
    };
  }

  /**
   * Calculate input completeness from original description.
   */
  private calculateInputCompleteness(description: string): number {
    if (!description) return 0;

    const length = description.length;
    if (length >= 500) return 1.0;
    if (length >= 200) return 0.7;
    if (length >= 100) return 0.5;
    if (length >= 50) return 0.3;
    return 0.1;
  }

  /**
   * Generate fallback enrichment when AI is unavailable.
   */
  private getFallbackEnrichment(params: {
    issueTitle: string;
    issueDescription: string;
    projectContext?: string;
    preserveOriginal: boolean;
  }): EnrichedIssue {
    const description = params.issueDescription || '';

    // Create basic structure with original content
    const enrichedBody = params.preserveOriginal
      ? `${description}\n\n---\n\n**[Auto-structured - AI unavailable]**\n\n**Problem:** ${params.issueTitle}\n\n**Description:** ${description.substring(0, 500)}${description.length > 500 ? '...' : ''}`
      : `**Problem:** ${params.issueTitle}\n\n**Description:** ${description}`;

    // Basic section generation
    const sections: EnrichedIssueSections = {
      problem: {
        content: params.issueTitle,
        confidence: 40 // Low confidence for fallback
      }
    };

    if (description) {
      sections.context = {
        content: description.substring(0, 300),
        confidence: 40
      };
    }

    // Low confidence factors for fallback
    const factors: ConfidenceFactors = {
      inputCompleteness: this.calculateInputCompleteness(description),
      aiSelfAssessment: 0.4, // AI unavailable, low self-assessment
      patternMatch: 0.3 // Basic pattern matching only
    };

    const score = 40; // Fixed low score for fallback
    const tier: ConfidenceTier = 'low';

    return {
      original: {
        title: params.issueTitle,
        body: description
      },
      preserveOriginal: params.preserveOriginal,
      enrichedBody,
      sections,
      suggestedLabels: [], // No label suggestions in fallback
      overallConfidence: {
        sectionId: 'enrichment-fallback',
        sectionName: 'Issue Enrichment (Fallback)',
        score,
        tier,
        factors,
        reasoning: 'AI unavailable, using basic structure',
        needsReview: true
      }
    };
  }
}
