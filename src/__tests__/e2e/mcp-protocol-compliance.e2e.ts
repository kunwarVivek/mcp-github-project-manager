import { spawn, ChildProcess } from 'child_process';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { existsSync } from 'fs';

const projectRoot = process.cwd();

/**
 * E2E tests specifically for MCP protocol compliance
 * These tests verify that the server properly adheres to the MCP protocol
 * by spawning the actual server process and testing the stdio transport layer
 */
describe('MCP Protocol Compliance E2E Tests', () => {
  const serverPath = join(projectRoot, 'build/index.js');
  let serverProcess: ChildProcess;
  const testTimeout = 10000;

  beforeAll(() => {
    // Ensure build exists
    if (!existsSync(serverPath)) {
      throw new Error('Server build not found. Run `npm run build` first.');
    }
  });

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null as any;
    }
  });

  describe('Stdio Transport Protocol Compliance', () => {
    it('should only output JSON messages to stdout, logs to stderr', async () => {
      let stdoutData = '';
      let stderrData = '';
      let stdoutMessages: any[] = [];
      let jsonParseErrors: string[] = [];
      let receivedInitResponse = false;

      // Spawn the server process
      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Collect stdout data (should be JSON only)
      serverProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdoutData += chunk;
        
        // Try to parse each line as JSON
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            stdoutMessages.push(parsed);
            // Check if this is the init response
            if (parsed.id === 1 && parsed.result) {
              receivedInitResponse = true;
            }
          } catch (error) {
            if (line.trim()) {
              jsonParseErrors.push(`Non-JSON on stdout: "${line.trim()}"`);
            }
          }
        }
      });

      // Collect stderr data (logs should go here)
      serverProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for server to start (look for startup message in stderr)
      await new Promise<void>((resolve) => {
        const checkStartup = () => {
          if (stderrData.includes('GitHub Project Manager MCP server running on stdio')) {
            resolve();
          } else {
            setTimeout(checkStartup, 100);
          }
        };
        setTimeout(checkStartup, 100);
        // Fallback timeout
        setTimeout(resolve, 5000);
      });

      // Send an MCP initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      };

      // Send the request
      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      // Wait for response with proper timeout
      await new Promise<void>((resolve) => {
        const checkResponse = () => {
          if (receivedInitResponse) {
            resolve();
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        setTimeout(checkResponse, 100);
        // Fallback timeout
        setTimeout(resolve, 3000);
      });

      // Send notifications/initialized
      const initializedNotification = {
        jsonrpc: "2.0",
        method: "notifications/initialized"
      };
      serverProcess.stdin?.write(JSON.stringify(initializedNotification) + '\n');

      // Wait a bit more for any additional processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify protocol compliance
      expect(jsonParseErrors).toEqual([]);
      expect(stderrData).toContain('GitHub Project Manager MCP server running on stdio');
      
      // Verify at least one valid MCP response was received
      expect(stdoutMessages.length).toBeGreaterThan(0);
      expect(receivedInitResponse).toBe(true);
      
      // Verify all stdout messages are valid MCP protocol messages
      for (const message of stdoutMessages) {
        expect(message).toHaveProperty('jsonrpc');
        expect(message.jsonrpc).toBe('2.0');
        // Should have either id (for responses) or method (for notifications)
        expect(message.id !== undefined || message.method !== undefined).toBe(true);
      }
    }, testTimeout);

    it('should handle list_tools request without stdout pollution', async () => {
      let stdoutData = '';
      let stderrData = '';
      let receivedInitResponse = false;
      let receivedToolsResponse = false;

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdoutData += chunk;
        
        // Check for responses
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === 1 && parsed.result) {
              receivedInitResponse = true;
            }
            if (parsed.id === 2 && parsed.result && parsed.result.tools) {
              receivedToolsResponse = true;
            }
          } catch (error) {
            // Ignore parse errors for this test
          }
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for server initialization
      await new Promise<void>((resolve) => {
        const checkStartup = () => {
          if (stderrData.includes('GitHub Project Manager MCP server running on stdio')) {
            resolve();
          } else {
            setTimeout(checkStartup, 100);
          }
        };
        setTimeout(checkStartup, 100);
        setTimeout(resolve, 5000);
      });

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };
      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      // Wait for init response
      await new Promise<void>((resolve) => {
        const checkResponse = () => {
          if (receivedInitResponse) {
            resolve();
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        setTimeout(checkResponse, 100);
        setTimeout(resolve, 3000);
      });

      // Send initialized notification
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Send list_tools request
      const listToolsRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      };
      serverProcess.stdin?.write(JSON.stringify(listToolsRequest) + '\n');

      // Wait for tools response
      await new Promise<void>((resolve) => {
        const checkResponse = () => {
          if (receivedToolsResponse) {
            resolve();
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        setTimeout(checkResponse, 100);
        setTimeout(resolve, 3000);
      });

      // Parse all stdout messages
      const stdoutLines = stdoutData.split('\n').filter((line: string) => line.trim());
      const validJsonMessages = stdoutLines.filter(line => {
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      });

      // Should have received valid JSON responses
      expect(validJsonMessages.length).toBeGreaterThan(0);
      
      // All stdout should be valid JSON (no log messages)
      expect(validJsonMessages.length).toBe(stdoutLines.length);
      
      // Stderr should contain initialization logs
      expect(stderrData).toContain('GitHub Project Manager MCP server running on stdio');
      
      // Should not contain any log messages in stdout
      expect(stdoutData).not.toContain('🤖 AI');
      expect(stdoutData).not.toContain('[MCP]');
      expect(stdoutData).not.toContain('GitHub Project Manager');
    }, testTimeout);

    it('should handle tool execution without stderr pollution in JSON responses', async () => {
      let responseMessages: any[] = [];
      let stderrData = '';

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            responseMessages.push(parsed);
          } catch (error) {
            // Ignore parse errors for this test
          }
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for server initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Initialize the server
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 500));

      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Call a tool (this might trigger AI service warnings)
      const callToolRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_milestone_metrics",
          arguments: {
            milestoneId: "test-milestone"
          }
        }
      };
      serverProcess.stdin?.write(JSON.stringify(callToolRequest) + '\n');

      // Wait for tool execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the tool response
      const toolResponse = responseMessages.find(msg => 
        msg.id === 3 && msg.jsonrpc === "2.0"
      );

      if (toolResponse) {
        // Verify the response doesn't contain log messages
        if (toolResponse.result) {
          const resultString = JSON.stringify(toolResponse.result);
          expect(resultString).not.toContain('🤖 AI');
          expect(resultString).not.toContain('[MCP]');
          expect(resultString).not.toContain('Warning:');
        }
      }

      // AI service warnings should be in stderr, not in the JSON response
      expect(stderrData).toContain('GitHub Project Manager MCP server running on stdio');
    }, testTimeout);
  });

  describe('Error Handling Protocol Compliance', () => {
    it('should return proper MCP error responses for invalid requests', async () => {
      let responseMessages: any[] = [];

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            responseMessages.push(parsed);
          } catch (error) {
            // Ignore parse errors for this test
          }
        }
      });

      // Wait for server initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send an invalid request (missing required fields)
      const invalidRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "invalid_tool",
          arguments: {}
        }
      };
      serverProcess.stdin?.write(JSON.stringify(invalidRequest) + '\n');

      // Wait for error response
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should receive an error response
      const errorResponse = responseMessages.find(msg => 
        msg.id === 1 && msg.error
      );

      expect(errorResponse).toBeDefined();
      expect(errorResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBeDefined();
      expect(errorResponse.error.message).toBeDefined();
    }, testTimeout);
  });

  describe('MCP Inspector Compatibility', () => {
    it('should be compatible with MCP Inspector connection flow', async () => {
      let initializeResponse: any = null;
      let toolsListResponse: any = null;

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdoutBuffer = '';
      serverProcess.stdout?.on('data', (data) => {
        stdoutBuffer += data.toString();

        // Try to extract complete JSON messages
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.id === 1 && parsed.result) {
                initializeResponse = parsed;
              } else if (parsed.id === 2 && parsed.result) {
                toolsListResponse = parsed;
              }
            } catch (error) {
              // For debugging: log parse errors for potential responses
              if (trimmed.includes('"jsonrpc"') || trimmed.includes('"result"')) {
                console.warn('JSON parse error for potential response:', trimmed.substring(0, 100) + '...');
              }
            }
          }
        }
      });

      // Wait for server startup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 1: Initialize (exactly like MCP Inspector would)
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {}
          },
          clientInfo: {
            name: "MCP Inspector",
            version: "1.0.0"
          }
        }
      }) + '\n');

      // Wait for initialize response with timeout
      await new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkResponse = () => {
          if (initializeResponse) {
            resolve(undefined);
          } else if (Date.now() - startTime > 10000) {
            reject(new Error('Timeout waiting for initialize response'));
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        checkResponse();
      });

      // Verify initialize response
      expect(initializeResponse).toBeDefined();
      expect(initializeResponse.jsonrpc).toBe('2.0');
      expect(initializeResponse.result).toBeDefined();
      expect(initializeResponse.result.capabilities).toBeDefined();

      // Step 2: Send initialized notification
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: List tools
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      }) + '\n');

      // Wait for tools response with timeout
      await new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkResponse = () => {
          if (toolsListResponse) {
            resolve(undefined);
          } else if (Date.now() - startTime > 10000) {
            // Before timing out, try to process any remaining buffer content
            if (stdoutBuffer.trim()) {
              try {
                const parsed = JSON.parse(stdoutBuffer.trim());
                if (parsed.id === 2 && parsed.result) {
                  toolsListResponse = parsed;
                  resolve(undefined);
                  return;
                }
              } catch (error) {
                console.warn('Failed to parse remaining buffer as JSON:', stdoutBuffer.substring(0, 200) + '...');
              }
            }
            reject(new Error('Timeout waiting for tools list response'));
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        checkResponse();
      });

      // Verify tools list response
      expect(toolsListResponse).toBeDefined();
      expect(toolsListResponse.result).toBeDefined();
      expect(toolsListResponse.result.tools).toBeDefined();
      expect(Array.isArray(toolsListResponse.result.tools)).toBe(true);
      expect(toolsListResponse.result.tools.length).toBeGreaterThan(0);

      // Verify tool structure matches MCP specification
      const firstTool = toolsListResponse.result.tools[0];
      expect(firstTool.name).toBeDefined();
      expect(firstTool.description).toBeDefined();
      expect(firstTool.inputSchema).toBeDefined();
    }, 30000); // Increase timeout for MCP Inspector test
  });
});
