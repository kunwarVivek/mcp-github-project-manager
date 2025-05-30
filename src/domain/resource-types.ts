// Domain resource types and enums
export enum ResourceType {
  PROJECT = "project",
  ISSUE = "issue",
  MILESTONE = "milestone",
  SPRINT = "sprint",
  RELATIONSHIP = "relationship",
  PULL_REQUEST = "pull_request",
  LABEL = "label",
  VIEW = "view",
  FIELD = "field",
  COMMENT = "comment",
  // AI-related resource types
  PRD = "prd",
  AI_TASK = "ai_task",
  FEATURE_REQUEST = "feature_request",
  TASK_LIFECYCLE = "task_lifecycle",
  PROJECT_ROADMAP = "project_roadmap",
  // Requirements traceability types
  REQUIREMENT = "requirement",
  USE_CASE = "use_case",
  TRACEABILITY_MATRIX = "traceability_matrix",
  TRACEABILITY_LINK = "traceability_link"
}

export enum ResourceStatus {
  ACTIVE = "active",
  IN_PROGRESS = "in_progress",
  CLOSED = "closed",
  ARCHIVED = "archived",
  DELETED = "deleted",
  PLANNED = "planned",
  COMPLETED = "completed"
}

export enum RelationshipType {
  LINKED = "linked",
  DEPENDENCY_OF = "dependency_of",
  BLOCKED_BY = "blocked_by",
  PARENT_CHILD = "parent_child",
  DEPENDENCY = "dependency"
}

export interface Resource {
  id: string;
  type: ResourceType;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  version?: number;
  status?: ResourceStatus;
}

export interface Relationship extends Resource {
  sourceId: string;
  sourceType: ResourceType;
  targetId: string;
  targetType: ResourceType;
  relationshipType: RelationshipType;
}

export enum ResourceEventType {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  ARCHIVED = "archived",
  RESTORED = "restored",
  RELATIONSHIP_CREATED = "relationship_created",
  RELATIONSHIP_DELETED = "relationship_deleted",
  RELATIONSHIP_REMOVED = "relationship_removed"
}

export interface ResourceEvent {
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  eventType: ResourceEventType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ResourceNotFoundError extends Error {
  constructor(resourceType: ResourceType, resourceId: string) {
    super(`${resourceType} with ID ${resourceId} not found`);
    this.name = "ResourceNotFoundError";
  }
}

export class ResourceVersionError extends Error {
  constructor(resourceType: ResourceType, resourceId: string, currentVersion: number, expectedVersion: number) {
    super(`Version mismatch for ${resourceType} with ID ${resourceId}: current=${currentVersion}, expected=${expectedVersion}`);
    this.name = "ResourceVersionError";
  }
}

export class ResourceValidationError extends Error {
  constructor(resourceType: ResourceType, details: string) {
    super(`Validation failed for ${resourceType}: ${details}`);
    this.name = "ResourceValidationError";
  }
}

export interface ResourceValidationRule {
  field: string; // Added this field property
  validate(resource: any): boolean;
  getErrorMessage(resource: any): string;
  message: string; // Added this message property
}

export interface ResourceCacheOptions {
  ttl?: number;
  refreshInterval?: number;
  maxSize?: number;
  tags?: string[];
  namespaces?: string[];
  includeDeleted?: boolean;
}

export interface ResourceUpdateOptions {
  expectedVersion?: number;
  validate?: boolean;
  optimisticLock?: boolean;
  tags?: string[];
  namespaces?: string[];
}

export interface ResourceRepository<T extends Resource> {
  create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<T | null>;
  findAll(options?: any): Promise<T[]>;
}