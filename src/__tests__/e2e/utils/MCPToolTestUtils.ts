import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  CallToolResult,
  JSONRPCRequest,
  JSONRPCResponse,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/client";
import { asRecord, isRecord } from "./payload";

/**
 * The subset of an issue the e2e suites assert on when reading an issue back
 * through the MCP surface (`manage_issues` / `get`).
 */
export interface McpIssueState {
  id: string;
  number: number;
  title: string;
  /** Resource status: "active" for an open issue, "closed" for a closed one. */
  status: string;
}

/**
 * Utility class for testing MCP tools through the actual MCP interface
 */
export class MCPToolTestUtils {
  private static serverPath = join(process.cwd(), "build/index.js");
  private serverProcess: ChildProcess | null = null;
  private messageId = 1;

  constructor() {
    // Ensure build exists
    if (!existsSync(MCPToolTestUtils.serverPath)) {
      throw new Error("Server build not found. Run `npm run build` first.");
    }
  }

  /**
   * Start the MCP server process
   */
  async startServer(envOverrides: Record<string, string> = {}): Promise<void> {
    if (this.serverProcess) {
      throw new Error("Server is already running");
    }

    const env = {
      ...process.env,
      ...envOverrides,
      // Ensure we have required environment variables
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || "test-token",
      GITHUB_OWNER: process.env.GITHUB_OWNER || "test-owner",
      GITHUB_REPO: process.env.GITHUB_REPO || "test-repo",
      // These suites exercise the stdio protocol, not webhooks. Without this
      // every spawned server binds WEBHOOK_PORT (default 3001); Vitest runs
      // files in parallel, so they collided and failed nondeterministically.
      SSE_ENABLED: "false",
    };

    const proc = spawn("node", [MCPToolTestUtils.serverPath], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.serverProcess = proc;

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 10000);

      proc.on("spawn", () => {
        clearTimeout(timeout);
        resolve(void 0);
      });

      proc.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Initialize the MCP connection
    await this.initializeConnection();
  }

  /**
   * Stop the MCP server process
   */
  async stopServer(): Promise<void> {
    const proc = this.serverProcess;
    if (proc) {
      proc.kill("SIGTERM");

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!proc.killed) {
            proc.kill("SIGKILL");
          }
          resolve();
        }, 5000);

        proc.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.serverProcess = null;
    }
  }

  /**
   * Initialize MCP connection
   */
  private async initializeConnection(): Promise<void> {
    const initRequest: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "e2e-test", version: "1.0.0" },
      },
    };

    await this.sendMessage(initRequest);
  }

  /**
   * Send a message to the MCP server and wait for response
   */
  private async sendMessage(message: JSONRPCRequest): Promise<JSONRPCResponse> {
    const proc = this.serverProcess;
    if (!proc) {
      throw new Error("Server is not running");
    }
    const { stdin, stdout, stderr } = proc;
    if (!stdin || !stdout || !stderr) {
      throw new Error("Server stdio pipes are not available");
    }

    return new Promise((resolve, reject) => {
      let responseData = "";

      const timeout = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, 30000);

      const onData = (data: Buffer) => {
        responseData += data.toString();

        // Try to parse JSON response
        const lines = responseData.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          try {
            const response: unknown = JSON.parse(line);
            if (isRecord(response) && response.id === message.id) {
              clearTimeout(timeout);
              stdout.off("data", onData);
              stderr.off("data", onError);
              resolve(response as JSONRPCResponse);
              return;
            }
          } catch {
            // Continue parsing other lines
          }
        }
      };

      const onError = (_data: Buffer) => {
        // Drain stderr so the child process does not block on a full pipe.
      };

      stdout.on("data", onData);
      stderr.on("data", onError);

      // Send the message
      stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<Tool[]> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/list",
      params: {},
    };

    const response = await this.sendMessage(request);

    if ("error" in response) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    return (response.result as ListToolsResult).tools ?? [];
  }

  /**
   * Call a specific tool with arguments
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return MCPToolTestUtils.extractData(await this.callToolRaw(toolName, args));
  }

  private toolCallRequest(toolName: string, args: Record<string, unknown>): JSONRPCRequest {
    return {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };
  }

  /**
   * Call a specific tool and return raw MCP result (no extraction)
   */
  async callToolRaw(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const response = await this.sendMessage(this.toolCallRequest(toolName, args));

    if ("error" in response) {
      throw new Error(`Tool ${toolName} failed: ${response.error.message}`);
    }

    // The server's tools/call result is a CallToolResult.
    return response.result as CallToolResult;
  }

  /**
   * Read the Project V2 field values of the item that holds a given issue,
   * keyed by field name.
   *
   * `manage_project` / `filter_items` is the only MCP route that returns
   * field values by NAME: `manage_project` / `list_fields` goes through
   * `GitHubProjectRepository.findById`, which returns `fields: []`, so the
   * field ids needed to read a value are not reachable that way.
   *
   * @param projectId Project node id.
   * @param contentId Node id of the issue held by the project item.
   * @returns Field values keyed by field name, or `null` when the issue is
   *          not an item of the project.
   */
  async getProjectItemFieldValues(
    projectId: string,
    contentId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.callTool("manage_project", {
      action: "filter_items",
      projectId,
      filter: {},
    });

    // The compound surface answers with the action's payload; the granular
    // executor envelope is unwrapped if it is still there.
    const payload =
      isRecord(result) && result.structuredContent ? result.structuredContent : result;
    const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
    for (const item of items) {
      if (isRecord(item) && item.contentId === contentId) {
        return isRecord(item.fieldValues) ? item.fieldValues : {};
      }
    }
    return null;
  }

  /**
   * Fetch a single issue by node id (or by issue number).
   */
  async getIssue(issueId: string | number): Promise<McpIssueState | null> {
    const issue = await this.callTool("manage_issues", { action: "get", issueId: String(issueId) });
    if (!isRecord(issue)) return null;
    const { id, number, title, status } = issue;
    if (
      typeof id !== "string" ||
      typeof number !== "number" ||
      typeof title !== "string" ||
      typeof status !== "string"
    ) {
      return null;
    }
    return { id, number, title, status };
  }

  /**
   * List the comments of an issue, oldest first.
   */
  async listIssueComments(
    issueNumber: number
  ): Promise<Array<{ id: number; body: string; user: string; createdAt: string }>> {
    const comments = await this.callTool("manage_issues", { action: "list_comments", issueNumber });
    if (!Array.isArray(comments)) return [];
    return comments.map((comment: unknown) => {
      const c = asRecord(comment, "issue comment");
      const { id, body, user, createdAt } = c;
      if (
        typeof id !== "number" ||
        typeof body !== "string" ||
        typeof user !== "string" ||
        typeof createdAt !== "string"
      ) {
        throw new Error(`Malformed issue comment: ${JSON.stringify(c)}`);
      }
      return { id, body, user, createdAt };
    });
  }

  /**
   * Extract domain data from MCP v2 tool response
   */
  static extractData(result: unknown): unknown {
    if (!isRecord(result)) return result;
    // Check for structuredContent first (MCP v2 with outputSchema)
    if (result.structuredContent) return result.structuredContent;
    // Extract from content[0].text
    const first = Array.isArray(result.content) ? result.content[0] : undefined;
    if (isRecord(first) && typeof first.text === "string" && first.text) {
      try {
        // Recursively unwrap if needed
        return MCPToolTestUtils.extractData(JSON.parse(first.text));
      } catch {
        return first.text;
      }
    }
    return result;
  }

  /**
   * Test if a tool exists and has the expected schema
   */
  async validateToolExists(toolName: string): Promise<boolean> {
    const tools = await this.listTools();
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      return false;
    }

    // Validate tool has required properties
    return !!(tool.name && tool.description && tool.inputSchema);
  }

  /**
   * Test tool with invalid arguments to verify validation
   */
  async testToolValidation(
    toolName: string,
    invalidArgs: Record<string, unknown>
  ): Promise<{ hasValidation: boolean; errorMessage?: string }> {
    try {
      await this.callTool(toolName, invalidArgs);
      return { hasValidation: false };
    } catch (error) {
      return {
        hasValidation: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract content from MCP response
   */
  static extractContent(response: unknown): string {
    // Handle different response formats
    if (typeof response === "string") {
      try {
        return MCPToolTestUtils.extractContent(JSON.parse(response));
      } catch {
        return response;
      }
    }

    if (!isRecord(response)) {
      return JSON.stringify(response);
    }

    // Handle MCP tool response format
    if (response.output) {
      if (typeof response.output === "string") {
        try {
          const parsed: unknown = JSON.parse(response.output);
          if (isRecord(parsed) && parsed.content) {
            return typeof parsed.content === "string"
              ? parsed.content
              : JSON.stringify(parsed.content);
          }
          return response.output;
        } catch {
          return response.output;
        }
      }
      return JSON.stringify(response.output);
    }

    // Handle direct content
    if (response.content) {
      return typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    }

    return JSON.stringify(response);
  }

  /**
   * Check if we have real (not fake/test) credentials
   */
  static hasRealCredentials(testType: "github" | "ai" | "both"): boolean {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Check for fake test values from setup.ts
    const hasRealGitHub = !!(
      token &&
      token !== "test-token" &&
      token !== "" &&
      owner &&
      owner !== "test-owner" &&
      repo &&
      repo !== "test-repo"
    );

    const hasRealAI = !!(
      (anthropicKey &&
        anthropicKey !== "sk-ant-test-key" &&
        !anthropicKey.startsWith("sk-ant-test")) ||
      (openaiKey && openaiKey !== "sk-test-openai-key" && !openaiKey.startsWith("sk-test"))
    );

    switch (testType) {
      case "github":
        return hasRealGitHub;
      case "ai":
        return hasRealAI;
      case "both":
        return hasRealGitHub && hasRealAI;
      default:
        return false;
    }
  }

  /**
   * Check if we should skip tests based on credentials
   */
  static shouldSkipTest(testType: "github" | "ai" | "both"): boolean {
    // Skip if we don't have real credentials for this test type
    return !MCPToolTestUtils.hasRealCredentials(testType);
  }

  /**
   * Create a test suite wrapper that handles server lifecycle.
   *
   * The suite is registered with `describe.skipIf`, so a run without real
   * credentials is reported as SKIPPED by Vitest instead of PASSED. The old
   * shape (register the tests, then return early inside each `it`) made a
   * suite that did nothing at all look green in the CI log.
   *
   * The individual `if (!utils)` guards stay as a second line of defence.
   */
  static createTestSuite(suiteName: string, testType: "github" | "ai" | "both" = "github") {
    return (tests: (utils: MCPToolTestUtils | undefined) => void) => {
      describe.skipIf(MCPToolTestUtils.shouldSkipTest(testType))(suiteName, () => {
        let utils: MCPToolTestUtils | undefined;

        beforeAll(async () => {
          if (MCPToolTestUtils.shouldSkipTest(testType)) {
            console.log(`Skipping ${suiteName} - missing real credentials for ${testType} tests`);
            return;
          }

          utils = new MCPToolTestUtils();
          await utils.startServer();
        }, 30000);

        afterAll(async () => {
          if (utils) {
            await utils.stopServer();
          }
        }, 10000);

        // Always register tests - they will skip inside via the `if (!utils)` guard
        tests(utils);
      });
    };
  }
}

/**
 * Helper functions for common test patterns
 */
export const MCPTestHelpers = {
  /**
   * Validate that a tool response has the expected structure
   */
  validateToolResponse(response: unknown, expectedFields: string[] = []): void {
    expect(response).toBeDefined();

    // Handle different response formats
    let actualResponse: unknown = response;

    // If response has output property, extract it
    if (isRecord(response) && typeof response.output === "string") {
      try {
        actualResponse = JSON.parse(response.output);
      } catch {
        // If parsing fails, use the output string directly
        actualResponse = response.output;
      }
    }

    // Validate expected fields
    for (const field of expectedFields) {
      expect(actualResponse).toHaveProperty(field);
    }
  },

  /**
   * Create test data for GitHub resources
   */
  createTestData: {
    project: (overrides: Record<string, unknown> = {}) => ({
      title: `Test Project ${Date.now()}`,
      shortDescription: "E2E test project",
      owner: process.env.GITHUB_OWNER || "test-owner",
      visibility: "private" as const,
      ...overrides,
    }),

    milestone: (overrides: Record<string, unknown> = {}) => ({
      title: `Test Milestone ${Date.now()}`,
      description: "E2E test milestone",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    }),

    issue: (overrides: Record<string, unknown> = {}) => ({
      title: `Test Issue ${Date.now()}`,
      description: "E2E test issue",
      assignees: [],
      labels: [],
      ...overrides,
    }),

    sprint: (overrides: Record<string, unknown> = {}) => ({
      title: `Test Sprint ${Date.now()}`,
      description: "E2E test sprint",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      goals: ["Complete E2E testing"],
      ...overrides,
    }),
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(
    condition: () => Promise<boolean>,
    timeout = 10000,
    interval = 1000
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Skip test if required credentials are missing
   * Note: Returns a boolean - caller should use console.log + return pattern
   */
  skipIfMissingCredentials(testType: "github" | "ai" | "both", testName: string): boolean {
    if (MCPToolTestUtils.shouldSkipTest(testType)) {
      console.log(`Skipping: ${testName} - missing credentials for ${testType} tests`);
      return true;
    }
    return false;
  },

  /**
   * Check if a test should be skipped and return appropriate action
   */
  checkCredentials(testType: "github" | "ai" | "both"): { shouldSkip: boolean; reason?: string } {
    const shouldSkip = MCPToolTestUtils.shouldSkipTest(testType);
    return {
      shouldSkip,
      reason: shouldSkip ? `Missing credentials for ${testType} tests` : undefined,
    };
  },
};
