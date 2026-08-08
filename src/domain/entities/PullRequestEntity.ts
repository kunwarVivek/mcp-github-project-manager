/**
 * PullRequestEntity - Rich domain entity for GitHub Pull Requests
 *
 * This entity encapsulates business logic and invariants for pull requests,
 * providing computed properties and validation methods.
 *
 * ## Design Decisions
 * - Adds computed properties for PR status, merge state, and review status
 * - Enforces invariants (e.g., cannot merge a draft PR, cannot approve own PR)
 * - Provides factory methods for common creation patterns
 *
 * ## Usage
 * ```typescript
 * const pr = PullRequestEntity.fromData(prData);
 *
 * // Business logic
 * pr.isOpen; // checks if PR is open
 * pr.canMerge(); // checks if PR can be merged
 * pr.approvals; // number of approvals
 * pr.isApproved; // checks if PR has enough approvals
 * ```
 */

/**
 * Pull request state
 */
export enum PullRequestState {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
}

/**
 * Review state
 */
export enum ReviewState {
  PENDING = 'pending',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
  COMMENTED = 'commented',
  DISMISSED = 'dismissed',
}

/**
 * Merge method
 */
export enum MergeMethod {
  MERGE = 'merge',
  SQUASH = 'squash',
  REBASE = 'rebase',
}

/**
 * Configuration for PullRequestEntity
 */
export interface PullRequestEntityConfig {
  /** Required approvals before merge (default: 1) */
  requiredApprovals?: number;
  /** Allow draft PRs to be merged (default: false) */
  allowDraftMerge?: boolean;
  /** Require status checks to pass (default: false) */
  requireStatusChecks?: boolean;
}

const DEFAULT_CONFIG: PullRequestEntityConfig = {
  requiredApprovals: 1,
  allowDraftMerge: false,
  requireStatusChecks: false,
};

/**
 * Pull request review
 */
export interface PullRequestReview {
  id: number;
  user: string;
  state: ReviewState;
  body: string;
  submittedAt?: string;
}

/**
 * Rich domain entity for GitHub Pull Requests
 */
export class PullRequestEntity {
  // Core properties
  public readonly id: number;
  public readonly number: number;
  public title: string;
  public description: string;
  public state: PullRequestState;
  public readonly author: string;
  public readonly head: string;
  public readonly base: string;
  public readonly url: string;
  public readonly createdAt: string;
  public updatedAt: string;
  public mergedAt?: string;
  public closedAt?: string;
  public mergeCommitSha?: string;
  public isDraft: boolean;
  public reviews: PullRequestReview[];
  public labels: string[];
  public assignees: string[];
  public linkedIssues: number[];

  // Internal config
  private readonly config: PullRequestEntityConfig;

  private constructor(
    data: {
      id: number;
      number: number;
      title: string;
      description: string;
      state: PullRequestState;
      author: string;
      head: string;
      base: string;
      url: string;
      createdAt: string;
      updatedAt: string;
      mergedAt?: string;
      closedAt?: string;
      mergeCommitSha?: string;
      isDraft: boolean;
      reviews?: PullRequestReview[];
      labels?: string[];
      assignees?: string[];
      linkedIssues?: number[];
    },
    config: PullRequestEntityConfig = DEFAULT_CONFIG
  ) {
    this.id = data.id;
    this.number = data.number;
    this.title = data.title;
    this.description = data.description;
    this.state = data.state;
    this.author = data.author;
    this.head = data.head;
    this.base = data.base;
    this.url = data.url;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.mergedAt = data.mergedAt;
    this.closedAt = data.closedAt;
    this.mergeCommitSha = data.mergeCommitSha;
    this.isDraft = data.isDraft;
    this.reviews = [...(data.reviews ?? [])];
    this.labels = [...(data.labels ?? [])];
    this.assignees = [...(data.assignees ?? [])];
    this.linkedIssues = [...(data.linkedIssues ?? [])];
    this.config = config;
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create a PullRequestEntity from existing data
   */
  static fromData(
    data: {
      id: number;
      number: number;
      title: string;
      description?: string;
      state: string;
      author?: string;
      head?: string;
      base?: string;
      url: string;
      createdAt?: string;
      updatedAt?: string;
      mergedAt?: string;
      closedAt?: string;
      mergeCommitSha?: string;
      isDraft?: boolean;
      merged?: boolean;
      user?: string;
      body?: string;
      headRef?: string;
      baseRef?: string;
    },
    config?: PullRequestEntityConfig
  ): PullRequestEntity {
    // Normalize state
    let state: PullRequestState;
    if (data.merged) {
      state = PullRequestState.MERGED;
    } else if (data.state === 'closed') {
      state = PullRequestState.CLOSED;
    } else {
      state = PullRequestState.OPEN;
    }

    const now = new Date().toISOString();

    return new PullRequestEntity(
      {
        id: data.id,
        number: data.number,
        title: data.title,
        description: data.body ?? data.description ?? '',
        state,
        author: data.user ?? data.author ?? 'unknown',
        head: data.headRef ?? data.head ?? '',
        base: data.baseRef ?? data.base ?? '',
        url: data.url,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
        mergedAt: data.mergedAt,
        closedAt: data.closedAt,
        mergeCommitSha: data.mergeCommitSha,
        isDraft: data.isDraft ?? false,
      },
      config
    );
  }

  /**
   * Create a new PullRequestEntity with defaults
   */
  static create(
    data: {
      title: string;
      description?: string;
      author: string;
      head: string;
      base: string;
      url: string;
      isDraft?: boolean;
    },
    options: {
      id?: number;
      number?: number;
      config?: PullRequestEntityConfig;
    } = {}
  ): PullRequestEntity {
    const now = new Date().toISOString();

    return new PullRequestEntity(
      {
        id: options.id ?? 0,
        number: options.number ?? 0,
        title: data.title,
        description: data.description ?? '',
        state: PullRequestState.OPEN,
        author: data.author,
        head: data.head,
        base: data.base,
        url: data.url,
        createdAt: now,
        updatedAt: now,
        isDraft: data.isDraft ?? false,
      },
      options.config
    );
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Check if the PR is open
   */
  get isOpen(): boolean {
    return this.state === PullRequestState.OPEN;
  }

  /**
   * Check if the PR is closed (not merged)
   */
  get isClosed(): boolean {
    return this.state === PullRequestState.CLOSED;
  }

  /**
   * Check if the PR is merged
   */
  get isMerged(): boolean {
    return this.state === PullRequestState.MERGED;
  }

  /**
   * Check if the PR can be merged
   */
  get canBeMerged(): boolean {
    return this.isOpen && !this.isDraft;
  }

  /**
   * Check if the PR is approved
   */
  get isApproved(): boolean {
    const approvals = this.reviews.filter(
      r => r.state === ReviewState.APPROVED
    ).length;
    return approvals >= (this.config.requiredApprovals ?? 1);
  }

  /**
   * Check if changes are requested
   */
  get hasChangesRequested(): boolean {
    return this.reviews.some(r => r.state === ReviewState.CHANGES_REQUESTED);
  }

  /**
   * Get the number of approvals
   */
  get approvals(): number {
    return this.reviews.filter(r => r.state === ReviewState.APPROVED).length;
  }

  /**
   * Get the number of change requests
   */
  get changeRequests(): number {
    return this.reviews.filter(r => r.state === ReviewState.CHANGES_REQUESTED).length;
  }

  /**
   * Get review summary
   */
  get reviewSummary(): {
    approvals: number;
    changeRequests: number;
    comments: number;
    pending: number;
  } {
    return {
      approvals: this.approvals,
      changeRequests: this.changeRequests,
      comments: this.reviews.filter(r => r.state === ReviewState.COMMENTED).length,
      pending: this.reviews.filter(r => r.state === ReviewState.PENDING).length,
    };
  }

  /**
   * Get age in days since creation
   */
  get ageInDays(): number {
    const created = new Date(this.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get time since last update in days
   */
  get daysSinceUpdate(): number {
    const updated = new Date(this.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updated.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the PR is stale (no update in 7+ days)
   */
  get isStale(): boolean {
    return this.daysSinceUpdate >= 7;
  }

  /**
   * Check if the PR has conflicts (simplified - would need API check)
   */
  get hasConflicts(): boolean {
    // This is a placeholder - actual conflict detection requires API call
    return false;
  }

  /**
   * Get linked issue numbers from title/description
   */
  get extractedIssueNumbers(): number[] {
    const text = `${this.title} ${this.description}`;
    const matches = text.match(/#(\d+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => parseInt(m.slice(1), 10)))];
  }

  // =========================================================================
  // Business Logic Methods
  // =========================================================================

  /**
   * Mark as ready for review
   */
  markReadyForReview(): void {
    if (!this.isDraft) {
      return; // Already ready
    }
    this.isDraft = false;
    this.touch();
  }

  /**
   * Convert to draft
   */
  convertToDraft(): void {
    if (this.isDraft) {
      return; // Already draft
    }
    if (this.isMerged) {
      throw new Error('Cannot convert merged PR to draft');
    }
    this.isDraft = true;
    this.touch();
  }

  /**
   * Close the PR
   */
  close(): void {
    if (!this.isOpen) {
      return; // Already closed or merged
    }
    this.state = PullRequestState.CLOSED;
    this.closedAt = new Date().toISOString();
    this.touch();
  }

  /**
   * Merge the PR
   */
  merge(mergeCommitSha: string): void {
    if (!this.canBeMerged) {
      throw new Error('Cannot merge: PR is not open or is a draft');
    }
    if (!this.isApproved && (this.config.requiredApprovals ?? 1) > 0) {
      throw new Error('Cannot merge: PR is not approved');
    }
    if (this.hasChangesRequested) {
      throw new Error('Cannot merge: changes requested');
    }

    this.state = PullRequestState.MERGED;
    this.mergedAt = new Date().toISOString();
    this.mergeCommitSha = mergeCommitSha;
    this.touch();
  }

  /**
   * Reopen the PR
   */
  reopen(): void {
    if (this.isOpen) {
      return; // Already open
    }
    if (this.isMerged) {
      throw new Error('Cannot reopen merged PR');
    }
    this.state = PullRequestState.OPEN;
    this.closedAt = undefined;
    this.touch();
  }

  /**
   * Add a review
   */
  addReview(review: PullRequestReview): void {
    // Remove existing review from same user
    this.reviews = this.reviews.filter(r => r.user !== review.user);
    this.reviews.push(review);
    this.touch();
  }

  /**
   * Approve the PR
   */
  approve(user: string, body?: string): void {
    this.addReview({
      id: Date.now(),
      user,
      state: ReviewState.APPROVED,
      body: body ?? '',
      submittedAt: new Date().toISOString(),
    });
  }

  /**
   * Request changes
   */
  requestChanges(user: string, body: string): void {
    if (!body) {
      throw new Error('Change request must include a reason');
    }
    this.addReview({
      id: Date.now(),
      user,
      state: ReviewState.CHANGES_REQUESTED,
      body,
      submittedAt: new Date().toISOString(),
    });
  }

  /**
   * Add a comment review
   */
  comment(user: string, body: string): void {
    this.addReview({
      id: Date.now(),
      user,
      state: ReviewState.COMMENTED,
      body,
      submittedAt: new Date().toISOString(),
    });
  }

  /**
   * Add a label
   * @returns true if label was added, false if already exists
   */
  addLabel(label: string): boolean {
    if (this.labels.includes(label)) {
      return false;
    }
    this.labels.push(label);
    this.touch();
    return true;
  }

  /**
   * Remove a label
   * @returns true if label was removed, false if not found
   */
  removeLabel(label: string): boolean {
    const index = this.labels.indexOf(label);
    if (index === -1) {
      return false;
    }
    this.labels.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Check if PR has a specific label
   */
  hasLabel(label: string): boolean {
    return this.labels.includes(label);
  }

  /**
   * Assign a user
   * @returns true if user was assigned, false if already assigned
   */
  assignTo(userId: string): boolean {
    if (this.assignees.includes(userId)) {
      return false;
    }
    this.assignees.push(userId);
    this.touch();
    return true;
  }

  /**
   * Unassign a user
   * @returns true if user was unassigned, false if not found
   */
  unassign(userId: string): boolean {
    const index = this.assignees.indexOf(userId);
    if (index === -1) {
      return false;
    }
    this.assignees.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Link an issue
   * @returns true if issue was linked, false if already linked
   */
  linkIssue(issueNumber: number): boolean {
    if (this.linkedIssues.includes(issueNumber)) {
      return false;
    }
    this.linkedIssues.push(issueNumber);
    this.touch();
    return true;
  }

  /**
   * Unlink an issue
   * @returns true if issue was unlinked, false if not found
   */
  unlinkIssue(issueNumber: number): boolean {
    const index = this.linkedIssues.indexOf(issueNumber);
    if (index === -1) {
      return false;
    }
    this.linkedIssues.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Get branch name suggestion from title
   */
  toBranchName(): string {
    return this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  /**
   * Convert to plain object (for serialization)
   */
  toData(): {
    id: number;
    number: number;
    title: string;
    description: string;
    state: string;
    author: string;
    head: string;
    base: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    mergedAt?: string;
    closedAt?: string;
    mergeCommitSha?: string;
    isDraft: boolean;
    reviews: PullRequestReview[];
    labels: string[];
    assignees: string[];
    linkedIssues: number[];
  } {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      description: this.description,
      state: this.state,
      author: this.author,
      head: this.head,
      base: this.base,
      url: this.url,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      mergedAt: this.mergedAt,
      closedAt: this.closedAt,
      mergeCommitSha: this.mergeCommitSha,
      isDraft: this.isDraft,
      reviews: [...this.reviews],
      labels: [...this.labels],
      assignees: [...this.assignees],
      linkedIssues: [...this.linkedIssues],
    };
  }

  /**
   * Get a summary of the PR
   */
  toSummary(): {
    id: number;
    number: number;
    title: string;
    state: string;
    author: string;
    isDraft: boolean;
    isOpen: boolean;
    isMerged: boolean;
    approvals: number;
    changeRequests: number;
    ageInDays: number;
    isStale: boolean;
    labels: string[];
    assignees: string[];
  } {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      state: this.state,
      author: this.author,
      isDraft: this.isDraft,
      isOpen: this.isOpen,
      isMerged: this.isMerged,
      approvals: this.approvals,
      changeRequests: this.changeRequests,
      ageInDays: this.ageInDays,
      isStale: this.isStale,
      labels: [...this.labels],
      assignees: [...this.assignees],
    };
  }

  /**
   * Create a copy of this PR
   */
  clone(): PullRequestEntity {
    return PullRequestEntity.fromData(this.toData(), this.config);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Update the updatedAt timestamp
   */
  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }
}
