import { MilestoneMetrics } from '../../../../domain/value-objects/MilestoneMetrics';
import { ResourceStatus } from '../../../../domain/resource-types';

describe('MilestoneMetrics Value Object', () => {
  const baseConfig = {
    milestoneId: 'milestone-1',
    title: 'v1.0 Release',
    dueDate: '2024-02-01',
    totalIssues: 20,
    closedIssues: 15,
    status: ResourceStatus.ACTIVE,
  };

  describe('creation', () => {
    it('should create a MilestoneMetrics instance', () => {
      const metrics = MilestoneMetrics.create(baseConfig);

      expect(metrics).toBeInstanceOf(MilestoneMetrics);
      expect(metrics.milestoneId).toBe('milestone-1');
      expect(metrics.title).toBe('v1.0 Release');
      expect(metrics.totalIssues).toBe(20);
      expect(metrics.closedIssues).toBe(15);
    });

    it('should throw error if totalIssues is negative', () => {
      expect(() =>
        MilestoneMetrics.create({ ...baseConfig, totalIssues: -1 })
      ).toThrow('totalIssues cannot be negative');
    });

    it('should throw error if closedIssues is negative', () => {
      expect(() =>
        MilestoneMetrics.create({ ...baseConfig, closedIssues: -1 })
      ).toThrow('closedIssues cannot be negative');
    });

    it('should throw error if closedIssues exceeds totalIssues', () => {
      expect(() =>
        MilestoneMetrics.create({ ...baseConfig, closedIssues: 25 })
      ).toThrow('closedIssues cannot exceed totalIssues');
    });
  });

  describe('computed properties', () => {
    it('should calculate openIssues', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.openIssues).toBe(5);
    });

    it('should calculate completionPercentage', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.completionPercentage).toBe(75);
    });

    it('should return 0% completion when no issues', () => {
      const metrics = MilestoneMetrics.create({
        ...baseConfig,
        totalIssues: 0,
        closedIssues: 0,
      });
      expect(metrics.completionPercentage).toBe(0);
    });

    it('should indicate hasDueDate when dueDate is set', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.hasDueDate).toBe(true);
    });

    it('should indicate no dueDate when dueDate is null', () => {
      const metrics = MilestoneMetrics.create({
        ...baseConfig,
        dueDate: null,
      });
      expect(metrics.hasDueDate).toBe(false);
    });

    it('should calculate isOverdue for past due date', () => {
      const metrics = MilestoneMetrics.create({
        ...baseConfig,
        dueDate: '2024-01-01', // Past date
      });
      expect(metrics.isOverdue).toBe(true);
    });

    it('should not be overdue when completed', () => {
      const metrics = MilestoneMetrics.create({
        ...baseConfig,
        dueDate: '2024-01-01',
        status: ResourceStatus.COMPLETED,
      });
      expect(metrics.isOverdue).toBe(false);
    });

    it('should indicate isComplete when all issues closed', () => {
      const metrics = MilestoneMetrics.create({
        ...baseConfig,
        closedIssues: 20,
      });
      expect(metrics.isComplete).toBe(true);
    });

    it('should not be complete when some issues open', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.isComplete).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should be frozen', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(Object.isFrozen(metrics)).toBe(true);
    });

    it('should not allow modification of properties', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(() => {
        (metrics as any).title = 'Modified';
      }).toThrow();
    });
  });

  describe('equality', () => {
    it('should be equal to another MilestoneMetrics with same values', () => {
      const metrics1 = MilestoneMetrics.create(baseConfig);
      const metrics2 = MilestoneMetrics.create(baseConfig);

      expect(metrics1.equals(metrics2)).toBe(true);
    });

    it('should not be equal to another MilestoneMetrics with different values', () => {
      const metrics1 = MilestoneMetrics.create(baseConfig);
      const metrics2 = MilestoneMetrics.create({ ...baseConfig, title: 'Different' });

      expect(metrics1.equals(metrics2)).toBe(false);
    });

    it('should not be equal to a non-MilestoneMetrics object', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.equals({ milestoneId: 'milestone-1' } as any)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to plain object', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      const data = metrics.toData();

      expect(data).toEqual({
        milestoneId: 'milestone-1',
        title: 'v1.0 Release',
        dueDate: '2024-02-01',
        totalIssues: 20,
        closedIssues: 15,
        openIssues: 5,
        completionPercentage: 75,
        status: ResourceStatus.ACTIVE,
        hasDueDate: true,
        isOverdue: expect.any(Boolean),
        daysUntilDue: expect.any(Number),
        isAtRisk: expect.any(Boolean),
        isComplete: false,
      });
    });

    it('should create string representation', () => {
      const metrics = MilestoneMetrics.create(baseConfig);
      expect(metrics.toString()).toContain('v1.0 Release');
      expect(metrics.toString()).toContain('75%');
    });
  });
});
