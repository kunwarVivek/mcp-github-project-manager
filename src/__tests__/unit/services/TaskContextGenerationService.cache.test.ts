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
import { AIResponseCache } from "../../../services/ai/AIResponseCache";
import type { AIServiceFactory } from "../../../services/ai/AIServiceFactory";
import { ImplementationGuidanceSchema } from "../../../services/ai/prompts/ContextGenerationPrompts";
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
  technicalConsiderations: ["Rate limit logins"],
  bestPractices: [],
  commonPitfalls: [],
  testingStrategy: { approach: "Unit tests", testTypes: [], coverage: "80%", tools: [] },
  qualityAssurance: [],
  performanceOptimization: [],
};

function factoryWith(modelId: string): AIServiceFactory {
  const model = { provider: "fake", modelId };
  return {
    getBestAvailableModel: () => model,
    getModel: () => model,
  } as unknown as AIServiceFactory;
}

function guidanceCalls(): number {
  return vi
    .mocked(generateObject)
    .mock.calls.filter(
      ([opts]) => (opts as { schema?: unknown }).schema === ImplementationGuidanceSchema
    ).length;
}

/** Answer only the guidance request; every other AI call fails soft. */
function mockGuidance(fail = false): void {
  vi.mocked(generateObject).mockImplementation((async (opts: { schema: unknown }) => {
    if (opts.schema === ImplementationGuidanceSchema) {
      if (fail) throw new Error("provider down");
      return { object: structuredClone(guidanceObject) };
    }
    throw new Error("unavailable");
  }) as unknown as typeof generateObject);
}

describe("TaskContextGenerationService AI response cache", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
  });

  it("serves an identical second build from the cache and reports cacheHit", async () => {
    mockGuidance();
    const cache = new AIResponseCache();
    const service = new TaskContextGenerationService(factoryWith("m1"), new NoopLogger(), cache);

    const first = await service.generateTaskContext(task, "prd text", config);
    const second = await service.generateTaskContext(task, "prd text", config);

    expect(first.metrics.cacheHit).toBe(false);
    expect(second.metrics.cacheHit).toBe(true);
    expect(guidanceCalls()).toBe(1);
    expect(second.context.implementationGuidance).toEqual(first.context.implementationGuidance);
    expect(cache.size).toBe(1);
  });

  it("misses when prompt-affecting input or the model differs", async () => {
    mockGuidance();
    const cache = new AIResponseCache();
    const service = new TaskContextGenerationService(factoryWith("m1"), new NoopLogger(), cache);

    await service.generateTaskContext(task, "prd text", config);
    const changedTask = await service.generateTaskContext(
      { ...task, title: "Implement SSO" },
      "prd text",
      config
    );
    const otherModel = await new TaskContextGenerationService(
      factoryWith("m2"),
      new NoopLogger(),
      cache
    ).generateTaskContext(task, "prd text", config);

    expect(changedTask.metrics.cacheHit).toBe(false);
    expect(otherModel.metrics.cacheHit).toBe(false);
    expect(guidanceCalls()).toBe(3);
  });

  it("does not cache failed generations", async () => {
    const cache = new AIResponseCache();
    const service = new TaskContextGenerationService(factoryWith("m1"), new NoopLogger(), cache);

    mockGuidance(true);
    const failed = await service.generateTaskContext(task, "prd text", config);
    expect(failed.context.implementationGuidance).toBeUndefined();
    expect(cache.size).toBe(0);

    mockGuidance();
    const retried = await service.generateTaskContext(task, "prd text", config);
    expect(retried.metrics.cacheHit).toBe(false);
    expect(retried.context.implementationGuidance?.recommendedApproach).toBe(
      guidanceObject.recommendedApproach
    );
    expect(cache.size).toBe(1);
  });
});
