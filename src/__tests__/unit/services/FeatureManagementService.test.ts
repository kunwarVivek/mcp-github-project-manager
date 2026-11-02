import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureRequirement, PRDDocument } from "../../../domain/ai-types";
import type { AIServiceFactory } from "../../../services/ai/AIServiceFactory";
import { FeatureManagementService } from "../../../services/FeatureManagementService";
import { partialFake } from "../../helpers/aiFakes";

const sub = vi.hoisted(() => ({
  analyzeFeatureRequest: vi.fn(),
  addFeatureToPRD: vi.fn(),
  expandFeatureToTasks: vi.fn(),
  createInitialTaskLifecycleState: vi.fn(),
}));

vi.mock("../../../services/feature/FeatureAnalysisService", () => ({
  FeatureAnalysisService: vi.fn(function () {
    return { analyzeFeatureRequest: sub.analyzeFeatureRequest };
  }),
}));
vi.mock("../../../services/feature/FeaturePRDService", () => ({
  FeaturePRDService: vi.fn(function () {
    return { addFeatureToPRD: sub.addFeatureToPRD };
  }),
}));
vi.mock("../../../services/feature/FeatureExpansionService", () => ({
  FeatureExpansionService: vi.fn(function () {
    return { expandFeatureToTasks: sub.expandFeatureToTasks };
  }),
}));
vi.mock("../../../services/feature/TaskLifecycleService", () => ({
  TaskLifecycleService: vi.fn(function () {
    return { createInitialTaskLifecycleState: sub.createInitialTaskLifecycleState };
  }),
}));

describe("FeatureManagementService.createCompleteFeatureLifecycle", () => {
  const targetPRD = partialFake<PRDDocument>({ id: "prd-1", title: "Platform" });
  const prdFeature = { id: "feature-in-prd", title: "Dark mode" } as FeatureRequirement;
  const tasks = [{ id: "t1" }, { id: "t2" }];
  let service: FeatureManagementService;

  beforeEach(() => {
    sub.analyzeFeatureRequest.mockResolvedValue({
      recommendation: "approve",
      priority: "high",
      complexity: 6,
      dependencies: ["auth"],
    });
    sub.addFeatureToPRD.mockResolvedValue({
      updatedPRD: { id: "prd-1", title: "Platform v2" },
      newFeature: prdFeature,
    });
    sub.expandFeatureToTasks.mockResolvedValue({ tasks, estimatedEffort: 21 });
    sub.createInitialTaskLifecycleState.mockImplementation((task: { id: string }) => ({
      taskId: task.id,
    }));

    service = new FeatureManagementService(partialFake<AIServiceFactory>({}));
  });

  it("adds an approved feature to the PRD, expands it and creates one lifecycle state per task", async () => {
    const result = await service.createCompleteFeatureLifecycle({
      featureIdea: "Dark mode",
      description: "Let users switch themes",
      targetPRD,
      requestedBy: "alice",
      businessJustification: "Requested by many users",
    });

    expect(result.featureRequest).toMatchObject({
      featureIdea: "Dark mode",
      targetPRD: "prd-1",
      requestedBy: "alice",
      businessJustification: "Requested by many users",
      status: "pending",
    });
    expect(sub.analyzeFeatureRequest).toHaveBeenCalledWith(
      expect.objectContaining({ featureIdea: "Dark mode", existingPRD: targetPRD })
    );
    expect(sub.addFeatureToPRD).toHaveBeenCalledWith(
      expect.objectContaining({ targetPRD, featureRequest: result.featureRequest })
    );
    expect(result.updatedPRD).toMatchObject({ title: "Platform v2" });
    expect(sub.expandFeatureToTasks).toHaveBeenCalledWith({ feature: prdFeature });
    expect(result.lifecycleStates).toEqual([{ taskId: "t1" }, { taskId: "t2" }]);
    expect(result.roadmapUpdate).toBeUndefined();
  });

  it("builds a standalone feature from the analysis when there is no PRD", async () => {
    const result = await service.createCompleteFeatureLifecycle({
      featureIdea: "Dark Mode",
      description: "Let users switch themes",
      requestedBy: "alice",
    });

    expect(sub.addFeatureToPRD).not.toHaveBeenCalled();
    expect(result.updatedPRD).toBeUndefined();
    expect(sub.expandFeatureToTasks).toHaveBeenCalledWith({
      feature: expect.objectContaining({
        title: "Dark Mode",
        description: "Let users switch themes",
        priority: "high",
        estimatedComplexity: 6,
        dependencies: ["auth"],
        userStories: ["As a user, I want dark mode"],
      }),
    });
  });

  it("does not touch the PRD when the analysis does not recommend approval", async () => {
    sub.analyzeFeatureRequest.mockResolvedValue({
      recommendation: "reject",
      priority: "low",
      complexity: 2,
      dependencies: [],
    });

    const result = await service.createCompleteFeatureLifecycle({
      featureIdea: "Dark mode",
      description: "Let users switch themes",
      targetPRD,
      requestedBy: "alice",
    });

    expect(sub.addFeatureToPRD).not.toHaveBeenCalled();
    expect(result.updatedPRD).toBeUndefined();
  });

  it("adds the feature to the PRD with autoApprove even when the analysis rejects it", async () => {
    sub.analyzeFeatureRequest.mockResolvedValue({
      recommendation: "reject",
      priority: "low",
      complexity: 2,
      dependencies: [],
    });

    const result = await service.createCompleteFeatureLifecycle({
      featureIdea: "Dark mode",
      description: "Let users switch themes",
      targetPRD,
      requestedBy: "alice",
      autoApprove: true,
    });

    expect(sub.addFeatureToPRD).toHaveBeenCalledWith(
      expect.objectContaining({ autoApprove: true })
    );
    expect(result.updatedPRD).toBeDefined();
  });

  it("plans the new feature on the roadmap of the target project", async () => {
    const result = await service.createCompleteFeatureLifecycle({
      featureIdea: "Dark mode",
      description: "Let users switch themes",
      targetPRD,
      targetProject: "project-9",
      requestedBy: "alice",
    });

    expect(result.roadmapUpdate).toMatchObject({
      projectId: "project-9",
      features: { current: [], planned: [prdFeature], backlog: [] },
    });
    expect(Object.values(result.roadmapUpdate?.timeline.quarters ?? {})[0].features).toEqual([
      "feature-in-prd",
    ]);
  });

  it("reports a failing step as an error and creates no lifecycle states", async () => {
    sub.expandFeatureToTasks.mockRejectedValue(new Error("model unavailable"));

    await expect(
      service.createCompleteFeatureLifecycle({
        featureIdea: "Dark mode",
        description: "Let users switch themes",
        requestedBy: "alice",
      })
    ).rejects.toThrow(/model unavailable/);
    expect(sub.createInitialTaskLifecycleState).not.toHaveBeenCalled();
  });
});
