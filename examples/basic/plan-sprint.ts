/**
 * Basic Example: Plan a Sprint
 * 
 * This example demonstrates how to plan a sprint with existing issues
 * using the GitHub Project Manager MCP Server.
 * 
 * Prerequisites:
 * 1. GitHub Project Manager MCP Server running
 * 2. Valid GitHub token with appropriate permissions
 * 3. Existing issues in your repository
 * 
 * Usage:
 * 1. Set environment variables (see .env.example)
 * 2. Update the issueIds array with your actual issue IDs
 * 3. Run: ts-node examples/basic/plan-sprint.ts
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

async function planSprint() {
  try {
    // Initialize the service
    const service = new ProjectManagementService(
      process.env.GITHUB_OWNER!,
      process.env.GITHUB_REPO!,
      process.env.GITHUB_TOKEN!
    );

    console.log('Planning a sprint...');
    
    // Replace these with your actual issue IDs
    // You can get these from the result of create-simple-project.ts
    // or from existing issues in your repository
    const issueIds = [1, 2, 3];
    
    // Calculate sprint dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 14); // 2-week sprint
    
    // Plan a sprint with the specified issues
    const result = await service.planSprint({
      sprint: {
        title: "Sprint 1: Project Setup",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        goals: [
          "Complete initial project setup",
          "Implement core functionality"
        ]
      },
      issueIds: issueIds
    });

    console.log('Sprint planned successfully!');
    console.log('Sprint ID:', result.id);
    console.log('Sprint Title:', result.title);
    console.log('Sprint Start:', new Date(result.startDate).toLocaleDateString());
    console.log('Sprint End:', new Date(result.endDate).toLocaleDateString());
    console.log('Sprint Goals:', result.goals);
    console.log('Issues:', result.issues);
    
    // Print detailed information
    console.log('\nDetailed Information:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    process.stderr.write('Error planning sprint:');
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
planSprint();
