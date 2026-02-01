/**
 * MCP tools for AI-powered roadmap planning operations.
 *
 * Provides 2 tools (AI-13 to AI-16):
 * - generate_roadmap: Generate project roadmap from requirements (AI-13, AI-14, AI-15)
 * - generate_roadmap_visualization: Generate Gantt-ready visualization data (AI-16)
 *
 * These tools expose Phase 10 AI roadmap planning services as MCP tools
 * with proper annotations, input/output schemas, and executors.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { RoadmapAIService } from "../../services/ai/RoadmapAIService.js";
import {
  RoadmapGenerationInputSchema,
  RoadmapGenerationInput,
  RoadmapOutputSchema,
  RoadmapOutput,
  RoadmapVisualizationOutputSchema,
  RoadmapVisualizationOutput,
} from "./schemas/sprint-roadmap-schemas.js";

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * generate_roadmap - AI-13, AI-14, AI-15: Generate roadmap from requirements
 *
 * AI-powered roadmap generation that creates phases, milestones, and
 * dependencies with velocity-grounded date estimates.
 *
 * - AI-13: Roadmap generation from requirements
 * - AI-14: Phase sequencing with dependencies
 * - AI-15: Milestone estimation (velocity-grounded dates)
 */
export const generateRoadmapTool: ToolDefinition<RoadmapGenerationInput, RoadmapOutput> = {
  name: "generate_roadmap",
  title: "Generate Roadmap",
  description:
    "Generate a project roadmap from requirements. Creates phases, milestones, and dependencies " +
    "with velocity-grounded date estimates. Accepts requirements as text or structured items. " +
    "Supports optional constraints (timeline, team size, velocity, sprint duration).",
  annotations: ANNOTATION_PATTERNS.aiOperation, // AI non-deterministic
  schema: RoadmapGenerationInputSchema as unknown as ToolSchema<RoadmapGenerationInput>,
  outputSchema: RoadmapOutputSchema,
};

/**
 * generate_roadmap_visualization - AI-16: Generate visualization data
 *
 * Generates Gantt-ready visualization data from a roadmap. Returns
 * simplified data structures optimized for chart rendering.
 */
export const generateRoadmapVisualizationTool: ToolDefinition<RoadmapOutput, RoadmapVisualizationOutput> = {
  name: "generate_roadmap_visualization",
  title: "Generate Roadmap Visualization",
  description:
    "Generate Gantt-ready visualization data for a roadmap. Returns phases, milestones, " +
    "and dependency edges optimized for chart rendering. " +
    "Input is a generated roadmap (from generate_roadmap).",
  annotations: ANNOTATION_PATTERNS.readOnly, // Deterministic transformation
  schema: RoadmapOutputSchema as unknown as ToolSchema<RoadmapOutput>,
  outputSchema: RoadmapVisualizationOutputSchema,
};

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Execute generate_roadmap tool (AI-13, AI-14, AI-15).
 *
 * @param args - Roadmap generation input parameters
 * @returns Generated roadmap with phases and milestones
 */
export async function executeGenerateRoadmap(
  args: RoadmapGenerationInput
): Promise<RoadmapOutput> {
  const service = new RoadmapAIService();

  const result = await service.generateRoadmap({
    requirements: args.requirements,
    constraints: args.constraints,
    businessContext: args.businessContext,
  });

  return result;
}

/**
 * Execute generate_roadmap_visualization tool (AI-16).
 *
 * @param args - Generated roadmap
 * @returns Visualization-ready data structure
 */
export async function executeGenerateRoadmapVisualization(
  args: RoadmapOutput
): Promise<RoadmapVisualizationOutput> {
  const service = new RoadmapAIService();

  const result = service.generateVisualizationData(args);

  return result;
}

// ============================================================================
// Export all tools for registration
// ============================================================================

/**
 * All roadmap AI tool definitions for registration in ToolRegistry.
 */
export const roadmapAITools: ToolDefinition<unknown>[] = [
  generateRoadmapTool as ToolDefinition<unknown>,
  generateRoadmapVisualizationTool as ToolDefinition<unknown>,
];

/**
 * Map of tool names to executor functions.
 */
export const roadmapAIExecutors: Record<string, (args: unknown) => Promise<unknown>> = {
  generate_roadmap: executeGenerateRoadmap as (args: unknown) => Promise<unknown>,
  generate_roadmap_visualization: executeGenerateRoadmapVisualization as (args: unknown) => Promise<unknown>,
};
