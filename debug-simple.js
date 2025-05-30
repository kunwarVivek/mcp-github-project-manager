const { spawn } = require('child_process');
const path = require('path');

// Simpler test with better error handling
async function testServerBasic() {
  console.log('Testing basic MCP server communication...');
  
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

  let hasResponded = false;
  let responseData = '';

  serverProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    responseData += chunk;
    console.log('Got stdout:', JSON.stringify(chunk));
    hasResponded = true;
  });

  serverProcess.stderr.on('data', (data) => {
    console.log('Got stderr:', data.toString().substring(0, 200) + '...');
  });

  serverProcess.on('error', (error) => {
    process.stderr.write('Process error:', error);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log('Process exited:', code, signal);
  });

  // Wait for server to be ready
  console.log('Waiting for server startup...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Send MCP request
  console.log('Sending MCP request...');
  const request = JSON.stringify({
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
  }) + '\n';

  console.log('Request:', request);
  serverProcess.stdin.write(request);

  // Wait for response  
  console.log('Waiting for response...');
  for (let i = 0; i < 20; i++) { // Wait up to 10 seconds
    if (hasResponded) break;
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Waiting... ${i + 1}/20`);
  }

  console.log('Has responded:', hasResponded);
  console.log('Response data:', responseData);

  // Cleanup
  serverProcess.kill();
  
  return hasResponded;
}

testServerBasic()
  .then(result => {
    console.log('Test result:', result ? 'SUCCESS' : 'FAILED');
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    process.stderr.write('Test error:', error);
    process.exit(1);
  });
