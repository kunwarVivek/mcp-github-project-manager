import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import {
  ClaimNotHeldError,
  clearItemHeartbeatTargets,
  ItemHeartbeatStore,
  MissingAgentFieldError,
} from "../../../infrastructure/agent/ItemHeartbeatStore";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import {
  AgentHeartbeatResolver,
  claimantChain,
} from "../../../services/agent/AgentHeartbeatResolver";

type Vars = Record<string, unknown>;

const ALL_FIELDS = [
  { id: "f-hb", name: "agent_heartbeat_at" },
  { id: "f-prog", name: "agent_progress" },
  { id: "f-branch", name: "agent_work_branch" },
  { id: "f-by", name: "agent_claimed_by" },
];

interface BoardItem {
  claimedBy?: string;
  heartbeatAt?: string;
  progress?: number;
  branch?: string;
}

function agent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    role: "engineer",
    runtime: "claude-code",
    capabilities: [],
    status: "working",
    registeredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ItemHeartbeatStore", () => {
  let graphql: Mock;
  let board: Map<number, BoardItem[]>;
  let fields: Array<{ id: string; name: string }>;
  let now: number;
  let store: ItemHeartbeatStore;

  const itemNode = (issue: number, item: BoardItem, index: number) => ({
    id: `item-${issue}-${index}`,
    project: { id: "project-1" },
    fieldValues: {
      nodes: [
        ...(item.claimedBy ? [{ field: { name: "agent_claimed_by" }, text: item.claimedBy }] : []),
        ...(item.heartbeatAt
          ? [{ field: { name: "agent_heartbeat_at" }, text: item.heartbeatAt }]
          : []),
        ...(item.progress !== undefined
          ? [{ field: { name: "agent_progress" }, number: item.progress }]
          : []),
        ...(item.branch ? [{ field: { name: "agent_work_branch" }, text: item.branch }] : []),
      ],
    },
  });

  beforeEach(() => {
    clearItemHeartbeatTargets();
    board = new Map();
    fields = ALL_FIELDS;
    now = 1_000_000;
    graphql = vi.fn(async (query: string, vars: Vars) => {
      if (query.includes("i0: issue(")) {
        const repository: Record<string, unknown> = {};
        for (const match of query.matchAll(/(i\d+): issue\(number: (\d+)\)/g)) {
          const items = board.get(Number(match[2])) ?? [];
          repository[match[1]] = {
            projectItems: { nodes: items.map((item, i) => itemNode(Number(match[2]), item, i)) },
          };
        }
        return { repository };
      }
      if (query.includes("issue(number: $number)")) {
        const items = board.get(vars.number as number);
        return {
          repository: {
            issue: items
              ? {
                  projectItems: {
                    nodes: items.map((i, n) => itemNode(vars.number as number, i, n)),
                  },
                }
              : null,
          },
        };
      }
      if (vars.projectId && !vars.itemId) return { node: { fields: { nodes: fields } } };
      return {};
    });
    store = new ItemHeartbeatStore(
      {
        getConfig: () => ({ owner: "o", repo: "r" }),
        graphql,
      } as unknown as GitHubRepositoryFactory,
      { now: () => now }
    );
  });

  const mutations = (): unknown[][] =>
    graphql.mock.calls.filter(([query]) => String(query).includes("updateProjectV2ItemFieldValue"));
  const lookups = (): unknown[][] =>
    graphql.mock.calls.filter(([query]) => String(query).includes("issue(number: $number)"));

  describe("writeHeartbeat", () => {
    it("writes timestamp, progress and branch in ONE mutation document", async () => {
      board.set(7, [{ claimedBy: "a" }]);

      await store.writeHeartbeat({
        issueNumber: 7,
        claimantIds: ["a"],
        timestamp: "2026-10-28T10:00:00.000Z",
        progress: 40,
        workBranch: "feat/x",
      });

      expect(mutations()).toHaveLength(1);
      const [query, vars] = mutations()[0] as [string, Vars];
      expect(query).toContain("text: $v0");
      expect(query).toContain("number: $v1");
      expect(query).toContain("text: $v2");
      expect(vars).toMatchObject({
        projectId: "project-1",
        itemId: "item-7-0",
        f0: "f-hb",
        v0: "2026-10-28T10:00:00.000Z",
        f1: "f-prog",
        v1: 40,
        f2: "f-branch",
        v2: "feat/x",
      });
    });

    it("sends only the timestamp when progress and branch are absent", async () => {
      board.set(7, [{ claimedBy: "a" }]);

      await store.writeHeartbeat({
        issueNumber: 7,
        claimantIds: ["a"],
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      const [query] = mutations()[0] as [string, Vars];
      expect(query).not.toContain("$v1");
    });

    it("resolves the item once and reuses it, within the TTL", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      const beat = () =>
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" });

      await beat();
      await beat();
      await beat();

      expect(lookups()).toHaveLength(1);
      expect(mutations()).toHaveLength(3);
    });

    it("re-resolves (and re-verifies the claim) once the cached target expires", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      const beat = () =>
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" });
      await beat();

      now += 6 * 60_000;
      board.set(7, [{ claimedBy: "someone-else" }]);

      await expect(beat()).rejects.toBeInstanceOf(ClaimNotHeldError);
      expect(lookups()).toHaveLength(2);
    });

    it("re-resolves once when a cached target fails, then succeeds on the fresh one", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      const beat = () =>
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" });
      await beat();

      const original = graphql.getMockImplementation();
      graphql.mockImplementationOnce(async () => {
        throw new Error("item moved");
      });
      graphql.mockImplementation(original as never);

      await expect(beat()).resolves.toBeUndefined();
      expect(lookups()).toHaveLength(2);
    });

    it("picks the item of the claimant, not another board's item", async () => {
      board.set(7, [{ claimedBy: "other" }, { claimedBy: "a" }]);

      await store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" });

      expect((mutations()[0] as [string, Vars])[1].itemId).toBe("item-7-1");
    });

    it("throws ClaimNotHeldError when no item is claimed by a claimant", async () => {
      board.set(7, [{ claimedBy: "other" }]);

      await expect(
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" })
      ).rejects.toThrow(/Task #7 is not claimed by a/);
      expect(mutations()).toHaveLength(0);
    });

    it("throws MissingAgentFieldError naming the field and the setup_fields action", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      fields = ALL_FIELDS.filter((f) => f.name !== "agent_heartbeat_at");

      const failure = await store
        .writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" })
        .then(
          () => undefined,
          (error: unknown) => error
        );

      expect(failure).toBeInstanceOf(MissingAgentFieldError);
      expect((failure as MissingAgentFieldError).missing).toEqual(["agent_heartbeat_at"]);
      expect((failure as Error).message).toMatch(/setup_fields.*project-1/s);
      expect(mutations()).toHaveLength(0);
    });

    it("picks up a field provisioned after the target was cached", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      fields = ALL_FIELDS.filter((f) => f.name !== "agent_progress");
      await expect(
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t", progress: 5 })
      ).rejects.toBeInstanceOf(MissingAgentFieldError);

      fields = ALL_FIELDS;
      await expect(
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t", progress: 5 })
      ).resolves.toBeUndefined();
    });

    it("forget() makes the next beat re-verify the claim", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      const beat = () =>
        store.writeHeartbeat({ issueNumber: 7, claimantIds: ["a"], timestamp: "t" });
      await beat();

      store.forget(7);
      board.set(7, [{ claimedBy: "b" }]);

      await expect(beat()).rejects.toBeInstanceOf(ClaimNotHeldError);
    });

    it.each([0, -1, 1.5, Number.NaN])(
      "rejects the invalid issue number %s",
      async (issueNumber) => {
        await expect(
          store.writeHeartbeat({ issueNumber, claimantIds: ["a"], timestamp: "t" })
        ).rejects.toThrow(/Invalid issue number/);
      }
    );
  });

  describe("readHeartbeats", () => {
    it("returns the hot state of the claimed item", async () => {
      board.set(7, [
        { claimedBy: "a", heartbeatAt: "2026-10-28T10:00:00.000Z", progress: 60, branch: "b" },
      ]);

      const result = await store.readHeartbeats([{ issueNumber: 7, claimantIds: ["a"] }]);

      expect(result.get(7)).toEqual({
        timestamp: "2026-10-28T10:00:00.000Z",
        progress: 60,
        workBranch: "b",
      });
    });

    it("has no entry for an issue no claimant holds", async () => {
      board.set(7, [{ claimedBy: "other", heartbeatAt: "t" }]);

      const result = await store.readHeartbeats([{ issueNumber: 7, claimantIds: ["a"] }]);

      expect(result.has(7)).toBe(false);
    });

    it("batches 25 issues per request: 60 issues cost 3 requests", async () => {
      const claims = Array.from({ length: 60 }, (_, i) => {
        board.set(i + 1, [{ claimedBy: "a", heartbeatAt: "t" }]);
        return { issueNumber: i + 1, claimantIds: ["a"] };
      });

      const result = await store.readHeartbeats(claims);

      expect(graphql).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(60);
    });

    it("reads a shared issue once and honours every claimant", async () => {
      board.set(7, [{ claimedBy: "root", heartbeatAt: "t" }]);

      const result = await store.readHeartbeats([
        { issueNumber: 7, claimantIds: ["child", "root"] },
        { issueNumber: 7, claimantIds: ["root"] },
      ]);

      expect(graphql).toHaveBeenCalledTimes(1);
      expect(result.get(7)?.timestamp).toBe("t");
    });

    it("issues no request for no claims", async () => {
      await store.readHeartbeats([]);

      expect(graphql).not.toHaveBeenCalled();
    });
  });

  describe("AgentHeartbeatResolver", () => {
    const iso = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

    it("prefers a newer item beat over an older registry beat", async () => {
      board.set(7, [{ claimedBy: "a", heartbeatAt: iso(2), progress: 30, branch: "feat" }]);
      const a = agent("a", { currentTaskId: "7", lastHeartbeat: iso(100) });

      const resolved = await new AgentHeartbeatResolver(store).resolve([a]);

      expect(resolved.get("a")).toEqual({
        lastHeartbeat: expect.any(String),
        source: "project_item",
        progress: 30,
        workBranch: "feat",
      });
      expect(
        Date.now() - new Date(resolved.get("a")?.lastHeartbeat as string).getTime()
      ).toBeLessThan(5 * 60_000);
    });

    it("keeps the registry beat when it is newer than the item's", async () => {
      board.set(7, [{ claimedBy: "a", heartbeatAt: iso(50) }]);
      const a = agent("a", { currentTaskId: "7", lastHeartbeat: iso(1) });

      const resolved = await new AgentHeartbeatResolver(store).resolve([a]);

      expect(resolved.get("a")?.source).toBe("registry");
    });

    it("falls back to the registry beat when the item has none yet", async () => {
      board.set(7, [{ claimedBy: "a" }]);
      const a = agent("a", { currentTaskId: "7", lastHeartbeat: iso(10) });

      const resolved = await new AgentHeartbeatResolver(store).resolve([a]);

      expect(resolved.get("a")?.source).toBe("registry");
      expect(resolved.get("a")?.lastHeartbeat).toBe(a.lastHeartbeat);
    });

    it("uses the registry only for an idle agent, with no board read", async () => {
      const idle = agent("i", { status: "idle", lastHeartbeat: iso(3) });

      const resolved = await new AgentHeartbeatResolver(store).resolve([idle]);

      expect(graphql).not.toHaveBeenCalled();
      expect(resolved.get("i")).toMatchObject({
        source: "registry",
        lastHeartbeat: idle.lastHeartbeat,
      });
    });

    it("has no heartbeat for an agent that never beat", async () => {
      const resolved = await new AgentHeartbeatResolver(store).resolve([
        agent("n", { status: "idle" }),
      ]);

      expect(resolved.get("n")).toEqual({ progress: undefined, workBranch: undefined });
    });

    it("resolves a subagent through the claim its root holds", async () => {
      board.set(7, [{ claimedBy: "root", heartbeatAt: iso(1) }]);
      const root = agent("root", { currentTaskId: "7" });
      const kid = agent("kid", { parentAgentId: "root", currentTaskId: "7" });

      const resolved = await new AgentHeartbeatResolver(store).resolve([root, kid], [kid]);

      expect(resolved.get("kid")?.source).toBe("project_item");
    });
  });

  describe("claimantChain", () => {
    it("lists the agent then its ancestors, nearest first, and survives a cycle", () => {
      const a = agent("a", { parentAgentId: "b" });
      const b = agent("b", { parentAgentId: "a" });
      const root = agent("r");
      const leaf = agent("leaf", { parentAgentId: "a" });
      const parentless = agent("p", { parentAgentId: "missing" });

      const byId = new Map([a, b, root, leaf, parentless].map((x) => [x.id, x]));

      expect(claimantChain(a, byId)).toEqual(["a", "b"]);
      expect(claimantChain(leaf, byId)).toEqual(["leaf", "a", "b"]);
      expect(claimantChain(parentless, byId)).toEqual(["p", "missing"]);
    });
  });
});
