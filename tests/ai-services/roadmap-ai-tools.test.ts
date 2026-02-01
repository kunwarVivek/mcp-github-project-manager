/**
 * Unit tests for Roadmap AI MCP Tools
 *
 * Tests the MCP tool definitions, schemas, and executors for
 * Phase 10 roadmap AI features.
 */

import {
  generateRoadmapTool,
  generateRoadmapVisualizationTool,
  executeGenerateRoadmap,
  executeGenerateRoadmapVisualization,
  roadmapAITools,
  roadmapAIExecutors,
} from '../../src/infrastructure/tools/roadmap-ai-tools';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import {
  RoadmapGenerationInputSchema,
  RoadmapOutputSchema,
} from '../../src/infrastructure/tools/schemas/sprint-roadmap-schemas';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('Roadmap AI MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
  });

  describe('Tool Definitions', () => {
    describe('generateRoadmapTool', () => {
      it('should have correct name', () => {
        expect(generateRoadmapTool.name).toBe('generate_roadmap');
      });

      it('should have title', () => {
        expect(generateRoadmapTool.title).toBe('Generate Roadmap');
      });

      it('should have description', () => {
        expect(generateRoadmapTool.description).toContain('roadmap');
      });

      it('should have aiOperation annotation', () => {
        expect(generateRoadmapTool.annotations?.idempotentHint).toBe(false);
      });

      it('should have input schema', () => {
        expect(generateRoadmapTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(generateRoadmapTool.outputSchema).toBeDefined();
      });
    });

    describe('generateRoadmapVisualizationTool', () => {
      it('should have correct name', () => {
        expect(generateRoadmapVisualizationTool.name).toBe('generate_roadmap_visualization');
      });

      it('should have title', () => {
        expect(generateRoadmapVisualizationTool.title).toBe('Generate Roadmap Visualization');
      });

      it('should have readOnly annotation', () => {
        expect(generateRoadmapVisualizationTool.annotations?.readOnlyHint).toBe(true);
      });

      it('should have input schema', () => {
        expect(generateRoadmapVisualizationTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(generateRoadmapVisualizationTool.outputSchema).toBeDefined();
      });
    });

    describe('roadmapAITools array', () => {
      it('should contain 2 tools', () => {
        expect(roadmapAITools).toHaveLength(2);
      });

      it('should contain all roadmap tools', () => {
        const names = roadmapAITools.map(t => t.name);
        expect(names).toContain('generate_roadmap');
        expect(names).toContain('generate_roadmap_visualization');
      });
    });

    describe('roadmapAIExecutors', () => {
      it('should have executor for each tool', () => {
        expect(roadmapAIExecutors).toHaveProperty('generate_roadmap');
        expect(roadmapAIExecutors).toHaveProperty('generate_roadmap_visualization');
      });

      it('should have functions as executors', () => {
        expect(typeof roadmapAIExecutors.generate_roadmap).toBe('function');
        expect(typeof roadmapAIExecutors.generate_roadmap_visualization).toBe('function');
      });
    });
  });

  describe('Input Schema Validation', () => {
    describe('RoadmapGenerationInputSchema', () => {
      it('should accept text requirements', () => {
        const input = {
          requirements: 'User authentication\nDashboard\nAPI integration'
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).not.toThrow();
      });

      it('should accept structured requirements', () => {
        const input = {
          requirements: [
            { id: 'REQ-001', title: 'User authentication' },
            { id: 'REQ-002', title: 'Dashboard' }
          ]
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).not.toThrow();
      });

      it('should accept constraints', () => {
        const input = {
          requirements: [{ id: '1', title: 'Feature' }],
          constraints: {
            velocity: 20,
            teamSize: 5,
            sprintDurationWeeks: 2
          }
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).not.toThrow();
      });

      it('should accept business context', () => {
        const input = {
          requirements: [{ id: '1', title: 'Feature' }],
          businessContext: 'This is a B2B SaaS product'
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).not.toThrow();
      });

      it('should reject empty requirements string', () => {
        const input = {
          requirements: 'short'
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).toThrow();
      });

      it('should reject empty requirements array', () => {
        const input = {
          requirements: []
        };
        expect(() => RoadmapGenerationInputSchema.parse(input)).toThrow();
      });
    });

    describe('RoadmapOutputSchema', () => {
      it('should accept valid roadmap output', () => {
        const output = {
          phases: [
            {
              id: 'phase-1',
              name: 'Foundation',
              description: 'Setup phase',
              objectives: ['Setup'],
              durationWeeks: 2,
              startWeek: 1,
              endWeek: 2,
              milestones: ['m1']
            }
          ],
          milestones: [
            {
              id: 'm1',
              title: 'Milestone 1',
              description: 'First milestone',
              phaseId: 'phase-1',
              targetDate: '2026-02-15',
              deliverables: ['D1'],
              dependencies: [],
              confidence: 0.8
            }
          ],
          dependencies: [],
          timeline: {
            startDate: '2026-02-01',
            endDate: '2026-02-15',
            totalWeeks: 2
          },
          confidence: {
            sectionId: 'roadmap',
            sectionName: 'Roadmap',
            score: 75,
            tier: 'medium',
            factors: { inputCompleteness: 0.7, aiSelfAssessment: 0.8, patternMatch: 0.7 },
            reasoning: 'Test',
            needsReview: false
          }
        };
        expect(() => RoadmapOutputSchema.parse(output)).not.toThrow();
      });
    });
  });

  describe('Executors', () => {
    describe('executeGenerateRoadmap', () => {
      it('should execute with text requirements', async () => {
        const result = await executeGenerateRoadmap({
          requirements: 'Feature 1\nFeature 2\nFeature 3'
        });

        expect(result).toHaveProperty('phases');
        expect(result).toHaveProperty('milestones');
        expect(result).toHaveProperty('timeline');
        expect(result).toHaveProperty('confidence');
      });

      it('should execute with structured requirements', async () => {
        const result = await executeGenerateRoadmap({
          requirements: [
            { id: '1', title: 'Feature 1' },
            { id: '2', title: 'Feature 2' }
          ]
        });

        expect(result.phases.length).toBeGreaterThan(0);
        expect(result.milestones.length).toBeGreaterThan(0);
      });

      it('should execute with constraints', async () => {
        const result = await executeGenerateRoadmap({
          requirements: [{ id: '1', title: 'Feature 1' }],
          constraints: {
            velocity: 30,
            sprintDurationWeeks: 3
          }
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });
    });

    describe('executeGenerateRoadmapVisualization', () => {
      it('should execute and return visualization data', async () => {
        // First generate a roadmap
        const roadmap = await executeGenerateRoadmap({
          requirements: [
            { id: '1', title: 'Feature 1' },
            { id: '2', title: 'Feature 2' }
          ]
        });

        // Then generate visualization
        const vizData = await executeGenerateRoadmapVisualization(roadmap);

        expect(vizData).toHaveProperty('phases');
        expect(vizData).toHaveProperty('milestones');
        expect(vizData).toHaveProperty('dependencies');
        expect(vizData).toHaveProperty('totalWeeks');
      });

      it('should return phases with colors', async () => {
        const roadmap = await executeGenerateRoadmap({
          requirements: [{ id: '1', title: 'Feature 1' }]
        });

        const vizData = await executeGenerateRoadmapVisualization(roadmap);

        vizData.phases.forEach(phase => {
          expect(phase).toHaveProperty('color');
          expect(phase.color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      it('should return milestones with week positions', async () => {
        const roadmap = await executeGenerateRoadmap({
          requirements: [{ id: '1', title: 'Feature 1' }]
        });

        const vizData = await executeGenerateRoadmapVisualization(roadmap);

        vizData.milestones.forEach(milestone => {
          expect(milestone).toHaveProperty('week');
          expect(typeof milestone.week).toBe('number');
        });
      });
    });
  });
});
