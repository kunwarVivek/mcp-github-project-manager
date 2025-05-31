import { MCPToolTestUtils, MCPTestHelpers } from '../utils/MCPToolTestUtils';

/**
 * Comprehensive E2E tests for Tool Integration and Workflows
 * Tests complex workflows that combine multiple MCP tools
 */

describe('Tool Integration Workflows E2E', () => {
  let utils: MCPToolTestUtils;
  let workflowProjectId: string;
  let workflowMilestoneId: string;
  let workflowIssueIds: string[] = [];
  let workflowSprintId: string;
  let workflowPRDContent: string;

  beforeAll(async () => {
    if (MCPToolTestUtils.shouldSkipTest('both')) {
      console.log('⏭️  Skipping Tool Integration Workflows E2E - missing credentials for both tests');
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
    if (MCPToolTestUtils.shouldSkipTest('both')) {
      test.skip('Skipping test - missing credentials for both tests');
    }
  });

  describe('Complete Project Setup Workflow', () => {
    it('should execute complete project creation workflow', async () => {
      if (MCPToolTestUtils.shouldSkipTest('both')) {
        test.skip('Skipping test - missing credentials for both tests');
        return;
      }

      // Step 1: Generate PRD
      const prdResponse = await utils.callTool('generate_prd', {
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
      const projectResponse = await utils.callTool('create_project', {
        title: 'ProjectHub Pro Development',
        shortDescription: 'Development project for ProjectHub Pro dashboard',
        owner: process.env.GITHUB_OWNER || "test-owner",
        visibility: 'private'
      });

      workflowProjectId = projectResponse.id;
      expect(workflowProjectId).toBeDefined();

      // Step 3: Parse PRD to generate tasks
      const parseResponse = await utils.callTool('parse_prd', {
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
      const milestoneResponse = await utils.callTool('create_milestone', {
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
      const roadmapData = {
        project: {
          title: 'ProjectHub Pro Roadmap',
          shortDescription: 'Complete development roadmap for ProjectHub Pro',
          owner: process.env.GITHUB_OWNER || "test-owner",
          visibility: 'private'
        },
        milestones: [
          {
            milestone: {
              title: 'Phase 1: Foundation',
              description: 'Core infrastructure and authentication',
              dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
            },
            issues: [
              {
                title: 'Set up project infrastructure',
                description: 'Initialize project structure, CI/CD, and development environment',
                priority: 'high',
                type: 'feature',
                assignees: [],
                labels: ['infrastructure', 'setup']
              },
              {
                title: 'Implement user authentication',
                description: 'Create secure authentication system with OAuth integration',
                priority: 'critical',
                type: 'feature',
                assignees: [],
                labels: ['auth', 'security']
              }
            ]
          },
          {
            milestone: {
              title: 'Phase 2: Core Features',
              description: 'Dashboard and project management features',
              dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            },
            issues: [
              {
                title: 'Build main dashboard',
                description: 'Create responsive dashboard with real-time analytics',
                priority: 'high',
                type: 'feature',
                assignees: [],
                labels: ['dashboard', 'analytics']
              },
              {
                title: 'Implement project management features',
                description: 'Add project creation, task management, and team collaboration',
                priority: 'high',
                type: 'feature',
                assignees: [],
                labels: ['project-management', 'collaboration']
              }
            ]
          }
        ]
      };

      const roadmapResponse = await utils.callTool('create_roadmap', roadmapData);
      
      expect(roadmapResponse.project).toBeDefined();
      expect(roadmapResponse.milestones).toHaveLength(2);
      expect(roadmapResponse.milestones[0].issues).toHaveLength(2);
      expect(roadmapResponse.milestones[1].issues).toHaveLength(2);

      // Store created issue IDs for later use
      roadmapResponse.milestones.forEach((milestone: any) => {
        milestone.issues.forEach((issue: any) => {
          workflowIssueIds.push(issue.id);
        });
      });

      console.log('✅ Comprehensive roadmap created with multiple milestones');
    });

    it('should plan sprint with selected issues', async () => {
      if (workflowIssueIds.length === 0) {
        test.skip('No issues available for sprint planning');
        return;
      }

      const sprintData = {
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
      };

      const sprintResponse = await utils.callTool('plan_sprint', sprintData);
      
      expect(sprintResponse.id).toBeDefined();
      expect(sprintResponse.title).toBe(sprintData.sprint.title);
      expect(sprintResponse.issues).toHaveLength(2);

      workflowSprintId = sprintResponse.id;
      console.log('✅ Sprint planned with selected issues');
    });
  });

  describe('AI-Enhanced Project Management Workflow', () => {
    it('should enhance PRD with technical details', async () => {
      if (!workflowPRDContent) {
        test.skip('No PRD available for enhancement');
        return;
      }

      const enhanceResponse = await utils.callTool('enhance_prd', {
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
      const featureResponse = await utils.callTool('add_feature', {
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
      if (!workflowPRDContent) {
        test.skip('No PRD available for traceability matrix');
        return;
      }

      const traceabilityResponse = await utils.callTool('create_traceability_matrix', {
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
      if (!workflowMilestoneId) {
        test.skip('No milestone available for metrics');
        return;
      }

      const metricsResponse = await utils.callTool('get_milestone_metrics', {
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
      if (!workflowSprintId) {
        test.skip('No sprint available for metrics');
        return;
      }

      const sprintMetricsResponse = await utils.callTool('get_sprint_metrics', {
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
      const upcomingResponse = await utils.callTool('get_upcoming_milestones', {
        daysAhead: 30,
        limit: 10,
        includeIssues: true
      });

      expect(Array.isArray(upcomingResponse)).toBe(true);
      console.log('✅ Upcoming milestones retrieved for planning');
    });

    it('should identify overdue milestones', async () => {
      const overdueResponse = await utils.callTool('get_overdue_milestones', {
        limit: 5,
        includeIssues: true
      });

      expect(Array.isArray(overdueResponse)).toBe(true);
      console.log('✅ Overdue milestones identified');
    });
  });

  describe('Task Management and Optimization Workflow', () => {
    it('should get next task recommendations for team', async () => {
      const nextTaskResponse = await utils.callTool('get_next_task', {
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
      const complexityResponse = await utils.callTool('analyze_task_complexity', {
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
      const expandResponse = await utils.callTool('expand_task', {
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
      // Verify all created resources exist and are properly linked
      if (workflowProjectId) {
        const project = await utils.callTool('get_project', { projectId: workflowProjectId });
        expect(project.id).toBe(workflowProjectId);
      }

      if (workflowMilestoneId) {
        const milestoneMetrics = await utils.callTool('get_milestone_metrics', {
          milestoneId: workflowMilestoneId,
          includeIssues: false
        });
        expect(milestoneMetrics.id).toBe(workflowMilestoneId);
      }

      if (workflowSprintId) {
        const sprintMetrics = await utils.callTool('get_sprint_metrics', {
          sprintId: workflowSprintId,
          includeIssues: false
        });
        expect(sprintMetrics.id).toBe(workflowSprintId);
      }

      console.log('✅ Complete project lifecycle validated');
    });

    it('should demonstrate tool interoperability', async () => {
      // Test that tools work together seamlessly
      const tools = await utils.listTools();
      
      // Verify all expected tool categories are present
      const githubTools = tools.filter(t => 
        t.name.includes('project') || t.name.includes('milestone') || 
        t.name.includes('issue') || t.name.includes('sprint')
      );
      
      const aiTools = tools.filter(t => 
        t.name.includes('prd') || t.name.includes('task') || 
        t.name.includes('feature') || t.name.includes('analyze')
      );

      expect(githubTools.length).toBeGreaterThan(15);
      expect(aiTools.length).toBeGreaterThan(5);

      console.log('✅ Tool interoperability demonstrated');
    });
  });
});
