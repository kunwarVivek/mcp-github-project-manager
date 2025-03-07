// Resource Type Enum
export enum ResourceType {
  PROJECT = 'project',
  ISSUE = 'issue',
  MILESTONE = 'milestone',
  SPRINT = 'sprint'
}

// Resource Status Enum
export enum ResourceStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  OPEN = 'open',
  CLOSED = 'closed',
  PLANNED = 'planned',
  COMPLETED = 'completed'
}

// Resource Event Types
export enum ResourceEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  ARCHIVED = 'archived',
  RESTORED = 'restored'
}

// Base Resource Interface
export interface Resource {
  id: string;
  type: ResourceType;
  version: number;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  metadata?: Record<string, unknown>;
}

// Resource Event Interface
export interface ResourceEvent<T = unknown> {
  type: ResourceEventType;
  resourceId: string;
  resourceType: ResourceType;
  timestamp: string;
  data: T;
}

// Cache Options
export interface ResourceCacheOptions {
  ttl?: number;
  includeDeleted?: boolean;
  tags?: string[];
  namespaces?: string[];
}

// Resource Lock Options
export interface ResourceLockOptions {
  ttl?: number;
  owner?: string;
  retries?: number;
  retryDelay?: number;
}

// Resource Update Options
export interface ResourceUpdateOptions {
  optimisticLock?: boolean;
  expectedVersion?: number;
  retainMetadata?: boolean;
}

// Query Options
export interface ResourceQueryOptions {
  includeDeleted?: boolean;
  version?: number;
}

// Error Classes
export class ResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ResourceNotFoundError extends ResourceError {
  constructor(resourceType: ResourceType, id: string) {
    super(`${resourceType} with id ${id} not found`);
  }
}

export class ResourceVersionError extends ResourceError {
  constructor(
    resourceType: ResourceType, 
    id: string, 
    expectedVersion: number, 
    actualVersion: number
  ) {
    super(
      `${resourceType} ${id} version mismatch: expected ${expectedVersion}, got ${actualVersion}`
    );
  }
}

export class ResourceValidationError extends ResourceError {
  constructor(message: string) {
    super(message);
  }
}

export class ResourceLockError extends ResourceError {
  constructor(resourceType: ResourceType, id: string) {
    super(`Failed to acquire lock for ${resourceType} ${id}`);
  }
}

// Type Guards
export function isResourceType(value: unknown): value is ResourceType {
  return Object.values(ResourceType).includes(value as ResourceType);
}

export function isResourceStatus(value: unknown): value is ResourceStatus {
  return Object.values(ResourceStatus).includes(value as ResourceStatus);
}

export function isResource(value: unknown): value is Resource {
  if (!value || typeof value !== 'object') return false;
  
  const resource = value as Partial<Resource>;
  return (
    typeof resource.id === 'string' &&
    isResourceType(resource.type) &&
    typeof resource.version === 'number' &&
    isResourceStatus(resource.status) &&
    typeof resource.createdAt === 'string' &&
    typeof resource.updatedAt === 'string' &&
    (resource.deletedAt === undefined || 
     resource.deletedAt === null || 
     typeof resource.deletedAt === 'string') &&
    (resource.metadata === undefined || 
     typeof resource.metadata === 'object')
  );
}

// Status Transition Rules
export const allowedStatusTransitions: Record<ResourceStatus, ResourceStatus[]> = {
  [ResourceStatus.ACTIVE]: [
    ResourceStatus.ARCHIVED,
    ResourceStatus.DELETED,
    ResourceStatus.CLOSED,
    ResourceStatus.COMPLETED
  ],
  [ResourceStatus.ARCHIVED]: [
    ResourceStatus.ACTIVE,
    ResourceStatus.DELETED
  ],
  [ResourceStatus.DELETED]: [],
  [ResourceStatus.OPEN]: [
    ResourceStatus.CLOSED,
    ResourceStatus.ARCHIVED,
    ResourceStatus.DELETED
  ],
  [ResourceStatus.CLOSED]: [
    ResourceStatus.OPEN,
    ResourceStatus.ARCHIVED,
    ResourceStatus.DELETED
  ],
  [ResourceStatus.PLANNED]: [
    ResourceStatus.ACTIVE,
    ResourceStatus.DELETED
  ],
  [ResourceStatus.COMPLETED]: [
    ResourceStatus.ACTIVE,
    ResourceStatus.ARCHIVED
  ]
};

export function isValidStatusTransition(
  currentStatus: ResourceStatus,
  newStatus: ResourceStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return allowedStatusTransitions[currentStatus]?.includes(newStatus) ?? false;
}

// Resource Validation Rules
export interface ResourceValidationRule {
  field: string;
  validate: (value: unknown) => boolean;
  message: string;
}

export function validateResource(
  resource: Resource,
  rules: ResourceValidationRule[]
): string[] {
  return rules
    .filter(rule => !rule.validate((resource as any)[rule.field]))
    .map(rule => rule.message);
}