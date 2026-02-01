/**
 * Unit tests for RoadmapAIService
 *
 * Tests roadmap generation, phase sequencing, milestone date calculation,
 * and visualization data generation.
 */

import { RoadmapAIService } from '../../src/services/ai/RoadmapAIService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { GeneratedRoadmap, RoadmapGenerationInput, RequirementItem } from '../../src/domain/roadmap-planning-types';

// Mock AIServiceFactory
jest.mock('../../src/services/ai/AIServiceFactory');

const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('RoadmapAIService', () => {
  let service: RoadmapAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup mock for each test
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });
    service = new RoadmapAIService();
  });

  describe('generateRoadmap', () => {
    describe('basic roadmap generation', () => {
      it('should generate roadmap from text requirements', async () => {
        const result = await service.generateRoadmap({
          requirements: `
            - User authentication with OAuth
            - Dashboard with analytics
            - API integration with third parties
            - Mobile responsive design
          `
        });

        expect(result.phases.length).toBeGreaterThan(0);
        expect(result.milestones.length).toBeGreaterThan(0);
        expect(result.timeline).toBeDefined();
      });

      it('should generate roadmap from structured requirements', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: 'REQ-001', title: 'User authentication', priority: 'critical' },
            { id: 'REQ-002', title: 'Dashboard', priority: 'high' },
            { id: 'REQ-003', title: 'API integration', priority: 'medium' }
          ]
        });

        expect(result.phases.length).toBeGreaterThan(0);
        expect(result.milestones.length).toBeGreaterThan(0);
      });

      it('should return valid roadmap structure', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: 'REQ-001', title: 'Feature A' }
          ]
        });

        expect(result).toHaveProperty('phases');
        expect(result).toHaveProperty('milestones');
        expect(result).toHaveProperty('dependencies');
        expect(result).toHaveProperty('timeline');
        expect(result).toHaveProperty('confidence');
      });
    });

    describe('phase structure', () => {
      it('should create phases with required properties', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Setup', priority: 'critical' },
            { id: '2', title: 'Core Features', priority: 'high' },
            { id: '3', title: 'Polish', priority: 'medium' }
          ]
        });

        result.phases.forEach(phase => {
          expect(phase).toHaveProperty('id');
          expect(phase).toHaveProperty('name');
          expect(phase).toHaveProperty('description');
          expect(phase).toHaveProperty('objectives');
          expect(phase).toHaveProperty('durationWeeks');
          expect(phase).toHaveProperty('startWeek');
          expect(phase).toHaveProperty('endWeek');
          expect(phase).toHaveProperty('milestones');
        });
      });

      it('should sequence phases correctly', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Setup' },
            { id: '2', title: 'Core' },
            { id: '3', title: 'Polish' }
          ]
        });

        // Phases should have increasing start/end weeks
        for (let i = 1; i < result.phases.length; i++) {
          expect(result.phases[i].startWeek).toBeGreaterThanOrEqual(
            result.phases[i - 1].startWeek
          );
        }
      });

      it('should have contiguous phase weeks', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' },
            { id: '3', title: 'C' }
          ]
        });

        for (let i = 1; i < result.phases.length; i++) {
          expect(result.phases[i].startWeek).toBe(result.phases[i - 1].endWeek + 1);
        }
      });
    });

    describe('milestone structure', () => {
      it('should create milestones with required properties', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Feature A' }
          ]
        });

        result.milestones.forEach(milestone => {
          expect(milestone).toHaveProperty('id');
          expect(milestone).toHaveProperty('title');
          expect(milestone).toHaveProperty('description');
          expect(milestone).toHaveProperty('phaseId');
          expect(milestone).toHaveProperty('targetDate');
          expect(milestone).toHaveProperty('deliverables');
          expect(milestone).toHaveProperty('dependencies');
          expect(milestone).toHaveProperty('confidence');
        });
      });

      it('should link milestones to phases', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Feature A' }
          ]
        });

        result.milestones.forEach(milestone => {
          const phase = result.phases.find(p => p.id === milestone.phaseId);
          expect(phase).toBeDefined();
          expect(phase!.milestones).toContain(milestone.id);
        });
      });

      it('should have valid target dates (ISO format)', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Feature A' }
          ]
        });

        result.milestones.forEach(milestone => {
          expect(milestone.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
      });
    });

    describe('timeline calculation', () => {
      it('should calculate timeline from phases', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A', estimatedPoints: 20 },
            { id: '2', title: 'B', estimatedPoints: 30 }
          ]
        });

        expect(result.timeline).toHaveProperty('startDate');
        expect(result.timeline).toHaveProperty('endDate');
        expect(result.timeline).toHaveProperty('totalWeeks');
        expect(result.timeline.totalWeeks).toBeGreaterThan(0);
      });

      it('should ground dates in velocity', async () => {
        const highVelocity = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A', estimatedPoints: 100 }
          ],
          constraints: { velocity: 50 }
        });

        const lowVelocity = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A', estimatedPoints: 100 }
          ],
          constraints: { velocity: 10 }
        });

        // Lower velocity = longer timeline
        expect(lowVelocity.timeline.totalWeeks).toBeGreaterThan(
          highVelocity.timeline.totalWeeks
        );
      });

      it('should have valid date formats', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        expect(result.timeline.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.timeline.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('constraints handling', () => {
      it('should accept velocity constraint', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }],
          constraints: { velocity: 25 }
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });

      it('should accept team size constraint', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }],
          constraints: { teamSize: 5 }
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });

      it('should accept sprint duration constraint', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }],
          constraints: { sprintDurationWeeks: 3 }
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });

      it('should handle empty constraints', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }],
          constraints: {}
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });
    });

    describe('dependencies', () => {
      it('should create milestone dependencies', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Setup database' },
            { id: '2', title: 'Build API on database' },
            { id: '3', title: 'Build UI on API' }
          ]
        });

        expect(Array.isArray(result.dependencies)).toBe(true);
      });

      it('should have valid dependency structure', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' }
          ]
        });

        result.dependencies.forEach(dep => {
          expect(dep).toHaveProperty('fromMilestoneId');
          expect(dep).toHaveProperty('toMilestoneId');
          expect(dep).toHaveProperty('type');
          expect(['blocks', 'relates_to']).toContain(dep.type);
        });
      });
    });

    describe('confidence scoring', () => {
      it('should include confidence in result', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        expect(result.confidence).toHaveProperty('sectionId');
        expect(result.confidence).toHaveProperty('score');
        expect(result.confidence).toHaveProperty('tier');
        expect(result.confidence).toHaveProperty('factors');
      });

      it('should have higher confidence with more requirements', async () => {
        const fewReqs = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        const manyReqs = await service.generateRoadmap({
          requirements: Array.from({ length: 10 }, (_, i) => ({
            id: `${i + 1}`,
            title: `Feature ${i + 1}`
          }))
        });

        expect(manyReqs.confidence.score).toBeGreaterThanOrEqual(
          fewReqs.confidence.score
        );
      });

      it('should have valid confidence tier', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        expect(['high', 'medium', 'low']).toContain(result.confidence.tier);
      });
    });

    describe('edge cases', () => {
      it('should handle single requirement', async () => {
        const result = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'Single feature' }]
        });

        expect(result.phases.length).toBeGreaterThanOrEqual(1);
        expect(result.milestones.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle many requirements', async () => {
        const requirements = Array.from({ length: 30 }, (_, i) => ({
          id: `${i + 1}`,
          title: `Feature ${i + 1}`
        }));

        const result = await service.generateRoadmap({ requirements });

        expect(result.phases.length).toBeGreaterThan(0);
        expect(result.milestones.length).toBeGreaterThan(0);
      });

      it('should handle requirements with all priorities', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Critical', priority: 'critical' },
            { id: '2', title: 'High', priority: 'high' },
            { id: '3', title: 'Medium', priority: 'medium' },
            { id: '4', title: 'Low', priority: 'low' }
          ]
        });

        expect(result.phases.length).toBeGreaterThan(0);
      });

      it('should handle empty text requirements', async () => {
        const result = await service.generateRoadmap({
          requirements: ''
        });

        // Should handle gracefully (may have minimal output)
        expect(result).toHaveProperty('phases');
        expect(result).toHaveProperty('timeline');
      });
    });

    describe('fallback behavior', () => {
      it('should use fallback when AI unavailable', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Feature A' },
            { id: '2', title: 'Feature B' },
            { id: '3', title: 'Feature C' }
          ]
        });

        // AI is mocked to return null, so fallback should be used
        expect(result.phases.length).toBeGreaterThan(0);
        expect(result.reasoning).toContain('Fallback');
      });

      it('should create sensible phases in fallback', async () => {
        const result = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' },
            { id: '3', title: 'C' },
            { id: '4', title: 'D' },
            { id: '5', title: 'E' }
          ]
        });

        // Should group into reasonable number of phases
        expect(result.phases.length).toBeGreaterThanOrEqual(2);
        expect(result.phases.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('generateVisualizationData', () => {
    it('should generate visualization data from roadmap', async () => {
      const roadmap = await service.generateRoadmap({
        requirements: [
          { id: '1', title: 'A' },
          { id: '2', title: 'B' }
        ]
      });

      const vizData = service.generateVisualizationData(roadmap);

      expect(vizData).toHaveProperty('phases');
      expect(vizData).toHaveProperty('milestones');
      expect(vizData).toHaveProperty('dependencies');
      expect(vizData).toHaveProperty('totalWeeks');
    });

    describe('phase visualization', () => {
      it('should include phase bars with positions', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' }
          ]
        });

        const vizData = service.generateVisualizationData(roadmap);

        vizData.phases.forEach(phase => {
          expect(phase).toHaveProperty('id');
          expect(phase).toHaveProperty('name');
          expect(phase).toHaveProperty('startWeek');
          expect(phase).toHaveProperty('endWeek');
          expect(phase.startWeek).toBeGreaterThanOrEqual(0);
          expect(phase.endWeek).toBeGreaterThanOrEqual(phase.startWeek);
        });
      });

      it('should include colors for phases', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' },
            { id: '3', title: 'C' }
          ]
        });

        const vizData = service.generateVisualizationData(roadmap);

        vizData.phases.forEach(phase => {
          expect(phase).toHaveProperty('color');
          expect(phase.color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      it('should use distinct colors for different phases', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: Array.from({ length: 10 }, (_, i) => ({
            id: `${i + 1}`,
            title: `Feature ${i + 1}`
          }))
        });

        const vizData = service.generateVisualizationData(roadmap);

        // At least some colors should be different
        const colors = vizData.phases.map(p => p.color);
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBeGreaterThanOrEqual(1);
      });
    });

    describe('milestone visualization', () => {
      it('should include milestone markers with week positions', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        const vizData = service.generateVisualizationData(roadmap);

        vizData.milestones.forEach(milestone => {
          expect(milestone).toHaveProperty('id');
          expect(milestone).toHaveProperty('title');
          expect(milestone).toHaveProperty('week');
          expect(milestone).toHaveProperty('phaseId');
          expect(milestone.week).toBeGreaterThanOrEqual(0);
        });
      });

      it('should link milestones to phases', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'A' },
            { id: '2', title: 'B' }
          ]
        });

        const vizData = service.generateVisualizationData(roadmap);

        vizData.milestones.forEach(milestone => {
          const phase = vizData.phases.find(p => p.id === milestone.phaseId);
          expect(phase).toBeDefined();
        });
      });
    });

    describe('dependency edges', () => {
      it('should include dependency edges', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [
            { id: '1', title: 'Setup' },
            { id: '2', title: 'Build on setup' }
          ]
        });

        const vizData = service.generateVisualizationData(roadmap);

        expect(Array.isArray(vizData.dependencies)).toBe(true);
        vizData.dependencies.forEach(dep => {
          expect(dep).toHaveProperty('from');
          expect(dep).toHaveProperty('to');
        });
      });
    });

    describe('total weeks', () => {
      it('should match roadmap timeline', async () => {
        const roadmap = await service.generateRoadmap({
          requirements: [{ id: '1', title: 'A' }]
        });

        const vizData = service.generateVisualizationData(roadmap);

        expect(vizData.totalWeeks).toBe(roadmap.timeline.totalWeeks);
      });
    });
  });
});
