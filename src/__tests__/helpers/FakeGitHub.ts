import { createHash } from "node:crypto";
import { type Mocked, vi } from "vitest";
import type { Agent } from "../../domain/agent-orchestration-types";
import { AGENT_REGISTRY_BRANCH, AGENT_REGISTRY_FILE } from "../../domain/agent-orchestration-types";
import type { GitHubRepositoryFactory } from "../../infrastructure/github/GitHubRepositoryFactory";
import type { OctokitInstance } from "../../infrastructure/github/types";

/**
 * Shared hand-rolled fake for the narrow GitHub surface used by the agent
 * storage layer (`AgentStore`, `WorkProductStore`).
 *
 * The fake behaves like the real REST endpoints rather than like a set of
 * assertion-only mocks:
 *
 * - reads (`issues.listForRepo`, `issues.listComments`, `repos.getContent`)
 *   return a **snapshot** of the server state taken at request time;
 * - issue writes (`issues.update`, `issues.createComment`, `issues.create`)
 *   mutate the server state atomically, last write wins;
 * - git refs and contents model the Contents API: `repos.getContent` returns
 *   the blob sha of a file, and `repos.createOrUpdateFileContents` is a
 *   **compare-and-swap** — a stale `sha` is rejected with 409, exactly like
 *   GitHub, so a lost update is impossible rather than merely unlikely;
 *   `git.createRef` answers 422 "Reference already exists" to the loser of a
 *   branch-creation race;
 * - writes (`issues.update`, `repos.createOrUpdateFileContents`,
 *   `git.createRef`) can be **paused**, which lets a test interleave
 *   concurrent writers deterministically: all of them read the same state,
 *   compute their change, and only then are the writes applied — one at a
 *   time with {@link FakeGitHub.releaseOneWrite} or all at once.
 *
 * No network, no new dependencies.
 */

export interface FakeIssue {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  state: "open" | "closed";
  /** ISO timestamp of the last write; set by `issues.update`, or seeded. */
  updatedAt?: string;
}

export interface FakeComment {
  id: number;
  body: string;
  createdAt: string;
}

export interface FakeWrite {
  issueNumber: number;
  body: string;
}

/** One `repos.createOrUpdateFileContents` call, in the order the server decided it. */
export interface FakeContentWrite {
  branch: string;
  path: string;
  content: string;
  /** The blob sha the writer said it was replacing (undefined for a create). */
  replacedSha: string | undefined;
  outcome: "committed" | "conflict" | "rejected";
}

/** One `git.createRef` call, in the order the server decided it. */
export interface FakeRefCreation {
  ref: string;
  outcome: "created" | "exists";
}

export interface FakeCommentPageRequest {
  issueNumber: number;
  page: number;
  perPage: number;
}

interface ListForRepoParams {
  owner: string;
  repo: string;
  labels?: string | string[];
  state?: "open" | "closed";
  per_page?: number;
  sort?: string;
  direction?: string;
  page?: number;
}

interface GetIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

interface CreateParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

interface CreateLabelParams {
  owner: string;
  repo: string;
  name: string;
  color?: string;
  description?: string;
}

interface UpdateParams {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
}

interface ListCommentsParams {
  owner: string;
  repo: string;
  issue_number: number;
  per_page?: number;
  page?: number;
}

interface CreateCommentParams {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
}

interface GetContentParams {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

interface PutContentParams {
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: string;
  branch?: string;
  sha?: string;
}

interface CreateBlobParams {
  owner: string;
  repo: string;
  content: string;
  encoding?: string;
}

interface CreateTreeParams {
  owner: string;
  repo: string;
  tree: Array<{ path: string; mode: string; type: string; sha: string }>;
}

interface CreateCommitParams {
  owner: string;
  repo: string;
  message: string;
  tree: string;
  parents?: string[];
}

interface CreateRefParams {
  owner: string;
  repo: string;
  ref: string;
  sha: string;
}

interface GetRefParams {
  owner: string;
  repo: string;
  ref: string;
}

interface FakeCommit {
  tree: string;
  parents: string[];
  message: string;
}

/** An HTTP failure shaped like Octokit's `RequestError` (`status` + `message`). */
export class FakeHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "FakeHttpError";
  }
}

const REPOSITORY_EMPTY = "Git Repository is empty.";

function gitObjectSha(kind: string, payload: string): string {
  return createHash("sha1")
    .update(`${kind} ${Buffer.byteLength(payload)}\0${payload}`)
    .digest("hex");
}

export class FakeGitHub {
  /** Issues living in the fake repository. */
  readonly issues: FakeIssue[] = [];
  /** Comments per issue number. */
  readonly comments = new Map<number, FakeComment[]>();
  /** Labels created through `issues.createLabel`. */
  readonly createdLabels: string[] = [];
  /** Every `issues.update` call, in the order the server applied them. */
  readonly writes: FakeWrite[] = [];
  /** Every `issues.listComments` call, in call order. */
  readonly commentPageRequests: FakeCommentPageRequest[] = [];
  /** Every `repos.createOrUpdateFileContents` call, in the order the server decided it. */
  readonly contentWrites: FakeContentWrite[] = [];
  /** Every `git.createRef` call, in the order the server decided it. */
  readonly refCreations: FakeRefCreation[] = [];
  /** How many `repos.getContent` calls were served. */
  contentReads = 0;

  private nextIssueNumber = 100;
  private nextCommentId = 1;
  private clock = 0;
  private objectCounter = 0;
  private writesPaused = false;
  private pendingWrites: Array<{ release: () => void }> = [];
  private pendingWriteWaiters: Array<{ target: number; resolve: () => void }> = [];

  private readonly blobs = new Map<string, string>();
  private readonly trees = new Map<string, Array<{ path: string; sha: string }>>();
  private readonly commits = new Map<string, FakeCommit>();
  private readonly branches = new Map<string, string>();
  private contentWriteFailure: { status: number; message: string } | undefined;
  private gitDataFailure: { status: number; message: string } | undefined;
  /** Runs on the server right before each content write is decided — a rival committing first. */
  beforeContentWrite: (() => void) | undefined;

  constructor(seedIssues: FakeIssue[] = [], options: { emptyRepository?: boolean } = {}) {
    for (const issue of seedIssues) {
      this.issues.push({ ...issue });
      this.nextIssueNumber = Math.max(this.nextIssueNumber, issue.number + 1);
    }
    if (!options.emptyRepository) {
      this.commitFiles("main", { "README.md": "# fake repository" });
    }
  }

  // -------------------------------------------------------------------------
  // Seeding helpers
  // -------------------------------------------------------------------------

  addIssue(issue: Partial<FakeIssue> & { number: number }): FakeIssue {
    const created: FakeIssue = {
      title: "Issue",
      body: "",
      labels: [],
      state: "open",
      ...issue,
    };
    this.issues.push(created);
    this.nextIssueNumber = Math.max(this.nextIssueNumber, created.number + 1);
    return created;
  }

  addComment(issueNumber: number, body: string): FakeComment {
    const list = this.comments.get(issueNumber) ?? [];
    const comment: FakeComment = {
      id: this.nextCommentId++,
      body,
      createdAt: "2026-01-01T00:00:00Z",
    };
    list.push(comment);
    this.comments.set(issueNumber, list);
    return comment;
  }

  /** Current body of an issue (empty string when the issue does not exist). */
  issueBody(issueNumber: number): string {
    return this.issues.find((issue) => issue.number === issueNumber)?.body ?? "";
  }

  /**
   * Create the registry branch with `registry.json` holding `content`
   * (agents are serialised; a string is stored verbatim, for corrupt files).
   */
  seedRegistry(content: Agent[] | string): void {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    this.commitFiles(AGENT_REGISTRY_BRANCH, { [AGENT_REGISTRY_FILE]: text });
  }

  /** Whether a branch exists on the fake server. */
  hasBranch(name: string): boolean {
    return this.branches.has(name);
  }

  /** Raw text of a file at the tip of a branch, or `undefined`. */
  fileText(branch: string, path: string): string | undefined {
    const tip = this.branches.get(branch);
    if (!tip) return undefined;
    const entry = this.treeEntries(tip).find((candidate) => candidate.path === path);
    return entry ? this.blobs.get(entry.sha) : undefined;
  }

  /** The registry as the server holds it right now. */
  registryAgents(): Agent[] {
    const text = this.fileText(AGENT_REGISTRY_BRANCH, AGENT_REGISTRY_FILE);
    if (text === undefined)
      throw new Error("the registry branch does not exist on the fake server");
    return JSON.parse(text) as Agent[];
  }

  /** Number of commits reachable from the tip of a branch. */
  commitCount(branch: string): number {
    let count = 0;
    let cursor = this.branches.get(branch);
    while (cursor) {
      count++;
      cursor = this.commits.get(cursor)?.parents[0];
    }
    return count;
  }

  /**
   * Make every `repos.createOrUpdateFileContents` fail with `status` until
   * cleared — how a missing `contents: write` permission (403/404) or a branch
   * ruleset (409 "Repository rule violations found") shows up.
   */
  rejectContentWrites(failure: { status: number; message: string } | undefined): void {
    this.contentWriteFailure = failure;
  }

  /** Make `git.createBlob` fail until cleared — a token that cannot create the registry branch. */
  rejectGitDataWrites(failure: { status: number; message: string } | undefined): void {
    this.gitDataFailure = failure;
  }

  /** Delete a file from the tip of a branch with a new commit. */
  removeFile(branch: string, path: string): void {
    const tip = this.branches.get(branch);
    if (!tip) throw new Error(`no branch ${branch} on the fake server`);
    const entries = this.treeEntries(tip).filter((entry) => entry.path !== path);
    this.branches.set(
      branch,
      this.storeCommit({ tree: this.storeTree(entries), parents: [tip], message: `remove ${path}` })
    );
  }

  // -------------------------------------------------------------------------
  // Write gating (used to simulate concurrent writers deterministically)
  // -------------------------------------------------------------------------

  /** Hold back `issues.update`, `repos.createOrUpdateFileContents` and `git.createRef` calls. */
  pauseWrites(): void {
    this.writesPaused = true;
  }

  /**
   * Apply every pending write and resume normal writes.
   *
   * `order` controls which write reaches the server first:
   * - `"queued"`: the writer that reached the server first writes first,
   * - `"reversed"`: the writer that reached the server last writes first.
   */
  releaseWrites(order: "queued" | "reversed" = "queued"): void {
    this.writesPaused = false;
    const pending = this.pendingWrites;
    this.pendingWrites = [];
    const ordered = order === "queued" ? pending : [...pending].reverse();
    for (const entry of ordered) {
      entry.release();
    }
  }

  /**
   * Apply exactly one pending write (the `index`-th to arrive) and keep the
   * rest — and any write that arrives later — paused.
   */
  releaseOneWrite(index = 0): void {
    const [entry] = this.pendingWrites.splice(index, 1);
    if (!entry) throw new Error(`no pending write at index ${index}`);
    entry.release();
  }

  /** Resolve once `target` writes are waiting to be applied. */
  waitForPendingWrites(target: number): Promise<void> {
    if (this.pendingWrites.length >= target) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.pendingWriteWaiters.push({ target, resolve });
    });
  }

  private settlePendingWriteWaiters(): void {
    this.pendingWriteWaiters = this.pendingWriteWaiters.filter((waiter) => {
      if (this.pendingWrites.length >= waiter.target) {
        waiter.resolve();
        return false;
      }
      return true;
    });
  }

  /** Run `apply` now, or once the write is released when writes are paused. */
  private async gated<T>(apply: () => T): Promise<T> {
    if (this.writesPaused) {
      await new Promise<void>((release) => {
        this.pendingWrites.push({ release });
        this.settlePendingWriteWaiters();
      });
    }
    return apply();
  }

  // -------------------------------------------------------------------------
  // Git object model
  // -------------------------------------------------------------------------

  private isEmptyRepository(): boolean {
    return this.branches.size === 0;
  }

  private treeEntries(commitSha: string): Array<{ path: string; sha: string }> {
    const commit = this.commits.get(commitSha);
    return commit ? (this.trees.get(commit.tree) ?? []) : [];
  }

  private storeBlob(content: string): string {
    const sha = gitObjectSha("blob", content);
    this.blobs.set(sha, content);
    return sha;
  }

  private storeTree(entries: Array<{ path: string; sha: string }>): string {
    const sha = gitObjectSha("tree", JSON.stringify(entries));
    this.trees.set(sha, entries);
    return sha;
  }

  private storeCommit(commit: FakeCommit): string {
    const sha = gitObjectSha("commit", `${JSON.stringify(commit)}#${this.objectCounter++}`);
    this.commits.set(sha, commit);
    return sha;
  }

  /** Commit `files` (full tree) on top of `branch`, creating the branch when needed. */
  private commitFiles(branch: string, files: Record<string, string>): string {
    const entries = Object.entries(files).map(([path, content]) => ({
      path,
      sha: this.storeBlob(content),
    }));
    const parent = this.branches.get(branch);
    const sha = this.storeCommit({
      tree: this.storeTree(entries),
      parents: parent ? [parent] : [],
      message: "fake commit",
    });
    this.branches.set(branch, sha);
    return sha;
  }

  private static branchOf(ref: string, prefix: string): string {
    return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
  }

  // -------------------------------------------------------------------------
  // REST surface
  // -------------------------------------------------------------------------

  readonly rest = {
    issues: {
      listForRepo: async (params: ListForRepoParams) => {
        const wanted =
          params.labels === undefined
            ? []
            : Array.isArray(params.labels)
              ? params.labels
              : [params.labels];
        const state = params.state ?? "open";
        const matches = this.issues
          .filter(
            (issue) =>
              issue.state === state && wanted.every((label) => issue.labels.includes(label))
          )
          .sort((a, b) => a.number - b.number);
        const perPage = params.per_page ?? 30;
        const page = params.page ?? 1;
        return {
          data: matches.slice((page - 1) * perPage, page * perPage).map((issue) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            updated_at: issue.updatedAt,
          })),
        };
      },

      get: async (params: GetIssueParams) => {
        const issue = this.issues.find((candidate) => candidate.number === params.issue_number);
        if (!issue) throw new FakeHttpError(404, "Not Found");
        return {
          data: {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            updated_at: issue.updatedAt,
          },
        };
      },

      create: async (params: CreateParams) => {
        const issue = this.addIssue({
          number: this.nextIssueNumber,
          title: params.title,
          body: params.body ?? "",
          labels: params.labels ?? [],
        });
        return {
          data: { number: issue.number, title: issue.title, body: issue.body },
        };
      },

      createLabel: async (params: CreateLabelParams) => {
        if (!this.createdLabels.includes(params.name)) {
          this.createdLabels.push(params.name);
        }
        return { data: { name: params.name } };
      },

      update: async (params: UpdateParams) => {
        const write: FakeWrite = { issueNumber: params.issue_number, body: params.body };
        await this.gated(() => {
          const issue = this.issues.find((candidate) => candidate.number === write.issueNumber);
          if (issue) {
            issue.body = write.body;
            issue.updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, ++this.clock)).toISOString();
          }
          this.writes.push(write);
        });
        return { data: { number: params.issue_number } };
      },

      listComments: async (params: ListCommentsParams) => {
        const perPage = params.per_page ?? 30;
        const page = params.page ?? 1;
        this.commentPageRequests.push({
          issueNumber: params.issue_number,
          page,
          perPage,
        });
        const all = this.comments.get(params.issue_number) ?? [];
        const start = (page - 1) * perPage;
        return {
          data: all.slice(start, start + perPage).map((comment) => ({
            id: comment.id,
            body: comment.body,
            created_at: comment.createdAt,
          })),
        };
      },

      createComment: async (params: CreateCommentParams) => {
        const comment = this.addComment(params.issue_number, params.body);
        return { data: { id: comment.id } };
      },
    },

    repos: {
      getContent: async (params: GetContentParams) => {
        this.contentReads++;
        const branch = params.ref ?? "main";
        const tip = this.branches.get(branch);
        const entry = tip
          ? this.treeEntries(tip).find((candidate) => candidate.path === params.path)
          : undefined;
        const text = entry ? this.blobs.get(entry.sha) : undefined;
        if (!entry || text === undefined) throw new FakeHttpError(404, "Not Found");

        return {
          data: {
            type: "file" as const,
            name: params.path,
            path: params.path,
            sha: entry.sha,
            size: Buffer.byteLength(text),
            encoding: "base64",
            content: Buffer.from(text, "utf8").toString("base64"),
          },
        };
      },

      createOrUpdateFileContents: async (params: PutContentParams) => {
        const branch = params.branch ?? "main";
        const content = Buffer.from(params.content, "base64").toString("utf8");

        return this.gated(() => {
          this.beforeContentWrite?.();
          const record = (outcome: FakeContentWrite["outcome"]): void => {
            this.contentWrites.push({
              branch,
              path: params.path,
              content,
              replacedSha: params.sha,
              outcome,
            });
          };

          const tip = this.branches.get(branch);
          if (!tip) {
            record("rejected");
            throw new FakeHttpError(404, `Branch ${branch} not found`);
          }
          if (this.contentWriteFailure) {
            record("rejected");
            throw new FakeHttpError(
              this.contentWriteFailure.status,
              this.contentWriteFailure.message
            );
          }

          const entries = this.treeEntries(tip);
          const current = entries.find((candidate) => candidate.path === params.path);
          if (current && params.sha === undefined) {
            record("rejected");
            throw new FakeHttpError(422, 'Invalid request.\n\n"sha" wasn\'t supplied.');
          }
          if (current?.sha !== params.sha) {
            record("conflict");
            throw new FakeHttpError(409, `${params.path} does not match ${params.sha}`);
          }

          const blobSha = this.storeBlob(content);
          const nextEntries = [
            ...entries.filter((candidate) => candidate.path !== params.path),
            { path: params.path, sha: blobSha },
          ];
          const commitSha = this.storeCommit({
            tree: this.storeTree(nextEntries),
            parents: [tip],
            message: params.message,
          });
          this.branches.set(branch, commitSha);
          record("committed");
          return { data: { content: { sha: blobSha }, commit: { sha: commitSha } } };
        });
      },
    },

    git: {
      getRef: async (params: GetRefParams) => {
        if (this.isEmptyRepository()) throw new FakeHttpError(409, REPOSITORY_EMPTY);
        const branch = FakeGitHub.branchOf(params.ref, "heads/");
        const tip = this.branches.get(branch);
        if (!tip) throw new FakeHttpError(404, "Not Found");
        return { data: { ref: `refs/heads/${branch}`, object: { sha: tip } } };
      },

      createBlob: async (params: CreateBlobParams) => {
        if (this.isEmptyRepository()) throw new FakeHttpError(409, REPOSITORY_EMPTY);
        if (this.gitDataFailure) {
          throw new FakeHttpError(this.gitDataFailure.status, this.gitDataFailure.message);
        }
        const text =
          params.encoding === "base64"
            ? Buffer.from(params.content, "base64").toString("utf8")
            : params.content;
        return { data: { sha: this.storeBlob(text) } };
      },

      createTree: async (params: CreateTreeParams) => {
        if (this.isEmptyRepository()) throw new FakeHttpError(409, REPOSITORY_EMPTY);
        const entries = params.tree.map((entry) => ({ path: entry.path, sha: entry.sha }));
        return { data: { sha: this.storeTree(entries) } };
      },

      createCommit: async (params: CreateCommitParams) => {
        if (this.isEmptyRepository()) throw new FakeHttpError(409, REPOSITORY_EMPTY);
        if (!this.trees.has(params.tree)) throw new FakeHttpError(422, "Tree SHA does not exist");
        const sha = this.storeCommit({
          tree: params.tree,
          parents: params.parents ?? [],
          message: params.message,
        });
        return { data: { sha } };
      },

      createRef: async (params: CreateRefParams) => {
        if (this.isEmptyRepository()) throw new FakeHttpError(409, REPOSITORY_EMPTY);
        const branch = FakeGitHub.branchOf(params.ref, "refs/heads/");
        return this.gated(() => {
          if (this.branches.has(branch)) {
            this.refCreations.push({ ref: params.ref, outcome: "exists" });
            throw new FakeHttpError(422, "Reference already exists");
          }
          if (!this.commits.has(params.sha)) throw new FakeHttpError(422, "Object does not exist");
          this.branches.set(branch, params.sha);
          this.refCreations.push({ ref: params.ref, outcome: "created" });
          return { data: { ref: params.ref, object: { sha: params.sha } } };
        });
      },
    },
  };

  /** GraphQL is not used by the agent storage layer, but kept for shape parity. */
  readonly graphql = vi.fn(async () => ({}));

  /** Build a repository factory backed by this fake. */
  asFactory(): Mocked<GitHubRepositoryFactory> {
    return {
      getOctokit: vi.fn(() => ({ rest: this.rest }) as unknown as OctokitInstance),
      getConfig: vi.fn(() => ({ owner: "test-owner", repo: "test-repo" })),
      graphql: this.graphql,
    } as unknown as Mocked<GitHubRepositoryFactory>;
  }
}
