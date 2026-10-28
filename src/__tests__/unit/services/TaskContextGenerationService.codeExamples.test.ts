import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AITask,
  type EnhancedTaskGenerationConfig,
  type TaskComplexity,
  TaskPriority,
  TaskStatus,
} from "../../../domain/ai-types";
import type { AIServiceFactory } from "../../../services/ai/AIServiceFactory";
import { TaskContextGenerationService } from "../../../services/TaskContextGenerationService";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateObject: vi.fn(),
}));

const task: AITask = {
  id: "task-1",
  title: "Implement user authentication",
  description: "Create secure login and registration functionality",
  status: TaskStatus.PENDING,
  priority: TaskPriority.HIGH,
  complexity: 7 as TaskComplexity,
  estimatedHours: 16,
  actualHours: 0,
  aiGenerated: true,
  subtasks: [],
  dependencies: [],
  acceptanceCriteria: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  tags: [],
};

const config: EnhancedTaskGenerationConfig = {
  enableEnhancedGeneration: true,
  createTraceabilityMatrix: false,
  generateUseCases: false,
  createLifecycleTracking: false,
  contextLevel: "standard",
  includeBusinessContext: false,
  includeTechnicalContext: false,
  includeImplementationGuidance: true,
  enforceTraceability: false,
  requireBusinessJustification: false,
  trackRequirementCoverage: false,
};

const aiExample = {
  title: "Login handler with hashing",
  description: "Demonstrates password verification with bcrypt",
  language: "typescript",
  snippet: "export async function login(email: string, password: string) { /* ... */ }",
  explanation: "Verifies the password hash before issuing a session token",
  source: "generated",
};

function factoryWith(model: object | null): AIServiceFactory {
  return {
    getBestAvailableModel: () => model,
    getModel: () => model,
  } as unknown as AIServiceFactory;
}

/** Answer only the code-example request; every other AI call fails soft. */
function mockOnlyCodeExamples(examples: unknown[]): void {
  vi.mocked(generateObject).mockImplementation((async (opts: { schema: unknown }) => {
    const shape = (opts.schema as { shape?: Record<string, unknown> }).shape;
    if (shape && "examples" in shape) {
      return { object: { examples } };
    }
    throw new Error("unavailable");
  }) as unknown as typeof generateObject);
}

describe("TaskContextGenerationService code examples", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
  });

  it("carries generated examples in contextualReferences.codeExamples, deduplicated", async () => {
    mockOnlyCodeExamples([aiExample, { ...aiExample }]);
    const service = new TaskContextGenerationService(factoryWith({ modelId: "fake" }));

    const { context } = await service.generateTaskContext(task, "prd text", config);

    const examples = context.contextualReferences?.codeExamples ?? [];
    expect(examples.filter((e) => e.snippet === aiExample.snippet)).toHaveLength(1);
  });

  it("does not generate examples when implementation guidance is disabled", async () => {
    mockOnlyCodeExamples([aiExample]);
    const service = new TaskContextGenerationService(factoryWith({ modelId: "fake" }));

    const { context } = await service.generateTaskContext(task, "prd text", {
      ...config,
      includeImplementationGuidance: false,
    });

    const examples = context.contextualReferences?.codeExamples ?? [];
    expect(examples.some((e) => e.snippet === aiExample.snippet)).toBe(false);
  });

  it("yields no code examples and does not throw when AI is unavailable", async () => {
    const service = new TaskContextGenerationService(factoryWith(null));

    const { context, metrics } = await service.generateTaskContext(task, "prd text", config);

    expect(context.contextualReferences?.codeExamples ?? []).toEqual([]);
    expect(metrics.errors).toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });
});
