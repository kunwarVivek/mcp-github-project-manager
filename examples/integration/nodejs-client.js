/**
 * Example: NodeJS Integration
 *
 * Demonstrates driving the MCP GitHub Project Manager with the MCP v2 client
 * SDK (`@modelcontextprotocol/client`).
 *
 * The server speaks MCP over stdio, so the client spawns it as a child
 * process and talks JSON-RPC over the child's stdin/stdout.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, "../../build/index.js");

/**
 * Example 1: spawn the server and list its tools.
 *
 * Note there is no in-process "server object" to construct: the server's
 * entrypoint boots its own stdio transport, so a client always talks to it
 * as a child process (or over HTTP/SSE when those are enabled).
 */
async function listToolsExample() {
  console.log("🚀 Example 1: connect and list tools");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      ...process.env,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITHUB_OWNER: process.env.GITHUB_OWNER,
      GITHUB_REPO: process.env.GITHUB_REPO,
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "nodejs-client-example", version: "1.0.0" });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    console.log(`Found ${tools.length} compound tools:`);
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description?.slice(0, 80) ?? ""}`);
    }

    // Example 2: call a compound tool. The MCP surface is 20 compound tools
    // that route on an `action` field — the granular tool names are internal.
    console.log("\n📝 Creating a sample project...");
    const projectResult = await client.callTool({
      name: "manage_project",
      arguments: {
        action: "create",
        title: "Sample Integration Project",
        description: "A project created via Node.js integration example",
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
      },
    });

    console.log("Project created successfully:");
    console.log(JSON.stringify(projectResult, null, 2));
  } finally {
    await client.close();
  }
}

/**
 * Example 3: discover the action surface of a domain.
 */
async function discoverToolsExample() {
  console.log("\n🚀 Example 3: discover_tools");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: { ...process.env },
    stderr: "pipe",
  });

  const client = new Client({ name: "nodejs-client-example", version: "1.0.0" });

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "discover_tools",
      arguments: { domain: "ai_analysis" },
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

// Run the examples
async function main() {
  console.log("=== MCP GitHub Project Manager Integration Examples ===\n");

  // Check for required environment variables
  if (!process.env.GITHUB_TOKEN) {
    process.stderr.write("❌ Error: GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  await listToolsExample();
  await discoverToolsExample();
}

main().catch((error) => {
  process.stderr.write("❌ Unhandled error:", error);
  process.exit(1);
});
