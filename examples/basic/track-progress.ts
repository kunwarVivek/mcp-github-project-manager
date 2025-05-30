/**
 * Basic Example: Track Sprint Progress
 * 
 * This example demonstrates how to track the progress of a sprint
 * using the GitHub Project Manager MCP Server.
 * 
 * Prerequisites:
 * 1. GitHub Project Manager MCP Server running
 * 2. Valid GitHub token with appropriate permissions
 * 3. Existing sprint created with plan-sprint.ts
 * 
 * Usage:
 * 1. Set environment variables (see .env.example)
 * 2. Update the sprintId variable with your actual sprint ID
 * 3. Run: ts-node examples/basic/track-progress.ts
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

async function trackSprintProgress() {
  try {
    // Initialize the service
    const service = new ProjectManagementService(
      process.env.GITHUB_OWNER!,
      process.env.GITHUB_REPO!,
      process.env.GITHUB_TOKEN!
    );

    console.log('Tracking sprint progress...');
    
    // Replace this with your actual sprint ID from plan-sprint.ts
    const sprintId = "sprint_1";
    
    // Get sprint metrics with detailed issue information
    const metrics = await service.getSprintMetrics(sprintId, true);

    console.log('Sprint Metrics:');
    console.log('Sprint Title:', metrics.sprint.title);
    console.log('Sprint Status:', metrics.sprint.status);
    console.log('Start Date:', new Date(metrics.sprint.startDate).toLocaleDateString());
    console.log('End Date:', new Date(metrics.sprint.endDate).toLocaleDateString());
    
    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(metrics.sprint.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('Days Remaining:', daysRemaining > 0 ? daysRemaining : 'Sprint ended');
    console.log('Progress:', `${metrics.progress.completionPercentage}%`);
    console.log('Open Issues:', metrics.progress.openIssues);
    console.log('Closed Issues:', metrics.progress.closedIssues);
    
    // Display issue breakdown
    console.log('\nIssue Breakdown:');
    console.log('By Type:');
    Object.entries(metrics.issueBreakdown.byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    
    console.log('By Priority:');
    Object.entries(metrics.issueBreakdown.byPriority).forEach(([priority, count]) => {
      console.log(`  - ${priority}: ${count}`);
    });
    
    // Display detailed issue information
    if (metrics.issues && metrics.issues.length > 0) {
      console.log('\nIssues:');
      metrics.issues.forEach(issue => {
        console.log(`- ${issue.title} (${issue.status})`);
        console.log(`  Type: ${issue.type}, Priority: ${issue.priority}`);
      });
    }
    
    // Print detailed information
    console.log('\nDetailed Information:');
    console.log(JSON.stringify(metrics, null, 2));
    
    return metrics;
  } catch (error) {
    process.stderr.write('Error tracking sprint progress:');
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
trackSprintProgress();
