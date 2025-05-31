import { MCPToolTestUtils, MCPTestHelpers } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for GitHub Project Management Tools
 * Tests all project-related MCP tools through the actual MCP interface
 */

describe('GitHub Project Management Tools E2E', () => {
  let utils: MCPToolTestUtils;
  let createdProjectId: string;
  let createdMilestoneId: string;
  let createdIssueId: string;
  let createdSprintId: string;

  beforeAll(async () => {
    if (MCPToolTestUtils.shouldSkipTest('github')) {
      console.log('⏭️  Skipping GitHub Project Management Tools E2E - missing credentials for github tests');
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

  beforeEach(() => {
    if (MCPToolTestUtils.shouldSkipTest('github')) {
      test.skip('Skipping test - missing credentials for github tests', () => {});
    }
  });

  describe('Project Tools', () => {
    it('should list all project tools', async () => {
      const tools = await utils.listTools();
      
      const projectTools = [
        'create_project', 'list_projects', 'get_project', 'update_project', 'delete_project',
        'create_project_field', 'list_project_fields', 'update_project_field',
        'create_project_view', 'list_project_views', 'update_project_view',
        'add_project_item', 'remove_project_item', 'list_project_items',
        'set_field_value', 'get_field_value'
      ];

      for (const toolName of projectTools) {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.name).toBe(toolName);
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should create a new project', async () => {
      const projectData = MCPTestHelpers.createTestData.project();
      
      const response = await utils.callTool('create_project', projectData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'url']);
      expect(response.title).toBe(projectData.title);
      expect(response.visibility).toBe(projectData.visibility);
      
      createdProjectId = response.id;
    });

    it('should validate create_project arguments', async () => {
      const invalidArgs = { title: '', visibility: 'invalid' };
      
      const validation = await utils.testToolValidation('create_project', invalidArgs);
      
      expect(validation.hasValidation).toBe(true);
      expect(validation.errorMessage).toContain('title');
    });

    it('should list projects', async () => {
      const response = await utils.callTool('list_projects', {});
      
      expect(Array.isArray(response)).toBe(true);
      if (createdProjectId) {
        const project = response.find((p: any) => p.id === createdProjectId);
        expect(project).toBeDefined();
      }
    });

    it('should get a specific project', async () => {
      if (!createdProjectId) {
        console.log('⏭️  Skipping: No project created to test with');
        return;
      }

      const response = await utils.callTool('get_project', { projectId: createdProjectId });
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.id).toBe(createdProjectId);
    });

    it('should update a project', async () => {
      if (!createdProjectId) {
        console.log('⏭️  Skipping: No project created to test with');
        return;
      }

      const updateData = {
        projectId: createdProjectId,
        title: 'Updated Test Project',
        shortDescription: 'Updated description'
      };

      const response = await utils.callTool('update_project', updateData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(updateData.title);
    });
  });

  describe('Milestone Tools', () => {
    it('should list milestone tools', async () => {
      const tools = await utils.listTools();
      
      const milestoneTools = ['create_milestone', 'list_milestones', 'update_milestone', 'delete_milestone'];

      for (const toolName of milestoneTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });

    it('should create a milestone', async () => {
      const milestoneData = MCPTestHelpers.createTestData.milestone();
      
      const response = await utils.callTool('create_milestone', milestoneData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(milestoneData.title);
      
      createdMilestoneId = response.id;
    });

    it('should list milestones', async () => {
      const response = await utils.callTool('list_milestones', {});
      
      expect(Array.isArray(response)).toBe(true);
      if (createdMilestoneId) {
        const milestone = response.find((m: any) => m.id === createdMilestoneId);
        expect(milestone).toBeDefined();
      }
    });

    it('should update a milestone', async () => {
      if (!createdMilestoneId) {
        console.log('⏭️  Skipping: No milestone created to test with');
        return;
      }

      const updateData = {
        milestoneId: createdMilestoneId,
        title: 'Updated Test Milestone',
        description: 'Updated milestone description'
      };

      const response = await utils.callTool('update_milestone', updateData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(updateData.title);
    });
  });

  describe('Issue Tools', () => {
    it('should list issue tools', async () => {
      const tools = await utils.listTools();
      
      const issueTools = ['create_issue', 'list_issues', 'get_issue', 'update_issue'];

      for (const toolName of issueTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });

    it('should create an issue', async () => {
      const issueData = MCPTestHelpers.createTestData.issue();
      
      const response = await utils.callTool('create_issue', issueData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'number']);
      expect(response.title).toBe(issueData.title);
      
      createdIssueId = response.id;
    });

    it('should list issues', async () => {
      const response = await utils.callTool('list_issues', {});
      
      expect(Array.isArray(response)).toBe(true);
      if (createdIssueId) {
        const issue = response.find((i: any) => i.id === createdIssueId);
        expect(issue).toBeDefined();
      }
    });

    it('should get a specific issue', async () => {
      if (!createdIssueId) {
        console.log('⏭️  Skipping: No issue created to test with');
        return;
      }

      const response = await utils.callTool('get_issue', { issueId: createdIssueId });
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'number']);
      expect(response.id).toBe(createdIssueId);
    });

    it('should update an issue', async () => {
      if (!createdIssueId) {
        test.skip('No issue created to test with');
        return;
      }

      const updateData = {
        issueId: createdIssueId,
        title: 'Updated Test Issue',
        description: 'Updated issue description'
      };

      const response = await utils.callTool('update_issue', updateData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(updateData.title);
    });
  });

  describe('Sprint Tools', () => {
    it('should list sprint tools', async () => {
      const tools = await utils.listTools();
      
      const sprintTools = [
        'create_sprint', 'list_sprints', 'get_current_sprint', 'update_sprint',
        'add_issues_to_sprint', 'remove_issues_from_sprint'
      ];

      for (const toolName of sprintTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });

    it('should create a sprint', async () => {
      const sprintData = MCPTestHelpers.createTestData.sprint();
      
      const response = await utils.callTool('create_sprint', sprintData);
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title']);
      expect(response.title).toBe(sprintData.title);
      
      createdSprintId = response.id;
    });

    it('should list sprints', async () => {
      const response = await utils.callTool('list_sprints', {});
      
      expect(Array.isArray(response)).toBe(true);
      if (createdSprintId) {
        const sprint = response.find((s: any) => s.id === createdSprintId);
        expect(sprint).toBeDefined();
      }
    });

    it('should add issues to sprint', async () => {
      if (!createdSprintId || !createdIssueId) {
        test.skip('No sprint or issue created to test with');
        return;
      }

      const response = await utils.callTool('add_issues_to_sprint', {
        sprintId: createdSprintId,
        issueIds: [createdIssueId]
      });
      
      expect(response).toBeDefined();
    });
  });

  describe('Roadmap and Planning Tools', () => {
    it('should list roadmap tools', async () => {
      const tools = await utils.listTools();
      
      const roadmapTools = [
        'create_roadmap', 'plan_sprint', 'get_milestone_metrics', 'get_sprint_metrics',
        'get_overdue_milestones', 'get_upcoming_milestones'
      ];

      for (const toolName of roadmapTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });

    it('should create a roadmap', async () => {
      const roadmapData = {
        project: {
          title: `Test Roadmap Project ${Date.now()}`,
          shortDescription: "E2E test roadmap project",
          owner: process.env.GITHUB_OWNER || "test-owner",
          visibility: "private" as const
        },
        milestones: [
          {
            milestone: MCPTestHelpers.createTestData.milestone(),
            issues: "Create initial project structure and setup development environment"
          }
        ]
      };

      const response = await utils.callTool('create_roadmap', roadmapData);
      
      MCPTestHelpers.validateToolResponse(response, ['project', 'milestones']);
      expect(response.project.title).toBe(roadmapData.project.title);
      expect(response.milestones).toHaveLength(1);
      expect(response.milestones[0].issues).toHaveLength(2);
    });

    it('should get milestone metrics', async () => {
      if (!createdMilestoneId) {
        test.skip('No milestone created to test with');
        return;
      }

      const response = await utils.callTool('get_milestone_metrics', {
        milestoneId: createdMilestoneId,
        includeIssues: true
      });
      
      MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'totalIssues', 'completionPercentage']);
    });

    it('should get upcoming milestones', async () => {
      const response = await utils.callTool('get_upcoming_milestones', {
        daysAhead: 30,
        limit: 5,
        includeIssues: false
      });

      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('Label Tools', () => {
    it('should list label tools', async () => {
      const tools = await utils.listTools();
      
      const labelTools = ['create_label', 'list_labels'];

      for (const toolName of labelTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });

    it('should create a label', async () => {
      const labelData = {
        name: `test-label-${Date.now()}`,
        color: 'ff0000',
        description: 'E2E test label'
      };

      const response = await utils.callTool('create_label', labelData);
      
      MCPTestHelpers.validateToolResponse(response, ['name', 'color']);
      expect(response.name).toBe(labelData.name);
    });

    it('should list labels', async () => {
      const response = await utils.callTool('list_labels', {});
      
      expect(Array.isArray(response)).toBe(true);
    });
  });
});
