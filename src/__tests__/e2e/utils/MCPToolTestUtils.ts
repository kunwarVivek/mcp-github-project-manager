import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPResponse, MCPSuccessResponse, MCPErrorResponse } from '../../../domain/mcp-types';
import { testConfig } from '../setup';

/**
 * Utility class for testing MCP tools through the actual MCP interface
 */
export class MCPToolTestUtils {
  private static serverPath = join(process.cwd(), 'build/index.js');
  private serverProcess: ChildProcess | null = null;
  private messageId = 1;

  constructor() {
    // Ensure build exists
    if (!existsSync(MCPToolTestUtils.serverPath)) {
      throw new Error('Server build not found. Run `npm run build` first.');
    }
  }

  /**
   * Start the MCP server process
   */
  async startServer(envOverrides: Record<string, string> = {}): Promise<void> {
    if (this.serverProcess) {
      throw new Error('Server is already running');
    }

    const env = {
      ...process.env,
      ...envOverrides,
      // Ensure we have required environment variables
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || 'test-token',
      GITHUB_OWNER: process.env.GITHUB_OWNER || 'test-owner',
      GITHUB_REPO: process.env.GITHUB_REPO || 'test-repo',
    };

    this.serverProcess = spawn('node', [MCPToolTestUtils.serverPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      this.serverProcess!.on('spawn', () => {
        clearTimeout(timeout);
        resolve(void 0);
      });

      this.serverProcess!.on('error', (error) => {
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
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.serverProcess!.on('exit', () => {
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
    const initRequest = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "e2e-test", version: "1.0.0" }
      }
    };

    await this.sendMessage(initRequest);
  }

  /**
   * Send a message to the MCP server and wait for response
   */
  private async sendMessage(message: any): Promise<any> {
    if (!this.serverProcess) {
      throw new Error('Server is not running');
    }

    return new Promise((resolve, reject) => {
      let responseData = '';
      let errorData = '';

      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 30000);

      const onData = (data: Buffer) => {
        responseData += data.toString();
        
        // Try to parse JSON response
        const lines = responseData.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === message.id) {
              clearTimeout(timeout);
              this.serverProcess!.stdout!.off('data', onData);
              this.serverProcess!.stderr!.off('data', onError);
              resolve(response);
              return;
            }
          } catch (e) {
            // Continue parsing other lines
          }
        }
      };

      const onError = (data: Buffer) => {
        errorData += data.toString();
      };

      this.serverProcess!.stdout!.on('data', onData);
      this.serverProcess!.stderr!.on('data', onError);

      // Send the message
      this.serverProcess!.stdin!.write(JSON.stringify(message) + '\n');
    });
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<any[]> {
    const request = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/list",
      params: {}
    };

    const response = await this.sendMessage(request);
    
    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  /**
   * Call a specific tool with arguments
   */
  async callTool(toolName: string, args: any): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    const response = await this.sendMessage(request);
    
    if (response.error) {
      throw new Error(`Tool ${toolName} failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Test if a tool exists and has the expected schema
   */
  async validateToolExists(toolName: string): Promise<boolean> {
    const tools = await this.listTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      return false;
    }

    // Validate tool has required properties
    return !!(tool.name && tool.description && tool.inputSchema);
  }

  /**
   * Test tool with invalid arguments to verify validation
   */
  async testToolValidation(toolName: string, invalidArgs: any): Promise<{ hasValidation: boolean; errorMessage?: string }> {
    try {
      await this.callTool(toolName, invalidArgs);
      return { hasValidation: false };
    } catch (error) {
      return { 
        hasValidation: true, 
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Extract content from MCP response
   */
  static extractContent(response: any): string {
    // Handle different response formats
    if (typeof response === 'string') {
      try {
        const parsed = JSON.parse(response);
        return MCPToolTestUtils.extractContent(parsed);
      } catch {
        return response;
      }
    }

    // Handle MCP tool response format
    if (response.output) {
      if (typeof response.output === 'string') {
        try {
          const parsed = JSON.parse(response.output);
          if (parsed.content) {
            return typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content);
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
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }

    return JSON.stringify(response);
  }

  /**
   * Check if we should skip tests based on credentials
   */
  static shouldSkipTest(testType: 'github' | 'ai' | 'both'): boolean {
    return testConfig.skipIfNoCredentials(testType);
  }

  /**
   * Create a test suite wrapper that handles server lifecycle
   */
  static createTestSuite(suiteName: string, testType: 'github' | 'ai' | 'both' = 'github') {
    return (tests: (utils: MCPToolTestUtils) => void) => {
      describe(suiteName, () => {
        let utils: MCPToolTestUtils | undefined;

        beforeAll(async () => {
          if (MCPToolTestUtils.shouldSkipTest(testType)) {
            console.log(`⏭️  Skipping ${suiteName} - missing credentials for ${testType} tests`);
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

        beforeEach(() => {
          if (MCPToolTestUtils.shouldSkipTest(testType)) {
            test.skip(`Skipping test - missing credentials for ${testType} tests`, () => {});
          }
        });

        if (!MCPToolTestUtils.shouldSkipTest(testType)) {
          tests(utils as MCPToolTestUtils);
        }
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
  validateToolResponse(response: any, expectedFields: string[] = []): void {
    expect(response).toBeDefined();

    // Handle different response formats
    let actualResponse = response;

    // If response has output property, extract it
    if (response.output && typeof response.output === 'string') {
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
    project: (overrides: any = {}) => ({
      title: `Test Project ${Date.now()}`,
      shortDescription: "E2E test project",
      owner: process.env.GITHUB_OWNER || "test-owner",
      visibility: "private" as const,
      ...overrides
    }),

    milestone: (overrides: any = {}) => ({
      title: `Test Milestone ${Date.now()}`,
      description: "E2E test milestone",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides
    }),

    issue: (overrides: any = {}) => ({
      title: `Test Issue ${Date.now()}`,
      description: "E2E test issue",
      assignees: [],
      labels: [],
      ...overrides
    }),

    sprint: (overrides: any = {}) => ({
      title: `Test Sprint ${Date.now()}`,
      description: "E2E test sprint",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      goals: ["Complete E2E testing"],
      ...overrides
    })
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(condition: () => Promise<boolean>, timeout = 10000, interval = 1000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Skip test if required credentials are missing
   */
  skipIfMissingCredentials(testType: 'github' | 'ai' | 'both', testName: string): void {
    if (MCPToolTestUtils.shouldSkipTest(testType)) {
      test.skip(`${testName} - missing credentials for ${testType} tests`, () => {});
      return;
    }
  },

  /**
   * Check if a test should be skipped and return appropriate action
   */
  checkCredentials(testType: 'github' | 'ai' | 'both'): { shouldSkip: boolean; reason?: string } {
    const shouldSkip = MCPToolTestUtils.shouldSkipTest(testType);
    return {
      shouldSkip,
      reason: shouldSkip ? `Missing credentials for ${testType} tests` : undefined
    };
  }
};
