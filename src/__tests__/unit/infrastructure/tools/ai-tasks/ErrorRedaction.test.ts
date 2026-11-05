import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import type { MCPResponse } from "../../../../../domain/mcp-types";
import { executeAddFeature } from "../../../../../infrastructure/tools/ai-tasks/AddFeatureTool";
import { executeAnalyzeTaskComplexity } from "../../../../../infrastructure/tools/ai-tasks/AnalyzeTaskComplexityTool";
import { executeCreateTraceabilityMatrix } from "../../../../../infrastructure/tools/ai-tasks/CreateTraceabilityMatrixTool";
import { executeEnhancePRD } from "../../../../../infrastructure/tools/ai-tasks/EnhancePRDTool";
import { executeGetNextTask } from "../../../../../infrastructure/tools/ai-tasks/GetNextTaskTool";
import { executeParsePRD } from "../../../../../infrastructure/tools/ai-tasks/ParsePRDTool";

const TOKEN = `ghp_${"a1B2c3D4e5".repeat(4).slice(0, 36)}`;
const FAILURE = new Error(`upstream rejected request using ${TOKEN} while calling provider`);

const failing = vi.hoisted(() => ({ fail: (): never => undefined as never }));

vi.mock("../../../../../services/FeatureManagementService", () => ({
  FeatureManagementService: vi.fn().mockImplementation(function () {
    return { createCompleteFeatureLifecycle: vi.fn().mockImplementation(failing.fail) };
  }),
}));
vi.mock("../../../../../services/TaskGenerationService", () => ({
  TaskGenerationService: vi.fn().mockImplementation(function () {
    return { analyzeTaskComplexity: vi.fn().mockImplementation(failing.fail) };
  }),
}));
vi.mock("../../../../../services/RequirementsTraceabilityService", () => ({
  RequirementsTraceabilityService: vi.fn().mockImplementation(function () {
    return { createTraceabilityMatrix: vi.fn().mockImplementation(failing.fail) };
  }),
}));
vi.mock("../../../../../services/PRDGenerationService", () => ({
  PRDGenerationService: vi.fn().mockImplementation(function () {
    return {
      enhancePRD: vi.fn().mockImplementation(failing.fail),
      extractFeaturesFromPRD: vi.fn().mockImplementation(failing.fail),
    };
  }),
}));
vi.mock("../../../../../services/NextTaskService", () => ({
  NextTaskService: vi.fn().mockImplementation(function () {
    return { recommend: vi.fn().mockImplementation(failing.fail) };
  }),
}));
vi.mock("../../../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: vi.fn().mockReturnValue({}),
}));

const PRD = `# Product\n${"The system lets users plan sprints and track delivery. ".repeat(4)}`;

const CASES: ReadonlyArray<{
  tool: string;
  run: () => Promise<MCPResponse>;
  returned: string;
}> = [
  {
    tool: "add_feature",
    returned: "Failed to add feature",
    run: () =>
      executeAddFeature({
        featureIdea: "Dark mode toggle",
        description: "Users can switch the interface between light and dark themes",
        requestedBy: "tester",
      }),
  },
  {
    tool: "analyze_task_complexity",
    returned: "Failed to analyze task complexity",
    run: () =>
      executeAnalyzeTaskComplexity({
        taskTitle: "Build exporter",
        taskDescription: "Export all project data to CSV files on demand",
        teamExperience: "mixed",
      }),
  },
  {
    tool: "create_traceability_matrix",
    returned: "Failed to create traceability matrix",
    run: () =>
      executeCreateTraceabilityMatrix({
        projectId: "p1",
        prdContent: PRD,
        features: [],
        tasks: [],
      }),
  },
  {
    tool: "enhance_prd",
    returned: "Failed to enhance PRD",
    run: () =>
      executeEnhancePRD({
        prdContent: PRD,
        enhancementType: "comprehensive",
        focusAreas: [],
        includeResearch: false,
        targetAudience: "mixed",
        addMissingElements: false,
        validateQuality: false,
      }),
  },
  {
    tool: "get_next_task",
    returned: "Failed to get task recommendations",
    run: () => executeGetNextTask({}),
  },
  {
    tool: "parse_prd",
    returned: "Failed to parse PRD",
    run: () => executeParsePRD({ prdContent: PRD }),
  },
];

describe("ai-task tool error sinks redact credential-shaped values", () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    failing.fail = () => {
      throw FAILURE;
    };
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it.each(CASES)(
    "$tool: token absent from stderr and returned text, message kept",
    async ({ run, returned, tool }) => {
      const response = await run();

      const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
      expect(stderr).toContain(`Error in ${tool} tool`);
      expect(stderr).toContain("upstream rejected request");
      expect(stderr).not.toContain(TOKEN);

      const returnedText = JSON.stringify(response);
      expect(returnedText).toContain(returned);
      expect(returnedText).toContain("while calling provider");
      expect(returnedText).not.toContain(TOKEN);
    }
  );
});
