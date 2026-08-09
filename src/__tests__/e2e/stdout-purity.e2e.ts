import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SERVER = resolve(process.cwd(), 'build/index.js');

const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'stdout-purity-probe', version: '1' },
  },
});

/**
 * A stdio MCP server speaks JSON-RPC over stdout. ANY other stdout write —
 * a stray console.log, or a dependency's startup banner — corrupts the stream
 * and drops the client before it can handshake.
 *
 * Two real regressions this guards:
 *   - GitHubSprintRepository.delete() used console.log.
 *   - dotenv v17 prints an "injected env" banner to stdout by default.
 */
describe('stdio transport: stdout purity', () => {
  it.runIf(existsSync(SERVER))('emits only JSON-RPC on stdout', async () => {
    const child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        // stdio suites don't test webhooks; without this every spawned
        // server binds WEBHOOK_PORT 3001 and parallel files collide.
        SSE_ENABLED: 'false',
        NODE_ENV: 'production',
        GITHUB_OWNER: 'probe-owner',
        GITHUB_REPO: 'probe-repo',
        GITHUB_TOKEN: 'ghp_probe',
        GH_CLI_TOKEN_FALLBACK: 'false',
      },
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let stdout = '';
    const firstResponse = new Promise<void>((done) => {
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
        if (stdout.includes('\n')) done();
      });
      child.on('exit', () => done());
    });

    child.stdin.write(`${INITIALIZE}\n`);
    await firstResponse;
    child.kill();

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      expect(
        () => JSON.parse(line),
        `non-JSON on stdout would corrupt the protocol stream: ${line}`
      ).not.toThrow();
    }
  }, 15_000);
});
