import { MCPContent, MCPContentType, MCPResponse } from "../../domain/mcp-types";

export class MCPResponseFormatter {
  /**
   * Format data into MCP response format with proper content type handling
   */
  static format(data: unknown, contentType: MCPContentType = MCPContentType.JSON): MCPResponse {
    const content: MCPContent[] = [{
      type: this.getTypeFromContentType(contentType),
      text: this.formatContent(data, contentType),
      contentType,
    }];

    return {
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        status: 200,
      },
    };
  }

  /**
   * Format multiple content pieces into a single MCP response
   */
  static formatMultiple(contents: Array<{ data: unknown; contentType: MCPContentType }>): MCPResponse {
    const formattedContent: MCPContent[] = contents.map(({ data, contentType }) => ({
      type: this.getTypeFromContentType(contentType),
      text: this.formatContent(data, contentType),
      contentType,
    }));

    return {
      content: formattedContent,
      metadata: {
        timestamp: new Date().toISOString(),
        status: 200,
      },
    };
  }

  private static formatContent(data: unknown, contentType: MCPContentType): string {
    switch (contentType) {
      case MCPContentType.JSON:
        return JSON.stringify(data, null, 2);
      case MCPContentType.TEXT:
        return String(data);
      case MCPContentType.MARKDOWN:
        // Convert data to markdown if it's not already a string
        return typeof data === "string" ? data : JSON.stringify(data, null, 2);
      case MCPContentType.HTML:
        // Convert data to HTML if it's not already a string
        return typeof data === "string" ? data : `<pre>${JSON.stringify(data, null, 2)}</pre>`;
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

  /**
   * Create success response with optional request ID
   */
  static success<T>(data: T, contentType?: MCPContentType, requestId?: string): MCPResponse {
    const response = this.format(data, contentType);
    if (requestId) {
      response.metadata.requestId = requestId;
    }
    return response;
  }

  /**
   * Create paginated response
   */
  static paginated<T>(
    data: T[],
    page: number,
    totalPages: number,
    contentType?: MCPContentType
  ): MCPResponse {
    const response = this.format(data, contentType);
    response.metadata = {
      ...response.metadata,
      pagination: {
        page,
        totalPages,
      },
    };
    return response;
  }
}