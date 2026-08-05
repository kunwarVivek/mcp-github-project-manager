import { z } from "zod";

// ============================================================================
// Confidence Scoring Types
// ============================================================================

/**
 * Confidence tier based on score
 */
export type ConfidenceTier = 'high' | 'medium' | 'low';

/**
 * Confidence factors that contribute to overall score
 */
export interface ConfidenceFactors {
  inputCompleteness: number;  // 0-1, based on input length, examples, constraints
  aiSelfAssessment: number;   // 0-1, from AI model's self-reported certainty
  patternMatch: number;       // 0-1, similarity to known successful patterns
}

/**
 * Per-section confidence scoring for AI-generated content
 */
export interface SectionConfidence {
  sectionId: string;
  sectionName: string;
  score: number;              // 0-100 overall confidence
  tier: ConfidenceTier;
  factors: ConfidenceFactors;
  reasoning?: string;         // AI's explanation for the score
  clarifyingQuestions?: string[];  // Generated when confidence is low
  needsReview: boolean;       // true if score < warning threshold
}

/**
 * Configuration for confidence thresholds
 */
export interface ConfidenceConfig {
  warningThreshold: number;   // Default 70 - below this shows warning
  errorThreshold: number;     // Default 50 - below this requires action
  enableIterativeRefinement: boolean;  // Auto-fetch more context when low
  maxRefinementAttempts: number;       // Default 3
}

/**
 * Default confidence configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  warningThreshold: 70,
  errorThreshold: 50,
  enableIterativeRefinement: true,
  maxRefinementAttempts: 3
};

// Confidence Scoring Zod Schemas
export const ConfidenceTierSchema = z.enum(['high', 'medium', 'low']);

export const ConfidenceFactorsSchema = z.object({
  inputCompleteness: z.number().min(0).max(1),
  aiSelfAssessment: z.number().min(0).max(1),
  patternMatch: z.number().min(0).max(1)
});

export const SectionConfidenceSchema = z.object({
  sectionId: z.string(),
  sectionName: z.string(),
  score: z.number().min(0).max(100),
  tier: ConfidenceTierSchema,
  factors: ConfidenceFactorsSchema,
  reasoning: z.string().optional(),
  clarifyingQuestions: z.array(z.string()).optional(),
  needsReview: z.boolean()
});

export const ConfidenceConfigSchema = z.object({
  warningThreshold: z.number().min(0).max(100).default(70),
  errorThreshold: z.number().min(0).max(100).default(50),
  enableIterativeRefinement: z.boolean().default(true),
  maxRefinementAttempts: z.number().min(1).max(10).default(3)
});
