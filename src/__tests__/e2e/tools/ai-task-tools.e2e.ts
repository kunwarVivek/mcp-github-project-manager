import { MCPToolTestUtils, } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for AI Task Management Tools
 *
 * All tests use the compound tool `ai_generate` with action-based routing.
 * Granular v1 tool names (generate_prd, parse_prd, etc.) are NOT listed
 * by the server — only `ai_generate` (and `ai_analyze`, `ai_plan`) appear.
 *
 * Tool mapping (v1 granular → v2 compound + action):
 *   generate_prd             → ai_generate  action:'generate_prd'
 *   enhance_prd              → ai_generate  action:'enhance_prd'
 *   parse_prd                → ai_generate  action:'parse_prd'
 *   add_feature              → ai_generate  action:'add_feature'
 *   get_next_task            → ai_generate  action:'get_next_task'
 *   analyze_task_complexity   → ai_generate  action:'analyze_complexity'
 *   expand_task              → ai_generate  action:'expand_task'
 *   create_traceability_matrix → ai_generate action:'create_traceability_matrix'
 */

const AI_COMPOUND_TOOL = 'ai_generate';

const AI_GENERATE_ACTIONS = [
  'generate_prd', 'enhance_prd', 'parse_prd', 'add_feature',
  'get_next_task', 'analyze_complexity', 'expand_task',
  'create_traceability_matrix',
];

MCPToolTestUtils.createTestSuite('AI Task Management Tools E2E', 'both')((utils: MCPToolTestUtils | undefined) => {
  let generatedPRDContent: string;
  let parsedTasks: any[];
  let projectId: string;

  describe('AI Tool Registration', () => {
    it('should list the ai_generate compound tool over MCP', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();

      const tool = tools.find((t: any) => t.name === AI_COMPOUND_TOOL);
      expect(tool).toBeDefined();
      expect(tool.name).toBe(AI_COMPOUND_TOOL);
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should NOT list granular AI tool names', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const tools = await utils.listTools();
      const names = tools.map((t: any) => t.name);

      for (const granular of [
        'generate_prd', 'parse_prd', 'get_next_task',
        'analyze_task_complexity', 'expand_task', 'enhance_prd',
        'create_traceability_matrix', 'add_feature',
      ]) {
        expect(names).not.toContain(granular);
      }
    });

    it('should validate ai_generate tool has proper schema', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      expect(await utils.validateToolExists(AI_COMPOUND_TOOL)).toBe(true);
    });
  });

  describe('PRD Generation Tools', () => {
    it('should generate a PRD from project idea', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'generate_prd',
        projectIdea: 'A modern task management application with AI-powered task prioritization and team collaboration features',
        projectName: 'TaskFlow AI',
        targetUsers: ['project-managers', 'developers', 'team-leads'],
        timeline: '6 months',
        complexity: 'medium' as const,
        author: 'e2e-test-team',
        stakeholders: ['engineering', 'design', 'product'],
        includeResearch: false,
        industryContext: 'productivity software',
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      expect(content).toContain('TaskFlow AI');
      expect(content).toContain('Key Objectives');
      expect(content).toContain('Target Users');
      expect(content).toContain('Key Features');

      generatedPRDContent = content;
    });

    it('should validate generate_prd arguments', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // Missing required 'action' or bad projectIdea should trigger validation
      const validation = await utils.testToolValidation(AI_COMPOUND_TOOL, {
        action: 'generate_prd',
        projectIdea: '',
        complexity: 'invalid',
      });

      expect(validation.hasValidation).toBe(true);
    });

    it('should enhance an existing PRD', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!generatedPRDContent) {
        console.log('Skipping: No PRD generated to enhance');
        return;
      }

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'enhance_prd',
        prdContent: generatedPRDContent,
        enhancementType: 'technical' as const,
        focusAreas: ['architecture', 'security', 'performance'],
        targetAudience: 'technical' as const,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      expect(content).toContain('Technical');
      expect(content.length).toBeGreaterThan(generatedPRDContent.length);
    });
  });

  describe('Task Generation and Parsing Tools', () => {
    it('should parse PRD and generate tasks', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!generatedPRDContent) {
        console.log('Skipping: No PRD generated to parse');
        return;
      }

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'parse_prd',
        prdContent: generatedPRDContent,
        maxTasks: 10,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app',
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: `test-project-${Date.now()}`,
        enhancedGeneration: true,
        contextLevel: 'full' as const,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      // Parse the response to get tasks
      let responseData;
      try {
        responseData = JSON.parse(content);
      } catch {
        // If content is not JSON, it might be a summary
        expect(content).toContain('tasks');
        return;
      }

      expect(responseData.tasks).toBeDefined();
      expect(Array.isArray(responseData.tasks)).toBe(true);
      expect(responseData.tasks.length).toBeGreaterThan(0);

      parsedTasks = responseData.tasks;
      projectId = `test-project-${Date.now()}`;
    });

    it('should get next task recommendations', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!parsedTasks || parsedTasks.length === 0) {
        console.log('Skipping: No tasks available for recommendations');
        return;
      }

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'get_next_task',
        projectId: projectId || 'test-project',
        sprintCapacity: 40,
        includeAnalysis: true,
        limit: 5,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      // Should contain recommendations
      expect(content).toContain('recommendations');
    });

    it('should analyze task complexity', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!parsedTasks || parsedTasks.length === 0) {
        console.log('Skipping: No tasks available for complexity analysis');
        return;
      }

      const firstTask = parsedTasks[0];

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'analyze_complexity',
        taskTitle: firstTask.title || 'Sample Task',
        taskDescription: firstTask.description || 'Sample task description',
        projectContext: 'Web application development',
        teamExperience: 'mid' as const,
        includeRecommendations: true,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      expect(content).toContain('complexity');
      expect(content).toContain('score');
    });

    it('should expand a task into subtasks', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!parsedTasks || parsedTasks.length === 0) {
        console.log('Skipping: No tasks available for expansion');
        return;
      }

      const firstTask = parsedTasks[0];

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'expand_task',
        taskTitle: firstTask.title || 'Sample Task',
        taskDescription: firstTask.description || 'Sample task description',
        maxSubtasks: 5,
        includeEstimates: true,
        includeDependencies: true,
        projectContext: 'Web application development',
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      expect(content).toContain('subtasks');
    });
  });

  describe('Feature Management Tools', () => {
    it('should add a feature to existing project', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'add_feature',
        featureIdea: 'Real-time Notifications',
        description: 'Add real-time push notifications for task updates and team collaboration',
        targetProject: projectId || 'test-project',
        requestedBy: 'e2e-test',
        autoApprove: false,
        expandToTasks: true,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      expect(content).toContain('Real-time Notifications');
      expect(content).toContain('feature');
    });

    it('should validate add_feature arguments', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const validation = await utils.testToolValidation(AI_COMPOUND_TOOL, {
        action: 'add_feature',
        featureIdea: '',
        description: '',
      });

      expect(validation.hasValidation).toBe(true);
    });
  });

  describe('Traceability and Requirements Tools', () => {
    it('should create traceability matrix', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!generatedPRDContent) {
        console.log('Skipping: No PRD available for traceability matrix');
        return;
      }

      const response = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'create_traceability_matrix',
        prdContent: generatedPRDContent,
        projectId: projectId || 'test-project',
        includeUseCases: true,
        includeTraceabilityLinks: true,
        includeCoverageAnalysis: true,
        validateCompleteness: true,
      });

      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);

      expect(content).toContain('traceability');
      expect(content).toContain('requirements');
    });
  });

  describe('AI Tool Error Handling', () => {
    it('should handle missing AI credentials gracefully', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // Test with environment that might not have AI credentials
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      try {
        const response = await utils.callTool(AI_COMPOUND_TOOL, {
          action: 'generate_prd',
          projectIdea: 'Simple test project',
          projectName: 'Test',
          targetUsers: ['users'],
          timeline: '1 month',
          complexity: 'low',
          author: 'test',
        });

        // Should either work with fallback or provide meaningful error
        expect(response).toBeDefined();
      } catch (error: any) {
        // Should provide meaningful error message about missing credentials
        expect(error.message).toMatch(/AI|credential|key|service/i);
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    });

    it('should validate all ai_generate actions reject empty args', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      for (const action of AI_GENERATE_ACTIONS) {
        // Send just the action with no other args — should trigger validation
        const validation = await utils.testToolValidation(AI_COMPOUND_TOOL, { action });
        expect(validation.hasValidation).toBe(true);
      }
    });
  });

  describe('AI Tool Integration', () => {
    it('should handle complete AI workflow', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      // Test complete workflow: Generate PRD -> Parse to tasks -> Get recommendations
      const projectIdea = 'A simple note-taking application with markdown support';

      // Step 1: Generate PRD
      const prdResponse = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'generate_prd',
        projectIdea,
        projectName: 'NoteMD',
        targetUsers: ['students', 'writers'],
        timeline: '3 months',
        complexity: 'low',
        author: 'e2e-test',
      });

      const prdContent = MCPToolTestUtils.extractContent(prdResponse);
      expect(prdContent).toContain('NoteMD');

      // Step 2: Parse PRD to tasks
      const parseResponse = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'parse_prd',
        prdContent,
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        projectType: 'web-app',
        projectId: 'notemd-test',
      });

      expect(parseResponse).toBeDefined();

      // Step 3: Get task recommendations
      const recommendationsResponse = await utils.callTool(AI_COMPOUND_TOOL, {
        action: 'get_next_task',
        projectId: 'notemd-test',
        sprintCapacity: 20,
        limit: 3,
      });

      expect(recommendationsResponse).toBeDefined();
    });
  });
});
