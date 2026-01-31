import { TaskComplexity } from '../domain/ai-types';

/**
 * Estimation record for tracking accuracy
 */
export interface EstimationRecord {
  taskId: string;
  title: string;
  estimatedPoints: number;
  actualPoints?: number;
  complexityBand: 'low' | 'medium' | 'high';
  estimatedAt: string;
  completedAt?: string;
  tags?: string[];
}

/**
 * Effort estimate with confidence
 */
export interface EffortEstimate {
  points: number;              // Story points (Fibonacci: 1, 2, 3, 5, 8, 13)
  range: {
    low: number;               // Optimistic estimate
    high: number;              // Pessimistic estimate
  };
  confidence: number;          // 0-100 confidence in the estimate
  calibrated: boolean;         // Whether calibration was applied
  calibrationFactor?: number;  // Factor applied if calibrated
  reasoning?: string;
}

/**
 * Complexity band determination
 */
export function getComplexityBand(complexity: TaskComplexity): 'low' | 'medium' | 'high' {
  if (complexity <= 3) return 'low';
  if (complexity <= 6) return 'medium';
  return 'high';
}

/**
 * Map complexity to base story points
 */
export function complexityToPoints(complexity: TaskComplexity): number {
  // Fibonacci-like mapping
  const mapping: Record<TaskComplexity, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 3,
    5: 5,
    6: 5,
    7: 8,
    8: 8,
    9: 13,
    10: 13
  };
  return mapping[complexity];
}

/**
 * Calculate estimate range based on complexity
 */
export function calculateRange(
  basePoints: number,
  complexity: TaskComplexity
): { low: number; high: number } {
  // Higher complexity = wider range
  const varianceFactor = 1 + (complexity / 10);

  return {
    low: Math.max(1, Math.round(basePoints / varianceFactor)),
    high: Math.round(basePoints * varianceFactor)
  };
}

/**
 * Estimation calibrator with historical accuracy tracking
 */
export class EstimationCalibrator {
  private records: EstimationRecord[] = [];
  private calibrationFactors: Map<string, number> = new Map();

  constructor(historicalRecords?: EstimationRecord[]) {
    if (historicalRecords) {
      this.records = [...historicalRecords];
      this.recalculateFactors();
    }
  }

  /**
   * Record a new estimate
   */
  recordEstimate(params: {
    taskId: string;
    title: string;
    estimatedPoints: number;
    complexity: TaskComplexity;
    tags?: string[];
  }): EstimationRecord {
    const record: EstimationRecord = {
      taskId: params.taskId,
      title: params.title,
      estimatedPoints: params.estimatedPoints,
      complexityBand: getComplexityBand(params.complexity),
      estimatedAt: new Date().toISOString(),
      tags: params.tags
    };

    this.records.push(record);
    return record;
  }

  /**
   * Record actual effort after task completion
   */
  recordActual(taskId: string, actualPoints: number): boolean {
    const record = this.records.find(r => r.taskId === taskId);
    if (!record) return false;

    record.actualPoints = actualPoints;
    record.completedAt = new Date().toISOString();

    // Recalculate calibration factors
    this.recalculateFactors();
    return true;
  }

  /**
   * Recalculate calibration factors from completed records
   */
  private recalculateFactors(): void {
    const bands: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    for (const band of bands) {
      const completed = this.records.filter(
        r => r.actualPoints !== undefined && r.complexityBand === band
      );

      if (completed.length >= 3) {
        // Need at least 3 data points for meaningful calibration
        const ratios = completed.map(r => r.actualPoints! / r.estimatedPoints);

        // Use median ratio to avoid outlier influence
        ratios.sort((a, b) => a - b);
        const medianIndex = Math.floor(ratios.length / 2);
        const medianRatio = ratios.length % 2 === 0
          ? (ratios[medianIndex - 1] + ratios[medianIndex]) / 2
          : ratios[medianIndex];

        this.calibrationFactors.set(band, medianRatio);
      }
    }
  }

  /**
   * Get calibration factor for a complexity band
   */
  getCalibrationFactor(band: 'low' | 'medium' | 'high'): number | null {
    return this.calibrationFactors.get(band) ?? null;
  }

  /**
   * Generate calibrated effort estimate
   */
  estimate(params: {
    complexity: TaskComplexity;
    title?: string;
    description?: string;
    tags?: string[];
  }): EffortEstimate {
    const basePoints = complexityToPoints(params.complexity);
    const band = getComplexityBand(params.complexity);
    const calibrationFactor = this.calibrationFactors.get(band);

    let finalPoints = basePoints;
    let calibrated = false;

    if (calibrationFactor) {
      finalPoints = Math.round(basePoints * calibrationFactor);
      // Clamp to Fibonacci sequence
      finalPoints = this.clampToFibonacci(finalPoints);
      calibrated = true;
    }

    const range = calculateRange(finalPoints, params.complexity);

    // Calculate confidence based on:
    // 1. How much historical data we have
    // 2. How consistent the calibration has been
    const confidence = this.calculateConfidence(band);

    return {
      points: finalPoints,
      range,
      confidence,
      calibrated,
      calibrationFactor,
      reasoning: this.generateReasoning(params.complexity, calibrated, calibrationFactor)
    };
  }

  /**
   * Clamp value to nearest Fibonacci number
   */
  private clampToFibonacci(value: number): number {
    const fibonacci = [1, 2, 3, 5, 8, 13, 21];
    let closest = fibonacci[0];
    let minDiff = Math.abs(value - closest);

    for (const fib of fibonacci) {
      const diff = Math.abs(value - fib);
      if (diff < minDiff) {
        minDiff = diff;
        closest = fib;
      }
    }

    return closest;
  }

  /**
   * Calculate confidence in estimates for a complexity band
   */
  private calculateConfidence(band: 'low' | 'medium' | 'high'): number {
    const completed = this.records.filter(
      r => r.actualPoints !== undefined && r.complexityBand === band
    );

    if (completed.length === 0) return 50;  // No data = 50% confidence
    if (completed.length < 3) return 60;    // Limited data = 60% confidence
    if (completed.length < 10) return 75;   // Some data = 75% confidence

    // Calculate variance in estimate accuracy
    const ratios = completed.map(r => r.actualPoints! / r.estimatedPoints);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance = ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    // Perfect accuracy (stdDev = 0) = 95% confidence
    // High variance (stdDev > 1) = 60% confidence
    const confidenceFromVariance = Math.max(60, Math.min(95, 95 - (stdDev * 35)));

    return Math.round(confidenceFromVariance);
  }

  /**
   * Generate reasoning for the estimate
   */
  private generateReasoning(
    complexity: TaskComplexity,
    calibrated: boolean,
    factor?: number | null
  ): string {
    const band = getComplexityBand(complexity);
    const dataCount = this.records.filter(
      r => r.actualPoints !== undefined && r.complexityBand === band
    ).length;

    if (!calibrated) {
      return `Base estimate for complexity ${complexity}/10. No calibration data available.`;
    }

    const direction = factor && factor > 1 ? 'increase' : 'decrease';
    const percent = factor ? Math.round(Math.abs(factor - 1) * 100) : 0;

    return `Calibrated estimate for complexity ${complexity}/10. ` +
      `Historical data (${dataCount} tasks) suggests ${percent}% ${direction} from base.`;
  }

  /**
   * Get estimation accuracy statistics
   */
  getAccuracyStats(): {
    totalRecords: number;
    completedRecords: number;
    accuracyByBand: Record<string, {
      count: number;
      avgError: number;
      calibrationFactor: number | null;
    }>;
  } {
    const bands: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const accuracyByBand: Record<string, { count: number; avgError: number; calibrationFactor: number | null }> = {};

    for (const band of bands) {
      const completed = this.records.filter(
        r => r.actualPoints !== undefined && r.complexityBand === band
      );

      if (completed.length === 0) {
        accuracyByBand[band] = { count: 0, avgError: 0, calibrationFactor: null };
        continue;
      }

      const errors = completed.map(r =>
        Math.abs(r.actualPoints! - r.estimatedPoints) / r.estimatedPoints
      );
      const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;

      accuracyByBand[band] = {
        count: completed.length,
        avgError: Math.round(avgError * 100) / 100,
        calibrationFactor: this.calibrationFactors.get(band) ?? null
      };
    }

    return {
      totalRecords: this.records.length,
      completedRecords: this.records.filter(r => r.actualPoints !== undefined).length,
      accuracyByBand
    };
  }

  /**
   * Export records for persistence
   */
  exportRecords(): EstimationRecord[] {
    return [...this.records];
  }

  /**
   * Import records from persistence
   */
  importRecords(records: EstimationRecord[]): void {
    this.records = [...records];
    this.recalculateFactors();
  }
}
