#!/usr/bin/env node

/**
 * Simple MCP Test - Minimal test to verify MCP communication
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  serverPath: join(__dirname, '../build/index.js'),
  githubToken: process.env.GITHUB_TOKEN || 'test-token',
  githubOwner: process.env.GITHUB_OWNER || 'test-owner',
  githubRepo: process.env.GITHUB_REPO || 'test-repo',
  timeout: 10000, // 10 seconds
};

console.log('🧪 Simple MCP Test');
console.log('==================');

async function testMCPConnection() {
  console.log('🚀 Starting MCP server...');
  
  // Start server process
  const serverProcess = spawn('node', [CONFIG.serverPath], {
    env: {
      ...process.env,
      GITHUB_TOKEN: CONFIG.githubToken,
      GITHUB_OWNER: CONFIG.githubOwner,
      GITHUB_REPO: CONFIG.githubRepo,
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverOutput = '';
  let serverErrors = '';

  // Collect server output
  serverProcess.stdout.on('data', (data) => {
    serverOutput += data.toString();
    console.log('📤 Server stdout:', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    serverErrors += data.toString();
    console.log('📤 Server stderr:', data.toString().trim());
  });

  // Wait for server to start
  console.log('⏳ Waiting for server to initialize...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('📨 Sending initialize request...');
  
  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'simple-test-client',
        version: '1.0.0'
      }
    }
  };

  const message = JSON.stringify(initRequest) + '\n';
  console.log('📨 Sending:', message.trim());
  
  serverProcess.stdin.write(message);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📨 Sending tools/list request...');
  
  // Send tools/list request
  const listRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };

  const listMessage = JSON.stringify(listRequest) + '\n';
  console.log('📨 Sending:', listMessage.trim());
  
  serverProcess.stdin.write(listMessage);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('Server Output Length:', serverOutput.length);
  console.log('Server Errors Length:', serverErrors.length);
  
  if (serverOutput.includes('jsonrpc')) {
    console.log('✅ JSON-RPC responses detected');
  } else {
    console.log('❌ No JSON-RPC responses detected');
  }

  // Kill server
  serverProcess.kill();
  console.log('🛑 Server stopped');
}

// Run test
testMCPConnection().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
