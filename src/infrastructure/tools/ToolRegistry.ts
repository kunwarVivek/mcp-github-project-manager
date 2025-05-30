import { ToolDefinition } from "./ToolValidator.js";
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
  createSprintTool,
  listSprintsTool,
  getCurrentSprintTool,
  createProjectFieldTool,
  createProjectViewTool,

  // New project tools
  updateProjectTool,
  deleteProjectTool,
  listProjectFieldsTool,
  updateProjectFieldTool,

  // Project item tools
  addProjectItemTool,
  removeProjectItemTool,
  listProjectItemsTool,

  // Field values tools
  setFieldValueTool,
  getFieldValueTool,

  // View tools
  listProjectViewsTool,
  updateProjectViewTool,

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
} from "./ToolSchemas.js";

/**
 * Central registry of all available tools
 */
export class ToolRegistry {
  private static _instance: ToolRegistry;
  private _tools: Map<string, ToolDefinition<any>>;

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
    this._tools.set(tool.name, tool);
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
  public getAllTools(): ToolDefinition<any>[] {
    return Array.from(this._tools.values());
  }

  /**
   * Convert tools to MCP format for list_tools response
   */
  public getToolsForMCP(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.convertZodToJsonSchema(tool.schema),
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

    // Register project item tools
    this.registerTool(addProjectItemTool);
    this.registerTool(removeProjectItemTool);
    this.registerTool(listProjectItemsTool);

    // Register field value tools
    this.registerTool(setFieldValueTool);
    this.registerTool(getFieldValueTool);

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
  }

  /**
   * Convert Zod schema to JSON Schema (simplified version)
   * This is a basic conversion - for production use, consider a library like zod-to-json-schema
   */
  private convertZodToJsonSchema(schema: any): any {
    try {
      // Access the internal representation of the schema
      // This is a simplified approach - in a real app, use a proper library
      const jsonSchema: {
        type: string;
        properties: Record<string, any>;
        required: string[];
      } = {
        type: "object",
        properties: {},
        required: [],
      };

      // Attempt to extract shape from the schema
      if (schema._def && schema._def.shape) {
        const shape = schema._def.shape();

        // Extract properties and required fields
        for (const [key, zodType] of Object.entries(shape)) {
          // Check if the field is required (not optional)
          if ((zodType as any)._def.typeName !== "ZodOptional") {
            jsonSchema.required.push(key as string);
          }

          // Map Zod types to JSON Schema types (simplified)
          jsonSchema.properties[key as string] = this.zodTypeToJsonSchemaType(zodType);
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
   * Simplified conversion of Zod type to JSON Schema type
   */
  private zodTypeToJsonSchemaType(zodType: any): any {
    try {
      // Handle optional types first
      if (zodType._def.typeName === "ZodOptional") {
        return this.zodTypeToJsonSchemaType(zodType._def.innerType);
      }

      // String type
      if (zodType._def.typeName === "ZodString") {
        return { type: "string" };
      }

      // Number type
      if (zodType._def.typeName === "ZodNumber") {
        return { type: "number" };
      }

      // Boolean type
      if (zodType._def.typeName === "ZodBoolean") {
        return { type: "boolean" };
      }

      // Array type
      if (zodType._def.typeName === "ZodArray") {
        return {
          type: "array",
          items: this.zodTypeToJsonSchemaType(zodType._def.type),
        };
      }

      // Object type
      if (zodType._def.typeName === "ZodObject") {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        const shape = zodType._def.shape();
        for (const [key, fieldType] of Object.entries(shape)) {
          properties[key as string] = this.zodTypeToJsonSchemaType(fieldType);

          // Check if the field is required (not optional)
          if ((fieldType as any)._def.typeName !== "ZodOptional") {
            required.push(key as string);
          }
        }

        return {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }

      // Enum type
      if (zodType._def.typeName === "ZodEnum") {
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