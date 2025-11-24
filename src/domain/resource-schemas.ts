import { z } from "zod";
import { ResourceType, RelationshipType, ResourceStatus } from "./resource-types";

// Base resource schema that all resources must conform to
export const BaseResourceSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(ResourceType),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  version: z.number().optional(),
  status: z.nativeEnum(ResourceStatus).optional()
});

// Schema for Project resources
export const ProjectSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.PROJECT),
  title: z.string().min(1),
  description: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
  owner: z.string().optional(),
  settings: z.record(z.any()).optional()
});

// Schema for Issue resources
export const IssueSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.ISSUE),
  title: z.string().min(1),
  description: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().uuid(),
  externalId: z.string().optional(),
  externalUrl: z.string().url().optional()
});

// Schema for Milestone resources
export const MilestoneSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.MILESTONE),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  projectId: z.string().uuid(),
  externalId: z.string().optional(),
  externalUrl: z.string().url().optional()
});

// Schema for Sprint resources
export const SprintSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.SPRINT),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.string(),
  projectId: z.string().uuid()
});

// Schema for Relationship resources
export const RelationshipSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.RELATIONSHIP),
  sourceId: z.string().uuid(),
  sourceType: z.nativeEnum(ResourceType),
  targetId: z.string().uuid(),
  targetType: z.nativeEnum(ResourceType),
  relationshipType: z.nativeEnum(RelationshipType)
});

// GitHub Projects v2 Field Types (comprehensive)
export enum GitHubFieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  SINGLE_SELECT = 'SINGLE_SELECT',
  ITERATION = 'ITERATION',
  MILESTONE = 'MILESTONE',
  PULL_REQUEST = 'PULL_REQUEST',
  ASSIGNEES = 'ASSIGNEES',
  LABELS = 'LABELS',
  LINKED_PULL_REQUESTS = 'LINKED_PULL_REQUESTS',
  REVIEWERS = 'REVIEWERS',
  REPOSITORY = 'REPOSITORY',
  TRACKED_BY = 'TRACKED_BY',
  TRACKS = 'TRACKS'
}

// GitHub Pull Request States
export enum GitHubPRState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  MERGED = 'MERGED',
  DRAFT = 'DRAFT'
}

// GitHub Pull Request Review Decision
export enum GitHubPRReviewDecision {
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED'
}

// Complete Pull Request schema matching GitHub PR fields
export const PullRequestSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.PULL_REQUEST),
  title: z.string().min(1),
  description: z.string().optional(),
  state: z.nativeEnum(GitHubPRState),
  isDraft: z.boolean(),
  number: z.number().int().positive(),
  url: z.string().url(),
  author: z.string(),
  assignees: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  baseRef: z.string().describe('Base branch name'),
  headRef: z.string().describe('Head branch name'),
  reviewDecision: z.nativeEnum(GitHubPRReviewDecision).optional(),
  mergedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  additions: z.number().int().min(0).optional(),
  deletions: z.number().int().min(0).optional(),
  changedFiles: z.number().int().min(0).optional(),
  repositoryId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional()
});

// Field Option schema for single-select fields
export const FieldOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  description: z.string().optional()
});

// Iteration configuration schema
export const IterationConfigSchema = z.object({
  duration: z.number().int().positive().describe('Duration in days'),
  startDay: z.number().int().min(0).max(6).describe('Day of week (0=Sunday)'),
  iterations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startDate: z.string().datetime(),
    duration: z.number().int().positive()
  })).optional()
});

// Field validation rules
export const FieldValidationSchema = z.object({
  required: z.boolean().default(false),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().optional().describe('Regex pattern for validation'),
  customValidation: z.string().optional().describe('Custom validation rules')
});

// Complete Field schema matching GitHub Projects v2
export const FieldSchema = BaseResourceSchema.extend({
  type: z.literal(ResourceType.FIELD),
  name: z.string().min(1),
  fieldType: z.nativeEnum(GitHubFieldType),
  dataType: z.enum(['string', 'number', 'date', 'boolean', 'array', 'object']).optional(),
  projectId: z.string().uuid().describe('Project this field belongs to'),

  // Configuration for different field types
  options: z.array(FieldOptionSchema).optional()
    .describe('Options for SINGLE_SELECT fields'),
  iterationConfig: IterationConfigSchema.optional()
    .describe('Configuration for ITERATION fields'),

  // Field properties
  isRequired: z.boolean().default(false),
  defaultValue: z.any().optional(),
  validation: FieldValidationSchema.optional(),
  description: z.string().optional(),

  // Metadata
  position: z.number().int().min(0).optional()
    .describe('Display position in project'),
  isVisible: z.boolean().default(true),
  isArchived: z.boolean().default(false),

  // GitHub-specific
  githubFieldId: z.string().optional()
    .describe('GitHub Projects v2 field ID')
});

// Map of all resource schemas indexed by resource type
export const resourceSchemas: Record<string, ResourceSchema> = {
  [ResourceType.PROJECT]: ProjectSchema,
  [ResourceType.ISSUE]: IssueSchema,
  [ResourceType.MILESTONE]: MilestoneSchema,
  [ResourceType.SPRINT]: SprintSchema,
  [ResourceType.RELATIONSHIP]: RelationshipSchema,
  [ResourceType.PULL_REQUEST]: PullRequestSchema,
  [ResourceType.FIELD]: FieldSchema
};

// Type for the resource schema map
export type ResourceSchemaMap = typeof resourceSchemas;

// Type for a resource schema
export type ResourceSchema = z.ZodType<any, any, any>;

// Function to validate a resource by its type
export function validateResourceByType(type: ResourceType, resource: any): any {
  // Remove generic type parameter which was causing the compilation error
  const schema = resourceSchemas[type];

  if (!schema) {
    throw new Error(`No schema found for resource type: ${type}`);
  }

  const result = schema.safeParse(resource);
  if (!result.success) {
    throw result.error;
  }

  return result.data;
}