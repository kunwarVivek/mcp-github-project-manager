import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAnalyzeTaskComplexity } from "../../../../../infrastructure/tools/ai-tasks/AnalyzeTaskComplexityTool";
import { executeCreateTraceabilityMatrix } from "../../../../../infrastructure/tools/ai-tasks/CreateTraceabilityMatrixTool";
import { ToolArgumentError } from "../../../../../infrastructure/tools/ToolValidator";

const analyzeTaskComplexity = vi.fn();

vi.mock("../../../../../services/TaskGenerationService", () => ({
  TaskGenerationService: vi.fn().mockImplementation(function () {
    return { analyzeTaskComplexity };
  }),
}));

async function validationIssues(call: Promise<unknown>) {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(ToolArgumentError);
  return (error as ToolArgumentError).issues;
}

describe("standalone ai-task executors validate their own arguments", () => {
  beforeEach(() => {
    analyzeTaskComplexity.mockReset();
  });

  describe("analyze_task_complexity", () => {
    it("names the missing required fields instead of throwing a TypeError", async () => {
      const issues = await validationIssues(executeAnalyzeTaskComplexity({}));

      expect(issues.map((i) => i.path)).toEqual(
        expect.arrayContaining(["taskTitle", "taskDescription"])
      );
      expect(analyzeTaskComplexity).not.toHaveBeenCalled();
    });

    it("rejects a too-short title", async () => {
      const issues = await validationIssues(
        executeAnalyzeTaskComplexity({
          taskTitle: "ab",
          taskDescription: "long enough description",
        })
      );

      expect(issues.map((i) => i.path)).toEqual(["taskTitle"]);
    });

    it("runs with valid args and applies schema defaults", async () => {
      analyzeTaskComplexity.mockResolvedValue({
        originalComplexity: 5,
        newComplexity: 6,
        estimatedHours: 12,
        analysis: "moderate",
        recommendations: [],
      });

      const result = await executeAnalyzeTaskComplexity({
        taskTitle: "Build login",
        taskDescription: "Implement the login form with validation",
      });

      expect(analyzeTaskComplexity).toHaveBeenCalledOnce();
      expect(JSON.stringify(result)).toContain("Task Complexity Analysis");
      // teamExperience default "mixed" is applied from the parsed value
      expect(JSON.stringify(result)).not.toContain("Failed to analyze");
    });
  });

  describe("create_traceability_matrix", () => {
    const prdContent = `# Product\n\n## Objectives\n- ship the thing\n\n## Overview\n${"x".repeat(100)}`;

    it("names the missing required fields instead of throwing a TypeError", async () => {
      const issues = await validationIssues(executeCreateTraceabilityMatrix({ projectId: "p1" }));

      expect(issues.map((i) => i.path)).toEqual(
        expect.arrayContaining(["prdContent", "features", "tasks"])
      );
    });

    it("rejects PRD content shorter than 100 characters", async () => {
      const issues = await validationIssues(
        executeCreateTraceabilityMatrix({
          projectId: "p1",
          prdContent: "too short",
          features: [],
          tasks: [],
        })
      );

      expect(issues.map((i) => i.path)).toEqual(["prdContent"]);
    });

    it("builds a matrix for valid args", async () => {
      const result = await executeCreateTraceabilityMatrix({
        projectId: "p1",
        prdContent,
        features: [
          {
            id: "f1",
            title: "Login",
            description: "User login",
            priority: "high",
            userStories: ["As a user I log in"],
            acceptanceCriteria: ["Valid credentials succeed"],
            estimatedComplexity: 3,
          },
        ],
        tasks: [
          {
            id: "t1",
            title: "Login form",
            description: "Build the form",
            complexity: 3,
            estimatedHours: 4,
            priority: "high",
          },
        ],
      });

      expect(JSON.stringify(result)).not.toContain("Failed to create traceability matrix");
      expect(JSON.stringify(result)).toContain("Requirements Traceability Matrix Created");
    });
  });
});
