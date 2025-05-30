import { MCPResponseFormatter } from "../mcp/MCPResponseFormatter";
import { MCPContentType, MCPResponse } from "../../domain/mcp-types";

export interface FormattingOptions {
  contentType?: MCPContentType;
  requestId?: string;
  includeRawData?: boolean;
}

export class ToolResultFormatter {
  /**
   * Format a tool result as a successful MCP response
   */
  static formatSuccess<T>(
    toolName: string,
    result: T,
    options: FormattingOptions = {}
  ): MCPResponse {
    const contentType = options.contentType || MCPContentType.JSON;

    // Determine the right content format based on the result type and requested content type
    switch (contentType) {
      case MCPContentType.MARKDOWN:
        return this.formatAsMarkdown(toolName, result, options);

      case MCPContentType.HTML:
        return this.formatAsHtml(toolName, result, options);

      case MCPContentType.TEXT:
        return this.formatAsText(toolName, result, options);

      case MCPContentType.JSON:
      default:
        return this.formatAsJson(toolName, result, options);
    }
  }

  /**
   * Format result as JSON
   */
  private static formatAsJson<T>(
    toolName: string,
    result: T,
    options: FormattingOptions
  ): MCPResponse {
    // Add metadata specific to tool results
    const metadata = {
      tool: toolName,
      timestamp: new Date().toISOString(),
      requestId: options.requestId,
    };

    return MCPResponseFormatter.format(result, MCPContentType.JSON, metadata);
  }

  /**
   * Format result as Markdown
   */
  private static formatAsMarkdown<T>(
    toolName: string,
    result: T,
    options: FormattingOptions
  ): MCPResponse {
    // Add a title based on the tool name
    let markdown = `# ${this.formatToolName(toolName)} Result\n\n`;

    // Handle different types of results
    if (Array.isArray(result)) {
      // Format array results as a table if possible
      if (result.length > 0 && typeof result[0] === 'object') {
        markdown += MCPResponseFormatter.formatAsMarkdownTable(result);
      } else {
        // Simple list for arrays of primitives
        markdown += result.map(item => `- ${JSON.stringify(item)}`).join('\n');
      }
    } else if (result && typeof result === 'object') {
      // Format key properties as headers with details
      markdown += Object.entries(result).map(([key, value]) => {
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');

        if (Array.isArray(value)) {
          // Format arrays as lists
          return `## ${formattedKey}\n${value.map(item => `- ${JSON.stringify(item)}`).join('\n')}`;
        } else if (value && typeof value === 'object') {
          // Format objects with nested details
          return `## ${formattedKey}\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
        } else {
          return `## ${formattedKey}\n${value}`;
        }
      }).join('\n\n');
    } else {
      // Simple value
      markdown += String(result);
    }

    // Include raw JSON data if requested
    if (options.includeRawData) {
      markdown += '\n\n## Raw Data\n\n```json\n' + JSON.stringify(result) + '\n```';
    }

    // Create MCP response with markdown content
    return MCPResponseFormatter.format(
      markdown,
      MCPContentType.MARKDOWN,
      {
        tool: toolName,
        timestamp: new Date().toISOString(),
        requestId: options.requestId,
      }
    );
  }

  /**
   * Format result as HTML
   */
  private static formatAsHtml<T>(
    toolName: string,
    result: T,
    options: FormattingOptions
  ): MCPResponse {
    // Generate HTML template based on the result type
    const htmlTemplate = (data: T) => {
      let html = `
        <div class="tool-result">
          <h1 class="tool-name">${this.formatToolName(toolName)} Result</h1>
          <div class="tool-content">
      `;

      if (Array.isArray(data)) {
        if (data.length > 0 && typeof data[0] === 'object') {
          // Table for array of objects
          const keys = Object.keys(data[0]);
          html += `
            <table class="tool-table">
              <thead>
                <tr>
                  ${keys.map(key => `<th>${key}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(item => `
                  <tr>
                    ${keys.map(key => `<td>${JSON.stringify(item[key])}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        } else {
          // List for array of primitives
          html += `
            <ul class="tool-list">
              ${data.map(item => `<li>${JSON.stringify(item)}</li>`).join('')}
            </ul>
          `;
        }
      } else if (data && typeof data === 'object') {
        // Format object properties
        html += `
          <div class="tool-object">
            ${Object.entries(data).map(([key, value]) => {
              const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
              return `
                <div class="tool-property">
                  <h2 class="tool-property-name">${formattedKey}</h2>
                  <div class="tool-property-value">
                    ${this.formatHtmlValue(value)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        // Simple value
        html += `<p class="tool-simple-value">${data}</p>`;
      }

      html += `
          </div>
        </div>
      `;

      if (options.includeRawData) {
        html += `
          <div class="tool-raw-data">
            <h2>Raw Data</h2>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      }

      return html;
    };

    return MCPResponseFormatter.format(
      MCPResponseFormatter.formatAsRichHtml(result, htmlTemplate),
      MCPContentType.HTML,
      {
        tool: toolName,
        timestamp: new Date().toISOString(),
        requestId: options.requestId,
      }
    );
  }

  /**
   * Format result as plain text
   */
  private static formatAsText<T>(
    toolName: string,
    result: T,
    options: FormattingOptions
  ): MCPResponse {
    // Format as simple text representation
    let text = `${this.formatToolName(toolName)} Result:\n\n`;

    if (typeof result === 'string') {
      text += result;
    } else {
      text += JSON.stringify(result);
    }

    return MCPResponseFormatter.format(
      text,
      MCPContentType.TEXT,
      {
        tool: toolName,
        timestamp: new Date().toISOString(),
        requestId: options.requestId,
      }
    );
  }

  /**
   * Format a value as HTML
   */
  private static formatHtmlValue(value: any): string {
    if (Array.isArray(value)) {
      return `
        <ul class="tool-list">
          ${value.map(item => `<li>${JSON.stringify(item)}</li>`).join('')}
        </ul>
      `;
    } else if (value && typeof value === 'object') {
      return `<pre>${JSON.stringify(value, null, 2)}</pre>`;
    } else {
      return `<span>${value}</span>`;
    }
  }

  /**
   * Format tool name for display
   */
  private static formatToolName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}