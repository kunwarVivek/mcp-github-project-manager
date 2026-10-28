import { beforeEach, describe, expect, it, vi } from "vitest";

const processHeartbeat = vi.fn();

vi.mock("../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: vi.fn(() => ({})),
}));
vi.mock("../../../infrastructure/agent/AgentStore", () => ({
  AgentStore: vi.fn(function () {
    return {};
  }),
}));
vi.mock("../../../services/agent/AgentContextService", () => ({
  AgentContextService: vi.fn(function () {
    return {};
  }),
}));
vi.mock("../../../services/agent/TaskCheckoutService", () => ({
  TaskCheckoutService: vi.fn(function () {
    return { processHeartbeat };
  }),
}));

import { executeAgentHeartbeat } from "../../../infrastructure/tools/agent-orchestration-tools";

describe("executeAgentHeartbeat", () => {
  beforeEach(() => {
    processHeartbeat.mockReset();
  });

  it("returns success when the heartbeat is recorded", async () => {
    processHeartbeat.mockResolvedValue({ success: true });

    const result = await executeAgentHeartbeat({ agentId: "a1", status: "working", progress: 40 });

    expect(result.structuredContent).toEqual({ success: true, message: "Heartbeat recorded" });
    expect(result.content[0].text).toContain("a1");
    expect(result.content[0].text).toContain("(40%)");
  });

  it("throws, instead of reporting success, when the heartbeat could not be recorded", async () => {
    processHeartbeat.mockResolvedValue({
      success: false,
      message: "Project is missing agent_heartbeat_at; run agent_manage setup_fields",
    });

    await expect(
      executeAgentHeartbeat({ agentId: "a1", status: "working", taskId: "7" })
    ).rejects.toThrow(/setup_fields/);
  });
});
