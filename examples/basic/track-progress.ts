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
 * 3. Run: pnpm exec tsx examples/basic/track-progress.ts
 */

import dotenv from "dotenv";
import { createProjectManagementService } from "../../src/container.js";

// Load environment variables
dotenv.config();

// Validate environment variables
const requiredEnvVars = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    process.stderr.write(`Error: ${envVar} environment variable is required`);
    process.exit(1);
  }
}

async function trackSprintProgress() {
  try {
    // Initialize the service
    const service = createProjectManagementService(
      process.env.GITHUB_OWNER ?? "",
      process.env.GITHUB_REPO ?? "",
      process.env.GITHUB_TOKEN ?? ""
    );

    console.log("Tracking sprint progress...");

    // Replace this with your actual sprint ID from plan-sprint.ts
    const sprintId = "sprint_1";

    // Get sprint metrics with detailed issue information
    const metrics = await service.getSprintMetrics(sprintId, true);

    console.log("Sprint Metrics:");
    console.log("Sprint Title:", metrics.title);
    console.log("Sprint Status:", metrics.status);
    console.log("Start Date:", new Date(metrics.startDate).toLocaleDateString());
    console.log("End Date:", new Date(metrics.endDate).toLocaleDateString());

    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(metrics.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    console.log("Days Remaining:", daysRemaining > 0 ? daysRemaining : "Sprint ended");
    const completionPercentage =
      metrics.totalIssues > 0
        ? Math.round((metrics.completedIssues / metrics.totalIssues) * 100)
        : 0;
    console.log("Progress:", `${completionPercentage}%`);
    console.log("Total Issues:", metrics.totalIssues);
    console.log("Completed Issues:", metrics.completedIssues);

    // Display detailed issue information
    if (metrics.issues && metrics.issues.length > 0) {
      console.log("\nIssues:");
      metrics.issues.forEach((issue) => {
        console.log(`- #${issue.number} ${issue.title} (${issue.status})`);
        console.log(`  Labels: ${issue.labels.join(", ") || "none"}`);
      });
    }

    // Print detailed information
    console.log("\nDetailed Information:");
    console.log(JSON.stringify(metrics, null, 2));

    return metrics;
  } catch (error) {
    process.stderr.write("Error tracking sprint progress:");
    if (error instanceof Error) {
      process.stderr.write(`${error.name}: ${error.message}`);
      process.stderr.write(error.stack ?? "");
    } else {
      process.stderr.write(String(error));
    }
    process.exit(1);
  }
}

// Run the example
trackSprintProgress();
