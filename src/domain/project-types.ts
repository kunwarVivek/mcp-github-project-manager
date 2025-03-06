import { z } from "zod";
import { Resource, ResourceSchema, ResourceType, ResourceStatus } from "./resource-types";

// Project-specific fields schema
export const ProjectFieldsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  visibility: z.enum(["public", "private"]),
  views: z.array(z.object({
    id: z.string(),
    name: z.string(),
    layout: z.enum(["table", "board", "roadmap"]),
    settings: z.object({
      sortBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(["asc", "desc"]),
      })).optional(),
      groupBy: z.string().optional(),
      columns: z.array(z.string()).optional(),
    }),
  })).default([]),
  fields: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["text", "number", "date", "select", "iteration"]),
    options: z.array(z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().optional(),
    })).optional(),
    defaultValue: z.any().optional(),
  })).default([]),
});

// Project type definition
export interface ProjectFields {
  title: string;
  description?: string;
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

export interface Project extends Resource, ProjectFields {}

// Type for creating a new project
export interface CreateProjectData extends ProjectFields {
  metadata?: Record<string, unknown>;
}

// Type for updating a project
export type UpdateProjectData = Partial<ProjectFields> & {
  metadata?: Record<string, unknown>;
};

// Helper to create a new resource from project data
export const createProjectResource = (data: CreateProjectData): Omit<Project, "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  type: ResourceType.PROJECT,
  status: ResourceStatus.ACTIVE,
  ...data,
  metadata: data.metadata ?? {},
});

// Validation functions
export const validateCreateProjectData = (data: unknown): CreateProjectData => {
  const validatedData = ProjectFieldsSchema.parse(data);
  return validatedData;
};

export const validateUpdateProjectData = (data: unknown): UpdateProjectData => {
  const validatedData = ProjectFieldsSchema.partial().parse(data);
  return validatedData;
};