import type { Agent } from "../../domain/agent-orchestration-types.js";
import {
  AGENT_REGISTRY_BRANCH,
  AGENT_REGISTRY_FILE,
  AgentSchema,
} from "../../domain/agent-orchestration-types.js";
import type { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import { LegacyAgentRegistry } from "./LegacyAgentRegistry.js";

const AgentRegistrySchema = AgentSchema.array();

/** Human-readable location of the registry, used in every message. */
const REGISTRY_LOCATION = `${AGENT_REGISTRY_BRANCH}:${AGENT_REGISTRY_FILE}`;

/** A registry read: the agents and the blob sha the next write must present. */
interface RegistryState {
  agents: Agent[];
  sha: string;
}

export interface AgentStoreOptions {
  /** Write attempts before a contended registry write throws. */
  maxWriteAttempts?: number;
  /** Wait between attempts; tests inject an instant one. */
  sleep?: (ms: number) => Promise<void>;
}

/** A rule/protection rejection looks like a conflict (409) but never resolves by retrying. */
const RULE_REJECTION =
  /rule violation|protected branch|branch protection|ruleset|GH006|GH013|required status|required review/i;

function httpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status } = error;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * GitHub-backed agent registry.
 *
 * ## Storage
 *
 * The registry is the file `registry.json` on the orphan branch
 * `agent-registry`, written through the GitHub Contents API. Unlike an issue
 * body, `PUT /contents` is a compare-and-swap: the request carries the blob
 * sha that was read, and GitHub rejects it (409) if the file changed since.
 * There is therefore no write-then-verify window in which two writers can both
 * succeed and one silently disappears.
 *
 * ## Concurrency
 *
 * All mutations go through {@link mutateAgents}: read the file and its sha,
 * apply the mutator, write with that sha. On a sha conflict the mutator is
 * re-applied to the FRESH list (so a concurrent writer's changes are kept) and
 * the write retried with jittered backoff, a bounded number of times;
 * exhaustion throws. A mutator that changes nothing writes nothing.
 *
 * Verified live against the GitHub API (the evidence behind the design):
 * - 8 parallel `PUT`s presenting the same sha: exactly one 200 and a 409 for
 *   every other request that reached GitHub
 *   (`is at <sha> but expected <sha>` for a racing commit, `does not match`
 *   for a stale blob sha);
 * - `getContent(ref=branch)` immediately after a write returned the written
 *   sha in 25 of 25 write-then-read cycles, and `git.getRef` returned the new
 *   commit in 25 of 25 — so reading by branch name is read-your-writes and no
 *   resolve-the-commit-first dance is needed.
 *
 * ## Bootstrap and migration
 *
 * The first access creates the branch (blob, tree, parentless commit, then
 * `createRef`) and imports any legacy registry issue. `createRef` is the
 * arbiter: when two processes race, one gets 201 and the other 422
 * "Reference already exists", re-reads, and carries on with the winner's
 * content. Only the winner rewrites the legacy issue to a pointer.
 */
export class AgentStore {
  private readonly factory: GitHubRepositoryFactory;
  private readonly legacy: LegacyAgentRegistry;
  private readonly maxWriteAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /**
   * Each lost attempt means another writer committed, so N writers that all
   * start together need up to N attempts for the last one. 50 outlasts any
   * realistic burst of concurrent agents; exhaustion still throws.
   */
  private static readonly DEFAULT_WRITE_ATTEMPTS = 50;

  /** Backoff window: attempt n waits a random time in [0, min(cap, base * 2^n)]. */
  private static readonly BACKOFF_BASE_MS = 50;
  private static readonly BACKOFF_CAP_MS = 2_000;

  constructor(factory: GitHubRepositoryFactory, options: AgentStoreOptions = {}) {
    this.factory = factory;
    this.legacy = new LegacyAgentRegistry(factory);
    this.maxWriteAttempts = options.maxWriteAttempts ?? AgentStore.DEFAULT_WRITE_ATTEMPTS;
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  private static validateAgentRecords(value: unknown, source: string): Agent[] {
    const result = AgentRegistrySchema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
          return `${path}${issue.message}`;
        })
        .join("; ");
      throw new Error(`${source} contains invalid agent records: ${details}`);
    }

    return result.data;
  }

  private static parseRegistry(text: string): Agent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Agent registry ${REGISTRY_LOCATION} contains malformed JSON: ${errorMessage(error)}`
      );
    }
    return AgentStore.validateAgentRecords(parsed, `Agent registry ${REGISTRY_LOCATION}`);
  }

  private static serialize(agents: Agent[]): string {
    return JSON.stringify(agents, null, 2);
  }

  /**
   * Read-only probe: does an agent registry exist in this repo?
   *
   * True when the registry branch exists or a legacy registry issue is still
   * waiting to be migrated. Unlike {@link listAgents} this never writes:
   * background sweeps (e.g. the auto-reclaim scheduler) call it first so a repo
   * that never uses the agent layer is not mutated behind the user's back.
   */
  async registryExists(): Promise<boolean> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    try {
      await octokit.rest.git.getRef({
        owner: config.owner,
        repo: config.repo,
        ref: `heads/${AGENT_REGISTRY_BRANCH}`,
      });
      return true;
    } catch (error) {
      const status = httpStatus(error);
      const emptyRepository = status === 409 && /empty/i.test(errorMessage(error));
      if (status !== 404 && !emptyRepository) throw error;
    }

    return this.legacy.exists();
  }

  /**
   * Read the registry file and its sha; `null` when the branch or the file
   * does not exist yet.
   *
   * Reading by branch name is strongly consistent here (see the class
   * comment), so a registration is visible to the very next read from any
   * process.
   */
  private async fetchRegistry(): Promise<RegistryState | null> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    let data: Awaited<ReturnType<typeof octokit.rest.repos.getContent>>["data"];
    try {
      ({ data } = await octokit.rest.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: AGENT_REGISTRY_FILE,
        ref: AGENT_REGISTRY_BRANCH,
      }));
    } catch (error) {
      const status = httpStatus(error);
      const emptyRepository = status === 409 && /empty/i.test(errorMessage(error));
      if (status === 404 || emptyRepository) return null;
      throw error;
    }

    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`${REGISTRY_LOCATION} is not a file; the agent registry cannot be read.`);
    }
    if (data.encoding !== "base64") {
      throw new Error(
        `${REGISTRY_LOCATION} is ${data.size} bytes, above the 1 MB the Contents API returns inline; the agent registry cannot be read.`
      );
    }

    return {
      agents: AgentStore.parseRegistry(Buffer.from(data.content, "base64").toString("utf8")),
      sha: data.sha,
    };
  }

  /** Read the registry, creating (and migrating into) the branch on first use. */
  private async readRegistry(): Promise<RegistryState> {
    const current = await this.fetchRegistry();
    if (current) return current;

    const { agents, imported } = this.legacy.load(await this.legacy.discover(true));
    const created = await this.createBranch(agents);
    if (created) await this.legacy.retire(imported);

    const state = await this.fetchRegistry();
    if (!state) {
      throw new Error(
        `Branch ${AGENT_REGISTRY_BRANCH} exists but has no ${AGENT_REGISTRY_FILE}; the agent registry cannot be read. Restore the file or delete the branch.`
      );
    }
    return state;
  }

  /**
   * Create the registry branch as a parentless commit holding `agents`.
   *
   * @returns `true` when this call created it, `false` when another process
   *   did (`createRef` answers 422 "Reference already exists"): the caller
   *   then re-reads the winner's content.
   */
  private async createBranch(agents: Agent[]): Promise<boolean> {
    const octokit = this.factory.getOctokit();
    const { owner, repo } = this.factory.getConfig();

    try {
      const blob = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: AgentStore.serialize(agents),
        encoding: "utf-8",
      });
      const tree = await octokit.rest.git.createTree({
        owner,
        repo,
        tree: [{ path: AGENT_REGISTRY_FILE, mode: "100644", type: "blob", sha: blob.data.sha }],
      });
      const commit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: "Initialise agent registry",
        tree: tree.data.sha,
        parents: [],
      });
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${AGENT_REGISTRY_BRANCH}`,
        sha: commit.data.sha,
      });
      return true;
    } catch (error) {
      if (httpStatus(error) === 422 && /already exists/i.test(errorMessage(error))) return false;
      throw AgentStore.writeFailure(error, `create the ${AGENT_REGISTRY_BRANCH} branch`);
    }
  }

  /**
   * Turn a rejected registry write into an error that says what to fix.
   *
   * A missing `contents: write` permission and a branch ruleset/protection
   * rejecting the write both look like opaque 403/404/409 responses.
   */
  private static writeFailure(error: unknown, action: string): Error {
    const status = httpStatus(error);
    const message = errorMessage(error);

    if (status === 409 && /empty/i.test(message)) {
      return new Error(
        `Cannot ${action}: the repository has no commits yet. Make an initial commit on the default branch first; ` +
          `creating the registry through the Contents API on an empty repository would turn the ${AGENT_REGISTRY_BRANCH} branch into the default branch.`,
        { cause: error }
      );
    }

    if (status === 403 || status === 404 || RULE_REJECTION.test(message)) {
      return new Error(
        `Cannot ${action} for the agent registry (${REGISTRY_LOCATION}): GitHub answered ${status ?? "an error"} "${message}". ` +
          `The token needs the "contents: write" permission on this repository (fine-grained token: Repository permissions → Contents: Read and write; classic token: the repo scope), ` +
          `and no branch ruleset or branch protection may block writes to the ${AGENT_REGISTRY_BRANCH} branch.`,
        { cause: error }
      );
    }

    return error instanceof Error ? error : new Error(message);
  }

  /** Read all agents from the registry. */
  async listAgents(): Promise<Agent[]> {
    return (await this.readRegistry()).agents;
  }

  /** Get a single agent by ID. */
  async getAgent(agentId: string): Promise<Agent | undefined> {
    const agents = await this.listAgents();
    return agents.find((a) => a.id === agentId);
  }

  /**
   * Replace the whole registry with `agents`, as one compare-and-swap write.
   *
   * Intended for administrative repair/tests; operational code should prefer
   * upsertAgent/removeAgent/removeAgentCascade for targeted changes.
   */
  async saveAgents(agents: Agent[]): Promise<void> {
    const replacement = AgentStore.validateAgentRecords(agents, "saveAgents replacement");
    await this.mutateAgents(() => replacement);
  }

  /** Add or update an agent (matched by `id`). */
  async upsertAgent(agent: Agent): Promise<void> {
    await this.mutateAgents((agents) => {
      const idx = agents.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        agents[idx] = agent;
      } else {
        agents.push(agent);
      }
      return agents;
    });
  }

  /** Remove an agent by ID. Returns `true` if found and removed. */
  async removeAgent(agentId: string): Promise<boolean> {
    let removed = false;
    await this.mutateAgents((agents) => {
      const filtered = agents.filter((a) => a.id !== agentId);
      removed = filtered.length !== agents.length;
      return filtered;
    });
    return removed;
  }

  /** Remove an agent and all its descendants. Returns count of removed agents. */
  async removeAgentCascade(agentId: string): Promise<number> {
    let removedCount = 0;
    await this.mutateAgents((agents) => {
      removedCount = 0;
      if (!agents.some((a) => a.id === agentId)) return agents;

      const toRemove = new Set([agentId]);
      let found = true;
      while (found) {
        found = false;
        for (const a of agents) {
          if (a.parentAgentId && toRemove.has(a.parentAgentId) && !toRemove.has(a.id)) {
            toRemove.add(a.id);
            found = true;
          }
        }
      }

      return agents.filter((a) => {
        if (!toRemove.has(a.id)) return true;
        removedCount++;
        return false;
      });
    });
    return removedCount;
  }

  /** Get direct children of an agent. */
  async getChildren(parentId: string): Promise<Agent[]> {
    const agents = await this.listAgents();
    return agents.filter((a) => a.parentAgentId === parentId);
  }

  /**
   * Apply a mutation to the registry with compare-and-swap.
   *
   * `mutator` receives a private copy of the current list and returns the new
   * one; it may be called more than once (once per attempt), each time on the
   * freshest list, so it must derive its result from its argument only. When
   * it returns an identical list nothing is written.
   *
   * Throws when {@link AgentStoreOptions.maxWriteAttempts} writes in a row lose
   * the compare-and-swap, or when GitHub rejects the write outright.
   */
  private async mutateAgents(mutator: (agents: Agent[]) => Agent[]): Promise<void> {
    let state = await this.readRegistry();

    for (let attempt = 0; attempt < this.maxWriteAttempts; attempt++) {
      const next = mutator(structuredClone(state.agents));
      if (AgentStore.serialize(next) === AgentStore.serialize(state.agents)) return;

      if (await this.writeRegistry(next, state.sha)) return;

      if (attempt + 1 < this.maxWriteAttempts) {
        await this.sleep(
          Math.random() *
            Math.min(AgentStore.BACKOFF_CAP_MS, AgentStore.BACKOFF_BASE_MS * 2 ** attempt)
        );
        state = await this.readRegistry();
      }
    }

    throw new Error(
      `Could not update the agent registry (${REGISTRY_LOCATION}): ${this.maxWriteAttempts} writes in a row lost the compare-and-swap to concurrent writers. The registry is intact; retry the operation.`
    );
  }

  /**
   * Commit `agents` to the registry file, presenting `sha` as the version it
   * replaces.
   *
   * @returns `true` when committed, `false` when `sha` is stale (another
   *   writer committed first) so the caller re-reads and re-applies.
   */
  private async writeRegistry(agents: Agent[], sha: string): Promise<boolean> {
    const octokit = this.factory.getOctokit();
    const { owner, repo } = this.factory.getConfig();

    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: AGENT_REGISTRY_FILE,
        branch: AGENT_REGISTRY_BRANCH,
        message: "Update agent registry",
        content: Buffer.from(AgentStore.serialize(agents), "utf8").toString("base64"),
        sha,
      });
      return true;
    } catch (error) {
      if (httpStatus(error) === 409 && !RULE_REJECTION.test(errorMessage(error))) return false;
      throw AgentStore.writeFailure(error, `write to the ${AGENT_REGISTRY_BRANCH} branch`);
    }
  }
}
