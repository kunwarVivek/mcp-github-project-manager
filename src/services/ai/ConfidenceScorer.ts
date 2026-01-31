import {
  SectionConfidence,
  ConfidenceConfig,
  ConfidenceFactors,
  ConfidenceTier,
  DEFAULT_CONFIDENCE_CONFIG
} from '../../domain/ai-types';

/**
 * Calculate input completeness based on provided context
 *
 * @param input - The input data for AI generation
 * @returns Score from 0-1 representing input completeness
 */
export function calculateInputCompleteness(input: {
  description?: string;
  examples?: string[];
  constraints?: string[];
  context?: string;
  requirements?: string[];
}): number {
  let score = 0;
  let maxScore = 0;

  // Description length (up to 500 chars is optimal, max 0.3)
  maxScore += 0.3;
  if (input.description) {
    const descLen = input.description.length;
    if (descLen >= 500) {
      score += 0.3;
    } else if (descLen >= 100) {
      score += 0.2;
    } else if (descLen > 0) {
      score += 0.1;
    }
  }

  // Examples provided (max 0.2)
  maxScore += 0.2;
  if (input.examples && input.examples.length > 0) {
    score += Math.min(0.2, input.examples.length * 0.05);
  }

  // Constraints provided (max 0.2)
  maxScore += 0.2;
  if (input.constraints && input.constraints.length > 0) {
    score += Math.min(0.2, input.constraints.length * 0.04);
  }

  // Additional context (max 0.15)
  maxScore += 0.15;
  if (input.context && input.context.length > 50) {
    score += 0.15;
  } else if (input.context && input.context.length > 0) {
    score += 0.08;
  }

  // Requirements provided (max 0.15)
  maxScore += 0.15;
  if (input.requirements && input.requirements.length > 0) {
    score += Math.min(0.15, input.requirements.length * 0.03);
  }

  return Math.min(1, score / maxScore);
}

/**
 * Calculate confidence tier from score
 */
export function getConfidenceTier(score: number, config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG): ConfidenceTier {
  if (score >= config.warningThreshold) return 'high';
  if (score >= config.errorThreshold) return 'medium';
  return 'low';
}

/**
 * Calculate weighted confidence score from factors
 */
export function calculateWeightedScore(factors: ConfidenceFactors, weights?: {
  inputCompleteness?: number;
  aiSelfAssessment?: number;
  patternMatch?: number;
}): number {
  const w = {
    inputCompleteness: weights?.inputCompleteness ?? 0.3,
    aiSelfAssessment: weights?.aiSelfAssessment ?? 0.4,
    patternMatch: weights?.patternMatch ?? 0.3
  };

  const totalWeight = w.inputCompleteness + w.aiSelfAssessment + w.patternMatch;

  const weightedSum =
    (factors.inputCompleteness * w.inputCompleteness) +
    (factors.aiSelfAssessment * w.aiSelfAssessment) +
    (factors.patternMatch * w.patternMatch);

  return Math.round((weightedSum / totalWeight) * 100);
}

/**
 * Generate clarifying questions for low confidence areas
 */
export function generateClarifyingQuestions(
  sectionName: string,
  factors: ConfidenceFactors,
  uncertainAreas?: string[]
): string[] {
  const questions: string[] = [];

  // Questions based on low input completeness
  if (factors.inputCompleteness < 0.5) {
    questions.push(`Can you provide more details about the ${sectionName.toLowerCase()}?`);
    questions.push(`Are there specific examples or use cases for the ${sectionName.toLowerCase()} you can share?`);
  }

  // Questions based on low pattern match
  if (factors.patternMatch < 0.5) {
    questions.push(`Does the ${sectionName.toLowerCase()} follow any industry standards or existing patterns?`);
  }

  // Questions from AI's uncertain areas
  if (uncertainAreas && uncertainAreas.length > 0) {
    uncertainAreas.forEach(area => {
      questions.push(`Could you clarify: ${area}?`);
    });
  }

  return questions.slice(0, 5); // Max 5 questions
}

/**
 * Service for calculating and managing confidence scores
 */
export class ConfidenceScorer {
  private config: ConfidenceConfig;
  private patternCache: Map<string, number> = new Map();

  constructor(config: Partial<ConfidenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIDENCE_CONFIG, ...config };
  }

  /**
   * Calculate confidence for a single section
   */
  calculateSectionConfidence(params: {
    sectionId: string;
    sectionName: string;
    inputData: {
      description?: string;
      examples?: string[];
      constraints?: string[];
      context?: string;
      requirements?: string[];
    };
    aiSelfAssessment: number;  // 0-1 from AI model
    aiReasoning?: string;
    uncertainAreas?: string[];
    patternMatchScore?: number; // 0-1, optional override
  }): SectionConfidence {
    const inputCompleteness = calculateInputCompleteness(params.inputData);
    const patternMatch = params.patternMatchScore ?? this.calculatePatternMatch(params.sectionName, params.inputData);

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment: params.aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score, this.config);
    const needsReview = score < this.config.warningThreshold;

    const clarifyingQuestions = tier === 'low'
      ? generateClarifyingQuestions(params.sectionName, factors, params.uncertainAreas)
      : undefined;

    return {
      sectionId: params.sectionId,
      sectionName: params.sectionName,
      score,
      tier,
      factors,
      reasoning: params.aiReasoning,
      clarifyingQuestions,
      needsReview
    };
  }

  /**
   * Calculate pattern match score based on section type and content
   * Uses simple heuristics; could be enhanced with ML in future
   */
  private calculatePatternMatch(sectionName: string, inputData: {
    description?: string;
    examples?: string[];
    constraints?: string[];
  }): number {
    const cacheKey = `${sectionName}:${JSON.stringify(inputData).substring(0, 100)}`;

    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    let score = 0.5; // Base score

    // Check for common PRD section patterns
    const sectionLower = sectionName.toLowerCase();

    if (sectionLower.includes('overview') || sectionLower.includes('description')) {
      // Good overviews have problem statement, solution, and value prop
      if (inputData.description) {
        if (inputData.description.includes('problem') || inputData.description.includes('challenge')) score += 0.1;
        if (inputData.description.includes('solution') || inputData.description.includes('will')) score += 0.1;
        if (inputData.description.includes('value') || inputData.description.includes('benefit')) score += 0.1;
      }
    }

    if (sectionLower.includes('feature') || sectionLower.includes('requirement')) {
      // Good features have clear actions and acceptance criteria
      if (inputData.examples && inputData.examples.length > 0) score += 0.15;
      if (inputData.constraints && inputData.constraints.length > 0) score += 0.1;
    }

    if (sectionLower.includes('user') || sectionLower.includes('persona')) {
      // Good personas have goals and pain points
      if (inputData.description && inputData.description.length > 200) score += 0.2;
    }

    const finalScore = Math.min(1, score);
    this.patternCache.set(cacheKey, finalScore);
    return finalScore;
  }

  /**
   * Aggregate confidence scores from multiple sections
   */
  aggregateConfidence(sections: SectionConfidence[]): {
    overallScore: number;
    overallTier: ConfidenceTier;
    lowConfidenceSections: SectionConfidence[];
    totalSections: number;
    sectionsNeedingReview: number;
  } {
    if (sections.length === 0) {
      return {
        overallScore: 0,
        overallTier: 'low',
        lowConfidenceSections: [],
        totalSections: 0,
        sectionsNeedingReview: 0
      };
    }

    const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
    const overallScore = Math.round(totalScore / sections.length);
    const overallTier = getConfidenceTier(overallScore, this.config);
    const lowConfidenceSections = sections.filter(s => s.tier === 'low');
    const sectionsNeedingReview = sections.filter(s => s.needsReview).length;

    return {
      overallScore,
      overallTier,
      lowConfidenceSections,
      totalSections: sections.length,
      sectionsNeedingReview
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ConfidenceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
