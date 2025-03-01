export type ProjectId = string;
export type IssueId = number;
export type MilestoneId = number;
export type SprintId = string;
export type ViewId = string;
export type FieldId = string;

export type ViewLayout = "table" | "board" | "roadmap";
export type FieldType = "text" | "number" | "date" | "single_select" | "iteration";

export interface Project {
  id: ProjectId;
  title: string;
  description: string;
  visibility: "private" | "public";
  status: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
  views?: ProjectView[];
  fields?: CustomField[];
}

export interface ProjectView {
  id: ViewId;
  name: string;
  layout: ViewLayout;
  settings: {
    groupBy?: string;
    sortBy?: Array<{
      field: string;
      direction: "asc" | "desc";
    }>;
  };
}

export interface ViewFilter {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "empty" | "not_empty";
  value?: any;
}

export interface CustomField {
  id: FieldId;
  name: string;
  type: FieldType;
  options?: string[]; // For single_select fields
  settings?: {
    dateFormat?: string;
    iterations?: {
      startDate: Date;
      duration: number;
    }[];
  };
}

export interface Issue {
  id: IssueId;
  title: string;
  description: string;
  status: "open" | "closed";
  priority: "high" | "medium" | "low";
  type: "bug" | "feature" | "enhancement" | "documentation";
  assignees: string[];
  labels: string[];
  milestoneId?: MilestoneId;
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, any>;
}

export interface Milestone {
  id: MilestoneId;
  title: string;
  description: string;
  dueDate?: Date;
  status: "open" | "closed";
  progress: {
    openIssues: number;
    closedIssues: number;
  };
}

export interface Sprint {
  id: SprintId;
  title: string;
  startDate: Date;
  endDate: Date;
  status: "planned" | "active" | "completed";
  goals: string[];
  issues: IssueId[];
}

export interface ProjectRepository {
  create(
    data: Omit<Project, "id" | "createdAt" | "updatedAt">
  ): Promise<Project>;
  update(id: ProjectId, data: Partial<Project>): Promise<Project>;
  delete(id: ProjectId): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  findAll(filters?: { status?: "open" | "closed" }, page?: number): Promise<Project[]>;
  createView(projectId: ProjectId, view: Omit<ProjectView, "id">): Promise<ProjectView>;
  updateView(projectId: ProjectId, viewId: ViewId, data: Partial<ProjectView>): Promise<ProjectView>;
  deleteView(projectId: ProjectId, viewId: ViewId): Promise<void>;
  createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField>;
  updateField(projectId: ProjectId, fieldId: FieldId, data: Partial<CustomField>): Promise<CustomField>;
  deleteField(projectId: ProjectId, fieldId: FieldId): Promise<void>;
}

export interface IssueRepository {
  create(data: Omit<Issue, "id" | "createdAt" | "updatedAt">): Promise<Issue>;
  update(id: IssueId, data: Partial<Issue>): Promise<Issue>;
  delete(id: IssueId): Promise<void>;
  findById(id: IssueId): Promise<Issue | null>;
  findAll(filters?: {
    status?: "open" | "closed";
    milestoneId?: MilestoneId;
    assignee?: string;
  }): Promise<Issue[]>;
  updateCustomField(id: IssueId, fieldId: FieldId, value: any): Promise<void>;
}

export interface MilestoneRepository {
  create(data: Omit<Milestone, "id" | "progress">): Promise<Milestone>;
  update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone>;
  delete(id: MilestoneId): Promise<void>;
  findById(id: MilestoneId): Promise<Milestone | null>;
  findAll(filters?: { status?: "open" | "closed" }): Promise<Milestone[]>;
  getProgress(
    id: MilestoneId
  ): Promise<{ openIssues: number; closedIssues: number }>;
  getCompletionPercentage(id: MilestoneId): Promise<number>;
  getOverdue(): Promise<Milestone[]>;
  getDueInNext(days: number): Promise<Milestone[]>;
}

export interface SprintRepository {
  create(data: Omit<Sprint, "id">): Promise<Sprint>;
  update(id: SprintId, data: Partial<Sprint>): Promise<Sprint>;
  delete(id: SprintId): Promise<void>;
  findById(id: SprintId): Promise<Sprint | null>;
  findAll(filters?: {
    status?: "planned" | "active" | "completed";
  }): Promise<Sprint[]>;
  getSprintMetrics(id: SprintId): Promise<{
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
  }>;
}
