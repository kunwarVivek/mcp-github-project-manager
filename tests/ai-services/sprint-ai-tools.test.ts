/**
 * Unit tests for Sprint AI MCP Tools
 *
 * Tests the MCP tool definitions, schemas, and executors for
 * Phase 10 sprint AI features.
 */

import {
  calculateSprintCapacityTool,
  prioritizeBacklogTool,
  assessSprintRiskTool,
  suggestSprintCompositionTool,
  executeCalculateSprintCapacity,
  executePrioritizeBacklog,
  executeAssessSprintRisk,
  executeSuggestSprintComposition,
  sprintAITools,
  sprintAIExecutors,
} from '../../src/infrastructure/tools/sprint-ai-tools';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import {
  SprintCapacityInputSchema,
  BacklogPrioritizationInputSchema,
  SprintRiskInputSchema,
  SprintSuggestionInputSchema,
} from '../../src/infrastructure/tools/schemas/sprint-roadmap-schemas';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('Sprint AI MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
  });

  describe('Tool Definitions', () => {
    describe('calculateSprintCapacityTool', () => {
      it('should have correct name', () => {
        expect(calculateSprintCapacityTool.name).toBe('calculate_sprint_capacity');
      });

      it('should have title', () => {
        expect(calculateSprintCapacityTool.title).toBe('Calculate Sprint Capacity');
      });

      it('should have description', () => {
        expect(calculateSprintCapacityTool.description).toContain('capacity');
      });

      it('should have readOnly annotation', () => {
        expect(calculateSprintCapacityTool.annotations?.readOnlyHint).toBe(true);
      });

      it('should have input schema', () => {
        expect(calculateSprintCapacityTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(calculateSprintCapacityTool.outputSchema).toBeDefined();
      });
    });

    describe('prioritizeBacklogTool', () => {
      it('should have correct name', () => {
        expect(prioritizeBacklogTool.name).toBe('prioritize_backlog');
      });

      it('should have title', () => {
        expect(prioritizeBacklogTool.title).toBe('Prioritize Backlog');
      });

      it('should have aiOperation annotation', () => {
        expect(prioritizeBacklogTool.annotations?.idempotentHint).toBe(false);
      });

      it('should have input schema', () => {
        expect(prioritizeBacklogTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(prioritizeBacklogTool.outputSchema).toBeDefined();
      });
    });

    describe('assessSprintRiskTool', () => {
      it('should have correct name', () => {
        expect(assessSprintRiskTool.name).toBe('assess_sprint_risk');
      });

      it('should have title', () => {
        expect(assessSprintRiskTool.title).toBe('Assess Sprint Risk');
      });

      it('should have description mentioning risks', () => {
        expect(assessSprintRiskTool.description).toContain('risk');
      });

      it('should have aiOperation annotation', () => {
        expect(assessSprintRiskTool.annotations?.idempotentHint).toBe(false);
      });
    });

    describe('suggestSprintCompositionTool', () => {
      it('should have correct name', () => {
        expect(suggestSprintCompositionTool.name).toBe('suggest_sprint_composition');
      });

      it('should have title', () => {
        expect(suggestSprintCompositionTool.title).toBe('Suggest Sprint Composition');
      });

      it('should have aiOperation annotation', () => {
        expect(suggestSprintCompositionTool.annotations?.idempotentHint).toBe(false);
      });
    });

    describe('sprintAITools array', () => {
      it('should contain 4 tools', () => {
        expect(sprintAITools).toHaveLength(4);
      });

      it('should contain all sprint tools', () => {
        const names = sprintAITools.map(t => t.name);
        expect(names).toContain('calculate_sprint_capacity');
        expect(names).toContain('prioritize_backlog');
        expect(names).toContain('assess_sprint_risk');
        expect(names).toContain('suggest_sprint_composition');
      });
    });

    describe('sprintAIExecutors', () => {
      it('should have executor for each tool', () => {
        expect(sprintAIExecutors).toHaveProperty('calculate_sprint_capacity');
        expect(sprintAIExecutors).toHaveProperty('prioritize_backlog');
        expect(sprintAIExecutors).toHaveProperty('assess_sprint_risk');
        expect(sprintAIExecutors).toHaveProperty('suggest_sprint_composition');
      });

      it('should have functions as executors', () => {
        expect(typeof sprintAIExecutors.calculate_sprint_capacity).toBe('function');
        expect(typeof sprintAIExecutors.prioritize_backlog).toBe('function');
        expect(typeof sprintAIExecutors.assess_sprint_risk).toBe('function');
        expect(typeof sprintAIExecutors.suggest_sprint_composition).toBe('function');
      });
    });
  });

  describe('Input Schema Validation', () => {
    describe('SprintCapacityInputSchema', () => {
      it('should accept valid input with numeric velocity', () => {
        const input = {
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        };
        expect(() => SprintCapacityInputSchema.parse(input)).not.toThrow();
      });

      it('should accept auto velocity', () => {
        const input = {
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        };
        expect(() => SprintCapacityInputSchema.parse(input)).not.toThrow();
      });

      it('should require team members', () => {
        const input = {
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: []
        };
        expect(() => SprintCapacityInputSchema.parse(input)).toThrow();
      });

      it('should accept historical sprints', () => {
        const input = {
          velocity: 'auto',
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }],
          historicalSprints: [
            {
              sprintId: 's1',
              sprintName: 'Sprint 1',
              plannedPoints: 20,
              completedPoints: 18,
              durationDays: 10,
              startDate: '2026-01-01',
              endDate: '2026-01-10'
            }
          ]
        };
        expect(() => SprintCapacityInputSchema.parse(input)).not.toThrow();
      });
    });

    describe('BacklogPrioritizationInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          sprintCapacity: 20
        };
        expect(() => BacklogPrioritizationInputSchema.parse(input)).not.toThrow();
      });

      it('should require at least one backlog item', () => {
        const input = {
          backlogItems: [],
          sprintCapacity: 20
        };
        expect(() => BacklogPrioritizationInputSchema.parse(input)).toThrow();
      });

      it('should accept business goals', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          sprintCapacity: 20,
          businessGoals: ['Goal 1', 'Goal 2']
        };
        expect(() => BacklogPrioritizationInputSchema.parse(input)).not.toThrow();
      });

      it('should accept risk tolerance', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          sprintCapacity: 20,
          riskTolerance: 'low'
        };
        expect(() => BacklogPrioritizationInputSchema.parse(input)).not.toThrow();
      });
    });

    describe('SprintRiskInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          sprintItems: [{ id: '1', title: 'Task 1' }],
          capacity: {
            totalPoints: 25,
            recommendedLoad: 20,
            teamAvailability: {
              totalAvailability: 1.0,
              memberCount: 1,
              members: [{ id: '1', name: 'Alice', availability: 1.0 }],
              confidence: 0.8
            },
            buffer: { percentage: 20, reasoning: 'Standard' },
            confidence: {
              sectionId: 'cap',
              sectionName: 'Capacity',
              score: 75,
              tier: 'medium',
              factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.8, patternMatch: 0.7 },
              reasoning: 'Test',
              needsReview: false
            }
          }
        };
        expect(() => SprintRiskInputSchema.parse(input)).not.toThrow();
      });

      it('should require at least one sprint item', () => {
        const input = {
          sprintItems: [],
          capacity: {
            totalPoints: 25,
            recommendedLoad: 20,
            teamAvailability: {
              totalAvailability: 1.0,
              memberCount: 0,
              members: [],
              confidence: 0.8
            },
            buffer: { percentage: 20, reasoning: 'Standard' },
            confidence: {
              sectionId: 'cap',
              sectionName: 'Capacity',
              score: 75,
              tier: 'medium',
              factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.8, patternMatch: 0.7 },
              reasoning: 'Test',
              needsReview: false
            }
          }
        };
        expect(() => SprintRiskInputSchema.parse(input)).toThrow();
      });
    });

    describe('SprintSuggestionInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          velocity: 20,
          sprintDurationDays: 10
        };
        expect(() => SprintSuggestionInputSchema.parse(input)).not.toThrow();
      });

      it('should require positive velocity', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          velocity: 0,
          sprintDurationDays: 10
        };
        expect(() => SprintSuggestionInputSchema.parse(input)).toThrow();
      });

      it('should accept team members', () => {
        const input = {
          backlogItems: [{ id: '1', title: 'Task 1' }],
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        };
        expect(() => SprintSuggestionInputSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('Executors', () => {
    describe('executeCalculateSprintCapacity', () => {
      it('should execute and return result', async () => {
        const result = await executeCalculateSprintCapacity({
          velocity: 20,
          sprintDurationDays: 10,
          teamMembers: [{ id: '1', name: 'Alice', availability: 1.0 }]
        });

        expect(result).toHaveProperty('totalPoints');
        expect(result).toHaveProperty('recommendedLoad');
        expect(result).toHaveProperty('confidence');
      });
    });

    describe('executePrioritizeBacklog', () => {
      it('should execute and return result', async () => {
        const result = await executePrioritizeBacklog({
          backlogItems: [{ id: '1', title: 'Task 1' }],
          sprintCapacity: 20,
          riskTolerance: 'medium'
        });

        expect(result).toHaveProperty('prioritizedItems');
        expect(result).toHaveProperty('reasoning');
        expect(result).toHaveProperty('confidence');
      });
    });

    describe('executeAssessSprintRisk', () => {
      it('should execute and return result', async () => {
        const result = await executeAssessSprintRisk({
          sprintItems: [{ id: '1', title: 'Task 1' }],
          capacity: {
            totalPoints: 25,
            recommendedLoad: 20,
            teamAvailability: {
              totalAvailability: 1.0,
              memberCount: 1,
              members: [{ id: '1', name: 'Alice', availability: 1.0 }],
              confidence: 0.8
            },
            buffer: { percentage: 20, reasoning: 'Standard' },
            confidence: {
              sectionId: 'cap',
              sectionName: 'Capacity',
              score: 75,
              tier: 'medium',
              factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.8, patternMatch: 0.7 },
              reasoning: 'Test',
              needsReview: false
            }
          }
        });

        expect(result).toHaveProperty('overallRisk');
        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('risks');
        expect(result).toHaveProperty('mitigations');
      });
    });

    describe('executeSuggestSprintComposition', () => {
      it('should execute and return result', async () => {
        const result = await executeSuggestSprintComposition({
          backlogItems: [{ id: '1', title: 'Task 1' }],
          velocity: 20,
          sprintDurationDays: 10,
          riskTolerance: 'medium'
        });

        expect(result).toHaveProperty('suggestedItems');
        expect(result).toHaveProperty('totalPoints');
        expect(result).toHaveProperty('capacityUtilization');
        expect(result).toHaveProperty('reasoning');
      });
    });
  });
});
