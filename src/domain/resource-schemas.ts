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

// Map of all resource schemas indexed by resource type
export const resourceSchemas: Record<string, ResourceSchema> = {
  [ResourceType.PROJECT]: ProjectSchema,
  [ResourceType.ISSUE]: IssueSchema,
  [ResourceType.MILESTONE]: MilestoneSchema,
  [ResourceType.SPRINT]: SprintSchema,
  [ResourceType.RELATIONSHIP]: RelationshipSchema,
  // Add entry for PULL_REQUEST which is missing but defined in ResourceType
  [ResourceType.PULL_REQUEST]: BaseResourceSchema.extend({
    type: z.literal(ResourceType.PULL_REQUEST),
    title: z.string(),
    description: z.string().optional(),
    status: z.string()
  }),
  // Add entry for FIELD which is missing but defined in ResourceType
  [ResourceType.FIELD]: BaseResourceSchema.extend({
    type: z.literal(ResourceType.FIELD),
    name: z.string(),
    fieldType: z.string()
  })
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