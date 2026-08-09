import { SprintMetrics } from '../../../../domain/value-objects/SprintMetrics';
import { ResourceStatus } from '../../../../domain/resource-types';

describe('SprintMetrics Value Object', () => {
  const baseConfig = {
    sprintId: 'sprint-1',
    title: 'Sprint 1',
    startDate: '2024-01-01',
    endDate: '2024-01-14',
    totalIssues: 10,
    completedIssues: 5,
    status: ResourceStatus.ACTIVE,
  };

  describe('creation', () => {
    it('should create a SprintMetrics instance', () => {
      const metrics = SprintMetrics.create(baseConfig);

      expect(metrics).toBeInstanceOf(SprintMetrics);
      expect(metrics.sprintId).toBe('sprint-1');
      expect(metrics.title).toBe('Sprint 1');
      expect(metrics.totalIssues).toBe(10);
      expect(metrics.completedIssues).toBe(5);
    });

    it('should throw error if totalIssues is negative', () => {
      expect(() =>
        SprintMetrics.create({ ...baseConfig, totalIssues: -1 })
      ).toThrow('totalIssues cannot be negative');
    });

    it('should throw error if completedIssues is negative', () => {
      expect(() =>
        SprintMetrics.create({ ...baseConfig, completedIssues: -1 })
      ).toThrow('completedIssues cannot be negative');
    });

    it('should throw error if completedIssues exceeds totalIssues', () => {
      expect(() =>
        SprintMetrics.create({ ...baseConfig, completedIssues: 15 })
      ).toThrow('completedIssues cannot exceed totalIssues');
    });
  });

  describe('computed properties', () => {
    it('should calculate remainingIssues', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(metrics.remainingIssues).toBe(5);
    });

    it('should calculate completionPercentage', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(metrics.completionPercentage).toBe(50);
    });

    it('should return 0% completion when no issues', () => {
      const metrics = SprintMetrics.create({
        ...baseConfig,
        totalIssues: 0,
        completedIssues: 0,
      });
      expect(metrics.completionPercentage).toBe(0);
    });

    it('should calculate durationInDays', () => {
      const metrics = SprintMetrics.create(baseConfig);
      // Jan 1 to Jan 14 = 13 days difference
      expect(metrics.durationInDays).toBe(13);
    });

    it('should calculate velocity', () => {
      const metrics = SprintMetrics.create(baseConfig);
      // 5 issues / 14 days = 0.36 (rounded to 1 decimal)
      expect(metrics.velocity).toBeCloseTo(0.4, 1);
    });

    it('should return 0 velocity when duration is 0', () => {
      const metrics = SprintMetrics.create({
        ...baseConfig,
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      });
      expect(metrics.velocity).toBe(0);
    });
  });

  describe('immutability', () => {
    it('should be frozen', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(Object.isFrozen(metrics)).toBe(true);
    });

    it('should not allow modification of properties', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(() => {
        (metrics as any).title = 'Modified';
      }).toThrow();
    });
  });

  describe('equality', () => {
    it('should be equal to another SprintMetrics with same values', () => {
      const metrics1 = SprintMetrics.create(baseConfig);
      const metrics2 = SprintMetrics.create(baseConfig);

      expect(metrics1.equals(metrics2)).toBe(true);
    });

    it('should not be equal to another SprintMetrics with different values', () => {
      const metrics1 = SprintMetrics.create(baseConfig);
      const metrics2 = SprintMetrics.create({ ...baseConfig, title: 'Different' });

      expect(metrics1.equals(metrics2)).toBe(false);
    });

    it('should not be equal to a non-SprintMetrics object', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(metrics.equals({ sprintId: 'sprint-1' } as any)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to plain object', () => {
      const metrics = SprintMetrics.create(baseConfig);
      const data = metrics.toData();

      expect(data).toEqual({
        sprintId: 'sprint-1',
        title: 'Sprint 1',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        totalIssues: 10,
        completedIssues: 5,
        remainingIssues: 5,
        completionPercentage: 50,
        status: ResourceStatus.ACTIVE,
        isActive: expect.any(Boolean),
        daysRemaining: undefined, // Sprint has ended (2024-01-14 is in the past)
        durationInDays: 13,
        isOverdue: expect.any(Boolean),
        velocity: expect.any(Number),
      });
    });

    it('should create string representation', () => {
      const metrics = SprintMetrics.create(baseConfig);
      expect(metrics.toString()).toContain('Sprint 1');
      expect(metrics.toString()).toContain('50%');
    });
  });
});
