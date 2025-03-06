import { z } from "zod";
import { Resource, ResourceType, ResourceStatus } from "./resource-types";
import { components } from "@octokit/openapi-types";
import { RestEndpointMethodTypes } from "@octokit/rest";

// GitHub API Types
export type OctokitIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type OctokitMilestone = RestEndpointMethodTypes["issues"]["getMilestone"]["response"]["data"];
export type OctokitProject = components["schemas"]["project"];
export type OctokitIssueEvent = RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][0];

// Domain Types
export type IssueId = string;
export type MilestoneId = string;
export type ProjectId = string;
export type SprintId = string;
export type ViewId = string;
export type FieldId = string;

// Base interfaces for each resource type
export interface ProjectFields {
  title: string;
  description?: string | null;
  visibility: "public" | "private";
  views: Array<{
    id: string;
    name: string;
    layout: "table" | "board" | "roadmap";
    settings: {
      sortBy?: Array<{
        field: string;
        direction: "asc" | "desc";
      }>;
      groupBy?: string;
      columns?: string[];
    };
  }>;
  fields: Array<{
    id: string;
    name: string;
    type: "text" | "number" | "date" | "select" | "iteration";
    options?: Array<{
      id: string;
      name: string;
      color?: string;
    }>;
    defaultValue?: any;
  }>;
}

export interface IssueFields {
  number: number;
  title: string;
  description?: string | null;
  milestoneId?: MilestoneId;
  assignees: string[];
  labels: string[];
  closedAt?: string | null;
  url: string;
}

export interface MilestoneFields {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  progress: {
    openIssues: number;
    closedIssues: number;
    completionPercentage: number;
  };
  closedAt?: string | null;
  url: string;
}

export interface SprintFields {
  title: string;
  startDate: string;
  endDate: string;
  goals?: string[];
  issues: IssueId[];
}

// Resource type implementations
export interface Project extends Resource, ProjectFields {}
export interface Issue extends Resource, IssueFields {}
export interface Milestone extends Resource, MilestoneFields {}
export interface Sprint extends Resource, SprintFields {}

// Base type for REST API responses
export interface RestIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<string | { name: string }>;
  assignees: Array<{ login: string }>;
  milestone: {
    number: number;
    title: string;
    description: string | null;
    due_on: string | null;
    state: "open" | "closed";
    open_issues: number;
    closed_issues: number;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    url: string;
  } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  user: {
    login: string;
  };
}

// Issue Event types
export interface IssueEvent {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  actor: string;
}
