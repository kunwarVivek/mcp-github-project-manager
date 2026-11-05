import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import { AgentStore } from "../../../infrastructure/agent/AgentStore";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";

const agent: Agent = {
  id: "agent-1",
  name: "agent-agent-1",
  role: "engineer",
  runtime: "claude-code",
  capabilities: [],
  status: "idle",
  registeredAt: "2026-01-01T00:00:00Z",
};

function makeStore(contentsData: Record<string, unknown>, blob: Record<string, unknown>) {
  const rest = {
    repos: {
      getContent: vi.fn(async () => ({ data: contentsData })),
      createOrUpdateFileContents: vi.fn(async () => ({ data: {} })),
    },
    git: { getBlob: vi.fn(async () => ({ data: blob })) },
  };
  const factory = {
    getOctokit: () => ({ rest }),
    getConfig: () => ({ owner: "o", repo: "r" }),
  } as unknown as GitHubRepositoryFactory;
  return { rest, store: new AgentStore(factory, { sleep: async () => {} }) };
}

describe("AgentStore large registry", () => {
  const body = (agents: Agent[]) => Buffer.from(JSON.stringify(agents)).toString("base64");

  it("reads through the Git Blobs API when the Contents API omits the body", async () => {
    const { rest, store } = makeStore(
      { type: "file", encoding: "none", content: "", size: 2_000_000, sha: "blob-sha" },
      { encoding: "base64", content: body([agent]) }
    );

    await expect(store.listAgents()).resolves.toEqual([agent]);
    expect(rest.git.getBlob).toHaveBeenCalledWith({ owner: "o", repo: "r", file_sha: "blob-sha" });
  });

  it("writes with compare-and-swap on the Contents sha after a blob read", async () => {
    const { rest, store } = makeStore(
      { type: "file", encoding: "none", content: "", size: 2_000_000, sha: "blob-sha" },
      { encoding: "base64", content: body([agent]) }
    );

    await store.updateAgent("agent-1", (fresh) => ({ ...fresh, status: "working" }));

    expect(rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "blob-sha" })
    );
  });

  it("does not call the Blobs API when the Contents API inlines the body", async () => {
    const { rest, store } = makeStore(
      { type: "file", encoding: "base64", content: body([agent]), size: 100, sha: "s" },
      {}
    );

    await store.listAgents();

    expect(rest.git.getBlob).not.toHaveBeenCalled();
  });

  it("fails clearly when the blob is not base64", async () => {
    const { store } = makeStore(
      { type: "file", encoding: "none", content: "", size: 2_000_000, sha: "s" },
      { encoding: "utf-8", content: "x" }
    );

    await expect(store.listAgents()).rejects.toThrow(/cannot be read/);
  });
});
