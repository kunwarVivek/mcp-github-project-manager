/**
 * Basic Example: Create a Simple Project
 * 
 * This example demonstrates how to create a basic project with a single milestone
 * and a few issues using the GitHub Project Manager MCP Server.
 * 
 * Prerequisites:
 * 1. GitHub Project Manager MCP Server running
 * 2. Valid GitHub token with appropriate permissions
 * 
 * Usage:
 * 1. Set environment variables (see .env.example)
 * 2. Run: ts-node examples/basic/create-simple-project.ts
 */

import { ProjectManagementService } from '../../src/services/ProjectManagementService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    process.stderr.write(`Error: ${envVar} environment variable is required`);
    process.exit(1);
  }
}

async function createSimpleProject() {
  try {
    // Initialize the service
    const service = new ProjectManagementService(
      process.env.GITHUB_OWNER!,
      process.env.GITHUB_REPO!,
      process.env.GITHUB_TOKEN!
    );

    console.log('Creating a simple project...');
    
    // Create a project with one milestone and two issues
    const result = await service.createRoadmap({
      project: {
        title: "Sample Project",
        shortDescription: "A sample project created via the MCP API",
        owner: process.env.GITHUB_OWNER!,
        visibility: "private"
      },
      milestones: [
        {
          milestone: {
            title: "Initial Release",
            description: "First version of the product",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
          },
          issues: [
            {
              title: "Setup project structure",
              description: "Create initial project structure and configuration",
              assignees: [],
              labels: ["setup"]
            },
            {
              title: "Implement core functionality",
              description: "Develop the core features of the application",
              assignees: [],
              labels: ["core"]
            }
          ]
        }
      ]
    });

    console.log('Project created successfully!');
    console.log('Project ID:', result.project.id);
    console.log('Project Title:', result.project.title);
    console.log('Milestone Count:', result.milestones.length);
    console.log('Issue Count:', result.milestones[0].issues.length);
    
    // Print detailed information
    console.log('\nDetailed Information:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    process.stderr.write('Error creating project:');
    if (error instanceof Error) {
      process.stderr.write(`${error.name}: ${error.message}`);
      process.stderr.write(error.stack);
    } else {
      process.stderr.write(error);
    }
    process.exit(1);
  }
}

// Run the example
createSimpleProject();
