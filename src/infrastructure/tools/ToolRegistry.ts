import zodToJsonSchema from "zod-to-json-schema";
import {
  ZodOptional,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodObject,
  ZodEnum,
  type ZodTypeAny,
} from "zod";
import { ToolDefinition, ToolAnnotations } from "./ToolValidator.js";
import {
  // Original tools
  createRoadmapTool,
  planSprintTool,
  getMilestoneMetricsTool,
  getSprintMetricsTool,
  getOverdueMilestonesTool,
  getUpcomingMilestonesTool,
  createProjectTool,
  listProjectsTool,
  getProjectTool,
  createMilestoneTool,
  listMilestonesTool,
  createIssueTool,
  listIssuesTool,
  getIssueTool,
  updateIssueTool,

  // Issue comment tools
  createIssueCommentTool,
  updateIssueCommentTool,
  deleteIssueCommentTool,
  listIssueCommentsTool,

  // Draft issue tools
  createDraftIssueTool,
  updateDraftIssueTool,
  deleteDraftIssueTool,

  // Pull Request tools
  createPullRequestTool,
  getPullRequestTool,
  listPullRequestsTool,
  updatePullRequestTool,
  mergePullRequestTool,
  listPullRequestReviewsTool,
  createPullRequestReviewTool,

  createSprintTool,
  listSprintsTool,
  getCurrentSprintTool,
  createProjectFieldTool,
  createProjectViewTool,

  // New project tools
  updateProjectTool,
  deleteProjectTool,
  getProjectReadmeTool,
  updateProjectReadmeTool,
  listProjectFieldsTool,
  updateProjectFieldTool,

  // Project item tools
  addProjectItemTool,
  removeProjectItemTool,
  listProjectItemsTool,
  archiveProjectItemTool,
  unarchiveProjectItemTool,

  // Field values tools
  setFieldValueTool,
  getFieldValueTool,
  clearFieldValueTool,

  // View tools
  listProjectViewsTool,
  updateProjectViewTool,
  deleteProjectViewTool,

  // Milestone tools
  updateMilestoneTool,
  deleteMilestoneTool,

  // Sprint tools
  updateSprintTool,
  addIssuesToSprintTool,
  removeIssuesFromSprintTool,

  // Label tools
  createLabelTool,
  listLabelsTool,

  // AI task management tools
  addFeatureTool,
  generatePRDTool,
  parsePRDTool,
  getNextTaskTool,
  analyzeTaskComplexityTool,
  expandTaskTool,
  enhancePRDTool,
  createTraceabilityMatrixTool,

  // Automation service tools
  createAutomationRuleTool,
  updateAutomationRuleTool,
  deleteAutomationRuleTool,
  getAutomationRuleTool,
  listAutomationRulesTool,
  enableAutomationRuleTool,
  disableAutomationRuleTool,

  // Iteration management tools
  getIterationConfigurationTool,
  getCurrentIterationTool,
  getIterationItemsTool,
  getIterationByDateTool,
  assignItemsToIterationTool,

  // AI-powered automation tools
  generateRoadmapTool,
  enrichIssueTool,
  enrichIssuesBulkTool,
  triageIssueTool,
  triageAllIssuesTool,
  scheduleTriagingTool,
} from "./ToolSchemas.js";

/**
 * Central registry of all available tools
 */
export class ToolRegistry {
  private static _instance: ToolRegistry;
  private _tools: Map<string, ToolDefinition<unknown>>;

  private constructor() {
    this._tools = new Map();
    this.registerBuiltInTools();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ToolRegistry {
    if (!ToolRegistry._instance) {
      ToolRegistry._instance = new ToolRegistry();
    }
    return ToolRegistry._instance;
  }

  /**
   * Register a new tool
   */
  public registerTool<T>(tool: ToolDefinition<T>): void {
    if (this._tools.has(tool.name)) {
      process.stderr.write(`Tool '${tool.name}' is already registered and will be overwritten.\n`);
    }
    this._tools.set(tool.name, tool as ToolDefinition<unknown>);
  }

  /**
   * Get a tool by name
   */
  public getTool<T>(name: string): ToolDefinition<T> | undefined {
    return this._tools.get(name) as ToolDefinition<T> | undefined;
  }

  /**
   * Get all registered tools
   */
  public getAllTools(): ToolDefinition<unknown>[] {
    return Array.from(this._tools.values());
  }

  /**
   * Convert tools to MCP format for list_tools response.
   * Uses zod-to-json-schema for proper JSON Schema conversion.
   * Includes annotations and outputSchema per MCP specification 2025-11-25.
   */
  public getToolsForMCP(): Array<{
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.schema, { $refStrategy: "none" }) as Record<string, unknown>,
      outputSchema: tool.outputSchema
        ? zodToJsonSchema(tool.outputSchema, { $refStrategy: "none" }) as Record<string, unknown>
        : undefined,
      annotations: tool.annotations,
    }));
  }

  /**
   * Register all built-in tools
   */
  private registerBuiltInTools(): void {
    // Register roadmap and planning tools
    this.registerTool(createRoadmapTool);
    this.registerTool(planSprintTool);
    this.registerTool(getMilestoneMetricsTool);
    this.registerTool(getSprintMetricsTool);
    this.registerTool(getOverdueMilestonesTool);
    this.registerTool(getUpcomingMilestonesTool);

    // Register project tools
    this.registerTool(createProjectTool);
    this.registerTool(listProjectsTool);
    this.registerTool(getProjectTool);
    this.registerTool(updateProjectTool);
    this.registerTool(deleteProjectTool);
    this.registerTool(getProjectReadmeTool);
    this.registerTool(updateProjectReadmeTool);

    // Register milestone tools
    this.registerTool(createMilestoneTool);
    this.registerTool(listMilestonesTool);
    this.registerTool(updateMilestoneTool);
    this.registerTool(deleteMilestoneTool);

    // Register issue tools
    this.registerTool(createIssueTool);
    this.registerTool(listIssuesTool);
    this.registerTool(getIssueTool);
    this.registerTool(updateIssueTool);

    // Register issue comment tools
    this.registerTool(createIssueCommentTool);
    this.registerTool(updateIssueCommentTool);
    this.registerTool(deleteIssueCommentTool);
    this.registerTool(listIssueCommentsTool);

    // Register draft issue tools
    this.registerTool(createDraftIssueTool);
    this.registerTool(updateDraftIssueTool);
    this.registerTool(deleteDraftIssueTool);

    // Register pull request tools
    this.registerTool(createPullRequestTool);
    this.registerTool(getPullRequestTool);
    this.registerTool(listPullRequestsTool);
    this.registerTool(updatePullRequestTool);
    this.registerTool(mergePullRequestTool);
    this.registerTool(listPullRequestReviewsTool);
    this.registerTool(createPullRequestReviewTool);

    // Register sprint tools
    this.registerTool(createSprintTool);
    this.registerTool(listSprintsTool);
    this.registerTool(getCurrentSprintTool);
    this.registerTool(updateSprintTool);
    this.registerTool(addIssuesToSprintTool);
    this.registerTool(removeIssuesFromSprintTool);

    // Register project field tools
    this.registerTool(createProjectFieldTool);
    this.registerTool(listProjectFieldsTool);
    this.registerTool(updateProjectFieldTool);

    // Register project view tools
    this.registerTool(createProjectViewTool);
    this.registerTool(listProjectViewsTool);
    this.registerTool(updateProjectViewTool);
    this.registerTool(deleteProjectViewTool);

    // Register project item tools
    this.registerTool(addProjectItemTool);
    this.registerTool(removeProjectItemTool);
    this.registerTool(listProjectItemsTool);
    this.registerTool(archiveProjectItemTool);
    this.registerTool(unarchiveProjectItemTool);

    // Register field value tools
    this.registerTool(setFieldValueTool);
    this.registerTool(getFieldValueTool);
    this.registerTool(clearFieldValueTool);

    // Register label tools
    this.registerTool(createLabelTool);
    this.registerTool(listLabelsTool);

    // Register AI task management tools
    this.registerTool(addFeatureTool);
    this.registerTool(generatePRDTool);
    this.registerTool(parsePRDTool);
    this.registerTool(getNextTaskTool);
    this.registerTool(analyzeTaskComplexityTool);
    this.registerTool(expandTaskTool);
    this.registerTool(enhancePRDTool);
    this.registerTool(createTraceabilityMatrixTool);

    // Register automation service tools
    this.registerTool(createAutomationRuleTool);
    this.registerTool(updateAutomationRuleTool);
    this.registerTool(deleteAutomationRuleTool);
    this.registerTool(getAutomationRuleTool);
    this.registerTool(listAutomationRulesTool);
    this.registerTool(enableAutomationRuleTool);
    this.registerTool(disableAutomationRuleTool);

    // Register iteration management tools
    this.registerTool(getIterationConfigurationTool);
    this.registerTool(getCurrentIterationTool);
    this.registerTool(getIterationItemsTool);
    this.registerTool(getIterationByDateTool);
    this.registerTool(assignItemsToIterationTool);

    // Register AI-powered automation tools
    this.registerTool(generateRoadmapTool);
    this.registerTool(enrichIssueTool);
    this.registerTool(enrichIssuesBulkTool);
    this.registerTool(triageIssueTool);
    this.registerTool(triageAllIssuesTool);
    this.registerTool(scheduleTriagingTool);
  }

  /**
   * Convert Zod schema to JSON Schema (simplified version)
   * @deprecated Use zodToJsonSchema from zod-to-json-schema library instead.
   * This method is kept for backward compatibility but is no longer used.
   */
  private convertZodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
    try {
      // Access the internal representation of the schema
      // This is a simplified approach - in a real app, use a proper library
      const jsonSchema: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
      } = {
        type: "object",
        properties: {},
        required: [],
      };

      // Attempt to extract shape from the schema
      if (schema instanceof ZodObject) {
        const shape = schema._def.shape();

        // Extract properties and required fields
        for (const [key, zodType] of Object.entries(shape) as [string, ZodTypeAny][]) {
          // Check if the field is required (not optional)
          if (!(zodType instanceof ZodOptional)) {
            jsonSchema.required.push(key);
          }

          // Map Zod types to JSON Schema types (simplified)
          jsonSchema.properties[key] = this.zodTypeToJsonSchemaType(zodType);
        }
      }

      return jsonSchema;
    } catch (error) {
      process.stderr.write(`Error converting Zod schema to JSON Schema: ${error instanceof Error ? error.message : String(error)}\n`);
      // Fallback to basic object schema
      return {
        type: "object",
        properties: {},
      };
    }
  }

  /**
   * Simplified conversion of Zod type to JSON Schema type.
   * @deprecated Use zodToJsonSchema from zod-to-json-schema library instead.
   * This method is kept for backward compatibility but is no longer used.
   */
  private zodTypeToJsonSchemaType(zodType: ZodTypeAny): Record<string, unknown> {
    try {
      // Handle optional types first
      if (zodType instanceof ZodOptional) {
        return this.zodTypeToJsonSchemaType(zodType._def.innerType);
      }

      // String type
      if (zodType instanceof ZodString) {
        return { type: "string" };
      }

      // Number type
      if (zodType instanceof ZodNumber) {
        return { type: "number" };
      }

      // Boolean type
      if (zodType instanceof ZodBoolean) {
        return { type: "boolean" };
      }

      // Array type
      if (zodType instanceof ZodArray) {
        return {
          type: "array",
          items: this.zodTypeToJsonSchemaType(zodType._def.type),
        };
      }

      // Object type
      if (zodType instanceof ZodObject) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        const shape = zodType._def.shape();
        for (const [key, fieldType] of Object.entries(shape) as [string, ZodTypeAny][]) {
          properties[key] = this.zodTypeToJsonSchemaType(fieldType);

          // Check if the field is required (not optional)
          if (!(fieldType instanceof ZodOptional)) {
            required.push(key);
          }
        }

        return {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }

      // Enum type
      if (zodType instanceof ZodEnum) {
        return {
          enum: zodType._def.values,
        };
      }

      // Default fallback
      return { type: "string" };
    } catch (error) {
      process.stderr.write(`Error mapping Zod type: ${error instanceof Error ? error.message : String(error)}\n`);
      return { type: "string" };
    }
  }
}
