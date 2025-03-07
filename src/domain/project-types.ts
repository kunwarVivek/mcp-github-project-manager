import { Resource, ResourceType, ResourceStatus } from "./resource-types";

export interface BaseProjectResource extends Resource {
  title: string;
  description: string;
}

export interface ProjectLink {
  id: string;
  type: 'parent' | 'child' | 'related';
  sourceId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select';
  options?: string[];
  required?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProjectView {
  id: string;
  name: string;
  type: 'board' | 'list' | 'calendar' | 'timeline';
  config: {
    groupBy?: string;
    sortBy?: string[];
    filters?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface ProjectSettings {
  defaultView?: string;
  labelColors?: Record<string, string>;
  customFields?: ProjectField[];
  notifications?: {
    enabled: boolean;
    channels?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface ProjectStats {
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  overdueMilestones: number;
  upcomingMilestones: number;
  lastUpdated: string;
}

export interface ProjectValidationRule {
  field: string;
  type: 'required' | 'format' | 'custom';
  value?: unknown;
  message: string;
  validate: (value: unknown) => boolean;
}

export interface ProjectWorkflow {
  id: string;
  name: string;
  states: {
    name: string;
    status: ResourceStatus;
    transitions: string[];
  }[];
  metadata?: Record<string, unknown>;
}

export const defaultProjectSettings: ProjectSettings = {
  defaultView: 'board',
  labelColors: {},
  customFields: [],
  notifications: {
    enabled: true,
    channels: ['email'],
  },
};

export const defaultValidationRules: ProjectValidationRule[] = [
  {
    field: 'title',
    type: 'required',
    message: 'Title is required',
    validate: (value) => Boolean(value && typeof value === 'string' && value.trim()),
  },
  {
    field: 'status',
    type: 'format',
    message: 'Invalid status',
    validate: (value) => Object.values(ResourceStatus).includes(value as ResourceStatus),
  },
];