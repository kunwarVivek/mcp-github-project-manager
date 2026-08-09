import { z } from "zod";
import type { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  AIEnrichmentOutputSchema,
  AITriageOutputSchema,
  AIRoadmapOutputSchema,
  BulkOperationResultSchema,
  SuccessOutputSchema,
} from "./project-schemas";

// ============================================================================
// AI-Powered Automation Schemas
// ============================================================================

export const generateRoadmapSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().optional(),
  sprintDurationWeeks: z.number().int().positive().default(2).optional(),
  targetMilestones: z.number().int().positive().default(4).optional(),
  autoCreate: z.boolean().default(false).optional()
});

export type GenerateRoadmapArgs = z.infer<typeof generateRoadmapSchema>;

export const enrichIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueId: z.string().min(1, "Issue ID is required"),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string().min(1, "Issue title is required"),
  issueDescription: z.string().optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type EnrichIssueArgs = z.infer<typeof enrichIssueSchema>;

export const enrichIssuesBulkSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueIds: z.array(z.string()).optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type EnrichIssuesBulkArgs = z.infer<typeof enrichIssuesBulkSchema>;

export const triageIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueId: z.string().min(1, "Issue ID is required"),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string().min(1, "Issue title is required"),
  issueDescription: z.string().optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type TriageIssueArgs = z.infer<typeof triageIssueSchema>;

export const triageAllIssuesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  onlyUntriaged: z.boolean().default(true).optional(),
  autoApply: z.boolean().default(false).optional(),
  projectContext: z.string().optional()
});

export type TriageAllIssuesArgs = z.infer<typeof triageAllIssuesSchema>;

export const scheduleTriagingSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  schedule: z.enum(['hourly', 'daily', 'weekly']),
  autoApply: z.boolean().default(false)
});

export type ScheduleTriagingArgs = z.infer<typeof scheduleTriagingSchema>;

// ============================================================================
// AI-Powered Automation Tool Definitions
// ============================================================================

export const generateRoadmapTool: ToolDefinition<GenerateRoadmapArgs, z.infer<typeof AIRoadmapOutputSchema>> = {
  name: "generate_roadmap",
  title: "Generate Roadmap",
  description: "AI-powered roadmap generation from project issues. Creates milestones, sprints, and phases automatically.",
  schema: generateRoadmapSchema as unknown as ToolSchema<GenerateRoadmapArgs>,
  outputSchema: AIRoadmapOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Generate roadmap",
      description: "Create a comprehensive roadmap from existing issues",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        projectTitle: "API Platform Development",
        projectDescription: "Build a scalable REST API platform",
        sprintDurationWeeks: 2,
        targetMilestones: 4,
        autoCreate: true
      }
    }
  ]
};

export const enrichIssueTool: ToolDefinition<EnrichIssueArgs, z.infer<typeof AIEnrichmentOutputSchema>> = {
  name: "enrich_issue",
  title: "Enrich Issue",
  description: "AI-powered issue enrichment. Automatically adds labels, priority, type, complexity, and effort estimates.",
  schema: enrichIssueSchema as unknown as ToolSchema<EnrichIssueArgs>,
  outputSchema: AIEnrichmentOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Enrich issue",
      description: "Add tags and metadata to an issue",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        issueId: "I_kwDOJrIzLs5eGXAT",
        issueNumber: 42,
        issueTitle: "Add user authentication",
        issueDescription: "Implement OAuth 2.0 authentication",
        autoApply: true
      }
    }
  ]
};

export const enrichIssuesBulkTool: ToolDefinition<EnrichIssuesBulkArgs, z.infer<typeof BulkOperationResultSchema>> = {
  name: "enrich_issues_bulk",
  title: "Enrich Issues Bulk",
  description: "Bulk AI-powered issue enrichment for multiple issues at once.",
  schema: enrichIssuesBulkSchema as unknown as ToolSchema<EnrichIssuesBulkArgs>,
  outputSchema: BulkOperationResultSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Enrich all issues",
      description: "Enrich all issues in a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        projectContext: "E-commerce platform with React frontend and Node.js backend",
        autoApply: false
      }
    }
  ]
};

export const triageIssueTool: ToolDefinition<TriageIssueArgs, z.infer<typeof AITriageOutputSchema>> = {
  name: "triage_issue",
  title: "Triage Issue",
  description: "AI-powered issue triaging. Classifies issues, assigns priority, and recommends actions.",
  schema: triageIssueSchema as unknown as ToolSchema<TriageIssueArgs>,
  outputSchema: AITriageOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Triage issue",
      description: "Classify and prioritize an issue",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        issueId: "I_kwDOJrIzLs5eGXAT",
        issueNumber: 42,
        issueTitle: "Application crashes on startup",
        issueDescription: "Users report app crashes immediately after launch",
        autoApply: true
      }
    }
  ]
};

export const triageAllIssuesTool: ToolDefinition<TriageAllIssuesArgs, z.infer<typeof BulkOperationResultSchema>> = {
  name: "triage_all_issues",
  title: "Triage All Issues",
  description: "Automatically triage all untriaged issues in a project.",
  schema: triageAllIssuesSchema as unknown as ToolSchema<TriageAllIssuesArgs>,
  outputSchema: BulkOperationResultSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Triage all issues",
      description: "Triage all issues that don't have labels yet",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        onlyUntriaged: true,
        autoApply: false,
        projectContext: "Mobile app for task management"
      }
    }
  ]
};

export const scheduleTriagingTool: ToolDefinition<ScheduleTriagingArgs, z.infer<typeof SuccessOutputSchema>> = {
  name: "schedule_triaging",
  title: "Schedule Triaging",
  description: "Schedule automated issue triaging to run periodically.",
  schema: scheduleTriagingSchema as unknown as ToolSchema<ScheduleTriagingArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Daily triage",
      description: "Set up daily automated triaging",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        schedule: "daily",
        autoApply: true
      }
    }
  ]
};
