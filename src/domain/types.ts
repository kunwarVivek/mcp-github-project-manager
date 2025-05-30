// Domain types for GitHub Project Manager
import { ResourceStatus, ResourceType } from "./resource-types";

// Project-related types
export type ProjectId = string;
export type FieldId = string;
export type ItemId = string;
export type IssueId = string;
export type MilestoneId = string;
export type SprintId = string;

// Field types supported by GitHub Projects v2
export type FieldType = 
  | 'text'
  | 'number'
  | 'date'
  | 'single_select'
  | 'iteration'
  | 'milestone'
  | 'assignees'
  | 'labels'
  | 'repository'
  | 'tracked_by'
  | 'tracks';

// View layouts supported by GitHub Projects v2
export type ViewLayout = 'board' | 'table' | 'timeline' | 'roadmap';

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
  defaultValue?: any;
  validation?: Record<string, any>;
  config?: Record<string, any>;
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
  defaultValue?: any;
  validation?: Record<string, any>;
  config?: Record<string, any>;
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
  defaultValue?: any;
  validation?: Record<string, any>;
  config?: Record<string, any>;
}

// Project view configuration
export interface ProjectView {
  id: string;
  name: string;
  layout: ViewLayout;
  fields?: CustomField[];
  sortBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  groupBy?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  settings?: Record<string, any>;
}

// Project item interface
export interface ProjectItem {
  id: ItemId;
  contentId: string;
  contentType: ResourceType;
  projectId: ProjectId;
  fieldValues: Record<FieldId, any>;
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
  visibility?: 'private' | 'public';
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
  updateView(projectId: ProjectId, viewId: string, data: Partial<ProjectView>): Promise<ProjectView>;
  deleteView(projectId: ProjectId, viewId: string): Promise<void>;
}
