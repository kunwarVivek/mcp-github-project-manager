/**
 * Backlog Prioritizer
 *
 * AI service for multi-factor backlog prioritization combining:
 * - AI-assessed business value
 * - Dependency graph analysis
 * - Risk scoring
 * - Effort fit calculation
 *
 * Implements requirement AI-10: Backlog prioritization (multi-factor).
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { DependencyGraph, GraphAnalysisResult } from '../../analysis/DependencyGraph';
import { AIServiceFactory } from './AIServiceFactory';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  BacklogItem,
  PrioritizedItem,
  PrioritizationResult,
  PriorityTier,
  PriorityFactors,
  PrioritizationReasoning
} from '../../domain/sprint-planning-types';
import { SectionConfidence, ConfidenceFactors, AITask, TaskStatus, TaskPriority } from '../../domain/ai-types';
import {
  SPRINT_PRIORITIZATION_SYSTEM_PROMPT,
  formatPrioritizationPrompt
} from './prompts/SprintPlanningPrompts';

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for AI business value scoring response.
 */
const AIBusinessValueSchema = z.object({
  items: z.array(z.object({
    itemId: z.string(),
    businessValue: z.number().min(0).max(1),
    reasoning: z.string()
  })),
  tradeoffs: z.array(z.string())
});

/**
 * Type for AI business value response.
 */
type AIBusinessValueResult = z.infer<typeof AIBusinessValueSchema>;

// ============================================================================
// Prioritization Weight Configuration
// ============================================================================

/**
 * Default weights for multi-factor prioritization.
 */
export interface PrioritizationWeights {
  businessValue: number;  // 0.4 - Primary driver
  dependencies: number;   // 0.25 - Enables/blocks other work
  risk: number;          // 0.2 - Uncertainty and complexity
  effort: number;        // 0.15 - Fit within capacity
}

const DEFAULT_WEIGHTS: PrioritizationWeights = {
  businessValue: 0.4,
  dependencies: 0.25,
  risk: 0.2,
  effort: 0.15
};

// ============================================================================
// BacklogPrioritizer Implementation
// ============================================================================

/**
 * Multi-factor backlog prioritizer with AI business value assessment.
 */
export class BacklogPrioritizer {
  private aiFactory: AIServiceFactory;
  private weights: PrioritizationWeights;

  constructor(weights?: Partial<PrioritizationWeights>) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Prioritize backlog items using multi-factor scoring.
   *
   * @param params - Prioritization parameters
   * @returns Prioritized items with scoring details
   */
  async prioritize(params: {
    backlogItems: BacklogItem[];
    sprintCapacity: number;
    businessGoals?: string[];
    riskTolerance?: 'low' | 'medium' | 'high';
  }): Promise<PrioritizationResult> {
    if (params.backlogItems.length === 0) {
      return this.getEmptyResult();
    }

    // 1. Build dependency graph
    const { dependencyGraph, graphAnalysis } = this.buildDependencyGraph(params.backlogItems);

    // 2. Get AI business value scoring (with fallback)
    const aiScoring = await this.getAIBusinessValueScoring(
      params.backlogItems,
      params.businessGoals || []
    );

    // 3. Calculate composite scores with weights
    const scoredItems = this.calculateCompositeScores(
      params.backlogItems,
      aiScoring,
      graphAnalysis,
      params.sprintCapacity,
      params.riskTolerance || 'medium'
    );

    // 4. Sort and assign priority tiers
    const prioritizedItems = this.assignPriorityTiers(scoredItems);

    // 5. Calculate confidence
    const confidence = this.calculateConfidence(
      params.backlogItems,
      aiScoring,
      graphAnalysis
    );

    return {
      prioritizedItems,
      reasoning: {
        methodology: 'Multi-factor weighted prioritization with AI-assessed business value',
        weightings: this.weights,
        tradeoffs: aiScoring.tradeoffs
      },
      confidence
    };
  }

  /**
   * Build dependency graph from backlog items.
   */
  private buildDependencyGraph(items: BacklogItem[]): {
    dependencyGraph: DependencyGraph;
    graphAnalysis: GraphAnalysisResult;
  } {
    const dependencyGraph = new DependencyGraph();

    // Convert BacklogItems to AITasks for DependencyGraph
    const aiTasks: AITask[] = items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      status: TaskStatus.PENDING,
      priority: this.mapPriorityToEnum(item.priority),
      complexity: this.estimateComplexity(item.points),
      estimatedHours: (item.points || 3) * 4, // Rough estimate
      aiGenerated: false,
      subtasks: [],
      dependencies: (item.dependencies || []).map(d => ({
        id: d,
        type: 'depends_on' as const
      })),
      acceptanceCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: item.labels || []
    }));

    dependencyGraph.addTasks(aiTasks);

    // Detect implicit dependencies
    dependencyGraph.detectImplicitDependencies(0.5);

    const graphAnalysis = dependencyGraph.analyze();

    return { dependencyGraph, graphAnalysis };
  }

  /**
   * Get AI business value scoring for backlog items.
   * Falls back to priority-based scoring if AI unavailable.
   */
  private async getAIBusinessValueScoring(
    items: BacklogItem[],
    goals: string[]
  ): Promise<AIBusinessValueResult> {
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      // Fallback: use priority as proxy for business value
      return {
        items: items.map(item => ({
          itemId: item.id,
          businessValue: this.priorityToValue(item.priority),
          reasoning: 'Fallback: derived from priority level'
        })),
        tradeoffs: ['AI unavailable - using priority-based estimation']
      };
    }

    try {
      const result = await generateObject({
        model,
        system: SPRINT_PRIORITIZATION_SYSTEM_PROMPT,
        prompt: formatPrioritizationPrompt(items, goals),
        schema: AIBusinessValueSchema,
        temperature: 0.3
      });

      return result.object;
    } catch (error) {
      // Fallback on AI error
      console.error('AI business value scoring failed:', error);
      return {
        items: items.map(item => ({
          itemId: item.id,
          businessValue: this.priorityToValue(item.priority),
          reasoning: 'Fallback: AI error - derived from priority level'
        })),
        tradeoffs: ['AI error - using priority-based estimation']
      };
    }
  }

  /**
   * Calculate composite scores for all items.
   */
  private calculateCompositeScores(
    items: BacklogItem[],
    aiScoring: AIBusinessValueResult,
    graphAnalysis: GraphAnalysisResult,
    capacity: number,
    riskTolerance: 'low' | 'medium' | 'high'
  ): Array<BacklogItem & { score: number; factors: PriorityFactors; aiReasoning: string }> {
    // Map AI scores by item ID for quick lookup
    const aiScoreMap = new Map(
      aiScoring.items.map(i => [i.itemId, i])
    );

    return items.map(item => {
      const aiScore = aiScoreMap.get(item.id);
      const businessValue = aiScore?.businessValue ?? this.priorityToValue(item.priority);
      const aiReasoning = aiScore?.reasoning || 'No AI reasoning available';

      // Dependency score: higher if can start immediately (orphan) or on critical path
      const dependencyScore = this.calculateDependencyScore(item.id, graphAnalysis);

      // Risk score: based on priority, complexity, and risk tolerance
      const riskScore = this.calculateRiskScore(item, riskTolerance);

      // Effort fit: how well the item fits remaining capacity
      const effortFit = this.calculateEffortFit(item.points || 3, capacity);

      // Calculate weighted composite score
      const score = Math.round(
        (businessValue * this.weights.businessValue +
         dependencyScore * this.weights.dependencies +
         riskScore * this.weights.risk +
         effortFit * this.weights.effort) * 100
      );

      return {
        ...item,
        score,
        factors: { businessValue, dependencyScore, riskScore, effortFit },
        aiReasoning
      };
    });
  }

  /**
   * Calculate dependency score based on graph position.
   */
  private calculateDependencyScore(itemId: string, graphAnalysis: GraphAnalysisResult): number {
    // Orphan tasks can start immediately - highest score
    if (graphAnalysis.orphanTasks.includes(itemId)) {
      return 1.0;
    }

    // Critical path items are important for overall delivery
    if (graphAnalysis.criticalPath.includes(itemId)) {
      return 0.85;
    }

    // Check execution order position
    const orderIndex = graphAnalysis.executionOrder.indexOf(itemId);
    if (orderIndex >= 0) {
      // Earlier in execution order = slightly higher score
      const positionFactor = 1 - (orderIndex / Math.max(1, graphAnalysis.executionOrder.length));
      return 0.5 + (positionFactor * 0.3);
    }

    // Default score for items not in analysis
    return 0.5;
  }

  /**
   * Calculate risk score based on item characteristics.
   */
  private calculateRiskScore(
    item: BacklogItem,
    riskTolerance: 'low' | 'medium' | 'high'
  ): number {
    const points = item.points || 3;

    // Base risk from complexity (higher points = higher risk)
    let baseRisk = 1 - (Math.min(points, 13) / 15);

    // Adjust based on priority (critical items have lower risk tolerance)
    const priorityAdjustment = this.priorityToValue(item.priority) * 0.2;
    baseRisk = baseRisk - priorityAdjustment;

    // Apply risk tolerance modifier
    const toleranceModifier = {
      low: 0.8,    // Prefer lower risk items
      medium: 1.0, // Neutral
      high: 1.2    // Can accept higher risk
    }[riskTolerance];

    return Math.max(0, Math.min(1, baseRisk * toleranceModifier));
  }

  /**
   * Calculate effort fit based on capacity.
   */
  private calculateEffortFit(points: number, capacity: number): number {
    if (capacity <= 0) return 0.5;

    const ratio = points / capacity;

    // Items that fit well in capacity get higher scores
    if (ratio <= 0.2) return 1.0;      // Small items (< 20% capacity)
    if (ratio <= 0.35) return 0.85;    // Medium-small (20-35%)
    if (ratio <= 0.5) return 0.7;      // Medium (35-50%)
    if (ratio <= 0.7) return 0.5;      // Large (50-70%)
    return 0.3;                         // Very large (> 70%)
  }

  /**
   * Assign priority tiers based on scores.
   */
  private assignPriorityTiers(
    scored: Array<BacklogItem & { score: number; factors: PriorityFactors; aiReasoning: string }>
  ): PrioritizedItem[] {
    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        itemId: item.id,
        priority: this.scoreToPriorityTier(item.score),
        score: item.score,
        factors: item.factors,
        reasoning: this.formatReasoning(item)
      }));
  }

  /**
   * Convert numeric score to priority tier.
   */
  private scoreToPriorityTier(score: number): PriorityTier {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Format reasoning string for prioritized item.
   */
  private formatReasoning(
    item: BacklogItem & { score: number; factors: PriorityFactors; aiReasoning: string }
  ): string {
    const { factors, aiReasoning } = item;
    return `Score ${item.score}: BV=${factors.businessValue.toFixed(2)}, ` +
           `Dep=${factors.dependencyScore.toFixed(2)}, ` +
           `Risk=${factors.riskScore.toFixed(2)}, ` +
           `Fit=${factors.effortFit.toFixed(2)}. ${aiReasoning}`;
  }

  /**
   * Calculate confidence for prioritization result.
   */
  private calculateConfidence(
    items: BacklogItem[],
    aiScoring: AIBusinessValueResult,
    graphAnalysis: GraphAnalysisResult
  ): SectionConfidence {
    // Input completeness: based on item descriptions and dependency info
    const hasDescriptions = items.filter(i => i.description && i.description.length > 50).length;
    const descriptionRatio = hasDescriptions / Math.max(1, items.length);

    const hasDependencies = items.filter(i => i.dependencies && i.dependencies.length > 0).length;
    const dependencyRatio = hasDependencies / Math.max(1, items.length);

    const inputCompleteness = (descriptionRatio * 0.6) + (dependencyRatio * 0.4);

    // AI self-assessment: based on whether AI was used or fallback
    const usedAI = !aiScoring.tradeoffs.some(t =>
      t.includes('Fallback') || t.includes('AI unavailable') || t.includes('AI error')
    );
    const aiSelfAssessment = usedAI ? 0.8 : 0.4;

    // Pattern match: based on graph analysis quality
    const hasCycles = graphAnalysis.cycles.length > 0;
    const patternMatch = hasCycles ? 0.4 : 0.7;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70;

    return {
      sectionId: 'backlog-prioritization',
      sectionName: 'Backlog Prioritization',
      score,
      tier,
      factors,
      reasoning: this.getConfidenceReasoning(usedAI, hasCycles, inputCompleteness),
      needsReview
    };
  }

  /**
   * Generate confidence reasoning.
   */
  private getConfidenceReasoning(
    usedAI: boolean,
    hasCycles: boolean,
    inputCompleteness: number
  ): string {
    const reasons: string[] = [];

    if (usedAI) {
      reasons.push('AI-powered business value assessment');
    } else {
      reasons.push('Fallback priority-based scoring (AI unavailable)');
    }

    if (hasCycles) {
      reasons.push('Warning: circular dependencies detected in backlog');
    }

    if (inputCompleteness >= 0.7) {
      reasons.push('Good item descriptions and dependency data');
    } else if (inputCompleteness < 0.4) {
      reasons.push('Limited item details may affect accuracy');
    }

    return reasons.join('. ');
  }

  /**
   * Get empty result for empty backlog.
   */
  private getEmptyResult(): PrioritizationResult {
    return {
      prioritizedItems: [],
      reasoning: {
        methodology: 'No items to prioritize',
        weightings: this.weights,
        tradeoffs: []
      },
      confidence: {
        sectionId: 'backlog-prioritization',
        sectionName: 'Backlog Prioritization',
        score: 100,
        tier: 'high',
        factors: { inputCompleteness: 1, aiSelfAssessment: 1, patternMatch: 1 },
        reasoning: 'Empty backlog - no prioritization needed',
        needsReview: false
      }
    };
  }

  /**
   * Convert priority string to numeric value.
   */
  private priorityToValue(priority?: string): number {
    switch (priority) {
      case 'critical': return 1.0;
      case 'high': return 0.75;
      case 'medium': return 0.5;
      case 'low': return 0.25;
      default: return 0.5;
    }
  }

  /**
   * Map priority string to TaskPriority enum.
   */
  private mapPriorityToEnum(priority?: string): TaskPriority {
    switch (priority) {
      case 'critical': return TaskPriority.CRITICAL;
      case 'high': return TaskPriority.HIGH;
      case 'medium': return TaskPriority.MEDIUM;
      case 'low': return TaskPriority.LOW;
      default: return TaskPriority.MEDIUM;
    }
  }

  /**
   * Estimate complexity from story points.
   */
  private estimateComplexity(points?: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
    const p = points || 3;
    if (p <= 1) return 2;
    if (p <= 2) return 3;
    if (p <= 3) return 4;
    if (p <= 5) return 5;
    if (p <= 8) return 7;
    if (p <= 13) return 9;
    return 10;
  }
}
