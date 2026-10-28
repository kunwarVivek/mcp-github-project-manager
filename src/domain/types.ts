// Domain types for GitHub Project Manager
import type { ResourceStatus, ResourceType } from "./resource-types";

// Project-related types
export type ProjectId = string;
export type FieldId = string;
export type ItemId = string;
export type IssueId = string;
export type MilestoneId = string;
export type SprintId = string;

/**
 * Field types GitHub's `ProjectV2CustomFieldType` can create.
 *
 * The GraphQL enum has exactly six members — TEXT, NUMBER, DATE,
 * SINGLE_SELECT, MULTI_SELECT and ITERATION. Every other project field
 * (Assignees, Labels, Milestone, Repository, Tracked by, Tracks, …) is a
 * BUILT-IN field that GitHub adds to every project itself; the API cannot
 * create one, and asking it to is a schema error ("Expected type
 * ProjectV2CustomFieldType, found MILESTONE").
 */
export type FieldType = "text" | "number" | "date" | "single_select" | "multi_select" | "iteration";

/**
 * View layouts GitHub's `ProjectV2ViewLayout` accepts.
 *
 * The enum has exactly three members — BOARD_LAYOUT, TABLE_LAYOUT and
 * ROADMAP_LAYOUT. There is no timeline layout.
 */
export type ViewLayout = "board" | "table" | "roadmap";

/**
 * The role a collaborator can hold on a project.
 *
 * Exactly GitHub's `ProjectV2Roles` enum, which the live schema (verified
 * 2026-10-21) defines with four members: NONE, READER, WRITER and ADMIN.
 * `NONE` means "no access" - it takes the collaborator's access away.
 */
export type ProjectRole = "ADMIN" | "WRITER" | "READER" | "NONE";

/** Whether a collaborator is a user or a team. */
export type ProjectCollaboratorType = "user" | "team";

/**
 * A collaborator of a project, as GitHub reports it.
 *
 * `role` is set only for the collaborators whose role this platform just
 * granted: GitHub has no read path for collaborator roles - `ProjectV2` has
 * no `collaborators` field and the mutation payload returns the actors
 * without their roles - so a role can never be read back.
 */
export interface ProjectCollaborator {
  /** Node id of the user or the team. */
  id: string;
  /** Login of the user, or slug of the team. */
  login: string;
  /** Whether this collaborator is a user or a team. */
  type: ProjectCollaboratorType;
  /** The role that was granted, when this platform granted it. */
  role?: ProjectRole;
}

/**
 * A role to grant to a user or a team.
 *
 * Exactly one of `userLogin` / `teamSlug` must be set: the live
 * `ProjectV2Collaborator` input carries a `userId` or a `teamId`, never
 * both. The platform resolves the login / slug to the node id.
 */
export interface ProjectCollaboratorGrant {
  /** Login of the user to grant the role to. */
  userLogin?: string;
  /** Slug of the team to grant the role to. */
  teamSlug?: string;
  /** The role to grant. */
  role: ProjectRole;
}

// Issue-related types
export interface Issue {
  id: IssueId;
  number: number;
  title: string;
  description: string;
  status: ResourceStatus;
  assignees: string[];
  labels: string[];
  milestoneId?: MilestoneId;
  createdAt: string;
  updatedAt: string;
  url: string;
  /**
   * The name of the native GitHub issue type (an organization issue type),
   * e.g. "Bug". Absent when the issue has no native type.
   */
  issueTypeName?: string;
  /** The node id of the native issue type, when the issue has one. */
  issueTypeId?: string;
  /**
   * Numbers of the issues that block this one, read from GitHub's native
   * `blockedBy` issue edges.
   */
  blockedBy?: number[];
  /**
   * Numbers of the issues this one blocks, read from GitHub's native
   * `blocking` issue edges.
   */
  blocking?: number[];
  /**
   * Node ids of the projects the issue is a member of — GitHub's reverse
   * membership (`Issue.projectItems`).
   */
  projectIds?: string[];
}

export interface CreateIssue {
  title: string;
  description: string;
  assignees?: string[];
  labels?: string[];
  milestoneId?: MilestoneId;
  status?: ResourceStatus;
  priority?: string;
  issueType?: string;
}

export interface IssueRepository {
  create(data: CreateIssue): Promise<Issue>;
  update(id: IssueId, data: Partial<Issue>): Promise<Issue>;
  delete(id: IssueId): Promise<void>;
  findById(id: IssueId): Promise<Issue | null>;
  findByMilestone(milestoneId: MilestoneId): Promise<Issue[]>;
  findAll(options?: { status?: ResourceStatus }): Promise<Issue[]>;

  // ── Native issue dependencies ("blocked by" edges) ────────────────────
  /** The issues that block the given issue. */
  listBlockers(id: IssueId): Promise<IssueDependency[]>;
  /** The issues the given issue blocks. */
  listBlocking(id: IssueId): Promise<IssueDependency[]>;
  /** Makes the given issue blocked by another one. */
  addBlocker(id: IssueId, blockingIssueId: IssueId): Promise<IssueDependency>;
  /** Removes a "blocked by" edge. */
  removeBlocker(id: IssueId, blockingIssueId: IssueId): Promise<void>;

  // ── Native issue types ────────────────────────────────────────────────
  /** The organization issue type catalogue. */
  listIssueTypes(): Promise<IssueTypeDefinition[]>;
  /** The native issue type of an issue, when it has one. */
  getIssueType(id: IssueId): Promise<IssueTypeDefinition | null>;
  /**
   * Sets the native issue type of an issue.
   *
   * @param issueType - An issue type node id (`IT_...`) or a type name.
   */
  setIssueType(id: IssueId, issueType: string): Promise<IssueTypeDefinition | null>;

  // ── Reverse membership (which projects is this issue in?) ─────────────
  /** The projects an issue is a member of. */
  getProjectMembership(id: IssueId): Promise<IssueProjectMembership>;
  /** Whether an issue is a member of the given project. */
  isInProject(id: IssueId, projectId: string): Promise<boolean>;
}

/**
 * Where a native GitHub capability was read from.
 *
 * `native` — GitHub's own API (issue edges, organization issue types).
 * `label` — the platform's label emulation (`blocked-by:#123`, `type:bug`),
 * used as a fallback when the deployment does not expose the native field.
 */
export type IssueNativeSource = "native" | "label";

/**
 * A "blocked by" edge between two issues.
 *
 * `issueId` is the blocked issue (the one that cannot proceed);
 * `blockingIssueId` is the issue that blocks it.
 */
export interface IssueDependency {
  /** Node id of the blocked issue. */
  issueId: IssueId;
  /** Number of the blocked issue. */
  issueNumber: number;
  /** Node id of the blocking issue, when it could be resolved. */
  blockingIssueId: IssueId | null;
  /** Number of the blocking issue. */
  blockingIssueNumber: number;
  /** Title of the blocking issue, when known. */
  title?: string;
  /** State of the blocking issue, when known. */
  state?: string;
  /** Whether the edge is a GitHub edge or the label emulation. */
  source: IssueNativeSource;
}

/**
 * An organization issue type — GitHub's native issue-kind catalogue.
 */
export interface IssueTypeDefinition {
  /** Node id of the issue type (`IT_...`), when known. */
  id?: string;
  /** Display name, e.g. "Bug". */
  name: string;
  /** GitHub's colour for the type, e.g. "RED". */
  color?: string;
  /** What the type is for. */
  description?: string;
  /** Whether the organization has the type enabled. */
  isEnabled?: boolean;
  /** Whether the value came from the native type or the `type:` label. */
  source?: IssueNativeSource;
}

/**
 * The projects an issue is a member of — GitHub's reverse membership.
 */
export interface IssueProjectMembership {
  /** The issue the membership belongs to. */
  issueId: IssueId;
  /** Node ids of the projects the issue is in. */
  projectIds: string[];
  /** Node ids of the project items that represent the issue. */
  itemIds: string[];
  /** The projects themselves. */
  projects: Array<{
    id: string;
    number: number;
    title: string;
  }>;
}

// Milestone-related types
export interface Milestone {
  id: MilestoneId;
  number: number;
  title: string;
  description: string;
  dueDate?: string;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
  url: string;
  progress?: {
    percent: number;
    complete: number;
    total: number;
  };
}

export interface CreateMilestone {
  title: string;
  description: string;
  dueDate?: string;
  status?: ResourceStatus;
  goals?: string[];
}

export interface MilestoneRepository {
  create(data: CreateMilestone): Promise<Milestone>;
  update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone>;
  delete(id: MilestoneId): Promise<void>;
  findById(id: MilestoneId): Promise<Milestone | null>;
  findAll(options?: { status?: ResourceStatus }): Promise<Milestone[]>;
  getIssues(id: MilestoneId): Promise<Issue[]>;
}

// Sprint-related types
export interface Sprint {
  id: SprintId;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: ResourceStatus;
  issues: IssueId[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprint {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status?: ResourceStatus;
  issues?: IssueId[];
  goals?: string[];
}

export interface SprintRepository {
  create(data: CreateSprint): Promise<Sprint>;
  update(id: SprintId, data: Partial<Sprint>): Promise<Sprint>;
  delete(id: SprintId): Promise<void>;
  findById(id: SprintId): Promise<Sprint | null>;
  findAll(options?: { status?: ResourceStatus }): Promise<Sprint[]>;
  findCurrent(): Promise<Sprint | null>;
  addIssue(sprintId: SprintId, issueId: IssueId): Promise<Sprint>;
  removeIssue(sprintId: SprintId, issueId: IssueId): Promise<Sprint>;
  getIssues(sprintId: SprintId): Promise<Issue[]>;
}

// Helper function to create resources (referenced in ProjectManagementService)
export function createResource<T>(type: ResourceType, data: T): T & { type: ResourceType } {
  return { ...data, type };
}

// Type-specific field configuration. The iteration keys are the ones the
// platform reads; other keys are carried through untouched.
export interface FieldConfig {
  iterationDuration?: number;
  iterationStart?: string | Date;
  iterations?: Array<{ id: string; title: string; startDate: string; duration: number }>;
  [key: string]: unknown;
}

// Custom field configuration
export interface CustomField {
  id: FieldId;
  name: string;
  type: FieldType;
  options?: Array<{
    id: string;
    name: string;
    color?: string;
    description?: string;
  }>;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validation?: Record<string, unknown>;
  config?: FieldConfig;
}

// Field creation data
export interface CreateField {
  name: string;
  type: FieldType;
  options?: Array<{
    name: string;
    color?: string;
    description?: string;
  }>;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validation?: Record<string, unknown>;
  config?: FieldConfig;
}

// Field update data
export interface UpdateField {
  name?: string;
  options?: Array<{
    id?: string;
    name: string;
    color?: string;
    description?: string;
  }>;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validation?: Record<string, unknown>;
  config?: FieldConfig;
}

// Project view configuration
export interface ProjectView {
  id: string;
  name: string;
  layout: ViewLayout;
  fields?: CustomField[];
  sortBy?: Array<{
    field: string;
    direction: "ASC" | "DESC";
  }>;
  /**
   * The names of the fields the view groups by, in order.
   *
   * Live `ProjectV2View.groupByFields`. The API models grouping as a
   * connection, so this is a list even though GitHub's UI groups by a
   * single field.
   */
  groupByFields?: string[];
  /**
   * The view's server-side filter expression, exactly as GitHub stores it.
   *
   * Live `ProjectV2View.filter`; `null` when the view has no filter. This
   * is what makes a view a claiming pool: the view's items are the items
   * its filter selects, server-side.
   */
  filter?: string | null;
  /**
   * The names of the fields the view shows, in configured order.
   *
   * Live `ProjectV2View.configuration.visibleFields`.
   */
  visibleFields?: string[];
  filters?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  settings?: Record<string, unknown>;
}

// Project item interface
export interface ProjectItem {
  id: ItemId;
  contentId: string;
  /** Title of the linked issue / pull request, when the query returned it. */
  title?: string;
  contentType: ResourceType;
  projectId: ProjectId;
  fieldValues: Record<FieldId, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Project interface
export interface Project {
  id: ProjectId;
  type: ResourceType;
  title: string;
  description: string;
  owner: string;
  number: number;
  url: string;
  fields: CustomField[];
  views?: ProjectView[];
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  status?: ResourceStatus;
  visibility?: string;
  version?: number;
}

export interface CreateProject {
  title: string;
  shortDescription?: string; // Made optional since it's handled via update after creation
  description?: string;
  owner: string;
  visibility?: "private" | "public";
  views?: ProjectView[];
  fields?: CustomField[];
  teamId?: string; // Add support for team association (GitHub schema optional field)
  clientMutationId?: string; // Add support for mutation tracking (GitHub schema optional field)
  status?: ResourceStatus;
  goals?: string[];
}

// Project repository interface
export interface ProjectRepository {
  create(project: CreateProject): Promise<Project>;
  update(id: ProjectId, data: Partial<Project>): Promise<Project>;
  delete(id: ProjectId): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  findByOwner(owner: string): Promise<Project[]>;
  findAll(): Promise<Project[]>;

  // Field operations
  createField(projectId: ProjectId, field: CreateField): Promise<CustomField>;
  updateField(projectId: ProjectId, fieldId: FieldId, data: UpdateField): Promise<CustomField>;
  deleteField(projectId: ProjectId, fieldId: FieldId): Promise<void>;

  // View operations
  createView(projectId: ProjectId, name: string, layout: ViewLayout): Promise<ProjectView>;
  /**
   * The views of a project, with the configuration GitHub stores for them.
   *
   * `options` narrows the result down to a single view, by name or by id.
   */
  listViews(
    projectId: ProjectId,
    options?: { name?: string; viewId?: string }
  ): Promise<ProjectView[]>;
  updateView(
    projectId: ProjectId,
    viewId: string,
    data: Partial<ProjectView>
  ): Promise<ProjectView>;
  deleteView(projectId: ProjectId, viewId: string): Promise<void>;

  // Collaborator operations
  /**
   * Sets the roles of a project's collaborators.
   *
   * `org` is the organization that owns the teams; it defaults to the
   * configured owner.
   */
  updateCollaborators(
    projectId: ProjectId,
    grants: ProjectCollaboratorGrant[],
    org?: string
  ): Promise<ProjectCollaborator[]>;
}
