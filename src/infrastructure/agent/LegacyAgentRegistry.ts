import type { Agent } from "../../domain/agent-orchestration-types.js";
import {
  AGENT_REGISTRY_BRANCH,
  AGENT_REGISTRY_FILE,
  AGENT_REGISTRY_LABEL,
  AgentSchema,
} from "../../domain/agent-orchestration-types.js";
import type { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";

const LEGACY_REGISTRY_TITLE = "Agent Registry";
const AgentRegistrySchema = AgentSchema.array();

/** How many pages of issues the title scan walks. */
const TITLE_SCAN_PAGES = 5;

/** How often the label query is repeated before an empty answer is believed. */
const LABEL_ATTEMPTS = 3;

/**
 * First line of the body that replaces a migrated registry issue. A body that
 * starts with it is a pointer, never registry data, so it is never imported.
 */
const POINTER_MARKER = "<!-- agent-registry-pointer -->";

/** A legacy registry issue, with its body read directly (not from a list). */
export interface LegacyRegistryIssue {
  number: number;
  title: string;
  body: string;
  /** When the issue was last written — decides which duplicate wins. */
  updatedAt: string | null;
}

/** The agents held by the legacy registry issue(s), ready to be imported. */
export interface LegacyRegistryContents {
  agents: Agent[];
  /** Issues whose agents were imported; these are rewritten to a pointer. */
  imported: LegacyRegistryIssue[];
}

/**
 * The pre-branch agent registry: one JSON array in the body of an issue
 * titled "Agent Registry".
 *
 * Nothing in normal operation reads this. It exists for the one-time
 * migration into the registry branch (see `AgentStore`): find the legacy
 * issue(s), import their agents, then rewrite each imported issue to a
 * pointer so it can never be imported again.
 */
export class LegacyAgentRegistry {
  constructor(private readonly factory: GitHubRepositoryFactory) {}

  /** Read-only probe: does a legacy registry issue exist? */
  async exists(): Promise<boolean> {
    return (await this.discover(false)).length > 0;
  }

  /**
   * Every open issue that could be the legacy registry, with fresh bodies.
   *
   * The TITLE is the reliable key, not the label: GitHub's REST `labels`
   * filter intermittently answers with an empty set, so an empty label answer
   * is retried before it is believed. The label is only a fallback for a
   * registry whose title was edited.
   *
   * @param fullScan - walk every page to collect duplicates. The existence
   *   probe stops at the first page that holds a match.
   */
  async discover(fullScan: boolean): Promise<LegacyRegistryIssue[]> {
    const byTitle = await this.findByTitle(fullScan);
    const candidates = byTitle.length > 0 ? byTitle : await this.findByLabel();
    if (!fullScan) return candidates;
    return Promise.all(candidates.map((issue) => this.withFreshBody(issue)));
  }

  /**
   * The agents to import, folded from the canonical issue and its duplicates.
   *
   * - A corrupt canonical registry FAILS CLOSED: importing around it would
   *   silently replace the operator's data.
   * - A corrupt duplicate is skipped and left untouched.
   * - Across issues the record written last wins (issue `updated_at`).
   * - A pointer body (an already-migrated issue) contributes nothing.
   */
  load(issues: LegacyRegistryIssue[]): LegacyRegistryContents {
    const live = issues.filter((issue) => !issue.body.trimStart().startsWith(POINTER_MARKER));
    const canonical = LegacyAgentRegistry.selectCanonical(live);
    if (!canonical) return { agents: [], imported: [] };

    const merged = new Map<string, { agent: Agent; writtenAt: number }>();
    const imported: LegacyRegistryIssue[] = [];

    for (const issue of live) {
      const agents =
        issue.number === canonical.number
          ? LegacyAgentRegistry.parseCanonical(issue)
          : LegacyAgentRegistry.parseDuplicate(issue);
      if (!agents) continue;

      imported.push(issue);
      const writtenAt = issue.updatedAt ? Date.parse(issue.updatedAt) : 0;
      for (const agent of agents) {
        const existing = merged.get(agent.id);
        if (!existing || writtenAt > existing.writtenAt) {
          merged.set(agent.id, { agent, writtenAt });
        }
      }
    }

    return { agents: [...merged.values()].map((entry) => entry.agent), imported };
  }

  /** Rewrite migrated issues to a pointer at the registry branch. */
  async retire(issues: LegacyRegistryIssue[]): Promise<void> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    for (const issue of issues) {
      await octokit.rest.issues.update({
        owner: config.owner,
        repo: config.repo,
        issue_number: issue.number,
        body: LegacyAgentRegistry.pointerBody(),
      });
    }
  }

  static pointerBody(): string {
    return [
      POINTER_MARKER,
      `The agent registry moved. It now lives in \`${AGENT_REGISTRY_FILE}\` on the \`${AGENT_REGISTRY_BRANCH}\` branch (\`${AGENT_REGISTRY_BRANCH}:${AGENT_REGISTRY_FILE}\`), where every write is a compare-and-swap commit.`,
      "",
      "This issue is kept only as a pointer. Do not edit it: it holds no agent data.",
    ].join("\n");
  }

  /** Titled "Agent Registry" first, then the oldest. */
  private static selectCanonical(issues: LegacyRegistryIssue[]): LegacyRegistryIssue | undefined {
    let titled: LegacyRegistryIssue | undefined;
    let oldest: LegacyRegistryIssue | undefined;

    for (const issue of issues) {
      if (!oldest || issue.number < oldest.number) oldest = issue;
      if (issue.title === LEGACY_REGISTRY_TITLE && (!titled || issue.number < titled.number)) {
        titled = issue;
      }
    }

    return titled ?? oldest;
  }

  private static parseCanonical(issue: LegacyRegistryIssue): Agent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(issue.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Legacy agent registry issue #${issue.number} contains malformed JSON: ${message}. ` +
          "It was not migrated; fix or empty that issue body and retry."
      );
    }

    const result = AgentRegistrySchema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues
        .map((entry) => {
          const path = entry.path.length > 0 ? `${entry.path.join(".")}: ` : "";
          return `${path}${entry.message}`;
        })
        .join("; ");
      throw new Error(
        `Legacy agent registry issue #${issue.number} contains invalid agent records: ${details}. ` +
          "It was not migrated; fix or empty that issue body and retry."
      );
    }
    return result.data;
  }

  private static parseDuplicate(issue: LegacyRegistryIssue): Agent[] | undefined {
    try {
      const result = AgentRegistrySchema.safeParse(JSON.parse(issue.body || "[]"));
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  private async findByTitle(fullScan: boolean): Promise<LegacyRegistryIssue[]> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const found: LegacyRegistryIssue[] = [];
    const maxPages = fullScan ? TITLE_SCAN_PAGES : 1;

    for (let page = 1; page <= maxPages; page++) {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: config.owner,
        repo: config.repo,
        state: "open",
        per_page: 100,
        page,
        sort: "created",
        direction: "asc",
      });

      for (const issue of issues) {
        if (issue.title === LEGACY_REGISTRY_TITLE) found.push(LegacyAgentRegistry.toIssue(issue));
      }

      if (!fullScan && found.length > 0) break;
      if (issues.length < 100) break;
    }

    return found;
  }

  private async findByLabel(): Promise<LegacyRegistryIssue[]> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    for (let attempt = 0; attempt < LABEL_ATTEMPTS; attempt++) {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: config.owner,
        repo: config.repo,
        labels: AGENT_REGISTRY_LABEL,
        state: "open",
        per_page: 100,
        sort: "created",
        direction: "asc",
      });

      if (issues.length > 0) return issues.map((issue) => LegacyAgentRegistry.toIssue(issue));
    }

    return [];
  }

  /** The list endpoint's body can lag behind a write; a direct read cannot. */
  private async withFreshBody(issue: LegacyRegistryIssue): Promise<LegacyRegistryIssue> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const { data } = await octokit.rest.issues.get({
      owner: config.owner,
      repo: config.repo,
      issue_number: issue.number,
    });
    return LegacyAgentRegistry.toIssue(data);
  }

  private static toIssue(issue: {
    number: number;
    title?: string | null;
    body?: string | null;
    updated_at?: string | null;
  }): LegacyRegistryIssue {
    return {
      number: issue.number,
      title: issue.title ?? "",
      body: issue.body ?? "",
      updatedAt: issue.updated_at ?? null,
    };
  }
}
