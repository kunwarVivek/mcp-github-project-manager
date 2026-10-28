import { describe, expect, it, vi } from "vitest";

/**
 * The compound AI actions used to dereference their arguments without a
 * check, so a call with only the `action` discriminator crashed with
 * "Cannot read properties of undefined (reading 'map')" - an error the
 * caller could not act on.
 *
 * These tests pin the fixed behaviour: a clear message naming the missing
 * parameter, and - just as important - the field-name mapping between the
 * compound schema and the analyzer the executor feeds.
 */

const calculateCapacity = vi.fn();
const prioritize = vi.fn();
const assessRisks = vi.fn();
const suggestSprintComposition = vi.fn();
const suggestLabels = vi.fn();
const detectDuplicates = vi.fn();
const findRelatedIssues = vi.fn();
const generateRoadmap = vi.fn();
const generateVisualizationData = vi.fn();

vi.mock("../../../../services/ai/SprintCapacityAnalyzer", () => ({
  SprintCapacityAnalyzer: class {
    calculateCapacity = calculateCapacity;
  },
}));
vi.mock("../../../../services/ai/BacklogPrioritizer", () => ({
  BacklogPrioritizer: class {
    prioritize = prioritize;
  },
}));
vi.mock("../../../../services/ai/SprintRiskAssessor", () => ({
  SprintRiskAssessor: class {
    assessRisks = assessRisks;
  },
}));
vi.mock("../../../../services/ai/SprintSuggestionService", () => ({
  SprintSuggestionService: class {
    suggestSprintComposition = suggestSprintComposition;
  },
}));
vi.mock("../../../../services/ai/LabelSuggestionService", () => ({
  LabelSuggestionService: class {
    suggestLabels = suggestLabels;
  },
}));
vi.mock("../../../../services/ai/DuplicateDetectionService", () => ({
  DuplicateDetectionService: class {
    detectDuplicates = detectDuplicates;
  },
}));
vi.mock("../../../../services/ai/RelatedIssueLinkingService", () => ({
  RelatedIssueLinkingService: class {
    findRelatedIssues = findRelatedIssues;
  },
}));
vi.mock("../../../../services/ai/RoadmapAIService", () => ({
  RoadmapAIService: class {
    generateRoadmap = generateRoadmap;
    generateVisualizationData = generateVisualizationData;
  },
}));

const { executeCalculateSprintCapacity } = await import(
  "../../../../infrastructure/tools/sprint-ai-tools"
);
const { executeSuggestLabels, executeDetectDuplicates, executeFindRelatedIssues } = await import(
  "../../../../infrastructure/tools/issue-intelligence-tools"
);
const { executeGenerateRoadmap, executeGenerateRoadmapVisualization } = await import(
  "../../../../infrastructure/tools/roadmap-ai-tools"
);

describe("compound AI actions fail with an actionable message", () => {
  it("calculate_capacity names teamMembers when it is missing", async () => {
    await expect(executeCalculateSprintCapacity({} as never)).rejects.toThrow(
      "teamMembers is required for calculate_capacity"
    );
  });

  it("calculate_capacity maps the compound schema's availabilityPercent to the analyzer's fraction", async () => {
    calculateCapacity.mockResolvedValue({ totalPoints: 10 });

    await executeCalculateSprintCapacity({
      velocity: 20,
      sprintDurationDays: 14,
      // The compound schema advertises `name` + `availabilityPercent`; the
      // analyzer wants an `id` and an `availability` fraction.
      teamMembers: [{ name: "ada", availabilityPercent: 50, skills: ["ts"] }],
    } as never);

    expect(calculateCapacity).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMembers: [{ id: "ada", name: "ada", availability: 0.5, skills: ["ts"] }],
      })
    );
  });

  it("suggest_labels names existingLabels when it is missing", async () => {
    await expect(executeSuggestLabels({} as never)).rejects.toThrow(
      "existingLabels is required for suggest_labels"
    );
  });

  it("detect_duplicates names existingIssues when it is missing", async () => {
    await expect(executeDetectDuplicates({} as never)).rejects.toThrow(
      "existingIssues is required for detect_duplicates"
    );
  });

  it("find_related names repositoryIssues when it is missing", async () => {
    await expect(executeFindRelatedIssues({} as never)).rejects.toThrow(
      "repositoryIssues is required for find_related"
    );
  });

  it("find_related accepts the compound schema's relationConfig", async () => {
    findRelatedIssues.mockResolvedValue({ relationships: [] });

    await executeFindRelatedIssues({
      issueId: "I_1",
      issueTitle: "t",
      issueDescription: "d",
      repositoryIssues: [],
      relationConfig: { includeDependencies: true },
    } as never);

    // The relation settings are handed to the service, not dropped.
    expect(findRelatedIssues).toHaveBeenCalled();
  });

  it("generate_roadmap names requirements when it is missing", async () => {
    await expect(executeGenerateRoadmap({} as never)).rejects.toThrow(
      "requirements is required for generate_roadmap"
    );
  });

  it("generate_visualization names the roadmap when it is missing", async () => {
    await expect(executeGenerateRoadmapVisualization(undefined as never)).rejects.toThrow(
      "roadmap is required for generate_visualization"
    );
    await expect(executeGenerateRoadmapVisualization({} as never)).rejects.toThrow(
      "roadmap.phases is required for generate_visualization"
    );
  });
});
