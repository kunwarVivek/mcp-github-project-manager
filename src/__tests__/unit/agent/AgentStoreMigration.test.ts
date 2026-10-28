import { beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import {
  AGENT_REGISTRY_BRANCH,
  AGENT_REGISTRY_FILE,
  AGENT_REGISTRY_LABEL,
} from "../../../domain/agent-orchestration-types";
import { AgentStore } from "../../../infrastructure/agent/AgentStore";
import { LegacyAgentRegistry } from "../../../infrastructure/agent/LegacyAgentRegistry";
import { FakeGitHub } from "../../helpers/FakeGitHub";

/**
 * The registry used to be a JSON array in the body of an "Agent Registry"
 * issue. The first access after the upgrade imports those agents into the
 * registry branch, then rewrites the issue to a pointer so it is never
 * imported again.
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

function legacyIssue(
  number: number,
  agents: Agent[] | string,
  overrides: { title?: string; updatedAt?: string } = {}
) {
  return {
    number,
    title: overrides.title ?? "Agent Registry",
    body: typeof agents === "string" ? agents : JSON.stringify(agents, null, 2),
    labels: [AGENT_REGISTRY_LABEL],
    state: "open" as const,
    updatedAt: overrides.updatedAt,
  };
}

function isPointer(body: string): boolean {
  if (body !== LegacyAgentRegistry.pointerBody()) return false;
  try {
    JSON.parse(body);
    return false;
  } catch {
    return true;
  }
}

describe("legacy registry issue migration", () => {
  let github: FakeGitHub;

  beforeEach(() => {
    github = new FakeGitHub();
  });

  it("imports the agents once, creates the branch, and leaves a pointer on the kept issue", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("legacy-1"), makeAgent("legacy-2")]));

    const agents = await newStore(github).listAgents();

    expect(agents.map((a) => a.id)).toEqual(["legacy-1", "legacy-2"]);
    expect(github.registryAgents().map((a) => a.id)).toEqual(["legacy-1", "legacy-2"]);
    expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(true);

    // The issue is kept, open, and now points at the file — it is not JSON.
    const issue = github.issues.find((candidate) => candidate.number === 7);
    expect(issue?.state).toBe("open");
    expect(isPointer(issue?.body ?? "")).toBe(true);
    expect(issue?.body).toContain(`${AGENT_REGISTRY_BRANCH}:${AGENT_REGISTRY_FILE}`);
  });

  it("does not import again: later runs never touch the legacy issue", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("legacy-1")]));
    await newStore(github).listAgents();
    const issueWrites = github.writes.length;

    await newStore(github).upsertAgent(makeAgent("new-agent"));
    const second = await newStore(github).listAgents();

    expect(second.map((a) => a.id)).toEqual(["legacy-1", "new-agent"]);
    expect(github.writes).toHaveLength(issueWrites);
    expect(github.refCreations.filter((r) => r.outcome === "created")).toHaveLength(1);
  });

  it("a migrated pointer is never re-imported even if the branch is recreated empty", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("legacy-1")]));
    await newStore(github).listAgents();

    const recreated = new FakeGitHub();
    recreated.addIssue({
      number: 7,
      title: "Agent Registry",
      body: github.issueBody(7),
      labels: [AGENT_REGISTRY_LABEL],
    });

    expect(await newStore(recreated).listAgents()).toEqual([]);
  });

  it("folds duplicate registry issues, the record written last winning, and points them all", async () => {
    github.addIssue(
      legacyIssue(7, [makeAgent("shared", { status: "idle" }), makeAgent("only-canonical")], {
        updatedAt: "2026-02-01T00:00:00Z",
      })
    );
    github.addIssue(
      legacyIssue(9, [makeAgent("shared", { status: "working" }), makeAgent("only-duplicate")], {
        updatedAt: "2026-03-01T00:00:00Z",
      })
    );

    const agents = await newStore(github).listAgents();

    expect(agents.map((a) => a.id).sort()).toEqual(["only-canonical", "only-duplicate", "shared"]);
    expect(agents.find((a) => a.id === "shared")?.status).toBe("working");
    expect(isPointer(github.issueBody(7))).toBe(true);
    expect(isPointer(github.issueBody(9))).toBe(true);
  });

  it("fails closed on a corrupt canonical issue: nothing is created, nothing is rewritten", async () => {
    github.addIssue(legacyIssue(7, "{not-json"));

    await expect(newStore(github).listAgents()).rejects.toThrow(/malformed JSON/);

    expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);
    expect(github.issueBody(7)).toBe("{not-json");
  });

  it("fails closed when the canonical issue holds records that do not match the schema", async () => {
    github.addIssue(legacyIssue(7, JSON.stringify([{ id: "broken" }])));

    await expect(newStore(github).listAgents()).rejects.toThrow(/invalid agent records/);

    expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(false);
  });

  it("skips a corrupt duplicate and leaves its body untouched", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("good")]));
    github.addIssue(legacyIssue(9, "{garbage"));

    const agents = await newStore(github).listAgents();

    expect(agents.map((a) => a.id)).toEqual(["good"]);
    expect(isPointer(github.issueBody(7))).toBe(true);
    expect(github.issueBody(9)).toBe("{garbage");
  });

  it("finds a legacy registry whose title was edited through its label", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("relabelled")], { title: "agents (registry)" }));

    const agents = await newStore(github).listAgents();

    expect(agents.map((a) => a.id)).toEqual(["relabelled"]);
  });

  it("with no legacy issue, bootstraps an empty registry without creating an issue", async () => {
    expect(await newStore(github).listAgents()).toEqual([]);

    expect(github.hasBranch(AGENT_REGISTRY_BRANCH)).toBe(true);
    expect(github.issues).toHaveLength(0);
  });

  it("concurrent migrators converge: one branch, the legacy agents once, one pointer", async () => {
    github.addIssue(legacyIssue(7, [makeAgent("legacy-1"), makeAgent("legacy-2")]));

    github.pauseWrites();
    const first = newStore(github).listAgents();
    const second = newStore(github).upsertAgent(makeAgent("racer"));
    await github.waitForPendingWrites(2);
    github.releaseOneWrite(1);
    github.releaseWrites();
    const [agents] = await Promise.all([first, second]);

    expect(agents.map((a) => a.id)).toEqual(["legacy-1", "legacy-2"]);
    expect(
      github
        .registryAgents()
        .map((a) => a.id)
        .sort()
    ).toEqual(["legacy-1", "legacy-2", "racer"]);
    expect(github.refCreations.map((r) => r.outcome).sort()).toEqual(["created", "exists"]);
    expect(isPointer(github.issueBody(7))).toBe(true);
  });
});
