/**
 * Example: NodeJS Integration
 * 
 * This example demonstrates how to use the MCP GitHub Project Manager
 * as a module in a Node.js application.
 */

import { Server } from "../../build/index.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChildProcess, spawn } from "child_process";

// Example 1: Direct usage within the same process
async function directUsageExample() {
  console.log("🚀 Example 1: Direct usage");
  
  // Create an MCP server instance
  const server = new Server({
    transport: "stdio",
    config: {
      githubToken: process.env.GITHUB_TOKEN,
      githubOwner: process.env.GITHUB_OWNER,
      githubRepo: process.env.GITHUB_REPO
    }
  });
  
  // Start the server
  server.start();
  
  // Server is now running, but this approach doesn't allow interaction
  // from the same process since it's using stdio
  console.log("Server started but cannot be used in the same process with stdio transport");
}

// Example 2: Using as a child process
async function childProcessExample() {
  console.log("\n🚀 Example 2: Child process integration");
  
  // Start the server as a child process
  const serverProcess = spawn("node", ["../../build/index.js"], {
    env: {
      ...process.env,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITHUB_OWNER: process.env.GITHUB_OWNER,
      GITHUB_REPO: process.env.GITHUB_REPO
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  
  // Log server output for debugging
  serverProcess.stdout.on("data", (data) => {
    console.log(`Server stdout: ${data}`);
  });
  
  serverProcess.stderr.on("data", (data) => {
    process.stderr.write(`Server stderr: ${data}`);
  });
  
  // Wait for server to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create MCP client connected to the server process
  const client = new McpClient({
    transport: new StdioClientTransport(serverProcess.stdin, serverProcess.stdout)
  });
  
  try {
    // List available tools
    console.log("📝 Listing available tools...");
    const tools = await client.listTools();
    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => console.log(`- ${tool.name}: ${tool.description}`));
    
    // Create a project
    console.log("\n📝 Creating a sample project...");
    const projectResult = await client.callTool("create_project", {
      title: "Sample Integration Project",
      description: "A project created via Node.js integration example",
      visibility: "PRIVATE"
    });
    
    console.log("Project created successfully:");
    console.log(JSON.stringify(projectResult, null, 2));
    
  } catch (error) {
    process.stderr.write("❌ Error:", error);
  } finally {
    // Terminate the server process
    serverProcess.kill();
    console.log("Server process terminated");
  }
}

// Example 3: Using with HTTP transport
async function httpTransportExample() {
  console.log("\n🚀 Example 3: HTTP transport");
  console.log("Not implemented in this example - see documentation for HTTP setup");
}

// Run the examples
async function main() {
  console.log("=== MCP GitHub Project Manager Integration Examples ===\n");
  
  // Check for required environment variables
  if (!process.env.GITHUB_TOKEN) {
    process.stderr.write("❌ Error: GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }
  
  // Uncomment to run Example 1
  // await directUsageExample();
  
  // Run Example 2
  await childProcessExample();
  
  // Uncomment to run Example 3
  // await httpTransportExample();
}

main().catch(error => {
  process.stderr.write("❌ Unhandled error:", error);
  process.exit(1);
});
