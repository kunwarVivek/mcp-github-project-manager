import { beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import {
  AGENT_REGISTRY_BRANCH,
  AGENT_REGISTRY_FILE,
  AGENT_REGISTRY_LABEL,
} from "../../../domain/agent-orchestration-types";
import { AgentStore } from "../../../infrastructure/agent/AgentStore";
import { FakeGitHub } from "../../helpers/FakeGitHub";

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: "engineer",
    runtime: "claude-code",
    capabilities: ["typescript"],
    status: "idle",
    registeredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const instantly = async (): Promise<void> => {};

describe("AgentStore", () => {
  let github: FakeGitHub;
  let store: AgentStore;

  beforeEach(() => {
    github = new FakeGitHub();
    store = new AgentStore(github.asFactory(), { sleep: instantly });
  });

  describe("storage", () => {
    it("creates the registry branch on first write, as a parentless commit holding registry.json", async () => {
      expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);

      await store.upsertAgent(makeAgent("agent-1"));

      expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(true);
      expect(github.registryAgents().map((a) => a.id)).toEqual(["agent-1"]);
      // Bootstrap commit + the upsert commit: the branch is not forked from main.
      expect(github.commitCount(AGENT_REGISTRY_BRANCH)).toBe(2);
      expect(github.fileText("main", AGENT_REGISTRY_FILE)).toBeUndefined();
    });

    it("does not create a registry issue or label", async () => {
      await store.upsertAgent(makeAgent("agent-1"));

      expect(github.issues).toHaveLength(0);
      expect(github.createdLabels).toEqual([]);
    });
  });

  describe("upsertAgent", () => {
    it("adds a new agent to an empty registry", async () => {
      await store.upsertAgent(makeAgent("agent-1"));

      const body = github.registryAgents();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("agent-1");
    });

    it("updates an existing agent matched by id", async () => {
      github.seedRegistry([makeAgent("agent-1", { status: "idle" })]);
      await store.upsertAgent(makeAgent("agent-1", { status: "working" }));

      const body = github.registryAgents();
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe("working");
    });

    it("writes nothing when the agent is already stored exactly as given", async () => {
      github.seedRegistry([makeAgent("agent-1")]);
      const before = github.commitCount(AGENT_REGISTRY_BRANCH);

      await store.upsertAgent(makeAgent("agent-1"));

      expect(github.contentWrites).toHaveLength(0);
      expect(github.commitCount(AGENT_REGISTRY_BRANCH)).toBe(before);
    });
  });

  describe("saveAgents", () => {
    it("replaces the whole registry in one compare-and-swap write", async () => {
      github.seedRegistry([makeAgent("old")]);

      await store.saveAgents([makeAgent("replacement")]);

      expect(github.registryAgents().map((a) => a.id)).toEqual(["replacement"]);
      expect(github.contentWrites.map((write) => write.outcome)).toEqual(["committed"]);
    });

    it("rejects a replacement that does not match the agent schema, writing nothing", async () => {
      github.seedRegistry([makeAgent("old")]);

      await expect(store.saveAgents([{ id: "broken" } as unknown as Agent])).rejects.toThrow(
        /invalid agent records/
      );
      expect(github.contentWrites).toHaveLength(0);
    });
  });

  describe("removeAgent / removeAgentCascade", () => {
    it("returns false and writes nothing when the agent does not exist", async () => {
      github.seedRegistry([makeAgent("agent-1")]);

      const removed = await store.removeAgent("agent-nope");

      expect(removed).toBe(false);
      expect(github.contentWrites).toHaveLength(0);
    });

    it("removes an agent by id", async () => {
      github.seedRegistry([makeAgent("agent-1"), makeAgent("agent-2")]);

      const removed = await store.removeAgent("agent-1");

      expect(removed).toBe(true);
      expect(github.registryAgents().map((a) => a.id)).toEqual(["agent-2"]);
    });

    it("cascades removal to descendants", async () => {
      github.seedRegistry([
        makeAgent("parent"),
        makeAgent("child-1", { parentAgentId: "parent" }),
        makeAgent("grandchild", { parentAgentId: "child-1" }),
        makeAgent("unrelated"),
      ]);

      const count = await store.removeAgentCascade("parent");

      expect(count).toBe(3);
      expect(github.registryAgents().map((a) => a.id)).toEqual(["unrelated"]);
    });

    it("returns zero and preserves descendants when the root agent does not exist", async () => {
      github.seedRegistry([
        makeAgent("orphan", { parentAgentId: "missing-root" }),
        makeAgent("unrelated"),
      ]);

      const count = await store.removeAgentCascade("missing-root");

      expect(count).toBe(0);
      expect(github.registryAgents().map((a) => a.id)).toEqual(["orphan", "unrelated"]);
      expect(github.contentWrites).toHaveLength(0);
    });
  });

  describe("getChildren / listAgents / getAgent", () => {
    beforeEach(() => {
      github.seedRegistry([makeAgent("parent"), makeAgent("child", { parentAgentId: "parent" })]);
    });

    it("lists all agents", async () => {
      expect(await store.listAgents()).toHaveLength(2);
    });

    it("gets an agent by id", async () => {
      const agent = await store.getAgent("child");
      expect(agent?.parentAgentId).toBe("parent");
    });

    it("returns undefined for unknown agent", async () => {
      expect(await store.getAgent("ghost")).toBeUndefined();
    });

    it("returns direct children only", async () => {
      const children = await store.getChildren("parent");
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe("child");
    });

    it("sees a registration made through another store instance on the very next read", async () => {
      const other = new AgentStore(github.asFactory(), { sleep: instantly });

      await other.upsertAgent(makeAgent("late"));

      expect((await store.getAgent("late"))?.id).toBe("late");
    });
  });

  describe("fails closed", () => {
    it("when the registry file is malformed JSON", async () => {
      github.seedRegistry("{not-json");

      await expect(store.listAgents()).rejects.toThrow(/malformed JSON/);
    });

    it("when the registry file is empty", async () => {
      github.seedRegistry("");

      await expect(store.listAgents()).rejects.toThrow(/malformed JSON/);
    });

    it("when the records do not match the agent schema", async () => {
      github.seedRegistry(JSON.stringify([{ id: "agent-1", name: "agent-1" }], null, 2));

      await expect(store.listAgents()).rejects.toThrow(/invalid agent records/);
    });

    it("on a write: a corrupt registry is never overwritten", async () => {
      github.seedRegistry("{not-json");

      await expect(store.upsertAgent(makeAgent("agent-1"))).rejects.toThrow(/malformed JSON/);
      expect(github.fileText(AGENT_REGISTRY_BRANCH, AGENT_REGISTRY_FILE)).toBe("{not-json");
    });

    it("when the branch exists but registry.json was deleted from it", async () => {
      github.seedRegistry([makeAgent("agent-1")]);
      github.removeFile(AGENT_REGISTRY_BRANCH, AGENT_REGISTRY_FILE);

      await expect(store.listAgents()).rejects.toThrow(
        new RegExp(`${AGENT_REGISTRY_BRANCH} exists but has no ${AGENT_REGISTRY_FILE}`)
      );
    });
  });

  describe("registryExists", () => {
    it("is false on a repository that never used the agent layer, and writes nothing", async () => {
      const refCreationsBefore = github.refCreations.length;

      expect(await store.registryExists()).toBe(false);

      expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);
      expect(github.refCreations).toHaveLength(refCreationsBefore);
      expect(github.issues).toHaveLength(0);
    });

    it("is true once the registry branch exists", async () => {
      github.seedRegistry([]);

      expect(await store.registryExists()).toBe(true);
    });

    it("is true while a legacy registry issue still waits to be migrated, and does not migrate it", async () => {
      github.addIssue({
        number: 7,
        title: "Agent Registry",
        body: JSON.stringify([makeAgent("legacy")]),
        labels: [AGENT_REGISTRY_LABEL],
      });

      expect(await store.registryExists()).toBe(true);

      expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);
      expect(github.writes).toHaveLength(0);
    });

    it("is false on an empty repository (no commits) instead of throwing", async () => {
      const empty = new FakeGitHub([], { emptyRepository: true });

      expect(await new AgentStore(empty.asFactory()).registryExists()).toBe(false);
    });
  });

  describe("write failures name the branch and the permission", () => {
    it("a token without contents:write", async () => {
      github.seedRegistry([]);
      github.rejectContentWrites({
        status: 403,
        message: "Resource not accessible by integration",
      });

      const failure = await store.upsertAgent(makeAgent("agent-1")).then(
        () => undefined,
        (error: unknown) => error
      );

      expect(failure).toBeInstanceOf(Error);
      const message = (failure as Error).message;
      expect(message).toContain("contents: write");
      expect(message).toContain(AGENT_REGISTRY_BRANCH);
      expect(message).toContain("Resource not accessible by integration");
    });

    it("a branch ruleset rejecting the write is not retried as a conflict", async () => {
      github.seedRegistry([]);
      github.rejectContentWrites({
        status: 409,
        message: "Repository rule violations found\n\nChanges must be made through a pull request.",
      });

      await expect(store.upsertAgent(makeAgent("agent-1"))).rejects.toThrow(
        new RegExp(`ruleset or branch protection.*${AGENT_REGISTRY_BRANCH}`)
      );
      expect(github.contentWrites).toHaveLength(1);
    });

    it("a token that cannot create the branch", async () => {
      github.rejectGitDataWrites({
        status: 403,
        message: "Resource not accessible by integration",
      });

      await expect(store.upsertAgent(makeAgent("agent-1"))).rejects.toThrow(
        /create the agent-registry branch.*contents: write/s
      );
    });

    it("a repository with no commits explains how to proceed", async () => {
      const empty = new FakeGitHub([], { emptyRepository: true });

      await expect(
        new AgentStore(empty.asFactory()).upsertAgent(makeAgent("agent-1"))
      ).rejects.toThrow(/no commits yet.*initial commit/s);
      expect(empty.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);
    });
  });
});
