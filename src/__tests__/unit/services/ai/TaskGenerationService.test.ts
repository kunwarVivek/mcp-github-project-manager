import { generateObject } from "ai";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { type TaskComplexity, TaskPriority, TaskStatus } from "../../../../domain/ai-types";
import { AIServiceFactory } from "../../../../services/ai/AIServiceFactory";
import { TaskGenerationService } from "../../../../services/TaskGenerationService";
import { generateObjectResult } from "../../../helpers/aiFakes";

// Mock the AI service factory
vi.mock("../../../../services/ai/AIServiceFactory", () => {
  const mockFactory = {
    getMainModel: vi.fn(),
    getFallbackModel: vi.fn(),
    getModel: vi.fn(),
    getBestAvailableModel: vi.fn(),
    getPRDModel: vi.fn(),
    getResearchModel: vi.fn(),
  };
  return {
    AIServiceFactory: {
      getInstance: vi.fn().mockReturnValue(mockFactory),
    },
  };
});

// Mock the ai package
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

describe("TaskGenerationService", () => {
  let service: TaskGenerationService;
  let mockAIService: { modelId: string; provider: string };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Mock AI service - just needs to be a valid model object
    mockAIService = {
      modelId: "test-model",
      provider: "test-provider",
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getMainModel: vi.fn().mockReturnValue(mockAIService),
      getFallbackModel: vi.fn().mockReturnValue(mockAIService),
      getModel: vi.fn().mockReturnValue(mockAIService),
      getBestAvailableModel: vi.fn().mockReturnValue(mockAIService),
      getPRDModel: vi.fn().mockReturnValue(mockAIService),
      getResearchModel: vi.fn().mockReturnValue(mockAIService),
    };

    (AIServiceFactory.getInstance as Mock).mockReturnValue(mockFactory);

    service = new TaskGenerationService();
  });

  describe("generateTasksFromPRD", () => {
    it("should generate tasks from PRD content", async () => {
      const mockTasks = [
        {
          id: "task-1",
          title: "Setup project infrastructure",
          description: "Initialize project structure and CI/CD pipeline",
          complexity: 4,
          estimatedHours: 8,
          priority: "high",
          status: "pending",
          dependencies: [],
          acceptanceCriteria: ["Project structure is created", "CI/CD pipeline is configured"],
          tags: ["setup", "infrastructure"],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "task-2",
          title: "Implement user authentication",
          description: "Create secure login and registration functionality",
          complexity: 6,
          estimatedHours: 16,
          priority: "critical",
          status: "pending",
          dependencies: ["task-1"],
          acceptanceCriteria: ["Users can register with email", "Users can login securely"],
          tags: ["auth", "security"],
          aiGenerated: true,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(generateObject).mockResolvedValue(generateObjectResult(mockTasks));

      const input = {
        prd: "Task management application with user authentication and task CRUD operations",
        maxTasks: 10,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
      };

      const result = await service.generateTasksFromPRD(input);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Setup project infrastructure");
      expect(result[0].complexity).toBe(4);
      expect(result[0].estimatedHours).toBe(8);
      expect(result[1].dependencies).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "task-1" })])
      );
      // Enhanced task generation may call generateObject multiple times
      expect(generateObject).toHaveBeenCalled();
    });

    it("should include subtasks when requested", async () => {
      const mockTasksWithSubtasks = [
        {
          id: "task-1",
          title: "Complex feature implementation",
          description: "Implement a complex feature with multiple components",
          complexity: 8,
          estimatedHours: 24,
          priority: "high",
          status: "pending",
          dependencies: [],
          acceptanceCriteria: ["Feature is fully implemented"],
          tags: ["complex"],
          aiGenerated: true,
          subtasks: [
            {
              id: "subtask-1",
              title: "Design component architecture",
              description: "Design the overall architecture for the feature",
              complexity: 4,
              estimatedHours: 8,
              priority: "high",
              status: "pending",
              dependencies: [],
              acceptanceCriteria: ["Architecture is documented"],
              tags: ["design"],
              aiGenerated: true,
              subtasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(generateObject).mockResolvedValue(generateObjectResult(mockTasksWithSubtasks));

      const input = {
        prd: "Application with complex features requiring subtask breakdown",
        maxTasks: 5,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
      };

      const result = await service.generateTasksFromPRD(input);

      expect(result[0].subtasks).toBeDefined();
      expect(result[0].subtasks.length).toBeGreaterThan(0);
      // The service actually returns SubTask objects, not string IDs
      expect(result[0].subtasks[0]).toEqual(
        expect.objectContaining({
          id: "subtask-1",
          title: "Design component architecture",
        })
      );
    });
  });

  describe("generateEnhancedTasksFromPRD", () => {
    const enhancedTasks = [
      {
        id: "task-1",
        title: "Implement Product Catalog",
        description: "Create a product catalog with search and filtering",
        status: "TODO",
        priority: "HIGH",
        complexity: 5,
        estimatedHours: 40,
        acceptanceCriteria: ["Users can browse products by category"],
        parentPRDId: "prd-123",
        implementsRequirements: ["br-1"],
        implementsUseCases: ["uc-1"],
        implementsFeatures: ["feature-1"],
      },
      {
        id: "task-2",
        title: "Implement Shopping Cart",
        description: "Build shopping cart functionality",
        status: "TODO",
        priority: "HIGH",
        complexity: 4,
        estimatedHours: 32,
        acceptanceCriteria: ["Users can add products to cart"],
        parentPRDId: "prd-123",
        implementsRequirements: ["br-2"],
        implementsUseCases: ["uc-2"],
        implementsFeatures: ["feature-2"],
      },
    ];

    const baseConfig = {
      createTraceabilityMatrix: false,
      generateUseCases: false,
      createLifecycleTracking: false,
      contextLevel: "minimal" as const,
      includeBusinessContext: false,
      includeTechnicalContext: false,
      includeImplementationGuidance: false,
      enforceTraceability: false,
      requireBusinessJustification: false,
      trackRequirementCoverage: false,
    };

    it("returns the generated tasks when enhanced generation is disabled", async () => {
      vi.mocked(generateObject).mockResolvedValue(generateObjectResult(enhancedTasks));

      const result = await service.generateEnhancedTasksFromPRD({
        prd: "E-commerce platform with catalog and cart",
        maxTasks: 2,
        enhancedConfig: { ...baseConfig, enableEnhancedGeneration: false },
      });

      expect(result.map((t) => t.title)).toEqual([
        "Implement Product Catalog",
        "Implement Shopping Cart",
      ]);
      expect(generateObject).toHaveBeenCalled();
    });

    it("keeps generated tasks when enhanced generation builds traceability", async () => {
      vi.mocked(generateObject).mockResolvedValue(generateObjectResult(enhancedTasks));

      const result = await service.generateEnhancedTasksFromPRD({
        prd: "E-commerce platform with catalog and cart",
        maxTasks: 2,
        enhancedConfig: {
          ...baseConfig,
          enableEnhancedGeneration: true,
          createTraceabilityMatrix: true,
          enforceTraceability: true,
          trackRequirementCoverage: true,
        },
      });

      expect(result.map((t) => t.title)).toEqual([
        "Implement Product Catalog",
        "Implement Shopping Cart",
      ]);
      expect(result[0].estimatedHours).toBe(40);
    });
  });

  describe("analyzeTaskComplexity", () => {
    it("should analyze task complexity and provide recommendations", async () => {
      vi.mocked(generateObject).mockResolvedValue(
        generateObjectResult({
          complexity: 7,
          estimatedHours: 16,
          analysis: "Task complexity analysis shows increased complexity due to real-time features",
          riskFactors: ["WebSocket complexity"],
          recommendations: ["Use a mature WebSocket library"],
        })
      );

      const task = {
        id: "task-1",
        title: "Implement real-time collaboration",
        description: "Build WebSocket-based real-time collaboration with conflict resolution",
        complexity: 5 as TaskComplexity,
        estimatedHours: 12,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: [
          { id: "ac-1", description: "Real-time collaboration works", completed: false },
        ],
        tags: ["realtime"],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await service.analyzeTaskComplexity(task);

      expect(result.newComplexity).toBe(7);
      expect(result.estimatedHours).toBe(16);
      expect(result.analysis).toBeDefined();
      expect(result.recommendations).toEqual(["Use a mature WebSocket library"]);
      expect(vi.mocked(generateObject)).toHaveBeenCalled();
    });

    it("should handle simple tasks with low complexity", async () => {
      vi.mocked(generateObject).mockResolvedValue(
        generateObjectResult({
          complexity: 2,
          estimatedHours: 3,
          analysis: "Simple task with low complexity",
          riskFactors: [],
          recommendations: [],
        })
      );

      const simpleTask = {
        id: "task-1",
        title: "Update button color",
        description: "Change the primary button color from blue to green",
        complexity: 2 as TaskComplexity,
        estimatedHours: 2,
        priority: TaskPriority.LOW,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: [
          { id: "ac-2", description: "Button color is updated", completed: false },
        ],
        tags: ["ui"],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await service.analyzeTaskComplexity(simpleTask);

      expect(result.newComplexity).toBe(2);
      expect(result.analysis).toBeDefined();
      expect(result.recommendations).toEqual([]);
    });
  });

  describe("expandTaskIntoSubtasks", () => {
    it("should break down complex task into manageable subtasks", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("mock not configured"));

      const complexTask = {
        id: "task-1",
        title: "Build analytics dashboard",
        description: "Create comprehensive analytics dashboard with charts and metrics",
        complexity: 8 as TaskComplexity,
        estimatedHours: 24,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: [],
        acceptanceCriteria: [
          { id: "ac-3", description: "Dashboard displays analytics", completed: false },
        ],
        tags: ["analytics"],
        aiGenerated: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const input = {
        task: complexTask,
        maxDepth: 2,
        autoEstimate: true,
      };

      const result = await service.expandTaskIntoSubtasks(input);

      expect(result).toHaveLength(3); // Service generates 3 subtasks: Setup, Implementation, Testing
      expect(result[0].title).toContain("Setup");
      expect(result[0].complexity).toBeLessThan(complexTask.complexity);
      expect(result[1].title).toContain("Implementation");
      expect(vi.mocked(generateObject)).toHaveBeenCalled();
    });
  });

  // Note: generateTaskRecommendations method doesn't exist in TaskGenerationService

  describe("error handling", () => {
    it("should handle AI service errors gracefully", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("AI service error"));

      const input = {
        prd: "Test PRD content",
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
      };

      await expect(service.generateTasksFromPRD(input)).rejects.toThrow("AI service error");
    });

    it("should handle empty PRD input gracefully", async () => {
      vi.mocked(generateObject).mockResolvedValue(generateObjectResult([])); // Return empty tasks for empty PRD

      const emptyInput = {
        prd: "", // Empty PRD
        maxTasks: 0, // Invalid max tasks
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
      };

      const result = await service.generateTasksFromPRD(emptyInput);
      expect(result).toEqual([]);
    });
  });
});
