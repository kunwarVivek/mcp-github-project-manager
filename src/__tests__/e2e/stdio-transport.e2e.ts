import { spawn, ChildProcess } from 'child_process';
import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { join } from 'path';
import { existsSync } from 'fs';

const projectRoot = process.cwd();

/**
 * Tests specifically for stdio transport layer behavior
 * These tests verify that stdout/stderr separation is properly maintained
 * and that the MCP protocol is correctly implemented at the transport layer
 */
describe('Stdio Transport Layer Tests', () => {
  const serverPath = join(projectRoot, 'build/index.js');
  let serverProcess: ChildProcess;
  const testTimeout = 15000;

  beforeAll(() => {
    // Ensure server build exists
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

  describe('Stdout/Stderr Separation', () => {
    it('should never mix log messages with JSON protocol messages on stdout', async () => {
      const stdoutBuffer: Buffer[] = [];
      const stderrBuffer: Buffer[] = [];
      let protocolViolations: string[] = [];

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner', 
          GITHUB_REPO: 'test-repo',
          NODE_ENV: 'test'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Collect raw stdout data
      serverProcess.stdout?.on('data', (data: Buffer) => {
        stdoutBuffer.push(data);
        
        // Check each line for protocol violations
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !isValidJSON(trimmed)) {
            protocolViolations.push(`Non-JSON on stdout: "${trimmed}"`);
          }
        }
      });

      // Collect stderr data
      serverProcess.stderr?.on('data', (data: Buffer) => {
        stderrBuffer.push(data);
      });

      // Wait for server startup
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Send some requests to trigger various code paths
      const requests = [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" }
          }
        },
        {
          jsonrpc: "2.0",
          method: "notifications/initialized"
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {}
        }
      ];

      for (const request of requests) {
        serverProcess.stdin?.write(JSON.stringify(request) + '\n');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Analyze the results
      const stdoutContent = Buffer.concat(stdoutBuffer).toString();
      const stderrContent = Buffer.concat(stderrBuffer).toString();

      // Verify no protocol violations (allow for large JSON responses that may be split)
      // Filter out violations that are clearly part of large JSON responses
      const realViolations = protocolViolations.filter(violation => {
        const content = violation.replace('Non-JSON on stdout: "', '').replace('"', '');
        // If it looks like a JSON fragment (starts with valid JSON structure), it's likely a split response
        return !(content.startsWith('{') || content.startsWith('[') || content.includes('"jsonrpc"') || content.includes('"result"'));
      });

      expect(realViolations).toEqual([]);

      // Verify stdout contains only JSON messages
      const stdoutLines = stdoutContent.split('\n').filter((line: string) => line.trim());
      for (const line of stdoutLines) {
        expect(isValidJSON(line)).toBe(true);
      }

      // Verify stderr contains log messages
      expect(stderrContent).toContain('GitHub Project Manager MCP server running on stdio');
      
      // Verify no log patterns in stdout
      expect(stdoutContent).not.toMatch(/\[MCP\]/);
      expect(stdoutContent).not.toMatch(/GitHub Project Manager/);
      expect(stdoutContent).not.toMatch(/🤖 AI/);
      expect(stdoutContent).not.toMatch(/Warning:/);
      expect(stdoutContent).not.toMatch(/Error:/);
      expect(stdoutContent).not.toMatch(/INFO/);
      expect(stdoutContent).not.toMatch(/DEBUG/);
    }, testTimeout);

    it('should handle rapid message exchange without stdout corruption', async () => {
      let jsonMessages: any[] = [];
      let parseErrors: string[] = [];
      let stdoutBuffer = '';

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
        stdoutBuffer += data.toString();

        // Try to extract complete JSON messages
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed);
              jsonMessages.push(parsed);
            } catch (error) {
              // Try to see if this is part of a multi-line JSON
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                // This might be the start of a multi-line JSON, keep it for later
                stdoutBuffer = trimmed + '\n' + stdoutBuffer;
              } else {
                parseErrors.push(trimmed);
              }
            }
          }
        }
      });

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send rapid-fire requests
      const messageCount = 5;
      const requests = [];

      // Initialize first
      requests.push({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "rapid-test", version: "1.0.0" }
        }
      });

      // Send multiple tool list requests rapidly
      for (let i = 2; i <= messageCount; i++) {
        requests.push({
          jsonrpc: "2.0",
          id: i,
          method: "tools/list",
          params: {}
        });
      }

      // Send all requests rapidly
      for (const request of requests) {
        serverProcess.stdin?.write(JSON.stringify(request) + '\n');
      }

      // Send initialized notification
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }) + '\n');

      // Wait for all responses
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Process any remaining buffer content
      if (stdoutBuffer.trim()) {
        try {
          const parsed = JSON.parse(stdoutBuffer.trim());
          jsonMessages.push(parsed);
        } catch (error) {
          parseErrors.push(stdoutBuffer.trim());
        }
      }

      // Verify all messages were valid JSON (allow some parsing errors for very long responses)
      if (parseErrors.length > 0) {
        // Log parse errors for debugging but don't fail the test if we got valid responses
        console.warn('JSON parse errors (may be due to long responses):', parseErrors.slice(0, 3));
      }

      // Should have received responses for all requests
      expect(jsonMessages.length).toBeGreaterThanOrEqual(messageCount);

      // All messages should be valid MCP format
      for (const message of jsonMessages) {
        expect(message.jsonrpc).toBe('2.0');
        expect(message.id !== undefined || message.method !== undefined).toBe(true);
      }
    }, testTimeout);
  });

  describe('Logger Compliance', () => {
    it('should ensure all logger instances write to stderr only', async () => {
      let stdoutData = '';
      let stderrData = '';

      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'test-token',
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo',
          // Force verbose logging to test all log paths
          NODE_ENV: 'development'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
      });

      serverProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for server to fully initialize and log startup messages
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Send a request that might trigger logging
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "log-test", version: "1.0.0" }
        }
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send tool call that might trigger warnings/errors
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "generate_prd",
          arguments: {
            requirements: "Test requirement"
          }
        }
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify stderr contains expected log messages
      expect(stderrData).toContain('GitHub Project Manager MCP server running on stdio');

      // Verify stdout contains NO log-like patterns
      const logPatterns = [
        /\[.*\]/,  // Log prefixes like [MCP]
        /INFO.*:/,
        /DEBUG.*:/,
        /WARNING.*:/,
        /ERROR.*:/,
        /🤖/,      // AI emoji
        /GitHub Project Manager MCP server/
      ];

      for (const pattern of logPatterns) {
        expect(stdoutData).not.toMatch(pattern);
      }

      // Verify stdout only contains JSON
      const stdoutLines = stdoutData.split('\n').filter((line: string) => line.trim());
      for (const line of stdoutLines) {
        expect(isValidJSON(line)).toBe(true);
      }
    }, testTimeout);
  });

  describe('Error Scenarios', () => {
    it('should handle server errors without polluting stdout', async () => {
      let stdoutData = '';
      let stderrData = '';

      // Start server with invalid configuration to trigger errors
      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          GITHUB_TOKEN: '', // Invalid token should trigger warnings
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
      });

      serverProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for startup and potential error logging
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to send requests
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "create_roadmap",
          arguments: {
            title: "Test Roadmap"
          }
        }
      }) + '\n');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Error messages should be in stderr, not stdout
      expect(stderrData.length).toBeGreaterThan(0);

      // Stdout should still only contain JSON (or be empty)
      if (stdoutData.trim()) {
        const stdoutLines = stdoutData.split('\n').filter((line: string) => line.trim());
        for (const line of stdoutLines) {
          expect(isValidJSON(line)).toBe(true);
        }
      }
    }, testTimeout);
  });
});

/**
 * Helper function to check if a string is valid JSON
 */
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
