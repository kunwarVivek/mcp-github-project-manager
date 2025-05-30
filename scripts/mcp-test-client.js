#!/usr/bin/env node

/**
 * MCP Test Client - CLI tool for testing all MCP server tools
 * 
 * This script provides a simple command-line interface to test all tools
 * provided by the MCP GitHub Project Manager server.
 * 
 * Usage:
 *   node scripts/mcp-test-client.js [command] [options]
 * 
 * Commands:
 *   list-tools          List all available tools
 *   test-tool <name>    Test a specific tool interactively
 *   test-all           Test all tools with sample data
 *   interactive        Interactive mode for testing tools
 * 
 * Environment Variables:
 *   GITHUB_TOKEN       GitHub personal access token (required)
 *   GITHUB_OWNER       GitHub repository owner (required)
 *   GITHUB_REPO        GitHub repository name (required)
 *   MCP_SERVER_PATH    Path to the MCP server executable (optional)
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  serverPath: process.env.MCP_SERVER_PATH || join(__dirname, '../build/index.js'),
  githubToken: process.env.GITHUB_TOKEN,
  githubOwner: process.env.GITHUB_OWNER,
  githubRepo: process.env.GITHUB_REPO,
  timeout: 30000, // 30 seconds timeout for tool calls
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// MCP Client class
class MCPTestClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.tools = [];
  }

  async start() {
    console.log(colorize('🚀 Starting MCP GitHub Project Manager server...', 'blue'));
    
    // Validate environment variables
    if (!CONFIG.githubToken || !CONFIG.githubOwner || !CONFIG.githubRepo) {
      throw new Error('Missing required environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
    }

    // Start server process
    this.serverProcess = spawn('node', [CONFIG.serverPath], {
      env: {
        ...process.env,
        GITHUB_TOKEN: CONFIG.githubToken,
        GITHUB_OWNER: CONFIG.githubOwner,
        GITHUB_REPO: CONFIG.githubRepo,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server output
    this.serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(colorize(`Server: ${message}`, 'yellow'));
      }
    });

    // Handle server responses with proper buffering
    let responseBuffer = '';
    this.serverProcess.stdout.on('data', (data) => {
      responseBuffer += data.toString();

      // Process complete JSON messages
      let newlineIndex;
      while ((newlineIndex = responseBuffer.indexOf('\n')) !== -1) {
        const line = responseBuffer.slice(0, newlineIndex).trim();
        responseBuffer = responseBuffer.slice(newlineIndex + 1);

        if (line) {
          try {
            const response = JSON.parse(line);
            this.handleResponse(response);
          } catch (error) {
            // Ignore non-JSON output
            console.log(colorize(`Non-JSON output: ${line.substring(0, 100)}...`, 'yellow'));
          }
        }
      }
    });

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initialize connection
    await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      }
    });

    console.log(colorize('✅ MCP server started successfully', 'green'));
  }

  async stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      console.log(colorize('🛑 MCP server stopped', 'yellow'));
    }
  }

  getNextId() {
    return ++this.requestId;
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout: ${request.method}`));
      }, CONFIG.timeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });
      
      const message = JSON.stringify(request) + '\n';
      this.serverProcess.stdin.write(message);
    });
  }

  handleResponse(response) {
    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(response.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        reject(new Error(`${response.error.code}: ${response.error.message}`));
      } else {
        resolve(response.result);
      }
    }
  }

  async listTools() {
    const result = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextId(),
      method: 'tools/list'
    });
    
    this.tools = result.tools || [];
    return this.tools;
  }

  async callTool(name, args = {}) {
    return await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    });
  }
}

// Function to get sample data with dynamic values
function getSampleData() {
  const githubOwner = CONFIG.githubOwner;
  const githubRepo = CONFIG.githubRepo;

  return {
    // Project tools
    create_project: {
      title: 'Test Project',
      shortDescription: 'A test project created by MCP test client',
      owner: githubOwner, // Use dynamic owner
      visibility: 'private'
    },
    // Milestone tools
    create_milestone: {
      title: 'Test Milestone',
      description: 'A test milestone for validation',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    },

    // Issue tools
    create_issue: {
      title: 'Test Issue',
      description: 'This is a test issue created by the MCP test client',
      labels: ['test', 'mcp-client']
    },

    // Sprint tools
    create_sprint: {
      title: 'Test Sprint',
      description: 'A test sprint for validation',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      issueIds: ['1', '2'] // Array of issue IDs
    },

    // Label tools
    create_label: {
      name: 'test-label',
      color: '0052cc',
      description: 'A test label created by MCP test client'
    },
    // Parse PRD tool
    parse_prd: {
      prdContent: `# Task Management App PRD

## Overview
Build a modern task management application for small teams.

## Features
- User authentication and authorization
- Task creation and management
- Real-time collaboration
- Mobile-responsive design
- Team workspace management

## Technical Requirements
- Web-based application
- Real-time updates using WebSockets
- RESTful API design
- Mobile-first responsive design`,
      maxTasks: 15,
      includeSubtasks: true,
      autoEstimate: true,
      autoPrioritize: true,
      autoDetectDependencies: true,
      createLifecycle: true,
      createTraceabilityMatrix: true,
      includeUseCases: true,
      enhancedGeneration: true,
      contextLevel: 'standard',
      includeBusinessContext: true,
      includeTechnicalContext: true,
      includeImplementationGuidance: true
    },

    // Analytics and metrics tools
    list_projects: {
      limit: 10,
      status: 'active'
    },

    list_milestones: {
      status: 'open',
      sort: 'due_date',
      direction: 'asc'
    },

    list_issues: {
      status: 'open',
      sort: 'updated',
      direction: 'desc',
      limit: 10
    },

    list_sprints: {
      status: 'active'
    },

    get_upcoming_milestones: {
      daysAhead: 30,
      limit: 5,
      includeIssues: true
    },

    get_overdue_milestones: {
      limit: 5,
      includeIssues: true
    },

    // AI task tools with more examples
    get_next_task: {
      teamSkills: ['typescript', 'react', 'node.js', 'postgresql'],
      sprintCapacity: 40,
      maxComplexity: 8,
      excludeBlocked: true,
      includeAnalysis: true,
      limit: 3
    },

    analyze_task_complexity: {
      taskTitle: 'Implement real-time notifications',
      taskDescription: 'Build a WebSocket-based notification system with push notifications, email fallback, and user preference management',
      currentEstimate: 16,
      teamExperience: 'mixed', // Fix enum value
      includeBreakdown: true,
      includeRisks: true,
      includeRecommendations: true
    },

    expand_task: {
      taskTitle: 'User authentication system',
      taskDescription: 'Implement complete user authentication with login, registration, password reset, and session management',
      currentComplexity: 8,
      maxSubtasks: 8,
      maxDepth: 3,
      targetComplexity: 5,
      includeEstimates: true,
      includeDependencies: true,
      includeAcceptanceCriteria: true
    },

    add_feature: {
      featureIdea: 'Real-time Chat System',
      description: 'Add real-time messaging capabilities to the application with support for text messages, file sharing, and user presence indicators',
      requestedBy: 'test-user',
      autoApprove: false,
      expandToTasks: true,
      createLifecycle: true
    },

    enhance_prd: {
      prdContent: `# Basic Task App PRD

## Overview
Simple task management app.

## Features
- Create tasks
- Mark as complete`,
      enhancementType: 'comprehensive',
      includeResearch: true,
      targetAudience: 'technical',
      addMissingElements: true,
      improveExisting: true,
      validateQuality: true
    },

    create_traceability_matrix: {
      projectId: 'test-project',
      prdContent: `# Task Management System PRD

## Business Requirements
- BR001: Users must be able to create and manage tasks
- BR002: System must support team collaboration
- BR003: Real-time updates are required

## Features
- User authentication
- Task CRUD operations
- Team workspaces
- Real-time notifications`,
      features: [],
      tasks: [],
      includeUseCases: true,
      includeTraceabilityLinks: true,
      includeCoverageAnalysis: true,
      validateCompleteness: true
    },

    // Generate PRD tool
    generate_prd: {
      projectIdea: 'A simple task management application with user authentication and real-time updates',
      projectName: 'TaskMaster Pro',
      complexity: 'medium',
      author: 'test-user',
      includeResearch: true
    },

    // Create roadmap tool
    create_roadmap: {
      project: {
        title: 'Test Roadmap Project',
        shortDescription: 'A test project for roadmap validation',
        owner: githubOwner, // Add required owner field
        visibility: 'private'
      },
      milestones: [
        {
          milestone: {
            title: 'Phase 1: Foundation',
            description: 'Basic setup and core features',
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
          },
          issues: [
            {
              title: 'Setup project structure',
              description: 'Initialize project with proper folder structure and configuration',
              priority: 'high',
              type: 'feature',
              assignees: [],
              labels: ['setup', 'foundation']
            },
            {
              title: 'Implement authentication',
              description: 'Add user authentication and authorization system',
              priority: 'high',
              type: 'feature',
              assignees: [],
              labels: ['auth', 'security']
            }
          ]
        }
      ]
    }
  };
}

// Command handlers
async function listToolsCommand(client) {
  console.log(colorize('\n📋 Available Tools:', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  
  const tools = await client.listTools();
  
  if (tools.length === 0) {
    console.log(colorize('No tools available', 'yellow'));
    return;
  }
  
  // Group tools by category
  const categories = {
    'Project Management': [],
    'Planning & Analytics': [],
    'AI Task Management': [],
    'Other': []
  };
  
  tools.forEach(tool => {
    if (tool.name.includes('project') || tool.name.includes('milestone') || 
        tool.name.includes('issue') || tool.name.includes('sprint')) {
      categories['Project Management'].push(tool);
    } else if (tool.name.includes('roadmap') || tool.name.includes('metrics') || 
               tool.name.includes('overdue') || tool.name.includes('upcoming')) {
      categories['Planning & Analytics'].push(tool);
    } else if (tool.name.includes('prd') || tool.name.includes('task') || 
               tool.name.includes('feature') || tool.name.includes('traceability')) {
      categories['AI Task Management'].push(tool);
    } else {
      categories['Other'].push(tool);
    }
  });
  
  Object.entries(categories).forEach(([category, categoryTools]) => {
    if (categoryTools.length > 0) {
      console.log(colorize(`\n${category}:`, 'magenta'));
      categoryTools.forEach(tool => {
        console.log(`  ${colorize(tool.name, 'green')} - ${tool.description}`);
      });
    }
  });
  
  console.log(colorize(`\nTotal: ${tools.length} tools`, 'blue'));
}

async function testToolCommand(client, toolName) {
  console.log(colorize(`\n🔧 Testing tool: ${toolName}`, 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));

  const tools = await client.listTools();
  const tool = tools.find(t => t.name === toolName);

  if (!tool) {
    console.log(colorize(`❌ Tool '${toolName}' not found`, 'red'));
    return;
  }

  console.log(colorize(`Description: ${tool.description}`, 'blue'));

  // Check if we have sample data for this tool
  const sampleData = getSampleData();
  const sampleArgs = sampleData[toolName];

  if (sampleArgs) {
    console.log(colorize('\n📝 Using sample data:', 'yellow'));
    console.log(JSON.stringify(sampleArgs, null, 2));

    try {
      const result = await client.callTool(toolName, sampleArgs);
      console.log(colorize('\n✅ Tool executed successfully:', 'green'));
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(colorize(`\n❌ Tool execution failed: ${error.message}`, 'red'));
    }
  } else {
    console.log(colorize('\n⚠️  No sample data available for this tool', 'yellow'));
    console.log(colorize('Tool schema:', 'blue'));
    if (tool.inputSchema) {
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }
  }
}

async function testAllCommand(client) {
  console.log(colorize('\n🧪 Testing All Tools', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));

  const tools = await client.listTools();
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };

  const sampleData = getSampleData();

  for (const tool of tools) {
    const sampleArgs = sampleData[tool.name];

    if (!sampleArgs) {
      console.log(colorize(`⏭️  Skipping ${tool.name} (no sample data)`, 'yellow'));
      results.skipped.push(tool.name);
      continue;
    }

    console.log(colorize(`\n🔧 Testing ${tool.name}...`, 'blue'));

    try {
      const result = await client.callTool(tool.name, sampleArgs);
      console.log(colorize(`✅ ${tool.name} - PASSED`, 'green'));
      results.passed.push(tool.name);
    } catch (error) {
      console.log(colorize(`❌ ${tool.name} - FAILED: ${error.message}`, 'red'));
      results.failed.push({ name: tool.name, error: error.message });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  console.log(colorize('\n📊 Test Summary', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  console.log(colorize(`✅ Passed: ${results.passed.length}`, 'green'));
  console.log(colorize(`❌ Failed: ${results.failed.length}`, 'red'));
  console.log(colorize(`⏭️  Skipped: ${results.skipped.length}`, 'yellow'));

  if (results.failed.length > 0) {
    console.log(colorize('\nFailed Tests:', 'red'));
    results.failed.forEach(failure => {
      console.log(`  - ${failure.name}: ${failure.error}`);
    });
  }

  if (results.skipped.length > 0) {
    console.log(colorize('\nSkipped Tests (no sample data):', 'yellow'));
    results.skipped.forEach(name => {
      console.log(`  - ${name}`);
    });
  }
}

async function interactiveMode(client) {
  console.log(colorize('\n🎮 Interactive Mode', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  console.log('Type "help" for available commands, "exit" to quit');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const tools = await client.listTools();

  while (true) {
    const input = await new Promise(resolve => {
      rl.question(colorize('\n> ', 'cyan'), resolve);
    });

    const [command, ...args] = input.trim().split(' ');

    switch (command.toLowerCase()) {
      case 'help':
        console.log(colorize('\nAvailable commands:', 'blue'));
        console.log('  help                 - Show this help message');
        console.log('  list                 - List all available tools');
        console.log('  test <tool-name>     - Test a specific tool');
        console.log('  call <tool-name>     - Call a tool with custom arguments');
        console.log('  schema <tool-name>   - Show tool schema');
        console.log('  exit                 - Exit interactive mode');
        break;

      case 'list':
        tools.forEach(tool => {
          console.log(`  ${colorize(tool.name, 'green')} - ${tool.description}`);
        });
        break;

      case 'test':
        if (args.length === 0) {
          console.log(colorize('Usage: test <tool-name>', 'yellow'));
          break;
        }
        await testToolCommand(client, args[0]);
        break;

      case 'call':
        if (args.length === 0) {
          console.log(colorize('Usage: call <tool-name>', 'yellow'));
          break;
        }
        await callToolInteractive(client, args[0], rl);
        break;

      case 'schema':
        if (args.length === 0) {
          console.log(colorize('Usage: schema <tool-name>', 'yellow'));
          break;
        }
        const tool = tools.find(t => t.name === args[0]);
        if (tool) {
          console.log(JSON.stringify(tool.inputSchema, null, 2));
        } else {
          console.log(colorize(`Tool '${args[0]}' not found`, 'red'));
        }
        break;

      case 'exit':
        rl.close();
        return;

      default:
        if (command) {
          console.log(colorize(`Unknown command: ${command}`, 'red'));
          console.log('Type "help" for available commands');
        }
    }
  }
}

async function callToolInteractive(client, toolName, rl) {
  const tools = await client.listTools();
  const tool = tools.find(t => t.name === toolName);

  if (!tool) {
    console.log(colorize(`Tool '${toolName}' not found`, 'red'));
    return;
  }

  console.log(colorize(`\nCalling tool: ${toolName}`, 'blue'));
  console.log('Enter arguments as JSON (or press Enter for empty object):');

  const argsInput = await new Promise(resolve => {
    rl.question('Arguments: ', resolve);
  });

  let args = {};
  if (argsInput.trim()) {
    try {
      args = JSON.parse(argsInput);
    } catch (error) {
      console.log(colorize(`Invalid JSON: ${error.message}`, 'red'));
      return;
    }
  }

  try {
    const result = await client.callTool(toolName, args);
    console.log(colorize('\n✅ Result:', 'green'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(colorize(`\n❌ Error: ${error.message}`, 'red'));
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Show help if no command provided
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Validate environment variables
  if (!CONFIG.githubToken || !CONFIG.githubOwner || !CONFIG.githubRepo) {
    console.log(colorize('❌ Error: Missing required environment variables', 'red'));
    console.log('Please set the following environment variables:');
    console.log('  GITHUB_TOKEN  - Your GitHub personal access token');
    console.log('  GITHUB_OWNER  - GitHub repository owner');
    console.log('  GITHUB_REPO   - GitHub repository name');
    console.log('\nExample:');
    console.log('  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx');
    console.log('  export GITHUB_OWNER=myusername');
    console.log('  export GITHUB_REPO=myrepo');
    process.exit(1);
  }

  const client = new MCPTestClient();

  try {
    await client.start();

    switch (command) {
      case 'list-tools':
        await listToolsCommand(client);
        break;

      case 'test-tool':
        if (args.length < 2) {
          console.log(colorize('❌ Error: Tool name required', 'red'));
          console.log('Usage: node scripts/mcp-test-client.js test-tool <tool-name>');
          process.exit(1);
        }
        await testToolCommand(client, args[1]);
        break;

      case 'test-all':
        await testAllCommand(client);
        break;

      case 'interactive':
        await interactiveMode(client);
        break;

      default:
        console.log(colorize(`❌ Unknown command: ${command}`, 'red'));
        showHelp();
        process.exit(1);
    }

  } catch (error) {
    console.log(colorize(`❌ Fatal error: ${error.message}`, 'red'));
    process.exit(1);
  } finally {
    await client.stop();
  }
}

function showHelp() {
  console.log(colorize('MCP Test Client - CLI tool for testing MCP GitHub Project Manager', 'cyan'));
  console.log(colorize('=' .repeat(70), 'cyan'));
  console.log('\nUsage:');
  console.log('  node scripts/mcp-test-client.js <command> [options]');
  console.log('\nCommands:');
  console.log(colorize('  list-tools', 'green') + '          List all available tools with descriptions');
  console.log(colorize('  test-tool <name>', 'green') + '    Test a specific tool with sample data');
  console.log(colorize('  test-all', 'green') + '            Test all tools with sample data');
  console.log(colorize('  interactive', 'green') + '         Enter interactive mode for manual testing');
  console.log(colorize('  help', 'green') + '               Show this help message');
  console.log('\nEnvironment Variables (Required):');
  console.log('  GITHUB_TOKEN       GitHub personal access token');
  console.log('  GITHUB_OWNER       GitHub repository owner');
  console.log('  GITHUB_REPO        GitHub repository name');
  console.log('\nOptional Environment Variables:');
  console.log('  MCP_SERVER_PATH    Path to MCP server executable (default: ../build/index.js)');
  console.log('\nExamples:');
  console.log('  # List all available tools');
  console.log('  node scripts/mcp-test-client.js list-tools');
  console.log('');
  console.log('  # Test a specific tool');
  console.log('  node scripts/mcp-test-client.js test-tool create_project');
  console.log('');
  console.log('  # Test all tools');
  console.log('  node scripts/mcp-test-client.js test-all');
  console.log('');
  console.log('  # Interactive mode');
  console.log('  node scripts/mcp-test-client.js interactive');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Goodbye!', 'yellow'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n👋 Goodbye!', 'yellow'));
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.log(colorize(`❌ Unhandled error: ${error.message}`, 'red'));
  console.error(error.stack);
  process.exit(1);
});
