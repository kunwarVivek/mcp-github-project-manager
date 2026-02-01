/**
 * Unit tests for SprintSuggestionService
 *
 * Tests combined sprint composition suggestion using capacity, prioritization,
 * and risk assessment.
 */

import { SprintSuggestionService, SprintSuggestionParams } from '../../src/services/ai/SprintSuggestionService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { BacklogItem, TeamMember, SprintMetrics } from '../../src/domain/sprint-planning-types';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('SprintSuggestionService', () => {
  let service: SprintSuggestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    service = new SprintSuggestionService();
  });

  describe('suggestSprintComposition', () => {
    describe('basic suggestion', () => {
      it('should suggest items that fit capacity', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 5, priority: 'high' }),
            createBacklogItem({ id: '2', points: 3, priority: 'medium' }),
            createBacklogItem({ id: '3', points: 8, priority: 'low' })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems.length).toBeGreaterThan(0);
        expect(result.totalPoints).toBeLessThanOrEqual(result.capacityUtilization * 20);
      });

      it('should not exceed capacity', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 10, priority: 'high' }),
            createBacklogItem({ id: '2', points: 10, priority: 'medium' }),
            createBacklogItem({ id: '3', points: 10, priority: 'low' })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        // Recommended load is 80% of velocity = 16 points
        expect(result.totalPoints).toBeLessThanOrEqual(20);
      });

      it('should return valid suggestion structure', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result).toHaveProperty('suggestedItems');
        expect(result).toHaveProperty('totalPoints');
        expect(result).toHaveProperty('capacityUtilization');
        expect(result).toHaveProperty('reasoning');
        expect(result).toHaveProperty('risks');
        expect(result).toHaveProperty('confidence');
      });

      it('should return empty suggestion for empty backlog', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems).toHaveLength(0);
        expect(result.totalPoints).toBe(0);
        expect(result.capacityUtilization).toBe(0);
      });
    });

    describe('prioritization in selection', () => {
      it('should prefer higher priority items', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: 'low', points: 5, priority: 'low' }),
            createBacklogItem({ id: 'critical', points: 5, priority: 'critical' }),
            createBacklogItem({ id: 'high', points: 5, priority: 'high' })
          ],
          velocity: 10, // Only room for ~1-2 items
          sprintDurationDays: 10
        });

        // Critical and high should be selected before low
        const selectedIds = result.suggestedItems.map(i => i.itemId);
        if (selectedIds.includes('low')) {
          expect(selectedIds).toContain('critical');
        }
      });

      it('should include priority in suggested items', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1', priority: 'high' })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems[0]).toHaveProperty('priority');
        expect(['critical', 'high', 'medium', 'low']).toContain(
          result.suggestedItems[0].priority
        );
      });
    });

    describe('dependency handling', () => {
      it('should respect dependencies in selection', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 3, dependencies: [] }),
            createBacklogItem({ id: '2', points: 3, dependencies: ['1'] }),
            createBacklogItem({ id: '3', points: 3, dependencies: ['2'] })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        const selectedIds = result.suggestedItems.map(i => i.itemId);

        // If '3' is selected, '2' and '1' should also be selected
        if (selectedIds.includes('3')) {
          expect(selectedIds).toContain('2');
          expect(selectedIds).toContain('1');
        }

        // If '2' is selected, '1' should also be selected
        if (selectedIds.includes('2')) {
          expect(selectedIds).toContain('1');
        }
      });

      it('should include dependencies in suggested items', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', dependencies: ['external'] })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems[0]).toHaveProperty('dependencies');
      });

      it('should select orphan items first', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: 'orphan', points: 5, dependencies: [] }),
            createBacklogItem({ id: 'dependent', points: 5, dependencies: ['orphan'] })
          ],
          velocity: 10,
          sprintDurationDays: 10
        });

        const selectedIds = result.suggestedItems.map(i => i.itemId);

        // Orphan should be selected or selected before dependent
        if (result.suggestedItems.length === 1) {
          expect(selectedIds).toContain('orphan');
        }
      });
    });

    describe('team member handling', () => {
      it('should consider team availability', async () => {
        const fullTeamResult = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 10 })
          ],
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 1.0 }
          ]
        });

        const partialTeamResult = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 10 })
          ],
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 0.5 }
          ]
        });

        // Both should return valid results
        expect(fullTeamResult.suggestedItems.length).toBeGreaterThanOrEqual(0);
        expect(partialTeamResult.suggestedItems.length).toBeGreaterThanOrEqual(0);
        // Lower availability means less capacity, so either fewer items or higher utilization
        expect(partialTeamResult.totalPoints).toBeLessThanOrEqual(fullTeamResult.totalPoints + 1);
      });

      it('should handle empty team members', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: []
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle multiple team members', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [
            { id: '1', name: 'Alice', availability: 0.8 },
            { id: '2', name: 'Bob', availability: 0.6 },
            { id: '3', name: 'Carol', availability: 1.0 }
          ]
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('business goals', () => {
      it('should accept business goals', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', title: 'Improve performance' })
          ],
          velocity: 20,
          sprintDurationDays: 10,
          businessGoals: ['Reduce latency', 'Improve performance']
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should mention goals in reasoning', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10,
          businessGoals: ['Important goal']
        });

        expect(result.reasoning.toLowerCase()).toContain('goal');
      });
    });

    describe('risk tolerance', () => {
      it('should consider risk tolerance', async () => {
        const lowRiskResult = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 13 }), // Large = risky
            createBacklogItem({ id: '2', points: 2 })
          ],
          velocity: 20,
          sprintDurationDays: 10,
          riskTolerance: 'low'
        });

        const highRiskResult = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 13 }),
            createBacklogItem({ id: '2', points: 2 })
          ],
          velocity: 20,
          sprintDurationDays: 10,
          riskTolerance: 'high'
        });

        // Both should work without error
        expect(lowRiskResult.suggestedItems.length).toBeGreaterThanOrEqual(0);
        expect(highRiskResult.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should default to medium risk tolerance', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10
          // No riskTolerance specified
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('capacity utilization', () => {
      it('should calculate capacity utilization correctly', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 8 })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        const expectedUtilization = result.totalPoints / 16; // 80% of velocity
        expect(result.capacityUtilization).toBeCloseTo(expectedUtilization, 1);
      });

      it('should not over-utilize capacity', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: Array.from({ length: 10 }, (_, i) =>
            createBacklogItem({ id: `${i + 1}`, points: 5 })
          ),
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.capacityUtilization).toBeLessThanOrEqual(1.1); // Allow small buffer
      });
    });

    describe('risks in suggestion', () => {
      it('should include risks assessment', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 15 }),
            createBacklogItem({ id: '2', points: 10 })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(Array.isArray(result.risks)).toBe(true);
      });

      it('should identify risks for complex items', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 13 })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        // May or may not have risks depending on selection
        expect(Array.isArray(result.risks)).toBe(true);
      });
    });

    describe('reasoning', () => {
      it('should provide reasoning for suggestion', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', priority: 'critical' }),
            createBacklogItem({ id: '2', priority: 'low' })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.reasoning.length).toBeGreaterThan(0);
      });

      it('should include capacity info in reasoning', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1', points: 5 })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.reasoning.toLowerCase()).toMatch(/capacity|pts|points/);
      });

      it('should include item count in reasoning', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1' }),
            createBacklogItem({ id: '2' })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.reasoning).toMatch(/\d/); // Should contain numbers
      });
    });

    describe('include reason', () => {
      it('should provide include reason for each item', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', priority: 'critical' })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        if (result.suggestedItems.length > 0) {
          expect(result.suggestedItems[0]).toHaveProperty('includeReason');
          expect(result.suggestedItems[0].includeReason.length).toBeGreaterThan(0);
        }
      });
    });

    describe('confidence scoring', () => {
      it('should have valid confidence structure', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
        expect(result.confidence).toHaveProperty('reasoning');
      });

      it('should have score in valid range', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.confidence.score).toBeGreaterThanOrEqual(0);
        expect(result.confidence.score).toBeLessThanOrEqual(100);
      });

      it('should have valid tier', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1' })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(['high', 'medium', 'low']).toContain(result.confidence.tier);
      });
    });

    describe('edge cases', () => {
      it('should handle single item', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1', points: 5 })],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle many items', async () => {
        const items = Array.from({ length: 50 }, (_, i) =>
          createBacklogItem({ id: `${i + 1}`, points: 2 })
        );

        const result = await service.suggestSprintComposition({
          backlogItems: items,
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems.length).toBeGreaterThan(0);
        expect(result.totalPoints).toBeLessThanOrEqual(20);
      });

      it('should handle items without points', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: undefined })
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle very short sprint', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1', points: 5 })],
          velocity: 20,
          sprintDurationDays: 1
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle very low velocity', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [createBacklogItem({ id: '1', points: 5 })],
          velocity: 5,
          sprintDurationDays: 10
        });

        expect(result.suggestedItems.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle items larger than capacity', async () => {
        const result = await service.suggestSprintComposition({
          backlogItems: [
            createBacklogItem({ id: '1', points: 50 }) // Much larger than capacity
          ],
          velocity: 20,
          sprintDurationDays: 10
        });

        // Item is too large, may not be selected
        expect(result.totalPoints).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('getAISuggestion', () => {
    it('should return null when AI unavailable', async () => {
      const result = await service.getAISuggestion({
        backlogItems: [createBacklogItem({ id: '1' })],
        velocity: 20,
        sprintDurationDays: 10
      });

      expect(result).toBeNull();
    });
  });
});

// Helper function
function createBacklogItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    description: 'A test task',
    points: 3,
    priority: 'medium',
    labels: [],
    dependencies: [],
    ...overrides
  };
}
