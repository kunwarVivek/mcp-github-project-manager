import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AITask,
  type EnhancedTaskGenerationConfig,
  type TaskComplexity,
  TaskPriority,
  TaskStatus,
} from "../../../domain/ai-types";
import { NoopLogger } from "../../../infrastructure/logger";
import { traceContext } from "../../../infrastructure/observability/CorrelationContext";
import { AIResponseCache } from "../../../services/ai/AIResponseCache";
import type { AIServiceFactory } from "../../../services/ai/AIServiceFactory";
import { ImplementationGuidanceSchema } from "../../../services/ai/prompts/ContextGenerationPrompts";
import { TokenBudgetManager } from "../../../services/ai/TokenBudgetManager";
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

const guidanceObject = {
  recommendedApproach: "Use bcrypt with a session store",
  implementationSteps: [
    {
      step: 1,
      title: "Hash",
      description: "Hash passwords",
      estimatedTime: "1h",
      dependencies: [],
    },
  ],
  technicalConsiderations: [],
  bestPractices: [],
  commonPitfalls: [],
  testingStrategy: { approach: "Unit tests", testTypes: [], coverage: "80%", tools: [] },
  qualityAssurance: [],
  performanceOptimization: [],
};

const factory = {
  getBestAvailableModel: () => ({ provider: "fake", modelId: "m1" }),
  getModel: () => ({ provider: "fake", modelId: "m1" }),
} as unknown as AIServiceFactory;

function inSession<T>(fn: () => Promise<T>): Promise<T> {
  return traceContext.run({ correlationId: "session-1", startTime: 0, operation: "test" }, fn);
}

describe("TaskContextGenerationService token budget", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
    vi.mocked(generateObject).mockImplementation((async (opts: { schema: unknown }) => {
      if (opts.schema === ImplementationGuidanceSchema) {
        return {
          object: structuredClone(guidanceObject),
          usage: { inputTokens: { total: 20 }, outputTokens: { total: 30 } },
        };
      }
      throw new Error("unavailable");
    }) as unknown as typeof generateObject);
  });

  it("commits provider-reported usage to the correlation-id session", async () => {
    const budget = new TokenBudgetManager(1_000_000);
    const service = new TaskContextGenerationService(
      factory,
      new NoopLogger(),
      new AIResponseCache(),
      budget
    );

    await inSession(() => service.generateTaskContext(task, "prd", config));

    expect(budget.getStatus("session-1")).toMatchObject({ used: 50, reserved: 0 });
  });

  it("skips AI generation and returns the fallback context when the budget is exhausted", async () => {
    const budget = new TokenBudgetManager(1);
    const service = new TaskContextGenerationService(
      factory,
      new NoopLogger(),
      new AIResponseCache(),
      budget
    );

    const result = await inSession(() => service.generateTaskContext(task, "prd", config));

    expect(result.context.implementationGuidance).toBeUndefined();
    expect(vi.mocked(generateObject)).not.toHaveBeenCalledWith(
      expect.objectContaining({ schema: ImplementationGuidanceSchema })
    );
  });

  it("consumes no budget on a cache hit", async () => {
    const budget = new TokenBudgetManager(1_000_000);
    const service = new TaskContextGenerationService(
      factory,
      new NoopLogger(),
      new AIResponseCache(),
      budget
    );

    await inSession(() => service.generateTaskContext(task, "prd", config));
    const afterFirst = budget.getStatus("session-1");
    const second = await inSession(() => service.generateTaskContext(task, "prd", config));

    expect(second.metrics.cacheHit).toBe(true);
    expect(budget.getStatus("session-1")).toEqual(afterFirst);
  });
});
