import { MCPToolTestUtils } from '../utils/MCPToolTestUtils';

/**
 * Basic validation tests to ensure the E2E test infrastructure is working
 */
describe('E2E Test Infrastructure Validation', () => {
  let utils: MCPToolTestUtils;

  beforeAll(async () => {
    utils = new MCPToolTestUtils();
    await utils.startServer();
  }, 30000);

  afterAll(async () => {
    if (utils) {
      await utils.stopServer();
    }
  }, 10000);

  it('should start MCP server successfully', () => {
    expect(utils).toBeDefined();
  });

  it('should list available tools', async () => {
    const tools = await utils.listTools();
    
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    // Verify each tool has required properties
    tools.forEach(tool => {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });
  });

  it('should have GitHub project management tools', async () => {
    const tools = await utils.listTools();
    
    const expectedGitHubTools = [
      'manage_project', 'manage_issues', 'manage_milestones',
      'manage_sprints', 'manage_prs', 'manage_labels',
    ];

    for (const toolName of expectedGitHubTools) {
      const tool = tools.find(t => t.name === toolName);
      expect(tool).toBeDefined();
    }
  });

  it('should have AI task management tools', async () => {
    const tools = await utils.listTools();
    
    const expectedAITools = [
      'ai_generate', 'ai_analyze', 'ai_plan',
    ];

    for (const toolName of expectedAITools) {
      const tool = tools.find(t => t.name === toolName);
      expect(tool).toBeDefined();
    }
  });

  it('should validate tool argument schemas', async () => {
    // Test that tools properly validate arguments
    const invalidArgs = {};

    try {
      await utils.callTool('create_project', invalidArgs);
      fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.message).toContain('Invalid parameters');
    }
  });

  it('should handle unknown tools gracefully', async () => {
    try {
      await utils.callTool('nonexistent_tool', {});
      fail('Should have thrown error for unknown tool');
    } catch (error: any) {
      expect(error.message).toContain('nonexistent_tool');
    }
  });
});
