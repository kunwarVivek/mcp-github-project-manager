import { ResourceStatus } from '../resource-types';

/**
 * Status mapping configuration for different resource types.
 * 
 * Each resource type can have different string representations for the same
 * logical state (e.g., 'open' vs 'active' for active state).
 */
interface StatusMapping {
  /** String that represents the active/open state */
  active: string;
  /** String that represents the closed/completed state */
  closed: string;
  /** String that represents the planned state (optional) */
  planned?: string;
  /** String that represents the in-progress state (optional) */
  inProgress?: string;
  /** String that represents the completed state (optional, defaults to closed) */
  completed?: string;
}

/**
 * Predefined status mappings for different resource types.
 */
const STATUS_MAPPINGS: Record<string, StatusMapping> = {
  /** Issues use 'open' for active */
  issue: {
    active: 'open',
    closed: 'closed',
  },
  /** Projects use 'active' for active */
  project: {
    active: 'active',
    closed: 'closed',
  },
  /** Milestones use 'open' for active */
  milestone: {
    active: 'open',
    closed: 'closed',
  },
  /** Sprints have more status options */
  sprint: {
    active: 'active',
    closed: 'completed',
    planned: 'planned',
  },
  /** GitHub API uses uppercase for issues */
  githubIssue: {
    active: 'OPEN',
    closed: 'CLOSED',
  },
  /** GitHub API uses lowercase for milestones */
  githubMilestone: {
    active: 'open',
    closed: 'closed',
  },
};

/**
 * Parse a status string to ResourceStatus enum.
 * 
 * @param status - The status string to parse
 * @param resourceType - The resource type context for parsing (default: 'issue')
 * @returns The corresponding ResourceStatus enum value
 * 
 * @example
 * ```typescript
 * // Parse issue status
 * parseResourceStatus('open'); // ResourceStatus.ACTIVE
 * parseResourceStatus('closed'); // ResourceStatus.CLOSED
 * 
 * // Parse project status
 * parseResourceStatus('active', 'project'); // ResourceStatus.ACTIVE
 * 
 * // Parse sprint status
 * parseResourceStatus('planned', 'sprint'); // ResourceStatus.PLANNED
 * parseResourceStatus('completed', 'sprint'); // ResourceStatus.COMPLETED
 * ```
 */
export function parseResourceStatus(
  status: string,
  resourceType: string = 'issue'
): ResourceStatus {
  const mapping = STATUS_MAPPINGS[resourceType] || STATUS_MAPPINGS.issue;
  const normalizedStatus = status.toLowerCase();

  // Check for active state
  if (normalizedStatus === mapping.active.toLowerCase()) {
    return ResourceStatus.ACTIVE;
  }

  // Check for closed state
  if (normalizedStatus === mapping.closed.toLowerCase()) {
    return ResourceStatus.CLOSED;
  }

  // Check for planned state (if defined)
  if (mapping.planned && normalizedStatus === mapping.planned.toLowerCase()) {
    return ResourceStatus.PLANNED;
  }

  // Check for in-progress state (if defined)
  if (mapping.inProgress && normalizedStatus === mapping.inProgress.toLowerCase()) {
    return ResourceStatus.IN_PROGRESS;
  }

  // Check for completed state (if defined, otherwise use closed)
  const completedStr = mapping.completed || mapping.closed;
  if (normalizedStatus === completedStr.toLowerCase()) {
    return ResourceStatus.COMPLETED;
  }

  // Default fallback: try to match any ResourceStatus value
  const allStatuses = Object.values(ResourceStatus);
  const matched = allStatuses.find(
    s => s.toLowerCase() === normalizedStatus
  );
  
  if (matched) {
    return matched;
  }

  // Final fallback: if 'all' or empty, return undefined behavior (caller should handle)
  throw new Error(`Unknown status '${status}' for resource type '${resourceType}'`);
}

/**
 * Convert ResourceStatus to a status string for the given resource type.
 * 
 * @param resourceStatus - The ResourceStatus enum value
 * @param resourceType - The resource type context for conversion (default: 'issue')
 * @returns The corresponding status string
 * 
 * @example
 * ```typescript
 * // Convert to issue status string
 * toStatusString(ResourceStatus.ACTIVE); // 'open'
 * toStatusString(ResourceStatus.CLOSED); // 'closed'
 * 
 * // Convert to project status string
 * toStatusString(ResourceStatus.ACTIVE, 'project'); // 'active'
 * 
 * // Convert to GitHub issue state
 * toStatusString(ResourceStatus.ACTIVE, 'githubIssue'); // 'OPEN'
 * ```
 */
export function toStatusString(
  resourceStatus: ResourceStatus,
  resourceType: string = 'issue'
): string {
  const mapping = STATUS_MAPPINGS[resourceType] || STATUS_MAPPINGS.issue;

  switch (resourceStatus) {
    case ResourceStatus.ACTIVE:
    case ResourceStatus.IN_PROGRESS:
      return mapping.active;
    case ResourceStatus.CLOSED:
    case ResourceStatus.DELETED:
      return mapping.closed;
    case ResourceStatus.PLANNED:
      return mapping.planned || mapping.active;
    case ResourceStatus.COMPLETED:
      return mapping.completed || mapping.closed;
    case ResourceStatus.ARCHIVED:
      return mapping.closed;
    default:
      return mapping.closed;
  }
}

/**
 * Check if a status string represents an open/active state.
 * 
 * @param status - The status string to check
 * @param resourceType - The resource type context (default: 'issue')
 * @returns True if the status represents an active/open state
 * 
 * @example
 * ```typescript
 * isActiveStatus('open'); // true
 * isActiveStatus('closed'); // false
 * isActiveStatus('active', 'project'); // true
 * ```
 */
export function isActiveStatus(
  status: string,
  resourceType: string = 'issue'
): boolean {
  const mapping = STATUS_MAPPINGS[resourceType] || STATUS_MAPPINGS.issue;
  return status.toLowerCase() === mapping.active.toLowerCase();
}

/**
 * Check if a status string represents a closed/completed state.
 * 
 * @param status - The status string to check
 * @param resourceType - The resource type context (default: 'issue')
 * @returns True if the status represents a closed/completed state
 */
export function isClosedStatus(
  status: string,
  resourceType: string = 'issue'
): boolean {
  const parsed = parseResourceStatus(status, resourceType);
  return parsed === ResourceStatus.CLOSED || parsed === ResourceStatus.COMPLETED;
}

/**
 * Filter resources by status string.
 * 
 * @param resources - Array of resources with a status field
 * @param statusFilter - The status string to filter by ('all' returns all)
 * @param resourceType - The resource type context (default: 'issue')
 * @returns Filtered array of resources
 * 
 * @example
 * ```typescript
 * const openIssues = filterByStatus(issues, 'open');
 * const allIssues = filterByStatus(issues, 'all');
 * ```
 */
export function filterByStatus<T extends { status?: ResourceStatus }>(
  resources: T[],
  statusFilter: string,
  resourceType: string = 'issue'
): T[] {
  if (statusFilter === 'all') {
    return resources;
  }

  const targetStatus = parseResourceStatus(statusFilter, resourceType);
  return resources.filter(r => r.status === targetStatus);
}

/**
 * Register a custom status mapping for a new resource type.
 * This allows extending the parser for domain-specific resources.
 * 
 * @param resourceType - The resource type identifier
 * @param mapping - The status mapping configuration
 */
export function registerStatusMapping(
  resourceType: string,
  mapping: StatusMapping
): void {
  STATUS_MAPPINGS[resourceType] = mapping;
}

/**
 * Get all registered resource types with their status mappings.
 * Useful for debugging and documentation.
 */
export function getRegisteredStatusMappings(): Record<string, StatusMapping> {
  return { ...STATUS_MAPPINGS };
}
