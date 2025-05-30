/**
 * Script to generate OpenAPI documentation from tool schemas
 * 
 * This script extracts the Zod schemas from tool definitions and converts them
 * to OpenAPI format for use in the API Explorer.
 * 
 * Usage:
 * ts-node scripts/generate-openapi.ts
 */

import { writeFileSync } from 'fs';
import { ToolRegistry } from '../src/infrastructure/tools/ToolRegistry.js';

// Simple conversion of Zod schema to OpenAPI schema
function zodToOpenAPI(schema: any): any {
  // This is a simplified implementation
  // In a real implementation, you would use a library like zod-to-openapi
  
  try {
    // Handle object schemas
    if (schema._def && schema._def.typeName === 'ZodObject') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      const shape = schema._def.shape();
      for (const [key, zodType] of Object.entries(shape)) {
        properties[key] = zodTypeToJsonSchemaType(zodType);
        
        // Check if the field is required
        if (zodType._def && zodType._def.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
    
    // Handle array schemas
    if (schema._def && schema._def.typeName === 'ZodArray') {
      return {
        type: 'array',
        items: zodTypeToJsonSchemaType(schema._def.type)
      };
    }
    
    // Handle enum schemas
    if (schema._def && schema._def.typeName === 'ZodEnum') {
      return {
        type: 'string',
        enum: schema._def.values
      };
    }
    
    // Default to a simple object schema
    return {
      type: 'object',
      properties: {}
    };
  } catch (error) {
    process.stderr.write('Error converting Zod schema to OpenAPI:', error);
    return {
      type: 'object',
      properties: {}
    };
  }
}

// Convert Zod type to JSON Schema type
function zodTypeToJsonSchemaType(zodType: any): any {
  try {
    // Handle optional types
    if (zodType._def && zodType._def.typeName === 'ZodOptional') {
      return zodTypeToJsonSchemaType(zodType._def.innerType);
    }
    
    // Handle string type
    if (zodType._def && zodType._def.typeName === 'ZodString') {
      return { type: 'string' };
    }
    
    // Handle number type
    if (zodType._def && zodType._def.typeName === 'ZodNumber') {
      return { type: 'number' };
    }
    
    // Handle boolean type
    if (zodType._def && zodType._def.typeName === 'ZodBoolean') {
      return { type: 'boolean' };
    }
    
    // Handle array type
    if (zodType._def && zodType._def.typeName === 'ZodArray') {
      return {
        type: 'array',
        items: zodTypeToJsonSchemaType(zodType._def.type)
      };
    }
    
    // Handle object type
    if (zodType._def && zodType._def.typeName === 'ZodObject') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      const shape = zodType._def.shape();
      for (const [key, fieldType] of Object.entries(shape)) {
        properties[key] = zodTypeToJsonSchemaType(fieldType);
        
        // Check if the field is required
        if (fieldType._def && fieldType._def.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
    
    // Handle enum type
    if (zodType._def && zodType._def.typeName === 'ZodEnum') {
      return {
        type: 'string',
        enum: zodType._def.values
      };
    }
    
    // Default to string type
    return { type: 'string' };
  } catch (error) {
    process.stderr.write('Error converting Zod type to JSON Schema type:', error);
    return { type: 'string' };
  }
}

// Generate OpenAPI document
async function generateOpenAPI() {
  try {
    // Get all tools from the registry
    const registry = ToolRegistry.getInstance();
    const tools = registry.getAllTools();
    
    // Create OpenAPI document
    const openApiDocument = {
      openapi: '3.0.0',
      info: {
        title: 'GitHub Project Manager MCP API',
        version: '1.0.0',
        description: 'API for managing GitHub Projects through the Model Context Protocol'
      },
      servers: [
        {
          url: '/',
          description: 'MCP Server'
        }
      ],
      paths: {} as Record<string, any>,
      components: {
        schemas: {
          Error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Error code'
              },
              message: {
                type: 'string',
                description: 'Error message'
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    // Add each tool as a path
    for (const tool of tools) {
      const path = `/tools/${tool.name}`;
      
      // Convert tool schema to OpenAPI schema
      const requestSchema = zodToOpenAPI(tool.schema);
      
      // Add path to OpenAPI document
      openApiDocument.paths[path] = {
        post: {
          summary: tool.description,
          requestBody: {
            content: {
              'application/json': {
                schema: requestSchema
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful operation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      // Generic response schema
                      content: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              enum: ['text', 'json', 'markdown', 'html']
                            },
                            text: {
                              type: 'string'
                            },
                            contentType: {
                              type: 'string'
                            }
                          }
                        }
                      },
                      metadata: {
                        type: 'object',
                        properties: {
                          timestamp: {
                            type: 'string',
                            format: 'date-time'
                          },
                          status: {
                            type: 'integer'
                          },
                          requestId: {
                            type: 'string'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '404': {
              description: 'Resource not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '429': {
              description: 'Rate limited',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      };
      
      // Add examples if available
      if (tool.examples && tool.examples.length > 0) {
        const examples: Record<string, any> = {};
        
        for (const example of tool.examples) {
          examples[example.name.replace(/\s+/g, '_').toLowerCase()] = {
            summary: example.name,
            description: example.description,
            value: example.args
          };
        }
        
        openApiDocument.paths[path].post.requestBody.content['application/json'].examples = examples;
      }
    }
    
    // Write OpenAPI document to file
    writeFileSync('./docs/api-reference/openapi.json', JSON.stringify(openApiDocument, null, 2));
    console.log('OpenAPI documentation generated successfully!');
  } catch (error) {
    process.stderr.write('Error generating OpenAPI documentation:', error);
  }
}

// Run the script
generateOpenAPI().catch(process.stderr.write);
