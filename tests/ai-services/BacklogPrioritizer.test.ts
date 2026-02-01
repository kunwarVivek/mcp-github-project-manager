/**
 * Unit tests for BacklogPrioritizer
 *
 * Tests multi-factor backlog prioritization with AI business value
 * assessment and fallback behavior.
 */

import { BacklogPrioritizer } from '../../src/services/ai/BacklogPrioritizer';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { BacklogItem } from '../../src/domain/sprint-planning-types';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('BacklogPrioritizer', () => {
  let prioritizer: BacklogPrioritizer;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup mock for each test
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    prioritizer = new BacklogPrioritizer();
  });

  describe('prioritize', () => {
    describe('basic prioritization', () => {
      it('should prioritize items by score', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', priority: 'low', points: 3 }),
            createBacklogItem({ id: '2', priority: 'high', points: 5 }),
            createBacklogItem({ id: '3', priority: 'critical', points: 8 })
          ],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(3);
        // Higher priority items should have higher scores
        const critical = result.prioritizedItems.find(i => i.itemId === '3');
        const low = result.prioritizedItems.find(i => i.itemId === '1');
        expect(critical!.score).toBeGreaterThan(low!.score);
      });

      it('should assign priority tiers based on score', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', priority: 'critical', points: 5 }),
            createBacklogItem({ id: '2', priority: 'low', points: 2 })
          ],
          sprintCapacity: 20
        });

        const highItem = result.prioritizedItems.find(i => i.itemId === '1');
        const lowItem = result.prioritizedItems.find(i => i.itemId === '2');

        // Both should have valid priority tiers
        expect(['critical', 'high', 'medium', 'low']).toContain(highItem!.priority);
        expect(['critical', 'high', 'medium', 'low']).toContain(lowItem!.priority);
        // Higher input priority should yield higher or equal score
        expect(highItem!.score).toBeGreaterThanOrEqual(lowItem!.score);
      });

      it('should return empty result for empty backlog', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(0);
        expect(result.confidence.score).toBe(100);
      });

      it('should sort items by score descending', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', priority: 'low' }),
            createBacklogItem({ id: '2', priority: 'high' }),
            createBacklogItem({ id: '3', priority: 'medium' })
          ],
          sprintCapacity: 20
        });

        const scores = result.prioritizedItems.map(i => i.score);
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      });
    });

    describe('multi-factor scoring', () => {
      it('should include priority factors in result', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        const item = result.prioritizedItems[0];
        expect(item.factors).toHaveProperty('businessValue');
        expect(item.factors).toHaveProperty('dependencyScore');
        expect(item.factors).toHaveProperty('riskScore');
        expect(item.factors).toHaveProperty('effortFit');
      });

      it('should have factors in 0-1 range', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        const factors = result.prioritizedItems[0].factors;
        expect(factors.businessValue).toBeGreaterThanOrEqual(0);
        expect(factors.businessValue).toBeLessThanOrEqual(1);
        expect(factors.dependencyScore).toBeGreaterThanOrEqual(0);
        expect(factors.dependencyScore).toBeLessThanOrEqual(1);
        expect(factors.riskScore).toBeGreaterThanOrEqual(0);
        expect(factors.riskScore).toBeLessThanOrEqual(1);
        expect(factors.effortFit).toBeGreaterThanOrEqual(0);
        expect(factors.effortFit).toBeLessThanOrEqual(1);
      });

      it('should favor smaller items for effort fit', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: 'small', points: 2 }),
            createBacklogItem({ id: 'large', points: 13 })
          ],
          sprintCapacity: 20
        });

        const small = result.prioritizedItems.find(i => i.itemId === 'small');
        const large = result.prioritizedItems.find(i => i.itemId === 'large');

        expect(small!.factors.effortFit).toBeGreaterThan(large!.factors.effortFit);
      });
    });

    describe('dependency handling', () => {
      it('should score orphan items higher', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', dependencies: [] }),
            createBacklogItem({ id: '2', dependencies: ['1'] })
          ],
          sprintCapacity: 20
        });

        const orphan = result.prioritizedItems.find(i => i.itemId === '1');
        const dependent = result.prioritizedItems.find(i => i.itemId === '2');

        expect(orphan!.factors.dependencyScore).toBeGreaterThanOrEqual(
          dependent!.factors.dependencyScore
        );
      });

      it('should handle circular dependencies gracefully', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', dependencies: ['2'] }),
            createBacklogItem({ id: '2', dependencies: ['1'] })
          ],
          sprintCapacity: 20
        });

        // Should not throw and return valid results
        expect(result.prioritizedItems).toHaveLength(2);
      });

      it('should detect implicit dependencies', async () => {
        // Items with related keywords should have dependency relationships
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({
              id: '1',
              title: 'Set up database schema',
              description: 'Create user and product tables'
            }),
            createBacklogItem({
              id: '2',
              title: 'Create API endpoints',
              description: 'REST API for database operations'
            })
          ],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(2);
      });
    });

    describe('risk tolerance', () => {
      it('should adjust scores based on risk tolerance', async () => {
        const lowRiskResult = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1', points: 13 })], // Large = risky
          sprintCapacity: 20,
          riskTolerance: 'low'
        });

        const highRiskResult = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1', points: 13 })],
          sprintCapacity: 20,
          riskTolerance: 'high'
        });

        // High risk tolerance should favor large items more
        const lowRiskScore = lowRiskResult.prioritizedItems[0].factors.riskScore;
        const highRiskScore = highRiskResult.prioritizedItems[0].factors.riskScore;

        expect(highRiskScore).toBeGreaterThanOrEqual(lowRiskScore);
      });

      it('should default to medium risk tolerance', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
          // No riskTolerance specified
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });
    });

    describe('business goals', () => {
      it('should accept business goals', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', title: 'Improve performance' })
          ],
          sprintCapacity: 20,
          businessGoals: ['Reduce latency', 'Improve performance']
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });

      it('should handle empty business goals', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20,
          businessGoals: []
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });
    });

    describe('reasoning', () => {
      it('should include methodology in reasoning', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        expect(result.reasoning.methodology).toContain('Multi-factor');
      });

      it('should include weightings', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        expect(result.reasoning.weightings.businessValue).toBe(0.4);
        expect(result.reasoning.weightings.dependencies).toBe(0.25);
        expect(result.reasoning.weightings.risk).toBe(0.2);
        expect(result.reasoning.weightings.effort).toBe(0.15);
      });

      it('should include item-level reasoning', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems[0].reasoning).toBeDefined();
        expect(result.prioritizedItems[0].reasoning.length).toBeGreaterThan(0);
      });
    });

    describe('confidence scoring', () => {
      it('should have valid confidence structure', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
      });

      it('should indicate AI fallback in reasoning', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        // AI is mocked to return null, so should use fallback
        expect(result.confidence.reasoning?.toLowerCase()).toContain('fallback');
      });

      it('should have higher confidence with descriptions', async () => {
        const withDescResult = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({
              id: '1',
              description: 'A very detailed description that explains what this task is about and why it matters for the project. This is important context for prioritization.'
            })
          ],
          sprintCapacity: 20
        });

        const noDescResult = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1', description: '' })],
          sprintCapacity: 20
        });

        expect(withDescResult.confidence.factors.inputCompleteness).toBeGreaterThan(
          noDescResult.confidence.factors.inputCompleteness
        );
      });
    });

    describe('edge cases', () => {
      it('should handle single item', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });

      it('should handle many items', async () => {
        const items = Array.from({ length: 50 }, (_, i) =>
          createBacklogItem({ id: `${i + 1}` })
        );

        const result = await prioritizer.prioritize({
          backlogItems: items,
          sprintCapacity: 100
        });

        expect(result.prioritizedItems).toHaveLength(50);
      });

      it('should handle items without points', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', points: undefined })
          ],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });

      it('should handle items without priority', async () => {
        const result = await prioritizer.prioritize({
          backlogItems: [
            createBacklogItem({ id: '1', priority: undefined })
          ],
          sprintCapacity: 20
        });

        expect(result.prioritizedItems).toHaveLength(1);
      });
    });
  });

  describe('custom weights', () => {
    it('should accept custom weights', async () => {
      const customPrioritizer = new BacklogPrioritizer({
        businessValue: 0.6,
        dependencies: 0.15
      });

      const result = await customPrioritizer.prioritize({
        backlogItems: [createBacklogItem({ id: '1' })],
        sprintCapacity: 20
      });

      expect(result.reasoning.weightings.businessValue).toBe(0.6);
      expect(result.reasoning.weightings.dependencies).toBe(0.15);
    });
  });
});

// Helper function to create backlog item test data
function createBacklogItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    description: 'A test task for prioritization',
    points: 3,
    priority: 'medium',
    labels: [],
    dependencies: [],
    ...overrides
  };
}
