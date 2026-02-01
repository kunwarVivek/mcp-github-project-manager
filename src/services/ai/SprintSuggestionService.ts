/**
 * Sprint Suggestion Service
 *
 * AI service that combines capacity analysis, prioritization, and risk
 * assessment to suggest optimal sprint composition.
 *
 * Implements requirement AI-12: Sprint scope recommendations.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import { SprintCapacityAnalyzer, CapacityParams } from './SprintCapacityAnalyzer';
import { BacklogPrioritizer } from './BacklogPrioritizer';
import { SprintRiskAssessor } from './SprintRiskAssessor';
import { DependencyGraph, GraphAnalysisResult } from '../../analysis/DependencyGraph';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  SprintSuggestion,
  SuggestedItem,
  BacklogItem,
  TeamMember,
  SprintCapacity,
  SprintRisk,
  PrioritizedItem,
  PriorityTier,
  SprintMetrics
} from '../../domain/sprint-planning-types';
import { SectionConfidence, ConfidenceFactors, AITask, TaskStatus, TaskPriority } from '../../domain/ai-types';
import {
  SPRINT_SUGGESTION_SYSTEM_PROMPT,
  formatSprintSuggestionPrompt
} from './prompts/SprintPlanningPrompts';
import { EstimationCalibrator } from '../../analysis/EstimationCalibrator';

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for AI sprint suggestion response.
 */
const SprintSuggestionSchema = z.object({
  suggestedItems: z.array(z.object({
    itemId: z.string(),
    title: z.string(),
    points: z.number(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    includeReason: z.string(),
    dependencies: z.array(z.string())
  })),
  totalPoints: z.number(),
  capacityUtilization: z.number().min(0).max(1),
  reasoning: z.string(),
  risks: z.array(z.object({
    category: z.string(),
    description: z.string(),
    probability: z.enum(['high', 'medium', 'low']),
    mitigation: z.string()
  }))
});

// ============================================================================
// Sprint Suggestion Parameters
// ============================================================================

/**
 * Parameters for sprint composition suggestion.
 */
export interface SprintSuggestionParams {
  /** Available backlog items */
  backlogItems: BacklogItem[];
  /** Team velocity in points per sprint */
  velocity: number;
  /** Sprint duration in days */
  sprintDurationDays: number;
  /** Optional team members for capacity consideration */
  teamMembers?: TeamMember[];
  /** Optional business goals to optimize for */
  businessGoals?: string[];
  /** Risk tolerance level */
  riskTolerance?: 'low' | 'medium' | 'high';
  /** Optional historical sprint data */
  historicalSprints?: SprintMetrics[];
  /** Optional estimation calibrator for better estimates */
  estimationCalibrator?: EstimationCalibrator;
}

// ============================================================================
// SprintSuggestionService Implementation
// ============================================================================

/**
 * Combined sprint suggestion service using capacity, prioritization, and risk.
 */
export class SprintSuggestionService {
  private aiFactory: AIServiceFactory;
  private capacityAnalyzer: SprintCapacityAnalyzer;
  private prioritizer: BacklogPrioritizer;
  private riskAssessor: SprintRiskAssessor;

  constructor(estimationCalibrator?: EstimationCalibrator) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.capacityAnalyzer = new SprintCapacityAnalyzer(estimationCalibrator);
    this.prioritizer = new BacklogPrioritizer();
    this.riskAssessor = new SprintRiskAssessor();
  }

  /**
   * Suggest optimal sprint composition.
   *
   * @param params - Sprint suggestion parameters
   * @returns Sprint composition suggestion with risks
   */
  async suggestSprintComposition(params: SprintSuggestionParams): Promise<SprintSuggestion> {
    if (params.backlogItems.length === 0) {
      return this.getEmptySuggestion();
    }

    // 1. Calculate capacity
    const capacity = await this.capacityAnalyzer.calculateCapacity({
      velocity: params.velocity,
      sprintDurationDays: params.sprintDurationDays,
      teamMembers: params.teamMembers || [],
      historicalSprints: params.historicalSprints
    });

    // 2. Get prioritization
    const prioritization = await this.prioritizer.prioritize({
      backlogItems: params.backlogItems,
      sprintCapacity: capacity.recommendedLoad,
      businessGoals: params.businessGoals,
      riskTolerance: params.riskTolerance
    });

    // 3. Build dependency graph for selection
    const { dependencyGraph, graphAnalysis } = this.buildDependencyGraph(params.backlogItems);

    // 4. Select items that fit capacity, respecting dependencies
    const selectedItems = this.selectItemsForCapacity(
      prioritization.prioritizedItems,
      params.backlogItems,
      capacity.recommendedLoad,
      graphAnalysis
    );

    // 5. Calculate totals
    const totalPoints = selectedItems.reduce((sum, item) => sum + item.points, 0);
    const utilization = totalPoints / capacity.recommendedLoad;

    // 6. Assess risks for selected items
    const selectedBacklogItems = selectedItems.map(si =>
      params.backlogItems.find(bi => bi.id === si.itemId)!
    ).filter(Boolean);

    const riskAssessment = await this.riskAssessor.assessRisks({
      sprintItems: selectedBacklogItems,
      sprintCapacity: capacity
    });

    // 7. Calculate confidence
    const confidence = this.calculateConfidence(
      params,
      utilization,
      capacity,
      prioritization.confidence
    );

    // 8. Generate reasoning
    const reasoning = this.generateReasoning(
      selectedItems,
      capacity,
      prioritization,
      params.businessGoals
    );

    return {
      suggestedItems: selectedItems,
      totalPoints,
      capacityUtilization: utilization,
      reasoning,
      risks: riskAssessment.risks,
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
      estimatedHours: (item.points || 3) * 4,
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
    dependencyGraph.detectImplicitDependencies(0.5);

    const graphAnalysis = dependencyGraph.analyze();

    return { dependencyGraph, graphAnalysis };
  }

  /**
   * Select items that fit within capacity while respecting dependencies.
   */
  private selectItemsForCapacity(
    prioritized: PrioritizedItem[],
    backlogItems: BacklogItem[],
    capacity: number,
    graphAnalysis: GraphAnalysisResult
  ): SuggestedItem[] {
    const selected: SuggestedItem[] = [];
    let remainingCapacity = capacity;
    const includedIds = new Set<string>();
    const backlogMap = new Map(backlogItems.map(bi => [bi.id, bi]));

    // Sort by priority score descending
    const sorted = [...prioritized].sort((a, b) => b.score - a.score);

    for (const item of sorted) {
      const backlogItem = backlogMap.get(item.itemId);
      if (!backlogItem) continue;

      const points = backlogItem.points || 3;
      if (points > remainingCapacity) continue;

      // Check if all dependencies are included
      const deps = backlogItem.dependencies || [];
      const depsIncluded = deps.every(d => {
        // Dependency is satisfied if:
        // 1. Already included in selection
        // 2. Not in the current backlog (external dependency)
        return includedIds.has(d) || !backlogMap.has(d);
      });

      if (depsIncluded) {
        selected.push({
          itemId: item.itemId,
          title: backlogItem.title,
          points,
          priority: item.priority,
          includeReason: this.formatIncludeReason(item, graphAnalysis),
          dependencies: deps
        });
        remainingCapacity -= points;
        includedIds.add(item.itemId);
      }
    }

    return selected;
  }

  /**
   * Format inclusion reason for a selected item.
   */
  private formatIncludeReason(
    item: PrioritizedItem,
    graphAnalysis: GraphAnalysisResult
  ): string {
    const reasons: string[] = [];

    // Priority-based reason
    if (item.priority === 'critical') {
      reasons.push('Critical priority');
    } else if (item.priority === 'high') {
      reasons.push('High business value');
    }

    // Score-based reason
    if (item.score >= 80) {
      reasons.push('top-scored item');
    } else if (item.score >= 60) {
      reasons.push('high-scoring item');
    }

    // Graph-based reasons
    if (graphAnalysis.orphanTasks.includes(item.itemId)) {
      reasons.push('can start immediately (no blockers)');
    } else if (graphAnalysis.criticalPath.includes(item.itemId)) {
      reasons.push('on critical path');
    }

    // Factor-based reasons
    if (item.factors.dependencyScore >= 0.8) {
      reasons.push('enables other work');
    }
    if (item.factors.effortFit >= 0.8) {
      reasons.push('good capacity fit');
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : `Score ${item.score} (balanced across factors)`;
  }

  /**
   * Generate overall reasoning for the sprint suggestion.
   */
  private generateReasoning(
    selectedItems: SuggestedItem[],
    capacity: SprintCapacity,
    prioritization: { prioritizedItems: PrioritizedItem[] },
    businessGoals?: string[]
  ): string {
    const parts: string[] = [];

    // Capacity context
    parts.push(
      `Selected ${selectedItems.length} items (${selectedItems.reduce((s, i) => s + i.points, 0)} pts) ` +
      `for capacity of ${capacity.recommendedLoad} pts (${Math.round(capacity.buffer.percentage)}% buffer applied).`
    );

    // Priority distribution
    const criticalCount = selectedItems.filter(i => i.priority === 'critical').length;
    const highCount = selectedItems.filter(i => i.priority === 'high').length;
    if (criticalCount > 0 || highCount > 0) {
      parts.push(
        `Includes ${criticalCount} critical and ${highCount} high-priority items.`
      );
    }

    // Business goals
    if (businessGoals && businessGoals.length > 0) {
      parts.push(`Optimized for goals: ${businessGoals.slice(0, 2).join(', ')}.`);
    }

    // Excluded high-value items
    const notSelected = prioritization.prioritizedItems.filter(
      p => !selectedItems.find(s => s.itemId === p.itemId)
    );
    const highValueExcluded = notSelected.filter(p => p.score >= 60);
    if (highValueExcluded.length > 0) {
      parts.push(
        `${highValueExcluded.length} high-value item(s) deferred due to capacity or dependency constraints.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Calculate confidence for the sprint suggestion.
   */
  private calculateConfidence(
    params: SprintSuggestionParams,
    utilization: number,
    capacity: SprintCapacity,
    prioritizationConfidence: SectionConfidence
  ): SectionConfidence {
    // Input completeness from capacity and prioritization
    const inputCompleteness =
      (capacity.confidence.factors.inputCompleteness +
       prioritizationConfidence.factors.inputCompleteness) / 2;

    // AI self-assessment from prioritization
    const aiSelfAssessment = prioritizationConfidence.factors.aiSelfAssessment;

    // Pattern match based on utilization
    const patternMatch = utilization <= 0.85 ? 0.8 :
                         utilization <= 1.0 ? 0.6 : 0.4;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70;

    return {
      sectionId: 'sprint-suggestion',
      sectionName: 'Sprint Suggestion',
      score,
      tier,
      factors,
      reasoning: this.getConfidenceReasoning(utilization, capacity, prioritizationConfidence),
      needsReview
    };
  }

  /**
   * Generate confidence reasoning.
   */
  private getConfidenceReasoning(
    utilization: number,
    capacity: SprintCapacity,
    prioritizationConfidence: SectionConfidence
  ): string {
    const reasons: string[] = [];

    // Capacity confidence
    if (capacity.confidence.tier === 'high') {
      reasons.push('High confidence in capacity calculation');
    } else if (capacity.confidence.tier === 'low') {
      reasons.push('Capacity calculation has uncertainty');
    }

    // Prioritization confidence
    if (prioritizationConfidence.tier === 'high') {
      reasons.push('strong prioritization data');
    } else if (prioritizationConfidence.tier === 'low') {
      reasons.push('limited prioritization data');
    }

    // Utilization health
    if (utilization <= 0.8) {
      reasons.push('healthy capacity buffer');
    } else if (utilization > 0.95) {
      reasons.push('tight capacity - consider risk');
    }

    return reasons.join('; ');
  }

  /**
   * Get empty suggestion for empty backlog.
   */
  private getEmptySuggestion(): SprintSuggestion {
    return {
      suggestedItems: [],
      totalPoints: 0,
      capacityUtilization: 0,
      reasoning: 'No backlog items available for sprint planning',
      risks: [],
      confidence: {
        sectionId: 'sprint-suggestion',
        sectionName: 'Sprint Suggestion',
        score: 100,
        tier: 'high',
        factors: { inputCompleteness: 1, aiSelfAssessment: 1, patternMatch: 1 },
        reasoning: 'Empty backlog - no suggestions needed',
        needsReview: false
      }
    };
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

  /**
   * Get AI-powered sprint suggestion (alternative flow).
   * Uses AI directly for composition instead of combining services.
   */
  async getAISuggestion(params: SprintSuggestionParams): Promise<SprintSuggestion | null> {
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      return null;
    }

    try {
      // Calculate capacity first
      const capacity = await this.capacityAnalyzer.calculateCapacity({
        velocity: params.velocity,
        sprintDurationDays: params.sprintDurationDays,
        teamMembers: params.teamMembers || []
      });

      const result = await generateObject({
        model,
        system: SPRINT_SUGGESTION_SYSTEM_PROMPT,
        prompt: formatSprintSuggestionPrompt({
          availableItems: params.backlogItems.map(item => ({
            id: item.id,
            title: item.title,
            points: item.points,
            priority: item.priority
          })),
          capacity: capacity.recommendedLoad,
          businessGoals: params.businessGoals,
          riskTolerance: params.riskTolerance || 'medium'
        }),
        schema: SprintSuggestionSchema,
        temperature: 0.4
      });

      // Map AI response to SprintSuggestion
      return {
        suggestedItems: result.object.suggestedItems.map(item => ({
          itemId: item.itemId,
          title: item.title,
          points: item.points,
          priority: item.priority as PriorityTier,
          includeReason: item.includeReason,
          dependencies: item.dependencies
        })),
        totalPoints: result.object.totalPoints,
        capacityUtilization: result.object.capacityUtilization,
        reasoning: result.object.reasoning,
        risks: result.object.risks.map(r => ({
          id: `ai-risk-${Math.random().toString(36).substr(2, 9)}`,
          category: r.category as any,
          title: r.description.substring(0, 50),
          description: r.description,
          probability: r.probability as any,
          impact: 'medium' as const,
          relatedItems: []
        })),
        confidence: {
          sectionId: 'ai-sprint-suggestion',
          sectionName: 'AI Sprint Suggestion',
          score: 70,
          tier: 'medium',
          factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.7, patternMatch: 0.7 },
          reasoning: 'AI-generated sprint composition',
          needsReview: false
        }
      };
    } catch (error) {
      console.error('AI sprint suggestion failed:', error);
      return null;
    }
  }
}
