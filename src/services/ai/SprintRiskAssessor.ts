/**
 * Sprint Risk Assessor
 *
 * AI service for identifying and assessing sprint risks with
 * mitigation suggestions.
 *
 * Implements requirement AI-11: Sprint risk assessment.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  SprintRiskAssessment,
  SprintRisk,
  MitigationSuggestion,
  BacklogItem,
  SprintCapacity,
  SprintMetrics,
  SprintRiskCategory,
  RiskProbability,
  RiskImpact,
  MitigationStrategy,
  MitigationEffort
} from '../../domain/sprint-planning-types';
import { DetectedDependency } from '../../analysis/DependencyGraph';
import { SectionConfidence, ConfidenceFactors } from '../../domain/ai-types';
import {
  SPRINT_RISK_SYSTEM_PROMPT,
  formatRiskPrompt
} from './prompts/SprintPlanningPrompts';

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for AI risk assessment response.
 */
const SprintRiskAssessmentSchema = z.object({
  overallRisk: z.enum(['high', 'medium', 'low']),
  riskScore: z.number().min(0).max(100),
  risks: z.array(z.object({
    id: z.string(),
    category: z.enum(['scope', 'dependency', 'capacity', 'technical', 'external']),
    title: z.string(),
    description: z.string(),
    probability: z.enum(['high', 'medium', 'low']),
    impact: z.enum(['high', 'medium', 'low']),
    relatedItems: z.array(z.string())
  })),
  mitigations: z.array(z.object({
    riskId: z.string(),
    strategy: z.enum(['avoid', 'mitigate', 'transfer', 'accept']),
    action: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    effectiveness: z.number().min(0).max(1)
  })),
  reasoning: z.string()
});

/**
 * Type for AI risk assessment response.
 */
type AIRiskAssessmentResult = z.infer<typeof SprintRiskAssessmentSchema>;

// ============================================================================
// Risk Assessment Parameters
// ============================================================================

/**
 * Parameters for sprint risk assessment.
 */
export interface RiskAssessmentParams {
  /** Items planned for the sprint */
  sprintItems: BacklogItem[];
  /** Sprint capacity information */
  sprintCapacity: SprintCapacity;
  /** Known dependencies between items */
  dependencies?: DetectedDependency[];
  /** Optional historical data for context */
  historicalData?: SprintMetrics[];
}

// ============================================================================
// SprintRiskAssessor Implementation
// ============================================================================

/**
 * Sprint risk assessor with AI-powered risk identification and mitigation.
 */
export class SprintRiskAssessor {
  private aiFactory: AIServiceFactory;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
  }

  /**
   * Assess risks for a sprint composition.
   *
   * @param params - Risk assessment parameters
   * @returns Risk assessment with mitigations
   */
  async assessRisks(params: RiskAssessmentParams): Promise<SprintRiskAssessment> {
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      return this.getFallbackAssessment(params);
    }

    try {
      const result = await generateObject({
        model,
        system: SPRINT_RISK_SYSTEM_PROMPT,
        prompt: this.formatRiskPromptFromParams(params),
        schema: SprintRiskAssessmentSchema,
        temperature: 0.3
      });

      // Add confidence scoring
      const confidence = this.calculateConfidence(params, result.object.riskScore, true);

      return {
        overallRisk: result.object.overallRisk as RiskProbability,
        riskScore: result.object.riskScore,
        risks: result.object.risks.map(r => ({
          id: r.id,
          category: r.category as SprintRiskCategory,
          title: r.title,
          description: r.description,
          probability: r.probability as RiskProbability,
          impact: r.impact as RiskImpact,
          relatedItems: r.relatedItems
        })),
        mitigations: result.object.mitigations.map(m => ({
          riskId: m.riskId,
          strategy: m.strategy as MitigationStrategy,
          action: m.action,
          effort: m.effort as MitigationEffort,
          effectiveness: m.effectiveness
        })),
        confidence
      };
    } catch (error) {
      console.error('AI risk assessment failed:', error);
      return this.getFallbackAssessment(params);
    }
  }

  /**
   * Format risk prompt from assessment parameters.
   */
  private formatRiskPromptFromParams(params: RiskAssessmentParams): string {
    const totalPoints = params.sprintItems.reduce(
      (sum, item) => sum + (item.points || 3),
      0
    );

    const itemsWithDeps = params.sprintItems.filter(
      i => i.dependencies && i.dependencies.length > 0
    ).length;

    return formatRiskPrompt({
      sprintItems: params.sprintItems.map(item => ({
        id: item.id,
        title: item.title,
        points: item.points,
        dependencies: item.dependencies
      })),
      totalPoints,
      recommendedCapacity: params.sprintCapacity.recommendedLoad,
      dependencyCount: itemsWithDeps
    });
  }

  /**
   * Get fallback assessment using algorithmic risk detection.
   */
  private getFallbackAssessment(params: RiskAssessmentParams): SprintRiskAssessment {
    const risks: SprintRisk[] = [];
    const mitigations: MitigationSuggestion[] = [];
    let riskIdCounter = 1;

    const totalPoints = params.sprintItems.reduce(
      (sum, item) => sum + (item.points || 3),
      0
    );
    const utilizationRatio = totalPoints / params.sprintCapacity.recommendedLoad;

    // 1. Check for capacity overcommitment
    if (utilizationRatio > 1.0) {
      const riskId = `risk-${riskIdCounter++}`;
      risks.push({
        id: riskId,
        category: 'capacity',
        title: 'Sprint overcommitment',
        description: `Sprint scope (${totalPoints} points) exceeds recommended capacity ` +
                    `(${params.sprintCapacity.recommendedLoad} points) by ` +
                    `${Math.round((utilizationRatio - 1) * 100)}%`,
        probability: utilizationRatio > 1.3 ? 'high' : 'medium',
        impact: 'high',
        relatedItems: params.sprintItems.map(i => i.id)
      });
      mitigations.push({
        riskId,
        strategy: 'mitigate',
        action: 'Reduce sprint scope or defer lower-priority items',
        effort: 'low',
        effectiveness: 0.8
      });
    }

    // 2. Check for low buffer
    if (utilizationRatio > 0.9 && utilizationRatio <= 1.0) {
      const riskId = `risk-${riskIdCounter++}`;
      risks.push({
        id: riskId,
        category: 'capacity',
        title: 'Minimal capacity buffer',
        description: `Sprint is at ${Math.round(utilizationRatio * 100)}% capacity, ` +
                    `leaving little room for unexpected work`,
        probability: 'medium',
        impact: 'medium',
        relatedItems: []
      });
      mitigations.push({
        riskId,
        strategy: 'accept',
        action: 'Monitor sprint progress closely and be prepared to descope',
        effort: 'low',
        effectiveness: 0.5
      });
    }

    // 3. Check for complex items (high point items)
    const complexItems = params.sprintItems.filter(i => (i.points || 3) >= 8);
    if (complexItems.length > 0) {
      const riskId = `risk-${riskIdCounter++}`;
      risks.push({
        id: riskId,
        category: 'technical',
        title: 'High-complexity items present',
        description: `Sprint includes ${complexItems.length} high-complexity item(s) ` +
                    `(8+ points) which may have estimation uncertainty`,
        probability: 'medium',
        impact: 'medium',
        relatedItems: complexItems.map(i => i.id)
      });
      mitigations.push({
        riskId,
        strategy: 'mitigate',
        action: 'Consider breaking down complex items or timeboxing investigation',
        effort: 'medium',
        effectiveness: 0.7
      });
    }

    // 4. Check for dependency risks
    const itemsWithDeps = params.sprintItems.filter(
      i => i.dependencies && i.dependencies.length > 0
    );
    if (itemsWithDeps.length >= params.sprintItems.length * 0.5 && params.sprintItems.length > 2) {
      const riskId = `risk-${riskIdCounter++}`;
      risks.push({
        id: riskId,
        category: 'dependency',
        title: 'High dependency concentration',
        description: `${itemsWithDeps.length} of ${params.sprintItems.length} items have ` +
                    `dependencies, creating potential blocking chains`,
        probability: 'medium',
        impact: 'medium',
        relatedItems: itemsWithDeps.map(i => i.id)
      });
      mitigations.push({
        riskId,
        strategy: 'mitigate',
        action: 'Prioritize dependency-free items early in sprint and monitor blockers',
        effort: 'low',
        effectiveness: 0.6
      });
    }

    // 5. Check for missing descriptions (unclear scope)
    const itemsWithoutDesc = params.sprintItems.filter(
      i => !i.description || i.description.length < 20
    );
    if (itemsWithoutDesc.length >= params.sprintItems.length * 0.3 && params.sprintItems.length > 2) {
      const riskId = `risk-${riskIdCounter++}`;
      risks.push({
        id: riskId,
        category: 'scope',
        title: 'Unclear item definitions',
        description: `${itemsWithoutDesc.length} items lack detailed descriptions, ` +
                    `increasing scope uncertainty`,
        probability: 'medium',
        impact: 'medium',
        relatedItems: itemsWithoutDesc.map(i => i.id)
      });
      mitigations.push({
        riskId,
        strategy: 'mitigate',
        action: 'Refine item descriptions and acceptance criteria before sprint start',
        effort: 'medium',
        effectiveness: 0.7
      });
    }

    // Calculate overall risk level
    const riskScore = this.calculateRiskScore(risks);
    const overallRisk = this.getOverallRiskLevel(riskScore);

    // Calculate confidence for fallback
    const confidence = this.calculateConfidence(params, riskScore, false);

    return {
      overallRisk,
      riskScore,
      risks,
      mitigations,
      confidence
    };
  }

  /**
   * Calculate numeric risk score from identified risks.
   */
  private calculateRiskScore(risks: SprintRisk[]): number {
    if (risks.length === 0) return 0;

    let totalWeight = 0;

    for (const risk of risks) {
      const probWeight = { high: 3, medium: 2, low: 1 }[risk.probability];
      const impactWeight = { high: 3, medium: 2, low: 1 }[risk.impact];
      totalWeight += probWeight * impactWeight;
    }

    // Normalize to 0-100 scale (max 9 weight per risk, assume max 10 risks)
    return Math.min(100, Math.round((totalWeight / 90) * 100));
  }

  /**
   * Determine overall risk level from score.
   */
  private getOverallRiskLevel(score: number): RiskProbability {
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence for the risk assessment.
   */
  private calculateConfidence(
    params: RiskAssessmentParams,
    riskScore: number,
    usedAI: boolean
  ): SectionConfidence {
    // Input completeness based on item details
    const hasDescriptions = params.sprintItems.filter(
      i => i.description && i.description.length > 50
    ).length;
    const descriptionRatio = hasDescriptions / Math.max(1, params.sprintItems.length);
    const inputCompleteness = descriptionRatio * 0.7 + 0.3;

    // AI self-assessment
    const aiSelfAssessment = usedAI ? 0.75 : 0.5;

    // Pattern match based on capacity utilization clarity
    const utilizationRatio = params.sprintItems.reduce(
      (sum, i) => sum + (i.points || 3), 0
    ) / params.sprintCapacity.recommendedLoad;
    const patternMatch = utilizationRatio <= 1.0 ? 0.7 : 0.5;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70;

    return {
      sectionId: 'sprint-risk-assessment',
      sectionName: 'Sprint Risk Assessment',
      score,
      tier,
      factors,
      reasoning: usedAI
        ? 'AI-powered risk assessment with mitigation suggestions'
        : 'Algorithmic risk detection (AI unavailable)',
      needsReview
    };
  }
}
