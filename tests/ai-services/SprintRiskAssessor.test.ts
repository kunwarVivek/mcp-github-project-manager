/**
 * Unit tests for SprintRiskAssessor
 *
 * Tests sprint risk identification, mitigation suggestions,
 * and fallback behavior when AI is unavailable.
 */

import { SprintRiskAssessor, RiskAssessmentParams } from '../../src/services/ai/SprintRiskAssessor';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { BacklogItem, SprintCapacity } from '../../src/domain/sprint-planning-types';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('SprintRiskAssessor', () => {
  let assessor: SprintRiskAssessor;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup mock for each test
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    assessor = new SprintRiskAssessor();
  });

  describe('assessRisks', () => {
    describe('capacity risks', () => {
      it('should identify overcommitment risk', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 15 }),
            createBacklogItem({ id: '2', points: 15 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const overcommitRisk = result.risks.find(r =>
          r.category === 'capacity' && r.title.toLowerCase().includes('overcommit')
        );

        expect(overcommitRisk).toBeDefined();
        expect(overcommitRisk!.probability).toMatch(/high|medium/);
      });

      it('should identify low buffer risk', async () => {
        // 95% utilization (19/20) triggers the > 0.9 && <= 1.0 check
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 19 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const bufferRisk = result.risks.find(r =>
          r.category === 'capacity' && r.title.toLowerCase().includes('buffer')
        );

        expect(bufferRisk).toBeDefined();
      });

      it('should not flag capacity risk when well under capacity', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 5 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const overcommitRisk = result.risks.find(r =>
          r.title.toLowerCase().includes('overcommit')
        );

        expect(overcommitRisk).toBeUndefined();
      });
    });

    describe('complexity risks', () => {
      it('should identify high-complexity items', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 13 }),
            createBacklogItem({ id: '2', points: 8 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 30 })
        });

        const complexityRisk = result.risks.find(r =>
          r.category === 'technical' && r.title.toLowerCase().includes('complex')
        );

        expect(complexityRisk).toBeDefined();
        expect(complexityRisk!.relatedItems).toContain('1');
      });

      it('should not flag complexity risk for small items', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 2 }),
            createBacklogItem({ id: '2', points: 3 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const complexityRisk = result.risks.find(r =>
          r.title.toLowerCase().includes('complex')
        );

        expect(complexityRisk).toBeUndefined();
      });
    });

    describe('dependency risks', () => {
      it('should identify high dependency concentration', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', dependencies: [] }),
            createBacklogItem({ id: '2', dependencies: ['1'] }),
            createBacklogItem({ id: '3', dependencies: ['1', '2'] }),
            createBacklogItem({ id: '4', dependencies: ['2'] })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const depRisk = result.risks.find(r =>
          r.category === 'dependency'
        );

        expect(depRisk).toBeDefined();
      });
    });

    describe('scope risks', () => {
      it('should identify unclear item definitions', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', description: '' }),
            createBacklogItem({ id: '2', description: 'Short' }),
            createBacklogItem({ id: '3', description: '' })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const scopeRisk = result.risks.find(r =>
          r.category === 'scope' && r.title.toLowerCase().includes('unclear')
        );

        expect(scopeRisk).toBeDefined();
      });

      it('should not flag scope risk for well-defined items', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({
              id: '1',
              description: 'A very detailed description that explains what this task is about, the acceptance criteria, and edge cases to consider. This provides good clarity for the team.'
            })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const scopeRisk = result.risks.find(r =>
          r.category === 'scope' && r.title.toLowerCase().includes('unclear')
        );

        expect(scopeRisk).toBeUndefined();
      });
    });

    describe('overall risk assessment', () => {
      it('should calculate overall risk level', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 5 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(['high', 'medium', 'low']).toContain(result.overallRisk);
      });

      it('should calculate risk score 0-100', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
      });

      it('should have higher risk for overcommitted sprints', async () => {
        const safeResult = await assessor.assessRisks({
          sprintItems: [createBacklogItem({ id: '1', points: 5 })],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const riskyResult = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 15 }),
            createBacklogItem({ id: '2', points: 15 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(riskyResult.riskScore).toBeGreaterThan(safeResult.riskScore);
      });
    });

    describe('mitigations', () => {
      it('should provide mitigations for identified risks', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 }) // Over capacity
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.mitigations.length).toBeGreaterThan(0);

        const mitigation = result.mitigations[0];
        expect(mitigation).toHaveProperty('riskId');
        expect(mitigation).toHaveProperty('strategy');
        expect(mitigation).toHaveProperty('action');
        expect(mitigation).toHaveProperty('effort');
        expect(mitigation).toHaveProperty('effectiveness');
      });

      it('should have valid mitigation strategies', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.mitigations.forEach(m => {
          expect(['avoid', 'mitigate', 'transfer', 'accept']).toContain(m.strategy);
        });
      });

      it('should have valid effort levels', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.mitigations.forEach(m => {
          expect(['low', 'medium', 'high']).toContain(m.effort);
        });
      });

      it('should have effectiveness in 0-1 range', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.mitigations.forEach(m => {
          expect(m.effectiveness).toBeGreaterThanOrEqual(0);
          expect(m.effectiveness).toBeLessThanOrEqual(1);
        });
      });

      it('should link mitigations to risks', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.mitigations.forEach(m => {
          const relatedRisk = result.risks.find(r => r.id === m.riskId);
          expect(relatedRisk).toBeDefined();
        });
      });
    });

    describe('confidence scoring', () => {
      it('should have valid confidence structure', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
        expect(result.confidence).toHaveProperty('reasoning');
      });

      it('should indicate fallback mode when AI unavailable', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.confidence.reasoning?.toLowerCase()).toContain('algorithm');
      });

      it('should have higher confidence with good item descriptions', async () => {
        const goodDescResult = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({
              id: '1',
              description: 'A very detailed description that explains the task, provides context, lists acceptance criteria, and identifies potential edge cases.'
            })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        const badDescResult = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', description: '' })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(goodDescResult.confidence.factors.inputCompleteness).toBeGreaterThan(
          badDescResult.confidence.factors.inputCompleteness
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty sprint', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.risks).toHaveLength(0);
        expect(result.overallRisk).toBe('low');
        expect(result.riskScore).toBe(0);
      });

      it('should handle single item', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [createBacklogItem({ id: '1' })],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.overallRisk).toBeDefined();
      });

      it('should handle items without points', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: undefined })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        expect(result.overallRisk).toBeDefined();
      });

      it('should handle many items', async () => {
        const items = Array.from({ length: 20 }, (_, i) =>
          createBacklogItem({ id: `${i + 1}`, points: 2 })
        );

        const result = await assessor.assessRisks({
          sprintItems: items,
          sprintCapacity: createCapacity({ recommendedLoad: 50 })
        });

        expect(result.risks.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('risk structure', () => {
      it('should have valid risk structure', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        if (result.risks.length > 0) {
          const risk = result.risks[0];
          expect(risk).toHaveProperty('id');
          expect(risk).toHaveProperty('category');
          expect(risk).toHaveProperty('title');
          expect(risk).toHaveProperty('description');
          expect(risk).toHaveProperty('probability');
          expect(risk).toHaveProperty('impact');
          expect(risk).toHaveProperty('relatedItems');
        }
      });

      it('should have valid risk categories', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 }),
            createBacklogItem({ id: '2', points: 13 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.risks.forEach(risk => {
          expect(['scope', 'dependency', 'capacity', 'technical', 'external']).toContain(risk.category);
        });
      });

      it('should have valid probability values', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.risks.forEach(risk => {
          expect(['high', 'medium', 'low']).toContain(risk.probability);
        });
      });

      it('should have valid impact values', async () => {
        const result = await assessor.assessRisks({
          sprintItems: [
            createBacklogItem({ id: '1', points: 30 })
          ],
          sprintCapacity: createCapacity({ recommendedLoad: 20 })
        });

        result.risks.forEach(risk => {
          expect(['high', 'medium', 'low']).toContain(risk.impact);
        });
      });
    });
  });
});

// Helper functions
function createBacklogItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    description: 'A test task for risk assessment',
    points: 3,
    priority: 'medium',
    labels: [],
    dependencies: [],
    ...overrides
  };
}

function createCapacity(overrides: Partial<SprintCapacity> = {}): SprintCapacity {
  return {
    totalPoints: 25,
    recommendedLoad: 20,
    teamAvailability: {
      totalAvailability: 1.0,
      memberCount: 2,
      members: [
        { id: '1', name: 'Alice', availability: 1.0 },
        { id: '2', name: 'Bob', availability: 1.0 }
      ],
      confidence: 0.8
    },
    buffer: {
      percentage: 20,
      reasoning: 'Standard 20% buffer'
    },
    confidence: {
      sectionId: 'sprint-capacity',
      sectionName: 'Sprint Capacity',
      score: 75,
      tier: 'medium',
      factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.8, patternMatch: 0.7 },
      reasoning: 'Test capacity',
      needsReview: false
    },
    ...overrides
  };
}
