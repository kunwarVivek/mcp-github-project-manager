# Getting Started with GitHub Project Manager MCP

This tutorial will guide you through the process of setting up and using the GitHub Project Manager MCP Server for basic project management tasks.

## Prerequisites

Before you begin, make sure you have:

- Node.js 18.x or higher installed
- A GitHub account with appropriate permissions
- A GitHub Personal Access Token with required scopes:
  - `repo` (Full repository access)
  - `project` (Project access)
  - `write:org` (Organization access)

## Step 1: Installation and Setup

First, let's install and configure the server:

```bash
# Clone the repository
git clone https://github.com/your-org/github-project-manager-mcp.git
cd github-project-manager-mcp

# Install dependencies
npm install
# or
pnpm install

# Create environment configuration
cp .env.example .env
```

Now, edit the `.env` file with your GitHub credentials:

```env
GITHUB_TOKEN=your_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
```

## Step 2: Build and Start the Server

Build and start the MCP server:

```bash
# Build the project
npm run build

# Start the server
npm start
```

You should see output indicating that the server is running:

```
GitHub Project Manager MCP server running on stdio
```

## Step 3: Create Your First Project

Let's create a simple project with one milestone. Create a file named `create-project.js`:

```javascript
const { ProjectManagementService } = require('./build/services/ProjectManagementService');
require('dotenv').config();

async function createProject() {
  // Initialize the service with your GitHub credentials
  const service = new ProjectManagementService(
    process.env.GITHUB_OWNER,
    process.env.GITHUB_REPO,
    process.env.GITHUB_TOKEN
  );

  try {
    // Create a project with one milestone
    const result = await service.createRoadmap({
      project: {
        title: "My First Project",
        description: "A test project created with the MCP API",
        visibility: "private"
      },
      milestones: [
        {
          milestone: {
            title: "Phase 1",
            description: "Initial phase of the project",
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
          },
          issues: [
            {
              title: "Setup project repository",
              description: "Create and configure the initial project repository",
              priority: "high",
              type: "feature"
            }
          ]
        }
      ]
    });

    console.log('Project created successfully!');
    console.log('Project ID:', result.project.id);
    console.log('Project Title:', result.project.title);
    console.log('Milestone:', result.milestones[0].title);
    console.log('Issue:', result.milestones[0].issues[0].title);
    
    return result;
  } catch (error) {
    process.stderr.write('Error creating project:', error);
  }
}

createProject();
```

Run the script:

```bash
node create-project.js
```

You should see output confirming that your project was created successfully.

## Step 4: Plan a Sprint

Now, let's plan a sprint with our issues. Create a file named `plan-sprint.js`:

```javascript
const { ProjectManagementService } = require('./build/services/ProjectManagementService');
require('dotenv').config();

async function planSprint() {
  // Initialize the service with your GitHub credentials
  const service = new ProjectManagementService(
    process.env.GITHUB_OWNER,
    process.env.GITHUB_REPO,
    process.env.GITHUB_TOKEN
  );

  try {
    // Get the issue ID from the previous step
    // For this example, we'll assume it's 1, but you should replace this with your actual issue ID
    const issueId = 1;

    // Plan a sprint with the issue
    const sprint = await service.planSprint({
      sprint: {
        title: "Sprint 1",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        goals: [
          "Complete initial project setup",
          "Establish development workflow"
        ]
      },
      issueIds: [issueId]
    });

    console.log('Sprint planned successfully!');
    console.log('Sprint ID:', sprint.id);
    console.log('Sprint Title:', sprint.title);
    console.log('Sprint Goals:', sprint.goals);
    console.log('Issues:', sprint.issues);
    
    return sprint;
  } catch (error) {
    process.stderr.write('Error planning sprint:', error);
  }
}

planSprint();
```

Run the script:

```bash
node plan-sprint.js
```

## Step 5: Track Progress

Finally, let's check the progress of our sprint. Create a file named `track-progress.js`:

```javascript
const { ProjectManagementService } = require('./build/services/ProjectManagementService');
require('dotenv').config();

async function trackProgress() {
  // Initialize the service with your GitHub credentials
  const service = new ProjectManagementService(
    process.env.GITHUB_OWNER,
    process.env.GITHUB_REPO,
    process.env.GITHUB_TOKEN
  );

  try {
    // Get the sprint ID from the previous step
    // For this example, we'll assume it's "sprint_1", but you should replace this with your actual sprint ID
    const sprintId = "sprint_1";

    // Get sprint metrics
    const metrics = await service.getSprintMetrics(sprintId, true);

    console.log('Sprint Metrics:');
    console.log('Title:', metrics.sprint.title);
    console.log('Status:', metrics.sprint.status);
    console.log('Progress:', `${metrics.progress.completionPercentage}%`);
    console.log('Open Issues:', metrics.progress.openIssues);
    console.log('Closed Issues:', metrics.progress.closedIssues);
    
    // Display issues if available
    if (metrics.issues && metrics.issues.length > 0) {
      console.log('\nIssues:');
      metrics.issues.forEach(issue => {
        console.log(`- ${issue.title} (${issue.status})`);
      });
    }
    
    return metrics;
  } catch (error) {
    process.stderr.write('Error tracking progress:', error);
  }
}

trackProgress();
```

Run the script:

```bash
node track-progress.js
```

## Step 6: Explore the API

Now that you've completed the basic workflow, explore the full API capabilities:

1. Check out the [API Reference](../api-reference/index.md) for all available tools
2. Try creating more complex projects with multiple milestones
3. Experiment with different issue types and priorities
4. Track progress across multiple sprints

## Troubleshooting

If you encounter any issues:

### Authentication Errors

```
Error: Unauthorized: Bad credentials
```

- Verify that your GitHub token is correct and has not expired
- Check that your token has the required scopes
- Ensure the token is correctly set in your `.env` file

### Rate Limiting

```
Error: Rate limited: API rate limit exceeded
```

- Implement request batching for large operations
- Add retry logic with exponential backoff
- Monitor rate limit headers in responses

### Resource Not Found

```
Error: Resource not found: Issue with ID 123 not found
```

- Verify that the resource IDs you're using are correct
- Check that you have access to the resources
- Ensure you're using the correct owner and repository

## Next Steps

Congratulations! You've completed the getting started tutorial. Here are some next steps:

1. Explore the [API Reference](../api-reference/index.md) to learn about all available tools
2. Check out the [Examples](../../examples/README.md) directory for more code samples
3. Learn about [advanced features](./advanced-features.md) like custom fields and automation
4. Contribute to the project by following the [Contributing Guide](../contributing/index.md)
