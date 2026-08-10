import { MCPToolTestUtils, MCPTestHelpers } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for GitHub Project Management Tools
 * Tests all project-related MCP tools through the actual MCP interface
 * using MCP v2 compound tool names with action discriminators.
 *
 * These tests require real GitHub credentials. They will skip gracefully
 * when credentials are missing or invalid.
 */

// Check for real credentials (not fake test tokens)
const hasRealCredentials = (): boolean => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  // Skip if empty or if using fake test values from setup.ts
  if (!token || token === 'test-token' || token === '') return false;
  if (!owner || owner === 'test-owner') return false;
  if (!repo || repo === 'test-repo') return false;

  return true;
};

describe('GitHub Project Management Tools E2E', () => {
  let utils: MCPToolTestUtils | undefined;
  let createdProjectId: string;
  let createdMilestoneId: string;
  let createdMilestoneNumber: number;
  let createdIssueId: string;
  let createdIssueNumber: number;
  let createdSprintId: string;

  beforeAll(async () => {
    if (!hasRealCredentials()) {
      console.log('Skipping GitHub Project Management Tools E2E - missing real GitHub credentials');
      return;
    }

    utils = new MCPToolTestUtils();
    await utils.startServer();
  }, 30000);

  afterAll(async () => {
    if (utils) {
      await utils.stopServer();
    }
  }, 10000);

  describe('Project Tools', () => {
    it('should list all project tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      // All project operations are consolidated under manage_project
      const compoundTools = ['manage_project'];

      for (const toolName of compoundTools) {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should create a new project', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const projectData = MCPTestHelpers.createTestData.project();

      const response = await utils.callTool('manage_project', {
        action: 'create',
        ...projectData,
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'url']);
      expect(response.title).toBe(projectData.title);
      expect(response.visibility).toBe(projectData.visibility);

      createdProjectId = response.id;
    });

    it('should validate manage_project create arguments', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // MCP v2 validates args against JSON Schema before the handler runs.
      // An invalid enum value for visibility causes an isError tool result.
      const raw = await utils.callToolRaw('manage_project', { action: 'create', title: '', visibility: 'invalid' });
      // Either a JSON-RPC error or a tool-level isError
      expect(raw.isError || raw.content?.[0]?.text?.includes('error')).toBeTruthy();
    });

    it('should list projects', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_project', { action: 'list' });

      expect(Array.isArray(response)).toBe(true);
      if (createdProjectId) {
        const project = response.find((p: Record<string, unknown>) => p.id === createdProjectId);
        expect(project).toBeDefined();
      }
    });

    it('should get a specific project', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdProjectId) {
        console.log('Skipping: No project created to test with');
        return;
      }

      const response = await utils.callTool('manage_project', {
        action: 'get',
        projectId: createdProjectId,
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.id).toBe(createdProjectId);
    });

    it('should update a project', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdProjectId) {
        console.log('Skipping: No project created to test with');
        return;
      }

      const response = await utils.callTool('manage_project', {
        action: 'update',
        projectId: createdProjectId,
        title: 'Updated Test Project',
        shortDescription: 'Updated description',
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe('Updated Test Project');
    });
  });

  describe('Milestone Tools', () => {
    it('should list milestone tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      const tool = tools.find(t => t.name === 'manage_milestones');
      expect(tool).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should create a milestone', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // Use a highly unique title to avoid already_exists from prior runs
      const uniqueTitle = `E2E-MS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await utils.callTool('manage_milestones', {
        action: 'create',
        title: uniqueTitle,
        description: 'E2E test milestone',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(uniqueTitle);
      createdMilestoneId = response.id;
      createdMilestoneNumber = response.number;
    });

    it('should list milestones', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_milestones', { action: 'list' });

      expect(Array.isArray(response)).toBe(true);
      if (createdMilestoneId) {
        const milestone = response.find((m: Record<string, unknown>) => m.id === createdMilestoneId);
        expect(milestone).toBeDefined();
      }
    });

    it('should update a milestone', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdMilestoneId) {
        console.log('Skipping: No milestone created to test with');
        return;
      }
      const updatedTitle = `Updated-MS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Pass node ID directly — repository resolves to number for REST API
      const response = await utils.callTool('manage_milestones', {
        action: 'update',
        milestoneId: createdMilestoneId,
        title: updatedTitle,
        description: 'Updated milestone description',
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(updatedTitle);
    });
  });

  describe('Issue Tools', () => {
    it('should list issue tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      const tool = tools.find(t => t.name === 'manage_issues');
      expect(tool).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should create an issue', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const issueData = MCPTestHelpers.createTestData.issue();

      const response = await utils.callTool('manage_issues', {
        action: 'create',
        ...issueData,
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'number']);
      expect(response.title).toBe(issueData.title);

      createdIssueId = response.id;
      createdIssueNumber = response.number;
    });

    it('should list issues', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_issues', { action: 'list' });

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(0);
      // With orderBy DESC, the just-created issue should be in the first page
      if (createdIssueNumber) {
        const found = response.some((i: Record<string, unknown>) => i.number === createdIssueNumber);
        expect(found).toBe(true);
      }
    });

    it('should get a specific issue', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdIssueId) {
        console.log('Skipping: No issue created to test with');
        return;
      }
      // Pass node ID directly — findById now handles both node IDs and numbers
      const response = await utils.callTool('manage_issues', {
        action: 'get',
        issueId: createdIssueId,
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'number']);
    });

    it('should update an issue', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdIssueId) {
        console.log('Skipping: No issue created to test with');
        return;
      }
      // update uses GraphQL mutation which needs the node ID, not the number
      const response = await utils.callTool('manage_issues', {
        action: 'update',
        issueId: createdIssueId,
        title: 'Updated Test Issue',
        description: 'Updated issue description',
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe('Updated Test Issue');
    });
  });

  describe('Sprint Tools', () => {
    it('should list sprint tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      const tool = tools.find(t => t.name === 'manage_sprints');
      expect(tool).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should create a sprint', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const sprintData = MCPTestHelpers.createTestData.sprint();

      const response = await utils.callTool('manage_sprints', {
        action: 'create',
        ...sprintData,
        projectId: createdProjectId,
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(sprintData.title);

      createdSprintId = response.id;
    });

    it('should list sprints', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_sprints', { action: 'list' });

      expect(Array.isArray(response)).toBe(true);
    });

    it('should add issues to sprint', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdSprintId || !createdIssueId) {
        console.log('Skipping: No sprint or issue created to test with');
        return;
      }

      const response = await utils.callTool('manage_sprints', {
        action: 'add_issues',
        sprintId: createdSprintId,
        issueIds: [createdIssueId],
      });

      expect(response).toBeDefined();
    });
  });

  describe('Roadmap and Planning Tools', () => {
    it('should list roadmap tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      // Roadmap operations are distributed across compound tools:
      // - manage_milestones: get_metrics, get_overdue, get_upcoming
      // - manage_sprints: plan, get_metrics
      // - ai_plan: generate_roadmap
      const roadmapCompoundTools = ['manage_milestones', 'manage_sprints', 'ai_plan'];

      for (const toolName of roadmapCompoundTools) {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should create a roadmap', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('ai_plan', {
        action: 'generate_roadmap',
        requirements: 'Create initial project structure and setup development environment',
        constraints: {
          timeline: '3 months',
          teamSize: 2,
          sprintDurationWeeks: 2,
        },
        businessContext: `E2E test roadmap project ${Date.now()}`,
      });

      expect(response).toBeDefined();
      // AI-generated roadmap returns structured phases and milestones
      expect(response.title || response.phases || response.milestones).toBeDefined();
    });

    it('should get milestone metrics', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!createdMilestoneId) {
        console.log('Skipping: No milestone created to test with');
        return;
      }

      const response = await utils.callTool('manage_milestones', {
        action: 'get_metrics',
        milestoneId: String(createdMilestoneNumber),
      });

      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'totalIssues', 'completionPercentage']);
    });

    it('should get upcoming milestones', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_milestones', {
        action: 'get_upcoming',
        daysAhead: 90,
        limit: 10,
        includeIssues: false,
      });

      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('Label Tools', () => {
    it('should list label tools', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      const tool = tools.find(t => t.name === 'manage_labels');
      expect(tool).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should create a label', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // Random suffix avoids already_exists from leftover labels in the test repo
      const labelName = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const response = await utils.callTool('manage_labels', {
        action: 'create',
        name: labelName,
        color: 'ff0000',
        description: 'E2E test label',
      });

      MCPTestHelpers.validateToolResponse(response, ['name', 'color']);
      expect(response.name).toBe(labelName);
    });

    it('should list labels', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool('manage_labels', { action: 'list' });

      expect(Array.isArray(response)).toBe(true);
    });
  });
});
