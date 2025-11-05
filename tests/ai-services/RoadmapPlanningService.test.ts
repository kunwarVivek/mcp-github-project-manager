import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RoadmapPlanningService } from '../../src/services/RoadmapPlanningService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { ProjectManagementService } from '../../src/services/ProjectManagementService';

// Mock the AI service factory
jest.mock('../../src/services/ai/AIServiceFactory');

// Mock the ai package
jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn()
}));

// Mock ProjectManagementService
jest.mock('../../src/services/ProjectManagementService');

describe('RoadmapPlanningService', () => {
  let service: RoadmapPlanningService;
  let mockAIService: any;
  let mockProjectService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI service - just needs to be a valid model object
    mockAIService = {
      modelId: 'test-model',
      provider: 'test-provider'
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getMainModel: jest.fn().mockReturnValue(mockAIService),
      getFallbackModel: jest.fn().mockReturnValue(mockAIService),
      getModel: jest.fn().mockReturnValue(mockAIService),
      getBestAvailableModel: jest.fn().mockReturnValue(mockAIService),
      getPRDModel: jest.fn().mockReturnValue(mockAIService),
      getResearchModel: jest.fn().mockReturnValue(mockAIService)
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    // Mock ProjectManagementService methods
    mockProjectService = {
      listProjectItems: jest.fn(),
      createMilestone: jest.fn(),
      updateProjectItem: jest.fn()
    };

    (ProjectManagementService as jest.Mock).mockImplementation(() => mockProjectService);

    service = new RoadmapPlanningService(AIServiceFactory.getInstance(), new ProjectManagementService('test-owner', 'test-repo', 'test-token'));
  });

  describe('generateRoadmap', () => {
    it('should generate a comprehensive roadmap from project issues', async () => {
      const mockIssues = {
        items: [
          {
            id: 'issue-1',
            title: 'Implement user authentication',
            body: 'Add secure login functionality'
          },
          {
            id: 'issue-2',
            title: 'Create dashboard UI',
            body: 'Build the main dashboard interface'
          },
          {
            id: 'issue-3',
            title: 'Add API integration',
            body: 'Integrate with external APIs'
          }
        ]
      };

      const mockRoadmapResponse = {
        roadmap: {
          phases: [
            {
              name: 'Foundation',
              description: 'Build core infrastructure',
              durationWeeks: 4,
              objectives: ['Setup authentication', 'Create base UI']
            },
            {
              name: 'Integration',
              description: 'Connect external services',
              durationWeeks: 3,
              objectives: ['API integration', 'Testing']
            }
          ]
        },
        milestones: [
          {
            title: 'MVP Launch',
            description: 'Minimum viable product ready',
            dueDate: '2025-03-01',
            deliverables: ['Authentication working', 'Basic UI complete']
          }
        ],
        sprints: [
          {
            name: 'Sprint 1',
            durationWeeks: 2,
            goals: ['Setup auth infrastructure'],
            issues: ['issue-1']
          },
          {
            name: 'Sprint 2',
            durationWeeks: 2,
            goals: ['Build dashboard'],
            issues: ['issue-2']
          }
        ]
      };

      mockProjectService.listProjectItems.mockResolvedValue(mockIssues.items);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockRoadmapResponse)
      });

      const result = await service.generateRoadmap({
        projectId: 'project-123',
        projectTitle: 'Test Project',
        projectDescription: 'A test project for roadmap generation',
        sprintDurationWeeks: 2,
        targetMilestones: 3
      });

      expect(result).toBeDefined();
      expect(result.roadmap).toBeDefined();
      expect(result.roadmap.phases).toHaveLength(2);
      expect(result.milestones).toHaveLength(1);
      expect(result.sprints).toHaveLength(2);
      expect(mockProjectService.listProjectItems).toHaveBeenCalledWith({
        projectId: 'project-123',
        limit: 200
      });
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('should throw error when project has no issues', async () => {
      mockProjectService.listProjectItems.mockResolvedValue([]);

      await expect(
        service.generateRoadmap({
          projectId: 'empty-project',
          projectTitle: 'Empty Project',
          targetMilestones: 1
        })
      ).rejects.toThrow('No issues found in project');
    });

    it('should respect sprint duration configuration', async () => {
      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'issue-1', title: 'Test', body: 'Test issue' }
      ]);

      const mockRoadmap = {
        roadmap: { phases: [] },
        milestones: [],
        sprints: [
          { name: 'Sprint 1', durationWeeks: 3, goals: ['Test'], issues: [] }
        ]
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockRoadmap)
      });

      await service.generateRoadmap({
        projectId: 'project-123',
        projectTitle: 'Test',
        sprintDurationWeeks: 3
      });

      const generateTextCall = generateText.mock.calls[0][0];
      expect(generateTextCall.prompt).toContain('3-week sprints');
    });

    it('should handle complex projects with many issues', async () => {
      const mockManyIssues = Array.from({ length: 50 }, (_, i) => ({
        id: `issue-${i}`,
        title: `Feature ${i}`,
        body: `Description ${i}`
      }));

      mockProjectService.listProjectItems.mockResolvedValue(mockManyIssues);

      const mockComplexRoadmap = {
        roadmap: {
          phases: [
            { name: 'Phase 1', description: 'First phase', durationWeeks: 6, objectives: [] },
            { name: 'Phase 2', description: 'Second phase', durationWeeks: 6, objectives: [] },
            { name: 'Phase 3', description: 'Third phase', durationWeeks: 6, objectives: [] }
          ]
        },
        milestones: [
          { title: 'M1', description: 'First milestone', dueDate: '2025-03-01', deliverables: [] },
          { title: 'M2', description: 'Second milestone', dueDate: '2025-04-01', deliverables: [] }
        ],
        sprints: Array.from({ length: 9 }, (_, i) => ({
          name: `Sprint ${i + 1}`,
          durationWeeks: 2,
          goals: [],
          issues: []
        }))
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockComplexRoadmap)
      });

      const result = await service.generateRoadmap({
        projectId: 'complex-project',
        projectTitle: 'Complex Project',
        targetMilestones: 5
      });

      expect(result.roadmap.phases.length).toBeGreaterThan(0);
      expect(result.sprints.length).toBeGreaterThan(0);
    });
  });

  describe('createRoadmapInGitHub', () => {
    it('should create milestones in GitHub when requested', async () => {
      const mockRoadmap = {
        roadmap: {
          phases: [],
          milestones: [
            {
              title: 'MVP Launch',
              description: 'Launch minimum viable product',
              dueDate: '2025-06-01',
              deliverables: ['Auth', 'UI']
            },
            {
              title: 'Beta Release',
              description: 'Public beta release',
              dueDate: '2025-07-01',
              deliverables: ['Testing', 'Docs']
            }
          ]
        },
        milestones: [
          {
            title: 'MVP Launch',
            description: 'Launch minimum viable product',
            dueDate: '2025-06-01',
            deliverables: ['Auth', 'UI']
          }
        ],
        sprints: []
      };

      mockProjectService.createMilestone.mockResolvedValue({
        id: 'milestone-1',
        number: 1
      });

      const result = await service.createRoadmapInGitHub({
        projectId: 'project-123',
        roadmap: mockRoadmap
      });

      expect(result.createdMilestones).toBeGreaterThan(0);
      expect(mockProjectService.createMilestone).toHaveBeenCalled();
    });

    it('should handle GitHub API errors gracefully', async () => {
      const mockRoadmap = {
        roadmap: { phases: [], milestones: [] },
        milestones: [
          { title: 'Test', description: 'Test milestone', dueDate: '2025-06-01', deliverables: [] }
        ],
        sprints: []
      };

      mockProjectService.createMilestone.mockRejectedValue(
        new Error('GitHub API error: Rate limit exceeded')
      );

      // Service catches errors and continues, so should not throw
      const result = await service.createRoadmapInGitHub({
        projectId: 'project-123',
        roadmap: mockRoadmap
      });

      // Should complete with 0 milestones created due to error
      expect(result.createdMilestones).toBe(0);
      expect(mockProjectService.createMilestone).toHaveBeenCalled();
    });

    it('should skip creation if no milestones in roadmap', async () => {
      const mockEmptyRoadmap = {
        roadmap: { phases: [], milestones: [] },
        milestones: [],
        sprints: []
      };

      const result = await service.createRoadmapInGitHub({
        projectId: 'project-123',
        roadmap: mockEmptyRoadmap
      });

      expect(result.createdMilestones).toBe(0);
      expect(mockProjectService.createMilestone).not.toHaveBeenCalled();
    });
  });

  describe('analyzeIssuesForRoadmap', () => {
    it('should parse JSON response from AI correctly', async () => {
      const mockResponse = {
        roadmap: {
          phases: [
            {
              name: 'Development',
              description: 'Core development phase',
              durationWeeks: 8,
              objectives: ['Build features']
            }
          ]
        },
        milestones: [],
        sprints: []
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: `Here's the roadmap analysis:\n\n${JSON.stringify(mockResponse)}\n\nThis roadmap covers all key aspects.`
      });

      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'test', title: 'Test', body: 'Test' }
      ]);

      const result = await service.generateRoadmap({
        projectId: 'test-project',
        projectTitle: 'Test'
      });

      expect(result.roadmap.phases).toHaveLength(1);
      expect(result.roadmap.phases[0].name).toBe('Development');
    });

    it('should handle malformed JSON in AI response', async () => {
      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: 'This is not valid JSON { invalid syntax'
      });

      mockProjectService.listProjectItems.mockResolvedValue({
        items: []
      });

      await expect(
        service.generateRoadmap({
          projectId: 'test-project',
          projectTitle: 'Test'
        })
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when AI service is unavailable', async () => {
      const mockFactory = AIServiceFactory.getInstance();
      (mockFactory.getModel as jest.Mock).mockReturnValue(null);
      (mockFactory.getBestAvailableModel as jest.Mock).mockReturnValue(null);

      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'test', title: 'Test', body: 'Test' }
      ]);

      await expect(
        service.generateRoadmap({
          projectId: 'test',
          projectTitle: 'Test'
        })
      ).rejects.toThrow('AI service is not available');
    });

    it('should handle project service errors', async () => {
      mockProjectService.listProjectItems.mockRejectedValue(
        new Error('Failed to fetch project items')
      );

      await expect(
        service.generateRoadmap({
          projectId: 'test',
          projectTitle: 'Test'
        })
      ).rejects.toThrow('Failed to fetch project items');
    });

    it('should handle AI generation errors', async () => {
      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'test', title: 'Test', body: 'Test' }
      ]);

      const { generateText } = require('ai');
      generateText.mockRejectedValue(new Error('AI model timeout'));

      await expect(
        service.generateRoadmap({
          projectId: 'test',
          projectTitle: 'Test'
        })
      ).rejects.toThrow('AI model timeout');
    });
  });

  describe('input validation', () => {
    it('should handle missing project description', async () => {
      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'test', title: 'Test', body: 'Test' }
      ]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          roadmap: { phases: [] },
          milestones: [],
          sprints: []
        })
      });

      const result = await service.generateRoadmap({
        projectId: 'test',
        projectTitle: 'Test'
        // No projectDescription provided
      });

      expect(result).toBeDefined();
      expect(generateText).toHaveBeenCalled();
    });

    it('should use default values for optional parameters', async () => {
      mockProjectService.listProjectItems.mockResolvedValue([
        { id: 'test', title: 'Test', body: 'Test' }
      ]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          roadmap: { phases: [] },
          milestones: [],
          sprints: []
        })
      });

      await service.generateRoadmap({
        projectId: 'test',
        projectTitle: 'Test'
      });

      const generateTextCall = generateText.mock.calls[0][0];
      // Should use default sprint duration (2 weeks) and milestones (4)
      expect(generateTextCall.prompt).toContain('2-week sprints');
      expect(generateTextCall.prompt).toContain('4 milestones');
    });
  });

  describe('AI prompt construction', () => {
    it('should include all relevant context in AI prompt', async () => {
      const mockIssues = {
        items: [
          {
            id: 'issue-1',
            title: 'Critical bug',
            body: 'Fix authentication issue',
            labels: ['bug', 'critical']
          },
          {
            id: 'issue-2',
            title: 'New feature',
            body: 'Add user dashboard',
            labels: ['feature', 'enhancement']
          }
        ]
      };

      mockProjectService.listProjectItems.mockResolvedValue(mockIssues.items);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          roadmap: { phases: [] },
          milestones: [],
          sprints: []
        })
      });

      await service.generateRoadmap({
        projectId: 'test-project',
        projectTitle: 'My Awesome Project',
        projectDescription: 'Building the future of task management',
        sprintDurationWeeks: 3,
        targetMilestones: 5
      });

      const generateTextCall = generateText.mock.calls[0][0];
      expect(generateTextCall.prompt).toContain('My Awesome Project');
      expect(generateTextCall.prompt).toContain('Building the future of task management');
      expect(generateTextCall.prompt).toContain('3-week sprints');
      expect(generateTextCall.prompt).toContain('5 milestones');
      expect(generateTextCall.prompt).toContain('Critical bug');
      expect(generateTextCall.prompt).toContain('New feature');
    });
  });
});
