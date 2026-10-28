import { beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import { AgentStore } from "../../../infrastructure/agent/AgentStore";
import { FakeGitHub } from "../../helpers/FakeGitHub";

/**
 * The agent registry is one file on the `agent-registry` branch, written
 * through the Contents API with sha compare-and-swap. A write that presents a
 * stale sha is rejected, so two writers can never both "succeed" with one of
 * them silently vanishing — the defect of the old issue-body registry, where
 * `PATCH /issues` was last-write-wins and a verify-after-write could not see a
 * write that landed afterwards.
 *
 * These tests drive the real `AgentStore` against a fake that models those
 * semantics, and use paused writes to put writers in the exact interleavings
 * that used to lose agents.
 */

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

function newStore(github: FakeGitHub): AgentStore {
  return new AgentStore(github.asFactory(), { sleep: instantly });
}

describe("AgentStore concurrency and registry integrity", () => {
  let github: FakeGitHub;

  beforeEach(() => {
    github = new FakeGitHub();
    github.seedRegistry([]);
  });

  describe("the lost-update interleaving", () => {
    it("keeps both agents when A's write lands, A returns success, and only then B's stale write arrives", async () => {
      const writerA = newStore(github);
      const writerB = newStore(github);

      github.pauseWrites();

      // A reaches the server first, B second: both read the empty registry.
      const writeA = writerA.upsertAgent(makeAgent("agent-a"));
      await github.waitForPendingWrites(1);
      const writeB = writerB.upsertAgent(makeAgent("agent-b"));
      await github.waitForPendingWrites(2);

      // Release ONLY A's write and let A finish: it reports success.
      github.releaseOneWrite(0);
      await writeA;
      expect(github.registryAgents().map((a) => a.id)).toEqual(["agent-a"]);

      // Now B's write, based on the empty registry, finally reaches the server.
      github.releaseWrites();
      await writeB;

      expect(
        github
          .registryAgents()
          .map((a) => a.id)
          .sort()
      ).toEqual(["agent-a", "agent-b"]);
      // B's stale write was refused (409), not applied, and B committed on top of A.
      expect(github.contentWrites.map((write) => write.outcome)).toEqual([
        "committed",
        "conflict",
        "committed",
      ]);
    });

    it("keeps both agents when the writes land in the reverse order", async () => {
      const writerA = newStore(github);
      const writerB = newStore(github);

      github.pauseWrites();
      const writeA = writerA.upsertAgent(makeAgent("agent-a"));
      await github.waitForPendingWrites(1);
      const writeB = writerB.upsertAgent(makeAgent("agent-b"));
      await github.waitForPendingWrites(2);

      github.releaseWrites("reversed");
      await Promise.all([writeA, writeB]);

      expect(
        github
          .registryAgents()
          .map((a) => a.id)
          .sort()
      ).toEqual(["agent-a", "agent-b"]);
    });
  });

  describe("many concurrent writers of different agents", () => {
    it("all survive when every writer's write is held and then released together", async () => {
      const count = 12;
      github.pauseWrites();

      const writes = Array.from({ length: count }, (_, i) =>
        newStore(github).upsertAgent(makeAgent(`agent-${i}`))
      );
      await github.waitForPendingWrites(count);
      github.releaseWrites();
      await Promise.all(writes);

      const ids = github
        .registryAgents()
        .map((a) => a.id)
        .sort();
      expect(ids).toEqual(Array.from({ length: count }, (_, i) => `agent-${i}`).sort());
      // N writers on one sha: exactly one wins the first round, so contention
      // really happened and was resolved by retries, not by luck.
      expect(github.contentWrites.filter((w) => w.outcome === "conflict").length).toBeGreaterThan(
        0
      );
    });

    it("all survive free-running concurrent upserts, and the registry holds no duplicates", async () => {
      const count = 25;

      await Promise.all(
        Array.from({ length: count }, (_, i) =>
          newStore(github).upsertAgent(makeAgent(`agent-${i}`))
        )
      );

      const ids = github.registryAgents().map((a) => a.id);
      expect(new Set(ids).size).toBe(count);
      expect(ids).toHaveLength(count);
    });

    it("concurrent registrations and deregistrations of different agents all take effect", async () => {
      github.seedRegistry([makeAgent("old-1"), makeAgent("old-2"), makeAgent("old-3")]);

      await Promise.all([
        newStore(github).upsertAgent(makeAgent("new-1")),
        newStore(github).removeAgent("old-1"),
        newStore(github).upsertAgent(makeAgent("new-2")),
        newStore(github).removeAgentCascade("old-2"),
      ]);

      expect(
        github
          .registryAgents()
          .map((a) => a.id)
          .sort()
      ).toEqual(["new-1", "new-2", "old-3"]);
    });
  });

  describe("two concurrent writers of the SAME agent", () => {
    const recordA = makeAgent("agent-x", {
      name: "written-by-A",
      status: "working",
      currentTaskId: "task-A",
    });
    const recordB = makeAgent("agent-x", {
      name: "written-by-B",
      status: "needs_review",
      currentTaskId: "task-B",
    });

    async function run(order: "queued" | "reversed"): Promise<Agent[]> {
      github.pauseWrites();
      const writeA = newStore(github).upsertAgent(recordA);
      const writeB = newStore(github).upsertAgent(recordB);
      await github.waitForPendingWrites(2);
      github.releaseWrites(order);
      await Promise.all([writeA, writeB]);
      return github.registryAgents();
    }

    it("never mixes or drops: the last committed record is stored whole (A first, B last)", async () => {
      const agents = await run("queued");

      expect(agents).toEqual([recordB]);
      expect(github.contentWrites.map((w) => w.outcome)).toEqual([
        "committed",
        "conflict",
        "committed",
      ]);
    });

    it("never mixes or drops: the last committed record is stored whole (B first, A last)", async () => {
      const agents = await run("reversed");

      expect(agents).toEqual([recordA]);
    });

    it("the loser retried on top of the winner's commit instead of overwriting it blindly", async () => {
      await run("queued");

      const committed = github.contentWrites.filter((w) => w.outcome === "committed");
      expect(committed).toHaveLength(2);
      // The second commit replaced the blob that the FIRST commit produced.
      expect(committed[1].replacedSha).not.toBe(committed[0].replacedSha);
    });
  });

  describe("bootstrap race between two processes", () => {
    it("creates one branch, with both agents, from a single parentless root", async () => {
      const fresh = new FakeGitHub();
      const writerA = newStore(fresh);
      const writerB = newStore(fresh);

      fresh.pauseWrites();
      const writeA = writerA.upsertAgent(makeAgent("agent-a"));
      const writeB = writerB.upsertAgent(makeAgent("agent-b"));
      // Both found no branch and both built their bootstrap commit.
      await fresh.waitForPendingWrites(2);

      fresh.releaseOneWrite(0);
      fresh.releaseWrites();
      await Promise.all([writeA, writeB]);

      expect(fresh.refCreations.map((r) => r.outcome).sort()).toEqual(["created", "exists"]);
      expect(
        fresh
          .registryAgents()
          .map((a) => a.id)
          .sort()
      ).toEqual(["agent-a", "agent-b"]);
      // bootstrap + one commit per agent: a linear history, no second root.
      expect(fresh.commitCount("agent-registry")).toBe(3);
    });

    it("the process that loses the race reads the winner's bootstrap content", async () => {
      const fresh = new FakeGitHub();
      fresh.addIssue({
        number: 5,
        title: "Agent Registry",
        body: JSON.stringify([makeAgent("legacy")]),
        labels: ["agent-registry"],
      });

      fresh.pauseWrites();
      const readerA = newStore(fresh).listAgents();
      const readerB = newStore(fresh).listAgents();
      await fresh.waitForPendingWrites(2);
      fresh.releaseWrites();

      const [agentsA, agentsB] = await Promise.all([readerA, readerB]);

      expect(agentsA.map((a) => a.id)).toEqual(["legacy"]);
      expect(agentsB.map((a) => a.id)).toEqual(["legacy"]);
      expect(fresh.refCreations.map((r) => r.outcome).sort()).toEqual(["created", "exists"]);
    });
  });

  describe("sustained contention", () => {
    it("throws a clear error when every attempt loses to a rival, instead of warning and continuing", async () => {
      const delays: number[] = [];
      const store = new AgentStore(github.asFactory(), {
        maxWriteAttempts: 4,
        sleep: async (ms) => {
          delays.push(ms);
        },
      });
      let rival = 0;
      github.beforeContentWrite = () => {
        github.seedRegistry([makeAgent(`rival-${rival++}`)]);
      };

      await expect(store.upsertAgent(makeAgent("victim"))).rejects.toThrow(
        /4 writes in a row lost the compare-and-swap/
      );

      expect(github.contentWrites.map((w) => w.outcome)).toEqual([
        "conflict",
        "conflict",
        "conflict",
        "conflict",
      ]);
      // Jittered exponential backoff between attempts (none after the last one).
      expect(delays).toHaveLength(3);
      delays.forEach((ms, attempt) => {
        expect(ms).toBeGreaterThanOrEqual(0);
        expect(ms).toBeLessThanOrEqual(50 * 2 ** attempt);
      });
      // Nothing of the victim leaked into the registry.
      expect(github.registryAgents().map((a) => a.id)).not.toContain("victim");
    });

    it("applies the mutator to the fresh list on every retry", async () => {
      const store = newStore(github);
      let rivalWrites = 0;
      github.beforeContentWrite = () => {
        if (rivalWrites >= 2) return;
        rivalWrites++;
        github.seedRegistry([...github.registryAgents(), makeAgent(`rival-${rivalWrites}`)]);
      };

      await store.upsertAgent(makeAgent("victim"));

      expect(
        github
          .registryAgents()
          .map((a) => a.id)
          .sort()
      ).toEqual(["rival-1", "rival-2", "victim"]);
    });
  });
});
