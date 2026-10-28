import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORK_PRODUCT_MARKER, type WorkProduct } from "../../../domain/agent-orchestration-types";
import { executeAgentWork } from "../../../infrastructure/tools/compound/compound-executors";
import { FakeGitHub } from "../../helpers/FakeGitHub";

/**
 * `agent_work validate_work_product` reports which work product it judged.
 * The payload used to drop the submitting agent, so a reviewer could not tell
 * whose work the verdict was about.
 */

const holder = vi.hoisted(() => ({ factory: undefined as unknown }));

vi.mock("../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: () => holder.factory,
}));

const ISSUE_NUMBER = 7;

function comment(product: WorkProduct): string {
  return `## Agent Work Product\n\n${WORK_PRODUCT_MARKER} ${JSON.stringify(product)} -->\n`;
}

describe("agent_work validate_work_product", () => {
  let github: FakeGitHub;

  beforeEach(() => {
    github = new FakeGitHub();
    github.addIssue({
      number: ISSUE_NUMBER,
      title: "Task",
      body: "Do it.\n\n## Acceptance Criteria\n- It works",
    });
    holder.factory = github.asFactory();
  });

  it("names the agent that submitted the validated work product", async () => {
    github.addComment(
      ISSUE_NUMBER,
      comment({
        id: "wp-1",
        agentId: "agent-worker",
        taskId: String(ISSUE_NUMBER),
        commitShas: [],
        filesChanged: ["src/a.ts"],
        testResults: { passed: 2, failed: 0, skipped: 0, total: 2 },
        summary: "Implemented the task end to end",
        submittedAt: "2026-01-01T00:00:00Z",
      })
    );

    const result = (await executeAgentWork({
      action: "validate_work_product",
      agentId: "agent-worker",
      taskId: String(ISSUE_NUMBER),
    } as Parameters<typeof executeAgentWork>[0])) as {
      valid: boolean;
      workProduct: { id: string; agentId: string; files: string[] };
    };

    expect(result.valid).toBe(true);
    expect(result.workProduct.id).toBe("wp-1");
    expect(result.workProduct.agentId).toBe("agent-worker");
    expect(result.workProduct.files).toEqual(["src/a.ts"]);
  });
});
