import { Resource, ResourceStatus, ResourceType } from "./resource-types";

// View and Field Types
export type ViewLayout = 'board' | 'table' | 'timeline' | 'roadmap';
export type FieldType = 'text' | 'number' | 'date' | 'single_select' | 'multi_select' | 'iteration';

// Issue Types
export type IssueType = 'bug' | 'feature' | 'enhancement' | 'documentation';
export type IssuePriority = 'high' | 'medium' | 'low';
export type IssueId = string;

// Project Types
export type ProjectId = string;
export type ViewId = string;
export type FieldId = string;

// Milestone Types
export type MilestoneId = string;
export type SprintId = string;

// Create Types without id and timestamps
export interface CreateIssue {
  title: string;
  description: string;
  status: ResourceStatus;
  priority: IssuePriority;
  issueType: IssueType;
  assignees: string[];
  labels: string[];
  milestoneId?: string;
}

export interface CreateProject {
  title: string;
  description: string;
  status: ResourceStatus;
  visibility: 'public' | 'private';
  views: ProjectView[];
  fields: CustomField[];
}

export interface CreateMilestone {
  title: string;
  description?: string;
  status: ResourceStatus;
  dueDate?: string | null;
}

export interface CreateSprint {
  title: string;
  status: ResourceStatus;
  startDate: string;
  endDate: string;
  goals: string[];
  issues: IssueId[];
}

// Full Resource Types
export interface Issue extends Resource {
  type: ResourceType.ISSUE;
  title: string;
  description: string;
  status: ResourceStatus;
  priority: IssuePriority;
  issueType: IssueType;
  assignees: string[];
  labels: string[];
  milestoneId?: string;
}

export interface Project extends Resource {
  type: ResourceType.PROJECT;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  views: ProjectView[];
  fields: CustomField[];
}

export interface Milestone extends Resource {
  type: ResourceType.MILESTONE;
  title: string;
  description?: string;
  dueDate?: string | null;
  progress: {
    openIssues: number;
    closedIssues: number;
    completionPercentage: number;
  };
}

export interface Sprint extends Resource {
  type: ResourceType.SPRINT;
  title: string;
  startDate: string;
  endDate: string;
  goals: string[];
  issues: IssueId[];
}

// UI Component Types
export interface ProjectView {
  id: string;
  name: string;
  layout: ViewLayout;
  settings: {
    groupBy?: string;
    sortBy?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
  };
}

export interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
}

// Repository Interfaces
export interface ProjectRepository {
  create(data: CreateProject): Promise<Project>;
  update(id: ProjectId, data: Partial<Project>): Promise<Project>;
  delete(id: ProjectId): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  createView(projectId: ProjectId, view: Omit<ProjectView, "id">): Promise<ProjectView>;
  updateView(projectId: ProjectId, viewId: ViewId, data: Partial<ProjectView>): Promise<ProjectView>;
  deleteView(projectId: ProjectId, viewId: ViewId): Promise<void>;
  createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField>;
}

export interface IssueRepository {
  create(data: CreateIssue): Promise<Issue>;
  update(id: IssueId, data: Partial<Issue>): Promise<Issue>;
  delete(id: IssueId): Promise<void>;
  findById(id: IssueId): Promise<Issue | null>;
  findAll(): Promise<Issue[]>;
}

export interface SprintRepository {
  create(data: CreateSprint): Promise<Sprint>;
  update(id: SprintId, data: Partial<Sprint>): Promise<Sprint>;
  delete(id: SprintId): Promise<void>;
  findById(id: SprintId): Promise<Sprint | null>;
  findAll(filters?: { status?: ResourceStatus }): Promise<Sprint[]>;
}

export interface MilestoneRepository {
  create(data: CreateMilestone): Promise<Milestone>;
  update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone>;
  delete(id: MilestoneId): Promise<void>;
  findById(id: MilestoneId): Promise<Milestone | null>;
  findAll(): Promise<Milestone[]>;
  findByDueDate(before: Date): Promise<Milestone[]>;
  getOverdue(): Promise<Milestone[]>;
}

// Helper function to attach common resource fields
export function createResource<T extends Resource>(
  type: ResourceType,
  data: any
): T {
  return {
    ...data,
    type,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  } as T;
}
