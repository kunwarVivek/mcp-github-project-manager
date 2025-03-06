import { z } from "zod";

export enum ResourceType {
  PROJECT = "project",
  MILESTONE = "milestone",
  ISSUE = "issue",
  SPRINT = "sprint",
  FEATURE = "feature",
  BUG = "bug",
  TASK = "task",
}

export enum ResourceStatus {
  ACTIVE = "active",
  DELETED = "deleted",
  ARCHIVED = "archived",
  OPEN = "open",
  CLOSED = "closed",
  PLANNED = "planned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export enum ResourceEventType {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  ARCHIVED = "archived",
  STATUS_CHANGED = "status_changed",
  VERSION_UPDATED = "version_updated",
}

// Base Resource Schema
export const ResourceSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ResourceType),
  version: z.number(),
  status: z.nativeEnum(ResourceStatus),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

// Resource Event Schema
export const ResourceEventSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ResourceEventType),
  resourceId: z.string(),
  resourceType: z.nativeEnum(ResourceType),
  timestamp: z.string(),
  actor: z.string(),
  payload: z.unknown(),
});

// Base Resource interface
export interface Resource {
  id: string;
  type: ResourceType;
  version: number;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  metadata?: Record<string, unknown>;
}

// Resource Event interface
export interface ResourceEvent {
  id: string;
  type: ResourceEventType;
  resourceId: string;
  resourceType: ResourceType;
  timestamp: string;
  actor: string;
  payload: unknown;
}

// Cache options
export interface ResourceCacheOptions {
  ttl?: number;
  tags?: string[];
}

// Query options
export interface ResourceQueryOptions {
  includeDeleted?: boolean;
  includeTags?: string[];
  metadata?: Record<string, unknown>;
}

// Update options
export interface ResourceUpdateOptions {
  optimisticLock?: boolean;
  expectedVersion?: number;
}

// Update data type
export type ResourceUpdateData<T extends Resource> = Partial<Omit<T, keyof Resource>> & {
  version?: number;
  metadata?: Record<string, unknown>;
};

// Custom Error Types
export class ResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceError";
  }
}

export class ResourceNotFoundError extends ResourceError {
  constructor(type: ResourceType, id: string) {
    super(`Resource ${type}:${id} not found`);
    this.name = "ResourceNotFoundError";
  }
}

export class ResourceVersionError extends ResourceError {
  constructor(
    type: ResourceType,
    id: string,
    expectedVersion: number,
    actualVersion: number
  ) {
    super(
      `Version conflict for ${type}:${id}. Expected ${expectedVersion}, got ${actualVersion}`
    );
    this.name = "ResourceVersionError";
  }
}

export class ResourceValidationError extends ResourceError {
  constructor(message: string, public details?: Record<string, string>) {
    super(message);
    this.name = "ResourceValidationError";
  }
}

// Type Guards
export const isResource = (value: unknown): value is Resource => {
  return ResourceSchema.safeParse(value).success;
};

export const isResourceEvent = (value: unknown): value is ResourceEvent => {
  return ResourceEventSchema.safeParse(value).success;
};

// Utility Types
export type ResourceFields<T extends Resource> = Omit<T, keyof Resource>;
export type CreateResourceData<T extends Resource> = Omit<T, keyof Resource> & {
  metadata?: Record<string, unknown>;
};

// Helper Functions
export const mapStatus = (status: string): ResourceStatus => {
  switch (status.toLowerCase()) {
    case "open":
      return ResourceStatus.OPEN;
    case "closed":
      return ResourceStatus.CLOSED;
    case "planned":
      return ResourceStatus.PLANNED;
    case "in_progress":
      return ResourceStatus.IN_PROGRESS;
    case "completed":
      return ResourceStatus.COMPLETED;
    case "deleted":
      return ResourceStatus.DELETED;
    case "archived":
      return ResourceStatus.ARCHIVED;
    default:
      return ResourceStatus.ACTIVE;
  }
};

export const mapType = (type: string): ResourceType => {
  switch (type.toLowerCase()) {
    case "feature":
      return ResourceType.FEATURE;
    case "bug":
      return ResourceType.BUG;
    case "task":
      return ResourceType.TASK;
    case "milestone":
      return ResourceType.MILESTONE;
    case "sprint":
      return ResourceType.SPRINT;
    case "issue":
      return ResourceType.ISSUE;
    default:
      return ResourceType.PROJECT;
  }
};