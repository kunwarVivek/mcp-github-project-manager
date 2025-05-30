import {
  MCPContent,
  MCPContentType,
  MCPResponse,
  MCPErrorSchema,
  MCPErrorCode,
  MCPSuccessResponse,
  MCPErrorResponse
} from "../../domain/mcp-types";
import { z } from "zod";

export interface RichContent {
  type: 'text' | 'json' | 'markdown' | 'html';
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProgressUpdate {
  completed: number;
  total: number;
  message?: string;
  status: 'in-progress' | 'completed' | 'failed';
}

export class MCPResponseFormatter {
  /**
   * Format data into MCP response format with proper content type handling
   */
  static format(
    data: unknown,
    contentType: MCPContentType = MCPContentType.JSON,
    metadata?: Record<string, unknown>
  ): MCPSuccessResponse {
    // Convert the formatted content to string
    const formattedContent = this.formatContent(data, contentType);

    // Create a success response that matches the MCPSuccessResponse type
    return {
      version: "1.0",
      requestId: metadata?.requestId as string || `req-${Date.now()}`,
      status: "success",
      output: {
        content: formattedContent,
        format: {
          type: this.getTypeFromContentType(contentType)
        },
        context: metadata
      }
    };
  }

  /**
   * Format multiple content pieces into a single MCP response
   */
  static formatMultiple(
    contents: Array<{ data: unknown; contentType: MCPContentType; metadata?: Record<string, unknown> }>
  ): MCPSuccessResponse {
    // Combine all content into a single string with formatting
    let combinedContent = "";
    contents.forEach(({ data, contentType }) => {
      combinedContent += this.formatContent(data, contentType) + "\n\n";
    });

    // Create a success response with combined content
    return {
      version: "1.0",
      requestId: `req-${Date.now()}`,
      status: "success",
      output: {
        content: combinedContent.trim(),
        format: {
          type: "text"
        }
      }
    };
  }

  /**
   * Format rich content with multiple types and proper structure
   */
  static formatRich(
    contents: RichContent[],
    metadata?: Record<string, unknown>
  ): MCPSuccessResponse {
    // Combine content from multiple rich content objects
    let combinedContent = "";

    contents.forEach(({ type, data }) => {
      const contentType = this.getContentTypeFromType(type);
      combinedContent += this.formatContent(data, contentType) + "\n\n";
    });

    // Create a success response with the combined content
    return {
      version: "1.0",
      requestId: metadata?.requestId as string || `req-${Date.now()}`,
      status: "success",
      output: {
        content: combinedContent.trim(),
        format: {
          type: "text"
        },
        context: metadata
      }
    };
  }

  /**
   * Format data to markdown table (for structured data)
   */
  static formatAsMarkdownTable<T extends Record<string, unknown>>(
    data: T[],
    options?: {
      title?: string;
      columns?: Array<{key: keyof T; header: string}>;
    }
  ): string {
    if (data.length === 0) return 'No data available';

    // Determine columns
    const columns = options?.columns ||
      Object.keys(data[0]).map(key => ({
        key: key as keyof T,
        header: String(key),
      }));

    // Build header
    let markdown = options?.title ? `# ${options.title}\n\n` : '';

    // Build table header
    markdown += '| ' + columns.map(col => col.header).join(' | ') + ' |\n';
    markdown += '| ' + columns.map(() => '---').join(' | ') + ' |\n';

    // Build table rows
    for (const row of data) {
      markdown += '| ' + columns.map(col => String(row[col.key] ?? '')).join(' | ') + ' |\n';
    }

    return markdown;
  }

  /**
   * Format as rich HTML (with classes for styling)
   */
  static formatAsRichHtml<T>(
    data: T,
    template: (data: T) => string
  ): string {
    return template(data);
  }

  /**
   * Create error response with proper MCP error formatting
   */
  static error(
    code: MCPErrorCode,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ): MCPErrorResponse {
    // Validate error data against the schema
    const errorData = {
      code,
      message,
      details,
    };

    MCPErrorSchema.parse(errorData);

    // Create a properly formatted error response
    return {
      version: "1.0",
      requestId: requestId || `req-${Date.now()}`,
      status: "error",
      error: {
        code: code,
        message: message,
        details: details ? [{ code: "details", message: JSON.stringify(details) }] : undefined
      }
    };
  }

  /**
   * Create a progressive response for long-running operations
   */
  static progress(
    update: ProgressUpdate,
    requestId: string
  ): MCPSuccessResponse {
    return {
      version: "1.0",
      requestId: requestId,
      status: "success",
      output: {
        content: JSON.stringify(update),
        format: {
          type: "json"
        },
        context: {
          status: "in-progress",
          progress: update
        }
      }
    };
  }

  /**
   * Create success response with optional request ID
   */
  static success<T>(
    data: T,
    contentType?: MCPContentType,
    requestId?: string,
    metadata?: Record<string, unknown>
  ): MCPSuccessResponse {
    const formattedContent = this.formatContent(data, contentType || MCPContentType.JSON);

    return {
      version: "1.0",
      requestId: requestId || `req-${Date.now()}`,
      status: "success",
      output: {
        content: formattedContent,
        format: {
          type: this.getTypeFromContentType(contentType || MCPContentType.JSON)
        },
        context: metadata
      }
    };
  }

  /**
   * Create paginated response
   */
  static paginated<T>(
    data: T[],
    page: number,
    totalPages: number,
    options?: {
      contentType?: MCPContentType;
      requestId?: string;
      totalItems?: number;
    }
  ): MCPSuccessResponse {
    const formattedContent = this.formatContent(data, options?.contentType || MCPContentType.JSON);

    return {
      version: "1.0",
      requestId: options?.requestId || `req-${Date.now()}`,
      status: "success",
      output: {
        content: formattedContent,
        format: {
          type: this.getTypeFromContentType(options?.contentType || MCPContentType.JSON)
        },
        context: {
          pagination: {
            page,
            totalPages,
            totalItems: options?.totalItems
          }
        }
      }
    };
  }

  /**
   * Validate the structure of an MCP response
   */
  static validateResponse(response: unknown): boolean {
    const result = z.object({
      content: z.array(z.object({
        type: z.enum(['text', 'json', 'markdown', 'html']),
        text: z.string(),
        contentType: z.nativeEnum(MCPContentType),
      })).nonempty(),
      metadata: z.object({
        timestamp: z.string(),
        status: z.number(),
      }).nonstrict(),
    }).safeParse(response);

    return result.success;
  }

  private static formatContent(data: unknown, contentType: MCPContentType): string {
    switch (contentType) {
      case MCPContentType.JSON:
        // Use compact JSON for MCP protocol compliance (single line)
        return JSON.stringify(data);

      case MCPContentType.TEXT:
        return String(data);

      case MCPContentType.MARKDOWN:
        if (typeof data === "string") return data;

        // Create a simple markdown representation for objects
        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            return data.map(item => `- ${JSON.stringify(item)}`).join('\n');
          } else {
            return Object.entries(data)
              .map(([key, value]) => `### ${key}\n${JSON.stringify(value, null, 2)}`)
              .join('\n\n');
          }
        }

        return String(data);

      case MCPContentType.HTML:
        if (typeof data === "string") {
          // Check if it's already HTML
          if (data.trim().startsWith('<') && data.trim().endsWith('>')) {
            return data;
          }
          return `<pre>${data}</pre>`;
        }

        // Create a simple HTML representation for objects
        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            return `<ul>${data.map(item => `<li>${JSON.stringify(item)}</li>`).join('')}</ul>`;
          } else {
            return `<div class="mcp-object">
              ${Object.entries(data)
                .map(([key, value]) => `
                  <div class="mcp-property">
                    <div class="mcp-key">${key}</div>
                    <div class="mcp-value"><pre>${JSON.stringify(value, null, 2)}</pre></div>
                  </div>
                `)
                .join('')}
            </div>`;
          }
        }

        return `<pre>${String(data)}</pre>`;

      default:
        return String(data);
    }
  }

  private static getTypeFromContentType(contentType: MCPContentType): "text" | "json" | "markdown" | "html" {
    switch (contentType) {
      case MCPContentType.JSON:
        return "json";
      case MCPContentType.MARKDOWN:
        return "markdown";
      case MCPContentType.HTML:
        return "html";
      default:
        return "text";
    }
  }

  private static getContentTypeFromType(type: "text" | "json" | "markdown" | "html"): MCPContentType {
    switch (type) {
      case "json":
        return MCPContentType.JSON;
      case "markdown":
        return MCPContentType.MARKDOWN;
      case "html":
        return MCPContentType.HTML;
      default:
        return MCPContentType.TEXT;
    }
  }

  private static getStatusCodeForError(code: MCPErrorCode): number {
    switch (code) {
      case MCPErrorCode.VALIDATION_ERROR:
        return 400; // Bad Request
      case MCPErrorCode.RESOURCE_NOT_FOUND:
        return 404; // Not Found
      case MCPErrorCode.UNAUTHORIZED:
        return 401; // Unauthorized
      case MCPErrorCode.RATE_LIMITED:
        return 429; // Too Many Requests
      case MCPErrorCode.INTERNAL_ERROR:
      default:
        return 500; // Internal Server Error
    }
  }
}