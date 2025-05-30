const { spawn } = require('child_process');
const path = require('path');

// Simple debug script to test MCP communication
async function testMCPCommunication() {
  console.log('Starting MCP server debug test...');
  
  const serverPath = path.join(__dirname, 'build/index.js');
  
  const serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      GITHUB_TOKEN: 'test-token',
      GITHUB_OWNER: 'test-owner', 
      GITHUB_REPO: 'test-repo'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutData = '';
  let stderrData = '';
  let responseReceived = false;

  serverProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdoutData += chunk;
    console.log('STDOUT RECEIVED:', JSON.stringify(chunk));
    
    // Check if we got a JSON response
    try {
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim()) {
          const parsed = JSON.parse(line);
          console.log('VALID JSON RESPONSE:', parsed);
          responseReceived = true;
        }
      }
    } catch (e) {
      console.log('Non-JSON on stdout:', chunk);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderrData += chunk;
    console.log('STDERR RECEIVED:', JSON.stringify(chunk));
  });

  serverProcess.on('error', (error) => {
    process.stderr.write('Process error:', error);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log('Process exited with code:', code, 'signal:', signal);
  });

  // Wait for server startup
  console.log('Waiting for server startup...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Sending initialize request...');
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "debug-client",
        version: "1.0.0"
      }
    }
  };

  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  console.log('Sent:', JSON.stringify(initRequest));

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== RESULTS ===');
  console.log('Response received:', responseReceived);
  console.log('Stdout length:', stdoutData.length);
  console.log('Stderr length:', stderrData.length);
  console.log('Full stdout:', JSON.stringify(stdoutData));
  console.log('Full stderr (truncated):', JSON.stringify(stderrData.substring(0, 500)));

  serverProcess.kill('SIGTERM');
}

testMCPCommunication().catch(process.stderr.write);
