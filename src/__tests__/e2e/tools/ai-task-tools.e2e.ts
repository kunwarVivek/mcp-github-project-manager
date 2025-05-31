import { MCPToolTestUtils, MCPTestHelpers } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for AI Task Management Tools
 * Tests all AI-powered MCP tools through the actual MCP interface
 */

MCPToolTestUtils.createTestSuite('AI Task Management Tools E2E', 'both')((utils: MCPToolTestUtils) => {
  let generatedPRDContent: string;
  let parsedTasks: any[];
  let projectId: string;

  describe('AI Tool Registration', () => {
    it('should list all AI task management tools', async () => {
      const tools = await utils.listTools();
      
      const aiTools = [
        'add_feature', 'generate_prd', 'parse_prd', 'get_next_task',
        'analyze_task_complexity', 'expand_task', 'enhance_prd', 'create_traceability_matrix'
      ];

      for (const toolName of aiTools) {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.name).toBe(toolName);
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should validate AI tools have proper schemas', async () => {
      const aiTools = ['generate_prd', 'parse_prd', 'get_next_task', 'analyze_task_complexity'];
      
      for (const toolName of aiTools) {
        expect(await utils.validateToolExists(toolName)).toBe(true);
      }
    });
  });

  describe('PRD Generation Tools', () => {
    it('should generate a PRD from project idea', async () => {
      const prdArgs = {
        projectIdea: 'A modern task management application with AI-powered task prioritization and team collaboration features',
        projectName: 'TaskFlow AI',
        targetUsers: ['project-managers', 'developers', 'team-leads'],
        timeline: '6 months',
        complexity: 'medium' as const,
        author: 'e2e-test-team',
        stakeholders: ['engineering', 'design', 'product'],
        includeResearch: false,
        industryContext: 'productivity software'
      };

      const response = await utils.callTool('generate_prd', prdArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      expect(content).toContain('TaskFlow AI');
      expect(content).toContain('Key Objectives');
      expect(content).toContain('Target Users');
      expect(content).toContain('Key Features');
      
      generatedPRDContent = content;
    });

    it('should validate generate_prd arguments', async () => {
      const invalidArgs = { projectIdea: '', complexity: 'invalid' };
      
      const validation = await utils.testToolValidation('generate_prd', invalidArgs);
      
      expect(validation.hasValidation).toBe(true);
      expect(validation.errorMessage).toContain('projectIdea');
    });

    it('should enhance an existing PRD', async () => {
      if (!generatedPRDContent) {
        test.skip('No PRD generated to enhance');
        return;
      }

      const enhanceArgs = {
        prdContent: generatedPRDContent,
        enhancementType: 'technical_details' as const,
        focusAreas: ['architecture', 'security', 'performance'],
        targetAudience: 'technical' as const
      };

      const response = await utils.callTool('enhance_prd', enhanceArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      expect(content).toContain('Technical');
      expect(content.length).toBeGreaterThan(generatedPRDContent.length);
    });
  });

  describe('Task Generation and Parsing Tools', () => {
    it('should parse PRD and generate tasks', async () => {
      if (!generatedPRDContent) {
        test.skip('No PRD generated to parse');
        return;
      }

      const parseArgs = {
        prdContent: generatedPRDContent,
        maxTasks: 10,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app' as const,
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: `test-project-${Date.now()}`,
        enhancedGeneration: true,
        contextLevel: 'comprehensive' as const
      };

      const response = await utils.callTool('parse_prd', parseArgs);
      
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
      projectId = parseArgs.projectId;
    });

    it('should get next task recommendations', async () => {
      if (!parsedTasks || parsedTasks.length === 0) {
        test.skip('No tasks available for recommendations');
        return;
      }

      const nextTaskArgs = {
        projectId: projectId || 'test-project',
        teamCapacity: 40,
        sprintCapacity: 40,
        priorityFilter: ['high', 'critical'],
        complexityFilter: [1, 2, 3, 4, 5],
        includeAnalysis: true,
        maxRecommendations: 5
      };

      const response = await utils.callTool('get_next_task', nextTaskArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      
      // Should contain recommendations
      expect(content).toContain('recommendations');
    });

    it('should analyze task complexity', async () => {
      if (!parsedTasks || parsedTasks.length === 0) {
        test.skip('No tasks available for complexity analysis');
        return;
      }

      const firstTask = parsedTasks[0];
      const complexityArgs = {
        taskTitle: firstTask.title || 'Sample Task',
        taskDescription: firstTask.description || 'Sample task description',
        projectContext: 'Web application development',
        teamExperience: 'mid' as const, // Fixed: should be 'junior' | 'mid' | 'senior' | 'mixed'
        includeRecommendations: true
      };

      const response = await utils.callTool('analyze_task_complexity', complexityArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      
      expect(content).toContain('complexity');
      expect(content).toContain('score');
    });

    it('should expand a task into subtasks', async () => {
      if (!parsedTasks || parsedTasks.length === 0) {
        test.skip('No tasks available for expansion');
        return;
      }

      const firstTask = parsedTasks[0];
      const expandArgs = {
        taskTitle: firstTask.title || 'Sample Task',
        taskDescription: firstTask.description || 'Sample task description',
        maxSubtasks: 5,
        includeEstimates: true,
        includeDependencies: true,
        projectContext: 'Web application development'
      };

      const response = await utils.callTool('expand_task', expandArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      
      expect(content).toContain('subtasks');
    });
  });

  describe('Feature Management Tools', () => {
    it('should add a feature to existing project', async () => {
      const featureArgs = {
        projectId: projectId || 'test-project',
        featureTitle: 'Real-time Notifications',
        featureDescription: 'Add real-time push notifications for task updates and team collaboration',
        priority: 'high' as const,
        complexity: 'medium' as const,
        estimatedHours: 24,
        dependencies: [],
        acceptanceCriteria: [
          'Users receive notifications for task assignments',
          'Users can configure notification preferences',
          'Notifications work across web and mobile platforms'
        ],
        generateTasks: true,
        updatePRD: true
      };

      const response = await utils.callTool('add_feature', featureArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      
      expect(content).toContain('Real-time Notifications');
      expect(content).toContain('feature');
    });

    it('should validate add_feature arguments', async () => {
      const invalidArgs = { 
        projectId: '', 
        featureTitle: '', 
        priority: 'invalid',
        complexity: 'invalid'
      };
      
      const validation = await utils.testToolValidation('add_feature', invalidArgs);
      
      expect(validation.hasValidation).toBe(true);
    });
  });

  describe('Traceability and Requirements Tools', () => {
    it('should create traceability matrix', async () => {
      if (!generatedPRDContent) {
        test.skip('No PRD available for traceability matrix');
        return;
      }

      const traceabilityArgs = {
        prdContent: generatedPRDContent,
        projectId: projectId || 'test-project',
        includeUseCases: true,
        includeTestCases: true,
        includeRisks: true,
        matrixFormat: 'detailed' as const
      };

      const response = await utils.callTool('create_traceability_matrix', traceabilityArgs);
      
      expect(response).toBeDefined();
      const content = MCPToolTestUtils.extractContent(response);
      
      expect(content).toContain('traceability');
      expect(content).toContain('requirements');
    });
  });

  describe('AI Tool Error Handling', () => {
    it('should handle missing AI credentials gracefully', async () => {
      // Test with environment that might not have AI credentials
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      try {
        const response = await utils.callTool('generate_prd', {
          projectIdea: 'Simple test project',
          projectName: 'Test',
          targetUsers: ['users'],
          timeline: '1 month',
          complexity: 'low',
          author: 'test'
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

    it('should validate all AI tool schemas', async () => {
      const aiTools = [
        'generate_prd', 'parse_prd', 'get_next_task', 
        'analyze_task_complexity', 'expand_task', 'enhance_prd',
        'create_traceability_matrix', 'add_feature'
      ];

      for (const toolName of aiTools) {
        // Test with completely empty arguments
        const validation = await utils.testToolValidation(toolName, {});
        expect(validation.hasValidation).toBe(true);
      }
    });
  });

  describe('AI Tool Integration', () => {
    it('should handle complete AI workflow', async () => {
      // Test complete workflow: Generate PRD -> Parse to tasks -> Get recommendations
      const projectIdea = 'A simple note-taking application with markdown support';
      
      // Step 1: Generate PRD
      const prdResponse = await utils.callTool('generate_prd', {
        projectIdea,
        projectName: 'NoteMD',
        targetUsers: ['students', 'writers'],
        timeline: '3 months',
        complexity: 'low',
        author: 'e2e-test'
      });

      const prdContent = MCPToolTestUtils.extractContent(prdResponse);
      expect(prdContent).toContain('NoteMD');

      // Step 2: Parse PRD to tasks
      const parseResponse = await utils.callTool('parse_prd', {
        prdContent,
        maxTasks: 5,
        includeSubtasks: false,
        autoEstimate: true,
        autoPrioritize: true,
        projectType: 'web-app',
        projectId: 'notemd-test'
      });

      expect(parseResponse).toBeDefined();

      // Step 3: Get task recommendations
      const recommendationsResponse = await utils.callTool('get_next_task', {
        projectId: 'notemd-test',
        teamCapacity: 20,
        sprintCapacity: 20,
        maxRecommendations: 3
      });

      expect(recommendationsResponse).toBeDefined();
    });
  });
});
