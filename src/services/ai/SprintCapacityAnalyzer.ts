/**
 * Sprint Capacity Analyzer
 *
 * AI service for calculating sprint capacity with velocity calibration,
 * team availability, and confidence scoring.
 *
 * Implements requirement AI-09: Sprint capacity planning with velocity.
 */

import {
  EstimationCalibrator,
  getComplexityBand
} from '../../analysis/EstimationCalibrator';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  SprintCapacity,
  TeamMember,
  SprintMetrics,
  TeamAvailability
} from '../../domain/sprint-planning-types';
import { SectionConfidence, ConfidenceFactors } from '../../domain/ai-types';

/**
 * Availability adjustment for capacity calculation.
 */
interface AvailabilityAdjustment {
  memberId: string;
  memberName: string;
  originalAvailability: number;
  adjustedAvailability: number;
  reason?: string;
}

/**
 * Parameters for capacity calculation.
 */
export interface CapacityParams {
  /** Velocity in points per sprint, or 'auto' to calculate from history */
  velocity: number | 'auto';
  /** Sprint duration in days */
  sprintDurationDays: number;
  /** Team members with their availability */
  teamMembers: TeamMember[];
  /** Optional historical sprints for velocity calculation */
  historicalSprints?: SprintMetrics[];
  /** Optional custom buffer percentage (default: 20%) */
  bufferPercentage?: number;
}

/**
 * Sprint capacity analyzer with velocity calibration and confidence scoring.
 */
export class SprintCapacityAnalyzer {
  private estimationCalibrator?: EstimationCalibrator;
  private defaultVelocity = 20;
  private defaultBuffer = 0.20; // 20%

  constructor(estimationCalibrator?: EstimationCalibrator) {
    this.estimationCalibrator = estimationCalibrator;
  }

  /**
   * Calculate sprint capacity with buffer and confidence.
   *
   * @param params - Capacity calculation parameters
   * @returns Sprint capacity with confidence scoring
   */
  async calculateCapacity(params: CapacityParams): Promise<SprintCapacity> {
    // 1. Determine velocity
    const velocity = params.velocity === 'auto'
      ? this.calculateVelocityFromHistory(params.historicalSprints || [])
      : params.velocity;

    // 2. Calculate team availability factor
    const availabilityResult = this.calculateTeamAvailability(params.teamMembers);

    // 3. Apply calibration from EstimationCalibrator if available
    const calibrationFactor = this.getCalibrationFactor();
    const calibratedVelocity = Math.floor(velocity * availabilityResult.factor * calibrationFactor);

    // 4. Apply buffer for sustainability
    const bufferPercentage = params.bufferPercentage ?? this.defaultBuffer;
    const recommendedLoad = Math.floor(calibratedVelocity * (1 - bufferPercentage));

    // 5. Calculate confidence
    const hasHistoricalData = (params.historicalSprints?.length ?? 0) >= 3;
    const confidence = this.calculateConfidence(
      hasHistoricalData,
      availabilityResult.factor,
      params.velocity === 'auto'
    );

    // 6. Build team availability details
    const teamAvailability = this.buildTeamAvailability(
      params.teamMembers,
      availabilityResult
    );

    return {
      totalPoints: calibratedVelocity,
      recommendedLoad,
      teamAvailability,
      buffer: {
        percentage: bufferPercentage * 100,
        reasoning: this.getBufferReasoning(bufferPercentage, hasHistoricalData)
      },
      confidence
    };
  }

  /**
   * Calculate velocity from historical sprint data.
   * Uses rolling average with outlier filtering.
   */
  private calculateVelocityFromHistory(sprints: SprintMetrics[]): number {
    if (sprints.length === 0) {
      return this.defaultVelocity;
    }

    // Sort by date descending to get most recent first
    const sorted = [...sprints].sort((a, b) =>
      new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    );

    // Use last 3-5 sprints
    const recentSprints = sorted.slice(0, Math.min(5, sorted.length));

    // Calculate completion rates (completed / planned)
    const completionRates = recentSprints.map(s =>
      s.plannedPoints > 0 ? s.completedPoints / s.plannedPoints : 1
    );

    // Filter outliers (beyond 1.5 IQR)
    const filteredVelocities = this.filterOutliers(
      recentSprints.map(s => s.completedPoints)
    );

    if (filteredVelocities.length === 0) {
      return this.defaultVelocity;
    }

    // Calculate weighted average (more recent = higher weight)
    const weights = filteredVelocities.map((_, i) => 1 / (i + 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const weightedSum = filteredVelocities.reduce((sum, velocity, i) =>
      sum + velocity * weights[i], 0
    );

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Filter outliers using IQR method.
   */
  private filterOutliers(values: number[]): number[] {
    if (values.length < 4) {
      return values;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.filter(v => v >= lowerBound && v <= upperBound);
  }

  /**
   * Calculate aggregate team availability factor.
   */
  private calculateTeamAvailability(members: TeamMember[]): {
    factor: number;
    adjustments: AvailabilityAdjustment[];
  } {
    if (members.length === 0) {
      return { factor: 1, adjustments: [] };
    }

    const adjustments: AvailabilityAdjustment[] = [];
    let totalAdjustedAvailability = 0;

    for (const member of members) {
      // Normalize availability to 0-1 range
      const originalAvailability = Math.max(0, Math.min(1, member.availability));
      let adjustedAvailability = originalAvailability;
      let reason: string | undefined;

      // Apply adjustments for very low availability
      if (originalAvailability < 0.25) {
        // Very low availability members contribute less predictably
        adjustedAvailability = originalAvailability * 0.8;
        reason = 'Reduced predictability for low availability';
      }

      adjustments.push({
        memberId: member.id,
        memberName: member.name,
        originalAvailability,
        adjustedAvailability,
        reason
      });

      totalAdjustedAvailability += adjustedAvailability;
    }

    // Average availability factor
    const factor = totalAdjustedAvailability / members.length;

    return { factor, adjustments };
  }

  /**
   * Get calibration factor from EstimationCalibrator.
   */
  private getCalibrationFactor(): number {
    if (!this.estimationCalibrator) {
      return 1.0;
    }

    // Use medium complexity band as representative
    const calibrationFactor = this.estimationCalibrator.getCalibrationFactor('medium');
    return calibrationFactor ?? 1.0;
  }

  /**
   * Build team availability details for output.
   */
  private buildTeamAvailability(
    members: TeamMember[],
    availabilityResult: { factor: number; adjustments: AvailabilityAdjustment[] }
  ): TeamAvailability {
    return {
      totalAvailability: availabilityResult.factor,
      memberCount: members.length,
      members: members.map(m => ({
        id: m.id,
        name: m.name,
        availability: m.availability
      })),
      confidence: members.length > 0 ? 0.8 : 0.5
    };
  }

  /**
   * Calculate confidence for the capacity estimate.
   */
  private calculateConfidence(
    hasHistoricalData: boolean,
    availabilityFactor: number,
    isAutoVelocity: boolean
  ): SectionConfidence {
    const factors: ConfidenceFactors = {
      // Input completeness based on historical data availability
      inputCompleteness: hasHistoricalData ? 0.8 : (isAutoVelocity ? 0.4 : 0.6),
      // Self-assessment based on data quality
      aiSelfAssessment: hasHistoricalData ? 0.75 : 0.5,
      // Pattern match based on availability stability
      patternMatch: availabilityFactor > 0.7 ? 0.8 :
                    availabilityFactor > 0.5 ? 0.6 : 0.4
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70; // Default warning threshold

    return {
      sectionId: 'sprint-capacity',
      sectionName: 'Sprint Capacity',
      score,
      tier,
      factors,
      reasoning: this.getConfidenceReasoning(hasHistoricalData, availabilityFactor, isAutoVelocity),
      needsReview
    };
  }

  /**
   * Generate reasoning for confidence score.
   */
  private getConfidenceReasoning(
    hasHistoricalData: boolean,
    availabilityFactor: number,
    isAutoVelocity: boolean
  ): string {
    const reasons: string[] = [];

    if (hasHistoricalData) {
      reasons.push('Based on historical velocity data from 3+ sprints');
    } else if (isAutoVelocity) {
      reasons.push('Limited historical data - using estimated velocity');
    } else {
      reasons.push('Using provided velocity value');
    }

    if (availabilityFactor >= 0.8) {
      reasons.push('High team availability');
    } else if (availabilityFactor >= 0.5) {
      reasons.push('Moderate team availability');
    } else {
      reasons.push('Low team availability increases uncertainty');
    }

    return reasons.join('. ');
  }

  /**
   * Generate reasoning for buffer percentage.
   */
  private getBufferReasoning(bufferPercentage: number, hasHistoricalData: boolean): string {
    const bufferPercent = Math.round(bufferPercentage * 100);

    if (bufferPercent <= 15) {
      return `Conservative ${bufferPercent}% buffer - consider increasing for sustainability`;
    } else if (bufferPercent <= 25) {
      return `Standard ${bufferPercent}% buffer for unexpected work and sustainable pace`;
    } else {
      return `Higher ${bufferPercent}% buffer - accounts for uncertainty or known risks`;
    }
  }

  /**
   * Get recommended buffer based on historical variance.
   */
  getRecommendedBuffer(historicalSprints: SprintMetrics[]): number {
    if (historicalSprints.length < 3) {
      return this.defaultBuffer;
    }

    // Calculate variance in completion rates
    const completionRates = historicalSprints.map(s =>
      s.plannedPoints > 0 ? s.completedPoints / s.plannedPoints : 1
    );

    const avgCompletion = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
    const variance = completionRates.reduce((sum, rate) =>
      sum + Math.pow(rate - avgCompletion, 2), 0
    ) / completionRates.length;
    const stdDev = Math.sqrt(variance);

    // Higher variance = higher recommended buffer
    if (stdDev > 0.3) {
      return 0.30; // 30% buffer for high variance
    } else if (stdDev > 0.15) {
      return 0.25; // 25% buffer for moderate variance
    } else {
      return 0.20; // 20% buffer for stable teams
    }
  }
}
