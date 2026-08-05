import { z } from "zod";
import type { TaskPriority, TaskComplexity, AIGenerationMetadata } from './ai-task-types';
import { TaskPrioritySchema, TaskComplexitySchema, AIGenerationMetadataSchema } from './ai-task-types';

// ============================================================================
// PRD (Product Requirements Document) Types
// ============================================================================

/**
 * User Persona
 */
export interface UserPersona {
  id: string;
  name: string;
  description: string;
  goals: string[];
  painPoints: string[];
  technicalLevel: "beginner" | "intermediate" | "advanced";
}

/**
 * Feature Requirement
 */
export interface FeatureRequirement {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  userStories: string[];
  acceptanceCriteria: string[];
  estimatedComplexity: TaskComplexity;
  dependencies: string[]; // IDs of other features
}

/**
 * Technical Requirement
 */
export interface TechnicalRequirement {
  id: string;
  category: "performance" | "security" | "scalability" | "integration" | "infrastructure";
  requirement: string;
  rationale: string;
  priority: TaskPriority;
}

/**
 * Project Scope
 */
export interface ProjectScope {
  inScope: string[];
  outOfScope: string[];
  assumptions: string[];
  constraints: string[];
}

/**
 * Minimal PRD structure for mock/test purposes in tools.
 * Contains only the fields required by RequirementsTraceabilityService.extractBusinessRequirementsFromPRD()
 */
export interface MockPRD {
  id: string;
  title: string;
  overview: string;
  objectives: string[];
  successMetrics: string[];
  features: FeatureRequirement[];
  author: string;
  createdAt: string;
  updatedAt: string;
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;
}

/**
 * PRD Document
 */
export interface PRDDocument {
  id: string;
  title: string;
  version: string;

  // Core content
  overview: string;
  objectives: string[];
  scope: ProjectScope;

  // User-focused
  targetUsers: UserPersona[];
  userJourney: string;

  // Features and requirements
  features: FeatureRequirement[];
  technicalRequirements: TechnicalRequirement[];

  // Market research (optional)
  marketResearch?: {
    competitorAnalysis: string[];
    marketSize: string;
    trends: string[];
  };

  // Project details
  timeline: string;
  milestones: string[];
  successMetrics: string[];

  // AI metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Additional metadata
  author: string;
  stakeholders: string[];
  tags: string[];
}

// ============================================================================
// Zod Schemas for PRD Types
// ============================================================================

export const UserPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  goals: z.array(z.string()),
  painPoints: z.array(z.string()),
  technicalLevel: z.enum(["beginner", "intermediate", "advanced"])
});

export const FeatureRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: TaskPrioritySchema,
  userStories: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  estimatedComplexity: TaskComplexitySchema,
  dependencies: z.array(z.string())
});

export const PRDDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  overview: z.string(),
  objectives: z.array(z.string()),
  scope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
    assumptions: z.array(z.string()),
    constraints: z.array(z.string())
  }),
  targetUsers: z.array(UserPersonaSchema),
  userJourney: z.string(),
  features: z.array(FeatureRequirementSchema),
  technicalRequirements: z.array(z.object({
    id: z.string(),
    category: z.enum(["performance", "security", "scalability", "integration", "infrastructure"]),
    requirement: z.string(),
    rationale: z.string(),
    priority: TaskPrioritySchema
  })),
  marketResearch: z.object({
    competitorAnalysis: z.array(z.string()),
    marketSize: z.string(),
    trends: z.array(z.string())
  }).optional(),
  timeline: z.string(),
  milestones: z.array(z.string()),
  successMetrics: z.array(z.string()),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string(),
  stakeholders: z.array(z.string()),
  tags: z.array(z.string())
});
