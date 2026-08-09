import { MCPToolTestUtils, } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for Tool Integration and Workflows
 * Tests complex workflows that combine multiple MCP tools
 *
 * All tests use compound tools with action-based routing:
 * - manage_project: create, get, list, update, delete, ...
 * - manage_milestones: create, list, get_metrics, get_upcoming, get_overdue, ...
 * - manage_sprints: create, list, plan, get_metrics, ...
 * - manage_issues: create, list, get, update, ...
 * - ai_generate: generate_prd, enhance_prd, parse_prd, add_feature,
 *                get_next_task, analyze_complexity, expand_task,
 *                create_traceability_matrix
 */

describe('Tool Integration Workflows E2E', () => {
  let utils: MCPToolTestUtils | undefined;
  let workflowProjectId: string;
  let workflowMilestoneId: string;
  const workflowIssueIds: string[] = [];
  let workflowSprintId: string;
  let workflowPRDContent: string;

  beforeAll(async () => {
    if (MCPToolTestUtils.shouldSkipTest('both')) {
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

  // Note: Tests have individual guards for when utils is undefined
  // because beforeAll may skip initialization when credentials are missing

  describe('Complete Project Setup Workflow', () => {
    it('should execute complete project creation workflow', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      // Step 1: Generate PRD
      const prdResponse = await utils.callTool('ai_generate', {
        action: 'generate_prd',
        projectIdea: 'A comprehensive project management dashboard with real-time analytics and team collaboration',
        projectName: 'ProjectHub Pro',
        targetUsers: ['project-managers', 'team-leads', 'executives'],
        timeline: '8 months',
        complexity: 'high',
        author: 'e2e-workflow-test',
        stakeholders: ['engineering', 'design', 'product', 'sales'],
        includeResearch: true,
        industryContext: 'enterprise software'
      });

      workflowPRDContent = MCPToolTestUtils.extractContent(prdResponse);
      expect(workflowPRDContent).toContain('ProjectHub Pro');

      // Step 2: Create GitHub Project
      const projectResponse = await utils.callTool('manage_project', {
        action: 'create',
        title: 'ProjectHub Pro Development',
        shortDescription: 'Development project for ProjectHub Pro dashboard',
        owner: process.env.GITHUB_OWNER || "test-owner",
        visibility: 'private'
      });

      workflowProjectId = projectResponse.id;
      expect(workflowProjectId).toBeDefined();

      // Step 3: Parse PRD to generate tasks
      const parseResponse = await utils.callTool('ai_generate', {
        action: 'parse_prd',
        prdContent: workflowPRDContent,
        maxTasks: 15,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: 'web-app',
        createLifecycle: true,
        projectId: workflowProjectId,
        enhancedGeneration: true,
        contextLevel: 'comprehensive'
      });

      expect(parseResponse).toBeDefined();

      // Step 4: Create milestone for first phase
      const milestoneResponse = await utils.callTool('manage_milestones', {
        action: 'create',
        title: 'Phase 1: Core Infrastructure',
        description: 'Establish core infrastructure and basic functionality',
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
      });

      workflowMilestoneId = milestoneResponse.id;
      expect(workflowMilestoneId).toBeDefined();

      console.log('✅ Complete project setup workflow executed successfully');
    });
  });

  describe('Roadmap Creation and Sprint Planning Workflow', () => {
    it('should create comprehensive roadmap with multiple milestones', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      // Build roadmap by creating project + milestones + issues individually
      // via compound tools (create_roadmap was a granular convenience tool
      // not exposed on the MCP compound surface)
      const owner = process.env.GITHUB_OWNER || "test-owner";

      // Create project
      const project = await utils.callTool('manage_project', {
        action: 'create',
        title: 'ProjectHub Pro Roadmap',
        shortDescription: 'Complete development roadmap for ProjectHub Pro',
        owner,
        visibility: 'private'
      });
      expect(project.id).toBeDefined();

      // Phase 1 milestone + issues
      const milestone1 = await utils.callTool('manage_milestones', {
        action: 'create',
        title: 'Phase 1: Foundation',
        description: 'Core infrastructure and authentication',
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
      });

      const issue1 = await utils.callTool('manage_issues', {
        action: 'create',
        title: 'Set up project infrastructure',
        description: 'Initialize project structure, CI/CD, and development environment',
        priority: 'high',
        type: 'feature',
        assignees: [],
        labels: ['infrastructure', 'setup']
      });

      const issue2 = await utils.callTool('manage_issues', {
        action: 'create',
        title: 'Implement user authentication',
        description: 'Create secure authentication system with OAuth integration',
        priority: 'critical',
        type: 'feature',
        assignees: [],
        labels: ['auth', 'security']
      });

      // Phase 2 milestone + issues
      const milestone2 = await utils.callTool('manage_milestones', {
        action: 'create',
        title: 'Phase 2: Core Features',
        description: 'Dashboard and project management features',
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      });

      const issue3 = await utils.callTool('manage_issues', {
        action: 'create',
        title: 'Build main dashboard',
        description: 'Create responsive dashboard with real-time analytics',
        priority: 'high',
        type: 'feature',
        assignees: [],
        labels: ['dashboard', 'analytics']
      });

      const issue4 = await utils.callTool('manage_issues', {
        action: 'create',
        title: 'Implement project management features',
        description: 'Add project creation, task management, and team collaboration',
        priority: 'high',
        type: 'feature',
        assignees: [],
        labels: ['project-management', 'collaboration']
      });

      // Validate created resources
      expect(milestone1.id).toBeDefined();
      expect(milestone2.id).toBeDefined();
      expect(issue1.id).toBeDefined();
      expect(issue2.id).toBeDefined();
      expect(issue3.id).toBeDefined();
      expect(issue4.id).toBeDefined();

      // Store created issue IDs for later use
      workflowIssueIds.push(issue1.id, issue2.id, issue3.id, issue4.id);

      console.log('✅ Comprehensive roadmap created with multiple milestones');
    });

    it('should plan sprint with selected issues', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (workflowIssueIds.length === 0) {
        console.log('Skipping: No issues available for sprint planning');
        return;
      }

      const sprintResponse = await utils.callTool('manage_sprints', {
        action: 'plan',
        sprint: {
          title: 'Sprint 1: Foundation Setup',
          description: 'First sprint focusing on infrastructure and authentication',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          goals: [
            'Complete project infrastructure setup',
            'Implement basic authentication',
            'Establish development workflow'
          ]
        },
        issueIds: workflowIssueIds.slice(0, 2) // First 2 issues
      });
      
      expect(sprintResponse.id).toBeDefined();
      expect(sprintResponse.title).toBe('Sprint 1: Foundation Setup');
      expect(sprintResponse.issues).toHaveLength(2);

      workflowSprintId = sprintResponse.id;
      console.log('✅ Sprint planned with selected issues');
    });
  });

  describe('AI-Enhanced Project Management Workflow', () => {
    it('should enhance PRD with technical details', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!workflowPRDContent) {
        console.log('Skipping: No PRD available for enhancement');
        return;
      }

      const enhanceResponse = await utils.callTool('ai_generate', {
        action: 'enhance_prd',
        prdContent: workflowPRDContent,
        enhancementType: 'technical',
        focusAreas: ['architecture', 'security', 'performance', 'scalability'],
        includeResearch: false,
        targetAudience: 'technical',
        industryContext: 'enterprise software',
        includeUseCases: true,
        includePersonas: true,
        includeMetrics: true
      });

      const enhancedContent = MCPToolTestUtils.extractContent(enhanceResponse);
      expect(enhancedContent).toContain('Technical');
      expect(enhancedContent).toContain('Architecture');
      expect(enhancedContent.length).toBeGreaterThan(workflowPRDContent.length);

      console.log('✅ PRD enhanced with technical details');
    });

    it('should add new feature and generate tasks', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const featureResponse = await utils.callTool('ai_generate', {
        action: 'add_feature',
        featureIdea: 'Advanced Analytics Dashboard',
        description: 'Add comprehensive analytics with custom reports, data visualization, and export capabilities',
        targetProject: workflowProjectId || 'workflow-test',
        businessJustification: 'Provides valuable insights for decision making and improves user engagement',
        targetUsers: ['project-managers', 'analysts', 'executives'],
        requestedBy: 'product-team',
        autoApprove: true,
        expandToTasks: true,
        createLifecycle: true
      });

      expect(featureResponse).toBeDefined();
      const content = MCPToolTestUtils.extractContent(featureResponse);
      expect(content).toContain('Advanced Analytics Dashboard');

      console.log('✅ New feature added with task generation');
    });

    it('should create traceability matrix for complete project', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!workflowPRDContent) {
        console.log('Skipping: No PRD available for traceability matrix');
        return;
      }

      const traceabilityResponse = await utils.callTool('ai_generate', {
        action: 'create_traceability_matrix',
        projectId: workflowProjectId || 'workflow-test',
        prdContent: workflowPRDContent,
        features: [
          {
            id: 'feature-1',
            title: 'Analytics Dashboard',
            description: 'Real-time analytics dashboard with custom reports',
            priority: 'high',
            userStories: ['As a user, I want to view analytics so that I can make informed decisions'],
            acceptanceCriteria: ['Dashboard loads within 2 seconds', 'Data is updated in real-time'],
            estimatedComplexity: 7
          }
        ],
        tasks: [
          {
            id: 'task-1',
            title: 'Implement dashboard API',
            description: 'Create REST API endpoints for dashboard data',
            complexity: 5,
            estimatedHours: 16,
            priority: 'high'
          }
        ],
        includeUseCases: true,
        includeTraceabilityLinks: true,
        includeCoverageAnalysis: true,
        validateCompleteness: true
      });

      const content = MCPToolTestUtils.extractContent(traceabilityResponse);
      expect(content).toContain('traceability');
      expect(content).toContain('requirements');

      console.log('✅ Traceability matrix created for complete project');
    });
  });

  describe('Metrics and Monitoring Workflow', () => {
    it('should get comprehensive milestone metrics', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!workflowMilestoneId) {
        console.log('Skipping: No milestone available for metrics');
        return;
      }

      const metricsResponse = await utils.callTool('manage_milestones', {
        action: 'get_metrics',
        milestoneId: workflowMilestoneId,
        includeIssues: true
      });

      expect(metricsResponse.id).toBe(workflowMilestoneId);
      expect(metricsResponse).toHaveProperty('totalIssues');
      expect(metricsResponse).toHaveProperty('completionPercentage');
      expect(metricsResponse).toHaveProperty('daysRemaining');

      console.log('✅ Milestone metrics retrieved');
    });

    it('should get sprint metrics with detailed analysis', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }
      if (!workflowSprintId) {
        console.log('Skipping: No sprint available for metrics');
        return;
      }

      const sprintMetricsResponse = await utils.callTool('manage_sprints', {
        action: 'get_metrics',
        sprintId: workflowSprintId,
        includeIssues: true
      });

      expect(sprintMetricsResponse.id).toBe(workflowSprintId);
      expect(sprintMetricsResponse).toHaveProperty('totalIssues');
      expect(sprintMetricsResponse).toHaveProperty('completionPercentage');
      expect(sprintMetricsResponse).toHaveProperty('isActive');

      console.log('✅ Sprint metrics retrieved with analysis');
    });

    it('should get upcoming milestones for planning', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const upcomingResponse = await utils.callTool('manage_milestones', {
        action: 'get_upcoming',
        daysAhead: 30,
        limit: 10,
        includeIssues: true
      });

      expect(Array.isArray(upcomingResponse)).toBe(true);
      console.log('✅ Upcoming milestones retrieved for planning');
    });

    it('should identify overdue milestones', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const overdueResponse = await utils.callTool('manage_milestones', {
        action: 'get_overdue',
        limit: 5,
        includeIssues: true
      });

      expect(Array.isArray(overdueResponse)).toBe(true);
      console.log('✅ Overdue milestones identified');
    });
  });

  describe('Task Management and Optimization Workflow', () => {
    it('should get next task recommendations for team', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const nextTaskResponse = await utils.callTool('ai_generate', {
        action: 'get_next_task',
        projectId: workflowProjectId || 'workflow-test',
        teamCapacity: 80,
        sprintCapacity: 40,
        priorityFilter: ['critical', 'high'],
        complexityFilter: [1, 2, 3, 4],
        includeAnalysis: true,
        maxRecommendations: 5
      });

      expect(nextTaskResponse).toBeDefined();
      const content = MCPToolTestUtils.extractContent(nextTaskResponse);
      expect(content).toContain('recommendations');

      console.log('✅ Next task recommendations generated');
    });

    it('should analyze task complexity for planning', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const complexityResponse = await utils.callTool('ai_generate', {
        action: 'analyze_complexity',
        taskTitle: 'Implement real-time analytics engine',
        taskDescription: 'Build a scalable real-time analytics engine that can process large volumes of data and provide instant insights through WebSocket connections',
        projectContext: 'Enterprise dashboard application with high performance requirements',
        teamExperience: 'mid',
        includeRecommendations: true
      });

      expect(complexityResponse).toBeDefined();
      const content = MCPToolTestUtils.extractContent(complexityResponse);
      expect(content).toContain('complexity');

      console.log('✅ Task complexity analyzed for planning');
    });

    it('should expand complex task into subtasks', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      const expandResponse = await utils.callTool('ai_generate', {
        action: 'expand_task',
        taskTitle: 'Build comprehensive user management system',
        taskDescription: 'Create a complete user management system with authentication, authorization, profile management, and admin controls',
        currentComplexity: 8,
        maxSubtasks: 8,
        maxDepth: 2,
        targetComplexity: 3,
        includeEstimates: true,
        includeDependencies: true,
        includeAcceptanceCriteria: true,
        projectType: 'web-app',
        teamSkills: ['javascript', 'react', 'node.js', 'database']
      });

      expect(expandResponse).toBeDefined();
      const content = MCPToolTestUtils.extractContent(expandResponse);
      expect(content).toContain('subtasks');

      console.log('✅ Complex task expanded into subtasks');
    });
  });

  describe('End-to-End Workflow Validation', () => {
    it('should validate complete project lifecycle', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      // Verify all created resources exist and are properly linked
      if (workflowProjectId) {
        const project = await utils.callTool('manage_project', {
          action: 'get',
          projectId: workflowProjectId
        });
        expect(project.id).toBe(workflowProjectId);
      }

      if (workflowMilestoneId) {
        const milestoneMetrics = await utils.callTool('manage_milestones', {
          action: 'get_metrics',
          milestoneId: workflowMilestoneId,
          includeIssues: false
        });
        expect(milestoneMetrics.id).toBe(workflowMilestoneId);
      }

      if (workflowSprintId) {
        const sprintMetrics = await utils.callTool('manage_sprints', {
          action: 'get_metrics',
          sprintId: workflowSprintId,
          includeIssues: false
        });
        expect(sprintMetrics.id).toBe(workflowSprintId);
      }

      console.log('✅ Complete project lifecycle validated');
    });

    it('should demonstrate tool interoperability', async () => {
      if (!utils) {
        console.log('Skipping: utils not initialized (missing credentials)');
        return;
      }

      // Test that tools work together seamlessly
      const tools = await utils.listTools();
      
      // Verify compound tool categories are present
      const coreTools = tools.filter((t: any) => 
        t.name.startsWith('manage_')
      );
      
      const aiTools = tools.filter((t: any) => 
        t.name.startsWith('ai_')
      );

      // Compound tools: manage_project, manage_issues, manage_milestones,
      // manage_sprints, manage_prs, manage_labels, manage_automation,
      // manage_iterations, manage_events, manage_status_updates
      expect(coreTools.length).toBeGreaterThanOrEqual(8);
      // AI compound tools: ai_generate, ai_analyze, ai_plan
      expect(aiTools.length).toBeGreaterThanOrEqual(3);

      console.log('✅ Tool interoperability demonstrated');
    });
  });
});
