import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskGenerationService } from '../../src/services/TaskGenerationService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { TaskStatus, TaskPriority, TaskComplexity } from '../../src/domain/ai-types';

// Mock the AI service factory
jest.mock('../../src/services/ai/AIServiceFactory');

describe('TaskGenerationService', () => {
  let service: TaskGenerationService;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI service
    mockAIService = {
      generateObject: jest.fn(),
      generateText: jest.fn()
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getMainModel: jest.fn().mockReturnValue(mockAIService),
      getFallbackModel: jest.fn().mockReturnValue(mockAIService)
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    service = new TaskGenerationService();
  });

  describe('generateTasksFromPRD', () => {
    it('should generate tasks from PRD content', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Setup project infrastructure',
          description: 'Initialize project structure and CI/CD pipeline',
          complexity: 4,
          estimatedHours: 8,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          acceptanceCriteria: ['Project structure is created', 'CI/CD pipeline is configured'],
          tags: ['setup', 'infrastructure'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'task-2',
          title: 'Implement user authentication',
          description: 'Create secure login and registration functionality',
          complexity: 6,
          estimatedHours: 16,
          priority: 'critical',
          status: 'pending',
          dependencies: ['task-1'],
          acceptanceCriteria: ['Users can register with email', 'Users can login securely'],
          tags: ['auth', 'security'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockAIService.generateObject.mockResolvedValue({ tasks: mockTasks });

      const input = {
        prd: 'Task management application with user authentication and task CRUD operations',
        maxTasks: 10,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true
      };

      const result = await service.generateTasksFromPRD(input);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Setup project infrastructure');
      expect(result[0].complexity).toBe(4);
      expect(result[0].estimatedHours).toBe(8);
      expect(result[1].dependencies).toContain('task-1');
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });

    it('should respect maxTasks limit', async () => {
      const mockManyTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `Task ${i + 1}`,
        description: `Description for task ${i + 1}`,
        complexity: 3,
        estimatedHours: 6,
        priority: 'medium',
        status: 'pending',
        dependencies: [],
        acceptanceCriteria: [`Task ${i + 1} is completed`],
        tags: ['generated'],
        aiGenerated: true,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      mockAIService.generateObject.mockResolvedValue({ tasks: mockManyTasks });

      const input = {
        prd: 'Complex application with many features',
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true
      };

      const result = await service.generateTasksFromPRD(input);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should include subtasks when requested', async () => {
      const mockTasksWithSubtasks = [
        {
          id: 'task-1',
          title: 'Complex feature implementation',
          description: 'Implement a complex feature with multiple components',
          complexity: 8,
          estimatedHours: 24,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          acceptanceCriteria: ['Feature is fully implemented'],
          tags: ['complex'],
          aiGenerated: true,
          subtasks: [
            {
              id: 'subtask-1',
              title: 'Design component architecture',
              description: 'Design the overall architecture for the feature',
              complexity: 4,
              estimatedHours: 8,
              priority: 'high',
              status: 'pending',
              dependencies: [],
              acceptanceCriteria: ['Architecture is documented'],
              tags: ['design'],
              aiGenerated: true,
              subtasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockAIService.generateObject.mockResolvedValue({ tasks: mockTasksWithSubtasks });

      const input = {
        prd: 'Application with complex features requiring subtask breakdown',
        maxTasks: 5,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true
      };

      const result = await service.generateTasksFromPRD(input);

      expect(result[0].subtasks).toBeDefined();
      expect(result[0].subtasks.length).toBeGreaterThan(0);
      expect(result[0].subtasks[0].title).toBe('Design component architecture');
    });
  });

  describe('analyzeTaskComplexity', () => {
    it('should analyze task complexity and provide recommendations', async () => {
      const mockAnalysis = {
        originalComplexity: 5,
        newComplexity: 7,
        estimatedHours: 16,
        riskFactors: [
          'Real-time functionality adds complexity',
          'WebSocket implementation requires expertise'
        ],
        recommendations: [
          'Consider breaking into smaller tasks',
          'Ensure team has WebSocket experience',
          'Plan for additional testing time'
        ],
        confidence: 0.85,
        breakdown: {
          design: 4,
          implementation: 8,
          testing: 4,
          documentation: 2
        }
      };

      mockAIService.generateObject.mockResolvedValue(mockAnalysis);

      const task = {
        id: 'task-1',
        title: 'Implement real-time collaboration',
        description: 'Build WebSocket-based real-time collaboration with conflict resolution',
        complexity: 5 as TaskComplexity,
        estimatedHours: 12,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: ['Real-time collaboration works'],
        tags: ['realtime'],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await service.analyzeTaskComplexity(task);

      expect(result.newComplexity).toBe(7);
      expect(result.estimatedHours).toBe(16);
      expect(result.riskFactors).toContain('Real-time functionality adds complexity');
      expect(result.recommendations).toContain('Consider breaking into smaller tasks');
      expect(result.confidence).toBe(0.85);
      expect(result.breakdown).toBeDefined();
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });

    it('should handle simple tasks with low complexity', async () => {
      const mockSimpleAnalysis = {
        originalComplexity: 2,
        newComplexity: 2,
        estimatedHours: 3,
        riskFactors: [],
        recommendations: ['Straightforward implementation', 'Good starter task'],
        confidence: 0.95,
        breakdown: {
          design: 1,
          implementation: 2,
          testing: 1,
          documentation: 1
        }
      };

      mockAIService.generateObject.mockResolvedValue(mockSimpleAnalysis);

      const simpleTask = {
        id: 'task-1',
        title: 'Update button color',
        description: 'Change the primary button color from blue to green',
        complexity: 2 as TaskComplexity,
        estimatedHours: 2,
        priority: TaskPriority.LOW,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: ['Button color is updated'],
        tags: ['ui'],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await service.analyzeTaskComplexity(simpleTask);

      expect(result.newComplexity).toBe(2);
      expect(result.riskFactors).toHaveLength(0);
      expect(result.confidence).toBe(0.95);
      expect(result.recommendations).toContain('Straightforward implementation');
    });
  });

  describe('expandTaskIntoSubtasks', () => {
    it('should break down complex task into manageable subtasks', async () => {
      const mockSubtasks = [
        {
          id: 'subtask-1',
          title: 'Design dashboard layout',
          description: 'Create wireframes and design for the dashboard layout',
          complexity: 3,
          estimatedHours: 6,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          acceptanceCriteria: ['Wireframes are approved', 'Design is finalized'],
          tags: ['design'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'subtask-2',
          title: 'Implement dashboard components',
          description: 'Build React components for the dashboard',
          complexity: 5,
          estimatedHours: 12,
          priority: 'high',
          status: 'pending',
          dependencies: ['subtask-1'],
          acceptanceCriteria: ['Components are implemented', 'Components are tested'],
          tags: ['frontend'],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockAIService.generateObject.mockResolvedValue({ subtasks: mockSubtasks });

      const complexTask = {
        id: 'task-1',
        title: 'Build analytics dashboard',
        description: 'Create comprehensive analytics dashboard with charts and metrics',
        complexity: 8 as TaskComplexity,
        estimatedHours: 24,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: ['Dashboard displays analytics'],
        tags: ['analytics'],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const input = {
        task: complexTask,
        maxDepth: 2,
        autoEstimate: true
      };

      const result = await service.expandTaskIntoSubtasks(input);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Design dashboard layout');
      expect(result[0].complexity).toBeLessThan(complexTask.complexity);
      expect(result[1].dependencies).toContain('subtask-1');
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateTaskRecommendations', () => {
    it('should provide next task recommendations based on team context', async () => {
      const mockRecommendations = {
        recommendations: [
          {
            taskId: 'task-1',
            reason: 'No dependencies and matches team skills',
            confidence: 0.9,
            priority: 'high'
          },
          {
            taskId: 'task-3',
            reason: 'Good complexity level for current sprint capacity',
            confidence: 0.75,
            priority: 'medium'
          }
        ],
        analysis: 'Start with infrastructure setup as it has no dependencies and the team has strong DevOps skills',
        sprintRecommendations: {
          totalEffort: 32,
          taskCount: 4,
          riskLevel: 'low'
        }
      };

      mockAIService.generateObject.mockResolvedValue(mockRecommendations);

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Setup infrastructure',
          complexity: 4 as TaskComplexity,
          estimatedHours: 8,
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dependencies: [],
          tags: ['devops']
        },
        {
          id: 'task-2',
          title: 'Implement feature',
          complexity: 6 as TaskComplexity,
          estimatedHours: 16,
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
          dependencies: ['task-1'],
          tags: ['frontend']
        }
      ];

      const input = {
        tasks: mockTasks as any,
        teamSkills: ['devops', 'javascript', 'react'],
        sprintCapacity: 40,
        maxComplexity: 7
      };

      const result = await service.generateTaskRecommendations(input);

      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].taskId).toBe('task-1');
      expect(result.recommendations[0].confidence).toBe(0.9);
      expect(result.analysis).toContain('infrastructure setup');
      expect(result.sprintRecommendations).toBeDefined();
      expect(mockAIService.generateObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle AI service errors gracefully', async () => {
      mockAIService.generateObject.mockRejectedValue(new Error('AI service error'));

      const input = {
        prd: 'Test PRD content',
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true
      };

      await expect(service.generateTasksFromPRD(input)).rejects.toThrow('AI service error');
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        prd: '', // Empty PRD
        maxTasks: 0, // Invalid max tasks
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true
      };

      await expect(service.generateTasksFromPRD(invalidInput)).rejects.toThrow();
    });
  });
});
