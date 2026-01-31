import {
  EstimationCalibrator,
  getComplexityBand,
  complexityToPoints,
  calculateRange,
  EstimationRecord
} from '../../src/analysis/EstimationCalibrator';
import { TaskComplexity } from '../../src/domain/ai-types';

describe('EstimationCalibrator helpers', () => {
  describe('getComplexityBand', () => {
    it('returns low for complexity 1-3', () => {
      expect(getComplexityBand(1)).toBe('low');
      expect(getComplexityBand(2)).toBe('low');
      expect(getComplexityBand(3)).toBe('low');
    });

    it('returns medium for complexity 4-6', () => {
      expect(getComplexityBand(4)).toBe('medium');
      expect(getComplexityBand(5)).toBe('medium');
      expect(getComplexityBand(6)).toBe('medium');
    });

    it('returns high for complexity 7-10', () => {
      expect(getComplexityBand(7)).toBe('high');
      expect(getComplexityBand(8)).toBe('high');
      expect(getComplexityBand(9)).toBe('high');
      expect(getComplexityBand(10)).toBe('high');
    });
  });

  describe('complexityToPoints', () => {
    it('maps complexity to Fibonacci-like points', () => {
      expect(complexityToPoints(1)).toBe(1);
      expect(complexityToPoints(3)).toBe(2);
      expect(complexityToPoints(5)).toBe(5);
      expect(complexityToPoints(7)).toBe(8);
      expect(complexityToPoints(10)).toBe(13);
    });

    it('maps all complexity levels', () => {
      const allComplexities: TaskComplexity[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      for (const c of allComplexities) {
        const points = complexityToPoints(c);
        expect(points).toBeGreaterThanOrEqual(1);
        expect(points).toBeLessThanOrEqual(13);
      }
    });

    it('returns consistent results', () => {
      expect(complexityToPoints(5)).toBe(complexityToPoints(5));
    });
  });

  describe('calculateRange', () => {
    it('returns low and high range', () => {
      const range = calculateRange(5, 5 as TaskComplexity);

      expect(range.low).toBeLessThanOrEqual(5);
      expect(range.high).toBeGreaterThanOrEqual(5);
    });

    it('widens range for higher complexity', () => {
      const lowComplexRange = calculateRange(5, 2 as TaskComplexity);
      const highComplexRange = calculateRange(5, 9 as TaskComplexity);

      const lowWidth = lowComplexRange.high - lowComplexRange.low;
      const highWidth = highComplexRange.high - highComplexRange.low;

      expect(highWidth).toBeGreaterThan(lowWidth);
    });

    it('never returns negative low', () => {
      const range = calculateRange(1, 10 as TaskComplexity);
      expect(range.low).toBeGreaterThanOrEqual(1);
    });

    it('rounds to integers', () => {
      const range = calculateRange(3, 5 as TaskComplexity);
      expect(Number.isInteger(range.low)).toBe(true);
      expect(Number.isInteger(range.high)).toBe(true);
    });
  });
});

describe('EstimationCalibrator', () => {
  let calibrator: EstimationCalibrator;

  beforeEach(() => {
    calibrator = new EstimationCalibrator();
  });

  describe('recordEstimate', () => {
    it('records estimate and returns record', () => {
      const record = calibrator.recordEstimate({
        taskId: 'task-1',
        title: 'Test Task',
        estimatedPoints: 5,
        complexity: 5 as TaskComplexity
      });

      expect(record.taskId).toBe('task-1');
      expect(record.estimatedPoints).toBe(5);
      expect(record.complexityBand).toBe('medium');
      expect(record.estimatedAt).toBeDefined();
    });

    it('includes tags when provided', () => {
      const record = calibrator.recordEstimate({
        taskId: 'task-1',
        title: 'Test',
        estimatedPoints: 3,
        complexity: 3 as TaskComplexity,
        tags: ['backend', 'api']
      });

      expect(record.tags).toEqual(['backend', 'api']);
    });

    it('sets correct complexity band', () => {
      const lowRecord = calibrator.recordEstimate({
        taskId: 't1',
        title: 'Low',
        estimatedPoints: 2,
        complexity: 2 as TaskComplexity
      });
      expect(lowRecord.complexityBand).toBe('low');

      const highRecord = calibrator.recordEstimate({
        taskId: 't2',
        title: 'High',
        estimatedPoints: 8,
        complexity: 8 as TaskComplexity
      });
      expect(highRecord.complexityBand).toBe('high');
    });
  });

  describe('recordActual', () => {
    it('updates record with actual points', () => {
      calibrator.recordEstimate({
        taskId: 'task-1',
        title: 'Test',
        estimatedPoints: 5,
        complexity: 5 as TaskComplexity
      });

      const updated = calibrator.recordActual('task-1', 8);

      expect(updated).toBe(true);
    });

    it('returns false for unknown task', () => {
      const result = calibrator.recordActual('unknown', 5);
      expect(result).toBe(false);
    });

    it('sets completedAt timestamp', () => {
      calibrator.recordEstimate({
        taskId: 'task-1',
        title: 'Test',
        estimatedPoints: 5,
        complexity: 5 as TaskComplexity
      });

      calibrator.recordActual('task-1', 8);

      const records = calibrator.exportRecords();
      const record = records.find(r => r.taskId === 'task-1');
      expect(record?.completedAt).toBeDefined();
    });
  });

  describe('estimate', () => {
    it('returns uncalibrated estimate without historical data', () => {
      const estimate = calibrator.estimate({
        complexity: 5 as TaskComplexity,
        title: 'Test Task'
      });

      expect(estimate.points).toBe(5); // Base points for complexity 5
      expect(estimate.calibrated).toBe(false);
      expect(estimate.range.low).toBeLessThanOrEqual(estimate.points);
      expect(estimate.range.high).toBeGreaterThanOrEqual(estimate.points);
    });

    it('applies calibration with sufficient data', () => {
      // Add 5 completed tasks with consistent underestimation
      for (let i = 0; i < 5; i++) {
        calibrator.recordEstimate({
          taskId: `task-${i}`,
          title: 'Test',
          estimatedPoints: 5,
          complexity: 5 as TaskComplexity
        });
        calibrator.recordActual(`task-${i}`, 10); // Actual is 2x estimate
      }

      const estimate = calibrator.estimate({
        complexity: 5 as TaskComplexity
      });

      expect(estimate.calibrated).toBe(true);
      expect(estimate.calibrationFactor).toBeGreaterThan(1);
      expect(estimate.points).toBeGreaterThan(5); // Should be adjusted up
    });

    it('includes reasoning in estimate', () => {
      const estimate = calibrator.estimate({
        complexity: 7 as TaskComplexity,
        title: 'Complex Task'
      });

      expect(estimate.reasoning).toBeDefined();
      expect(estimate.reasoning!.length).toBeGreaterThan(0);
    });

    it('includes confidence in estimate', () => {
      const estimate = calibrator.estimate({
        complexity: 5 as TaskComplexity
      });

      expect(estimate.confidence).toBeGreaterThanOrEqual(0);
      expect(estimate.confidence).toBeLessThanOrEqual(100);
    });

    it('increases confidence with more data', () => {
      const noDataEstimate = calibrator.estimate({
        complexity: 5 as TaskComplexity
      });

      // Add data
      for (let i = 0; i < 10; i++) {
        calibrator.recordEstimate({
          taskId: `task-${i}`,
          title: 'Test',
          estimatedPoints: 5,
          complexity: 5 as TaskComplexity
        });
        calibrator.recordActual(`task-${i}`, 5); // Perfect accuracy
      }

      const withDataEstimate = calibrator.estimate({
        complexity: 5 as TaskComplexity
      });

      expect(withDataEstimate.confidence).toBeGreaterThanOrEqual(noDataEstimate.confidence);
    });
  });

  describe('getCalibrationFactor', () => {
    it('returns null without sufficient data', () => {
      const factor = calibrator.getCalibrationFactor('medium');
      expect(factor).toBeNull();
    });

    it('returns factor with sufficient data', () => {
      for (let i = 0; i < 5; i++) {
        calibrator.recordEstimate({
          taskId: `task-${i}`,
          title: 'Test',
          estimatedPoints: 5,
          complexity: 5 as TaskComplexity
        });
        calibrator.recordActual(`task-${i}`, 5); // Perfect accuracy
      }

      const factor = calibrator.getCalibrationFactor('medium');
      expect(factor).toBeCloseTo(1.0, 1);
    });

    it('requires at least 3 data points', () => {
      // Add only 2 records
      for (let i = 0; i < 2; i++) {
        calibrator.recordEstimate({
          taskId: `task-${i}`,
          title: 'Test',
          estimatedPoints: 5,
          complexity: 5 as TaskComplexity
        });
        calibrator.recordActual(`task-${i}`, 5);
      }

      const factor = calibrator.getCalibrationFactor('medium');
      expect(factor).toBeNull();
    });

    it('calculates factor per complexity band', () => {
      // Add low complexity data
      for (let i = 0; i < 5; i++) {
        calibrator.recordEstimate({
          taskId: `low-${i}`,
          title: 'Low',
          estimatedPoints: 2,
          complexity: 2 as TaskComplexity
        });
        calibrator.recordActual(`low-${i}`, 4);
      }

      // Add high complexity data
      for (let i = 0; i < 5; i++) {
        calibrator.recordEstimate({
          taskId: `high-${i}`,
          title: 'High',
          estimatedPoints: 8,
          complexity: 8 as TaskComplexity
        });
        calibrator.recordActual(`high-${i}`, 8);
      }

      const lowFactor = calibrator.getCalibrationFactor('low');
      const highFactor = calibrator.getCalibrationFactor('high');

      expect(lowFactor).not.toBe(highFactor);
      expect(lowFactor).toBeCloseTo(2.0, 1);
      expect(highFactor).toBeCloseTo(1.0, 1);
    });
  });

  describe('getAccuracyStats', () => {
    it('returns statistics for all bands', () => {
      calibrator.recordEstimate({
        taskId: 't1',
        title: 'Low',
        estimatedPoints: 2,
        complexity: 2 as TaskComplexity
      });
      calibrator.recordActual('t1', 3);

      const stats = calibrator.getAccuracyStats();

      expect(stats.totalRecords).toBe(1);
      expect(stats.completedRecords).toBe(1);
      expect(stats.accuracyByBand).toHaveProperty('low');
      expect(stats.accuracyByBand).toHaveProperty('medium');
      expect(stats.accuracyByBand).toHaveProperty('high');
    });

    it('calculates average error', () => {
      calibrator.recordEstimate({
        taskId: 't1',
        title: 'Test',
        estimatedPoints: 5,
        complexity: 5 as TaskComplexity
      });
      calibrator.recordActual('t1', 10); // 100% error

      const stats = calibrator.getAccuracyStats();
      expect(stats.accuracyByBand.medium.avgError).toBe(1); // 100% = 1.0
    });

    it('handles zero records', () => {
      const stats = calibrator.getAccuracyStats();
      expect(stats.totalRecords).toBe(0);
      expect(stats.completedRecords).toBe(0);
    });
  });

  describe('import/export', () => {
    it('exports and imports records', () => {
      calibrator.recordEstimate({
        taskId: 't1',
        title: 'Test',
        estimatedPoints: 5,
        complexity: 5 as TaskComplexity
      });

      const exported = calibrator.exportRecords();
      expect(exported.length).toBe(1);

      const newCalibrator = new EstimationCalibrator();
      newCalibrator.importRecords(exported);

      const stats = newCalibrator.getAccuracyStats();
      expect(stats.totalRecords).toBe(1);
    });

    it('recalculates factors on import', () => {
      const records: EstimationRecord[] = [];
      for (let i = 0; i < 5; i++) {
        records.push({
          taskId: `t${i}`,
          title: 'Test',
          estimatedPoints: 5,
          actualPoints: 10,
          complexityBand: 'medium',
          estimatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
      }

      calibrator.importRecords(records);

      const factor = calibrator.getCalibrationFactor('medium');
      expect(factor).toBeCloseTo(2.0, 1); // Actual was 2x estimate
    });

    it('replaces existing records on import', () => {
      calibrator.recordEstimate({
        taskId: 't1',
        title: 'Existing',
        estimatedPoints: 3,
        complexity: 3 as TaskComplexity
      });

      calibrator.importRecords([{
        taskId: 'new',
        title: 'New',
        estimatedPoints: 5,
        complexityBand: 'medium',
        estimatedAt: new Date().toISOString()
      }]);

      const stats = calibrator.getAccuracyStats();
      expect(stats.totalRecords).toBe(1);

      const exported = calibrator.exportRecords();
      expect(exported[0].taskId).toBe('new');
    });
  });

  describe('constructor with historical records', () => {
    it('initializes with historical data', () => {
      const records: EstimationRecord[] = [
        {
          taskId: 't1',
          title: 'Test',
          estimatedPoints: 5,
          actualPoints: 5,
          complexityBand: 'medium',
          estimatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      ];

      const newCalibrator = new EstimationCalibrator(records);
      const stats = newCalibrator.getAccuracyStats();

      expect(stats.totalRecords).toBe(1);
    });

    it('calculates calibration factors from historical data', () => {
      const records: EstimationRecord[] = [];
      for (let i = 0; i < 5; i++) {
        records.push({
          taskId: `t${i}`,
          title: 'Test',
          estimatedPoints: 5,
          actualPoints: 7,
          complexityBand: 'medium',
          estimatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
      }

      const newCalibrator = new EstimationCalibrator(records);
      const factor = newCalibrator.getCalibrationFactor('medium');

      expect(factor).toBeCloseTo(1.4, 1);
    });
  });
});
