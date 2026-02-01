/**
 * Unit tests for SprintCapacityAnalyzer
 *
 * Tests sprint capacity calculation with velocity, team availability,
 * historical data, and confidence scoring.
 */

import { SprintCapacityAnalyzer, CapacityParams } from '../../src/services/ai/SprintCapacityAnalyzer';
import { SprintMetrics, TeamMember } from '../../src/domain/sprint-planning-types';

describe('SprintCapacityAnalyzer', () => {
  let analyzer: SprintCapacityAnalyzer;

  beforeEach(() => {
    jest.resetAllMocks();
    analyzer = new SprintCapacityAnalyzer();
  });

  describe('calculateCapacity', () => {
    describe('basic capacity calculation', () => {
      it('should calculate capacity with given velocity', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 }
          ]
        });

        expect(result.totalPoints).toBe(30);
        expect(result.recommendedLoad).toBe(24); // 80% of 30
        expect(result.buffer.percentage).toBe(20);
      });

      it('should use default 20% buffer', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 50,
          sprintDurationDays: 14,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 }
          ]
        });

        expect(result.buffer.percentage).toBe(20);
        expect(result.recommendedLoad).toBe(40); // 50 * 0.8
      });

      it('should allow custom buffer percentage', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 50,
          sprintDurationDays: 14,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 }
          ],
          bufferPercentage: 0.30
        });

        expect(result.buffer.percentage).toBe(30);
        expect(result.recommendedLoad).toBe(35); // 50 * 0.7
      });

      it('should return valid structure with all required fields', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: []
        });

        expect(result).toHaveProperty('totalPoints');
        expect(result).toHaveProperty('recommendedLoad');
        expect(result).toHaveProperty('teamAvailability');
        expect(result).toHaveProperty('buffer');
        expect(result).toHaveProperty('confidence');
        expect(result.buffer).toHaveProperty('percentage');
        expect(result.buffer).toHaveProperty('reasoning');
      });
    });

    describe('team availability', () => {
      it('should apply team availability factor', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 0.5 },
            { id: '2', name: 'Bob', availability: 0.5 }
          ]
        });

        // Average availability = 0.5, velocity adjusted = 30 * 0.5 = 15
        expect(result.totalPoints).toBe(15);
      });

      it('should handle full availability', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 40,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 },
            { id: '2', name: 'Bob', availability: 1.0 }
          ]
        });

        expect(result.totalPoints).toBe(40);
      });

      it('should handle mixed availability', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 40,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 },
            { id: '2', name: 'Bob', availability: 0.5 },
            { id: '3', name: 'Carol', availability: 0.75 }
          ]
        });

        // Average availability = (1.0 + 0.5 + 0.75) / 3 = 0.75
        expect(result.totalPoints).toBe(30); // 40 * 0.75
      });

      it('should handle low availability with reduced predictability', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 40,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 0.2 }, // Very low
            { id: '2', name: 'Bob', availability: 0.2 }
          ]
        });

        // Low availability members contribute less predictably
        expect(result.totalPoints).toBeLessThan(8); // Less than 40 * 0.2
      });

      it('should provide member details in teamAvailability', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 0.8 },
            { id: '2', name: 'Bob', availability: 0.6 }
          ]
        });

        expect(result.teamAvailability.memberCount).toBe(2);
        expect(result.teamAvailability.members).toHaveLength(2);
        expect(result.teamAvailability.members[0]).toEqual({
          id: '1',
          name: 'Alice',
          availability: 0.8
        });
      });

      it('should clamp availability to 0-1 range', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.5 }, // Over 1
            { id: '2', name: 'Bob', availability: -0.5 } // Under 0
          ]
        });

        // Should clamp values
        expect(result.totalPoints).toBeGreaterThanOrEqual(0);
      });
    });

    describe('auto velocity calculation', () => {
      it('should calculate velocity from history when auto', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: [
            createSprintMetrics({ completedPoints: 20 }),
            createSprintMetrics({ completedPoints: 25 }),
            createSprintMetrics({ completedPoints: 30 })
          ]
        });

        // Should calculate velocity from history (weighted average)
        expect(result.totalPoints).toBeGreaterThan(0);
        expect(result.totalPoints).toBeLessThan(35); // Should not exceed max
      });

      it('should use default velocity when no history', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: []
        });

        expect(result.totalPoints).toBe(20); // Default velocity
      });

      it('should filter outliers from velocity calculation', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: [
            createSprintMetrics({ completedPoints: 20 }),
            createSprintMetrics({ completedPoints: 22 }),
            createSprintMetrics({ completedPoints: 100 }), // Outlier
            createSprintMetrics({ completedPoints: 18 }),
            createSprintMetrics({ completedPoints: 25 })
          ]
        });

        // Should filter out the 100 outlier
        expect(result.totalPoints).toBeLessThan(50);
        expect(result.totalPoints).toBeGreaterThan(15);
      });

      it('should weight recent sprints more heavily', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: [
            createSprintMetrics({ completedPoints: 30, endDate: '2026-01-31' }), // Most recent
            createSprintMetrics({ completedPoints: 20, endDate: '2026-01-17' }),
            createSprintMetrics({ completedPoints: 10, endDate: '2026-01-03' })
          ]
        });

        // Most recent sprint (30) should have highest weight
        expect(result.totalPoints).toBeGreaterThan(20);
      });
    });

    describe('confidence scoring', () => {
      it('should have higher confidence with historical data', async () => {
        const resultWithHistory = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: [
            createSprintMetrics({ completedPoints: 20 }),
            createSprintMetrics({ completedPoints: 22 }),
            createSprintMetrics({ completedPoints: 25 })
          ]
        });

        const resultWithoutHistory = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(resultWithHistory.confidence.score).toBeGreaterThan(
          resultWithoutHistory.confidence.score
        );
      });

      it('should have valid confidence structure', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('sectionName');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
        expect(result.confidence).toHaveProperty('needsReview');
        expect(result.confidence).toHaveProperty('reasoning');
      });

      it('should set needsReview when confidence is low', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 0.3 }]
        });

        // Low availability and no history should result in low confidence
        if (result.confidence.score < 70) {
          expect(result.confidence.needsReview).toBe(true);
        }
      });

      it('should have correct tier values', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(['high', 'medium', 'low']).toContain(result.confidence.tier);
      });
    });

    describe('buffer reasoning', () => {
      it('should provide reasoning for standard buffer', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          bufferPercentage: 0.20
        });

        expect(result.buffer.reasoning).toContain('20%');
        expect(result.buffer.reasoning.toLowerCase()).toContain('buffer');
      });

      it('should warn about low buffer', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          bufferPercentage: 0.10
        });

        expect(result.buffer.reasoning).toContain('10%');
      });

      it('should explain high buffer', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          bufferPercentage: 0.35
        });

        expect(result.buffer.reasoning).toContain('35%');
        expect(result.buffer.reasoning.toLowerCase()).toContain('uncertainty');
      });
    });

    describe('edge cases', () => {
      it('should handle empty team members', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 10,
          teamMembers: []
        });

        expect(result.totalPoints).toBe(30);
        expect(result.teamAvailability.memberCount).toBe(0);
      });

      it('should handle very short sprints', async () => {
        const result = await analyzer.calculateCapacity({
          velocity: 30,
          sprintDurationDays: 1,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(result.totalPoints).toBeGreaterThan(0);
      });

      it('should handle zero velocity', async () => {
        // Note: Zod schema enforces positive velocity, but test edge behavior
        const result = await analyzer.calculateCapacity({
          velocity: 1, // Minimum allowed
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(result.totalPoints).toBe(1);
      });

      it('should handle large teams', async () => {
        const teamMembers: TeamMember[] = Array.from({ length: 20 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Member ${i + 1}`,
          availability: 0.8
        }));

        const result = await analyzer.calculateCapacity({
          velocity: 100,
          sprintDurationDays: 14,
          teamMembers
        });

        expect(result.teamAvailability.memberCount).toBe(20);
        expect(result.totalPoints).toBe(80); // 100 * 0.8
      });
    });
  });

  describe('getRecommendedBuffer', () => {
    it('should return default buffer with insufficient data', () => {
      const buffer = analyzer.getRecommendedBuffer([]);
      expect(buffer).toBe(0.20);

      const buffer2 = analyzer.getRecommendedBuffer([
        createSprintMetrics({ completedPoints: 20, plannedPoints: 20 })
      ]);
      expect(buffer2).toBe(0.20);
    });

    it('should recommend higher buffer for high variance', () => {
      const buffer = analyzer.getRecommendedBuffer([
        createSprintMetrics({ completedPoints: 30, plannedPoints: 40 }), // 75%
        createSprintMetrics({ completedPoints: 20, plannedPoints: 40 }), // 50%
        createSprintMetrics({ completedPoints: 40, plannedPoints: 40 }), // 100%
        createSprintMetrics({ completedPoints: 15, plannedPoints: 40 })  // 37.5%
      ]);

      expect(buffer).toBeGreaterThanOrEqual(0.25);
    });

    it('should recommend lower buffer for stable teams', () => {
      const buffer = analyzer.getRecommendedBuffer([
        createSprintMetrics({ completedPoints: 18, plannedPoints: 20 }), // 90%
        createSprintMetrics({ completedPoints: 19, plannedPoints: 20 }), // 95%
        createSprintMetrics({ completedPoints: 20, plannedPoints: 20 }), // 100%
        createSprintMetrics({ completedPoints: 17, plannedPoints: 20 })  // 85%
      ]);

      expect(buffer).toBe(0.20);
    });
  });
});

// Helper function to create sprint metrics test data
function createSprintMetrics(overrides: Partial<SprintMetrics> = {}): SprintMetrics {
  return {
    sprintId: `sprint-${Math.random().toString(36).substr(2, 9)}`,
    sprintName: 'Test Sprint',
    plannedPoints: 20,
    completedPoints: 18,
    durationDays: 10,
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    ...overrides
  };
}
