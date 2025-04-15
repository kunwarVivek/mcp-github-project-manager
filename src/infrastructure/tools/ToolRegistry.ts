import { ToolDefinition } from "./ToolValidator.js";
import {
  createRoadmapTool,
  planSprintTool,
  getMilestoneMetricsTool,
  getSprintMetricsTool,
  getOverdueMilestonesTool,
  getUpcomingMilestonesTool,
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
      console.warn(`Tool '${tool.name}' is already registered and will be overwritten.`);
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
    // Register all standard tools
    this.registerTool(createRoadmapTool);
    this.registerTool(planSprintTool);
    this.registerTool(getMilestoneMetricsTool);
    this.registerTool(getSprintMetricsTool);
    this.registerTool(getOverdueMilestonesTool);
    this.registerTool(getUpcomingMilestonesTool);
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
          // Check if the type has an isOptional method before calling it
          if (typeof (zodType as any).isOptional === 'function' && !(zodType as any).isOptional()) {
            jsonSchema.required.push(key as string);
          }

          // Map Zod types to JSON Schema types (simplified)
          jsonSchema.properties[key as string] = this.zodTypeToJsonSchemaType(zodType);
        }
      }

      return jsonSchema;
    } catch (error) {
      console.error("Error converting Zod schema to JSON Schema:", error);
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
          
          // Check if the type has an isOptional method before calling it
          if (typeof (fieldType as any).isOptional === 'function' && !(fieldType as any).isOptional()) {
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
      console.error("Error mapping Zod type:", error);
      return { type: "string" };
    }
  }
}