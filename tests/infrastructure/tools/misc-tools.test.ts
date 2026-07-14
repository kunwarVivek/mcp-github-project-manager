/**
 * Unit tests for miscellaneous MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  createProjectViewSchema,
  listProjectViewsSchema,
  updateProjectViewSchema,
  deleteProjectViewSchema,
  getProjectReadmeSchema,
  updateProjectReadmeSchema,
  subscribeToEventsSchema,
  getRecentEventsSchema,
  replayEventsSchema,
  createRoadmapSchema,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  createProjectViewTool,
  listProjectViewsTool,
  updateProjectViewTool,
  deleteProjectViewTool,
  getProjectReadmeTool,
  updateProjectReadmeTool,
  subscribeToEventsTool,
  getRecentEventsTool,
  replayEventsTool,
  createRoadmapTool,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  healthCheckTool,
  healthCheckSchema,
  executeHealthCheck,
  HealthStatusOutputSchema,
} from '../../../src/infrastructure/tools/health-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Misc Tools - Project View Tools', () => {
  describe('Input Schemas', () => {
    describe('createProjectViewSchema', () => {
      it('rejects missing projectId', () => {
        const result = createProjectViewSchema.safeParse({
          name: 'My View',
          layout: 'board',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = createProjectViewSchema.safeParse({
          projectId: '',
          name: 'My View',
          layout: 'board',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing name', () => {
        const result = createProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          layout: 'board',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty name', () => {
        const result = createProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          name: '',
          layout: 'board',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid layout', () => {
        const result = createProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          name: 'My View',
          layout: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with all fields', () => {
        const result = createProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          name: 'Development Board',
          layout: 'board',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOLhQ7gc4AOEbH');
          expect(result.data.name).toBe('Development Board');
          expect(result.data.layout).toBe('board');
        }
      });

      it('accepts all layout options', () => {
        const layouts = ['board', 'table', 'timeline', 'roadmap'] as const;
        for (const layout of layouts) {
          const result = createProjectViewSchema.safeParse({
            projectId: 'PVT_kwDOLhQ7gc4AOEbH',
            name: 'Test View',
            layout,
          });
          expect(result.success).toBe(true);
        }
      });
    });

    describe('listProjectViewsSchema', () => {
      it('rejects missing projectId', () => {
        const result = listProjectViewsSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = listProjectViewsSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = listProjectViewsSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('updateProjectViewSchema', () => {
      it('rejects missing projectId', () => {
        const result = updateProjectViewSchema.safeParse({
          viewId: 'PVTI_123',
          name: 'New Name',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing viewId', () => {
        const result = updateProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          name: 'New Name',
        });
        expect(result.success).toBe(false);
      });

      it('accepts update with name only', () => {
        const result = updateProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          viewId: 'PVTI_123',
          name: 'Updated View',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('Updated View');
        }
      });

      it('accepts update with layout only', () => {
        const result = updateProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          viewId: 'PVTI_123',
          layout: 'table',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.layout).toBe('table');
        }
      });

      it('accepts update with all fields', () => {
        const result = updateProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          viewId: 'PVTI_123',
          name: 'Updated View',
          layout: 'board',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('deleteProjectViewSchema', () => {
      it('rejects missing projectId', () => {
        const result = deleteProjectViewSchema.safeParse({
          viewId: 'PVTI_123',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing viewId', () => {
        const result = deleteProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = deleteProjectViewSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          viewId: 'PVTI_123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOLhQ7gc4AOEbH');
          expect(result.data.viewId).toBe('PVTI_123');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createProjectViewTool', () => {
      it('has correct name', () => {
        expect(createProjectViewTool.name).toBe('create_project_view');
      });

      it('has correct title', () => {
        expect(createProjectViewTool.title).toBe('Create Project View');
      });

      it('has create annotation', () => {
        expect(createProjectViewTool.annotations?.readOnlyHint).toBe(false);
      });

      it('has examples', () => {
        expect(createProjectViewTool.examples).toBeDefined();
        expect(createProjectViewTool.examples?.length).toBeGreaterThan(0);
      });

      it('has valid example args', () => {
        const example = createProjectViewTool.examples?.[0];
        expect(example?.args).toHaveProperty('projectId');
        expect(example?.args).toHaveProperty('name');
        expect(example?.args).toHaveProperty('layout');
      });
    });

    describe('listProjectViewsTool', () => {
      it('has correct name', () => {
        expect(listProjectViewsTool.name).toBe('list_project_views');
      });

      it('has correct title', () => {
        expect(listProjectViewsTool.title).toBe('List Project Views');
      });

      it('has readOnly annotation', () => {
        expect(listProjectViewsTool.annotations?.readOnlyHint).toBe(true);
      });

      it('has examples', () => {
        expect(listProjectViewsTool.examples).toBeDefined();
        expect(listProjectViewsTool.examples?.length).toBeGreaterThan(0);
      });
    });

    describe('updateProjectViewTool', () => {
      it('has correct name', () => {
        expect(updateProjectViewTool.name).toBe('update_project_view');
      });

      it('has correct title', () => {
        expect(updateProjectViewTool.title).toBe('Update Project View');
      });

      it('has examples', () => {
        expect(updateProjectViewTool.examples).toBeDefined();
        expect(updateProjectViewTool.examples?.length).toBeGreaterThan(0);
      });
    });

    describe('deleteProjectViewTool', () => {
      it('has correct name', () => {
        expect(deleteProjectViewTool.name).toBe('delete_project_view');
      });

      it('has correct title', () => {
        expect(deleteProjectViewTool.title).toBe('Delete Project View');
      });
    });
  });
});

describe('Misc Tools - README Tools', () => {
  describe('Input Schemas', () => {
    describe('getProjectReadmeSchema', () => {
      it('rejects missing projectId', () => {
        const result = getProjectReadmeSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getProjectReadmeSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = getProjectReadmeSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('updateProjectReadmeSchema', () => {
      it('rejects missing projectId', () => {
        const result = updateProjectReadmeSchema.safeParse({
          readme: '# Project README',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing readme', () => {
        const result = updateProjectReadmeSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty readme', () => {
        const result = updateProjectReadmeSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          readme: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = updateProjectReadmeSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          readme: '# Project README\n\nThis is the project readme.',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.readme).toContain('Project README');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('getProjectReadmeTool', () => {
      it('has correct name', () => {
        expect(getProjectReadmeTool.name).toBe('get_project_readme');
      });

      it('has correct title', () => {
        expect(getProjectReadmeTool.title).toBe('Get Project README');
      });

      it('has readOnly annotation', () => {
        expect(getProjectReadmeTool.annotations?.readOnlyHint).toBe(true);
      });

      it('has examples', () => {
        expect(getProjectReadmeTool.examples).toBeDefined();
        expect(getProjectReadmeTool.examples?.length).toBeGreaterThan(0);
      });
    });

    describe('updateProjectReadmeTool', () => {
      it('has correct name', () => {
        expect(updateProjectReadmeTool.name).toBe('update_project_readme');
      });

      it('has correct title', () => {
        expect(updateProjectReadmeTool.title).toBe('Update Project README');
      });

      it('has create annotation', () => {
        expect(updateProjectReadmeTool.annotations?.readOnlyHint).toBe(false);
      });
    });
  });
});

describe('Misc Tools - Event Tools', () => {
  describe('Input Schemas', () => {
    describe('subscribeToEventsSchema', () => {
      it('rejects missing clientId', () => {
        const result = subscribeToEventsSchema.safeParse({
          filters: [{ resourceType: 'PROJECT' }],
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = subscribeToEventsSchema.safeParse({
          clientId: 'my-client',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.clientId).toBe('my-client');
        }
      });

      it('accepts full input', () => {
        const result = subscribeToEventsSchema.safeParse({
          clientId: 'my-client',
          filters: [
            { resourceType: 'PROJECT', eventType: 'updated' },
          ],
          transport: 'sse',
          endpoint: 'https://example.com/webhook',
        });
        expect(result.success).toBe(true);
      });

      it('accepts all transport options', () => {
        const transports = ['sse', 'webhook', 'internal'] as const;
        for (const transport of transports) {
          const result = subscribeToEventsSchema.safeParse({
            clientId: 'test-client',
            transport,
          });
          expect(result.success).toBe(true);
        }
      });
    });

    describe('getRecentEventsSchema', () => {
      it('accepts empty input', () => {
        const result = getRecentEventsSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts with resourceType', () => {
        const result = getRecentEventsSchema.safeParse({
          resourceType: 'PROJECT',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.resourceType).toBe('PROJECT');
        }
      });

      it('accepts with limit', () => {
        const result = getRecentEventsSchema.safeParse({
          limit: 50,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(50);
        }
      });

      it('accepts full input', () => {
        const result = getRecentEventsSchema.safeParse({
          resourceType: 'ISSUE',
          resourceId: '123',
          eventType: 'updated',
          limit: 25,
        });
        expect(result.success).toBe(true);
      });

      it('accepts all resourceType options', () => {
        const types = ['PROJECT', 'MILESTONE', 'ISSUE', 'SPRINT'] as const;
        for (const type of types) {
          const result = getRecentEventsSchema.safeParse({
            resourceType: type,
          });
          expect(result.success).toBe(true);
        }
      });
    });

    describe('replayEventsSchema', () => {
      it('rejects missing fromTimestamp', () => {
        const result = replayEventsSchema.safeParse({
          toTimestamp: '2025-01-02T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid fromTimestamp', () => {
        const result = replayEventsSchema.safeParse({
          fromTimestamp: 'not-a-date',
        });
        expect(result.success).toBe(false);
      });

      it('accepts with fromTimestamp only', () => {
        const result = replayEventsSchema.safeParse({
          fromTimestamp: '2025-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fromTimestamp).toBe('2025-01-01T00:00:00Z');
        }
      });

      it('accepts full input', () => {
        const result = replayEventsSchema.safeParse({
          fromTimestamp: '2025-01-01T00:00:00Z',
          toTimestamp: '2025-01-02T00:00:00Z',
          resourceType: 'PROJECT',
          resourceId: '123',
          limit: 500,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('subscribeToEventsTool', () => {
      it('has correct name', () => {
        expect(subscribeToEventsTool.name).toBe('subscribe_to_events');
      });

      it('has correct title', () => {
        expect(subscribeToEventsTool.title).toBe('Subscribe to Events');
      });

      it('has create annotation', () => {
        expect(subscribeToEventsTool.annotations?.readOnlyHint).toBe(false);
      });

      it('has examples', () => {
        expect(subscribeToEventsTool.examples).toBeDefined();
        expect(subscribeToEventsTool.examples?.length).toBeGreaterThan(0);
      });
    });

    describe('getRecentEventsTool', () => {
      it('has correct name', () => {
        expect(getRecentEventsTool.name).toBe('get_recent_events');
      });

      it('has correct title', () => {
        expect(getRecentEventsTool.title).toBe('Get Recent Events');
      });

      it('has readOnly annotation', () => {
        expect(getRecentEventsTool.annotations?.readOnlyHint).toBe(true);
      });

      it('has examples', () => {
        expect(getRecentEventsTool.examples).toBeDefined();
        expect(getRecentEventsTool.examples?.length).toBeGreaterThan(0);
      });
    });

    describe('replayEventsTool', () => {
      it('has correct name', () => {
        expect(replayEventsTool.name).toBe('replay_events');
      });

      it('has correct title', () => {
        expect(replayEventsTool.title).toBe('Replay Events');
      });

      it('has readOnly annotation', () => {
        expect(replayEventsTool.annotations?.readOnlyHint).toBe(true);
      });
    });
  });
});

describe('Misc Tools - Roadmap Tool', () => {
  describe('Input Schemas', () => {
    describe('createRoadmapSchema', () => {
      it('rejects missing project', () => {
        const result = createRoadmapSchema.safeParse({
          milestones: [],
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty project title', () => {
        const result = createRoadmapSchema.safeParse({
          project: { title: '', visibility: 'private' },
          milestones: [],
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty milestones', () => {
        const result = createRoadmapSchema.safeParse({
          project: { title: 'New Project', visibility: 'private' },
        });
        expect(result.success).toBe(false);
      });

      it('rejects milestone without title', () => {
        const result = createRoadmapSchema.safeParse({
          project: { title: 'New Project', visibility: 'private' },
          milestones: [
            {
              milestone: { description: 'Test description' },
              issues: [],
            },
          ],
        });
        expect(result.success).toBe(false);
      });

      it('rejects issue without title', () => {
        const result = createRoadmapSchema.safeParse({
          project: { title: 'New Project', visibility: 'private' },
          milestones: [
            {
              milestone: { title: 'Phase 1', description: 'Test description' },
              issues: [{ description: 'Issue description' }],
            },
          ],
        });
        expect(result.success).toBe(false);
      });

      it('accepts minimal valid input', () => {
        const result = createRoadmapSchema.safeParse({
          project: { title: 'New Project', visibility: 'private' },
          milestones: [
            {
              milestone: { title: 'Phase 1', description: 'First phase' },
            },
          ],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.project.title).toBe('New Project');
          expect(result.data.milestones).toHaveLength(1);
        }
      });

      it('accepts full valid input', () => {
        const result = createRoadmapSchema.safeParse({
          project: {
            title: 'New Mobile App',
            shortDescription: 'Develop a new mobile app',
            visibility: 'private',
          },
          milestones: [
            {
              milestone: {
                title: 'Design Phase',
                description: 'Complete all design work',
                dueDate: '2025-05-01T00:00:00Z',
              },
              issues: [
                {
                  title: 'Create wireframes',
                  description: 'Create wireframes for all screens',
                  priority: 'high',
                  type: 'feature',
                  assignees: ['designer1'],
                  labels: ['design', 'ui'],
                },
              ],
            },
            {
              milestone: {
                title: 'Development Phase',
                description: 'Implement features',
                dueDate: '2025-06-15T00:00:00Z',
              },
              issues: [],
            },
          ],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.milestones).toHaveLength(2);
          expect(result.data.milestones[0].issues).toHaveLength(1);
        }
      });

      it('accepts all visibility options', () => {
        const visibilities = ['private', 'public'] as const;
        for (const visibility of visibilities) {
          const result = createRoadmapSchema.safeParse({
            project: { title: 'Test Project', visibility },
            milestones: [
              { milestone: { title: 'Phase 1', description: 'Test' } },
            ],
          });
          expect(result.success).toBe(true);
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createRoadmapTool', () => {
      it('has correct name', () => {
        expect(createRoadmapTool.name).toBe('create_roadmap');
      });

      it('has correct title', () => {
        expect(createRoadmapTool.title).toBe('Create Roadmap');
      });

      it('has create annotation', () => {
        expect(createRoadmapTool.annotations?.readOnlyHint).toBe(false);
      });

      it('has examples', () => {
        expect(createRoadmapTool.examples).toBeDefined();
        expect(createRoadmapTool.examples?.length).toBeGreaterThan(0);
      });

      it('has valid example args', () => {
        const example = createRoadmapTool.examples?.[0];
        expect(example?.args).toHaveProperty('project');
        expect(example?.args).toHaveProperty('milestones');
      });
    });
  });
});

describe('Misc Tools - Health Check Tool', () => {
  describe('Input Schemas', () => {
    describe('healthCheckSchema', () => {
      it('accepts empty object', () => {
        const result = healthCheckSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts empty input', () => {
        const result = healthCheckSchema.safeParse({});
        if (result.success) {
          expect(result.data).toEqual({});
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('healthCheckTool', () => {
      it('has correct name', () => {
        expect(healthCheckTool.name).toBe('health_check');
      });

      it('has correct title', () => {
        expect(healthCheckTool.title).toBe('Health Check');
      });

      it('has readOnly annotation', () => {
        expect(healthCheckTool.annotations?.readOnlyHint).toBe(true);
      });

      it('has idempotent annotation', () => {
        expect(healthCheckTool.annotations?.idempotentHint).toBe(true);
      });

      it('has examples', () => {
        expect(healthCheckTool.examples).toBeDefined();
        expect(healthCheckTool.examples?.length).toBeGreaterThan(0);
      });

      it('has valid empty example args', () => {
        const example = healthCheckTool.examples?.[0];
        expect(example?.args).toEqual({});
      });
    });
  });

  describe('Output Schema', () => {
    it('validates healthy status', () => {
      const output = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        services: {
          github: {
            connected: true,
            rateLimit: { remaining: 4900, limit: 5000 },
          },
          ai: {
            available: true,
            circuitState: 'closed' as const,
            models: { available: ['gpt-4'], unavailable: [] },
          },
          cache: {
            entries: 100,
            persistenceEnabled: false,
          },
        },
      };
      const result = HealthStatusOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('validates degraded status', () => {
      const output = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        services: {
          github: {
            connected: true,
          },
          ai: {
            available: false,
            circuitState: 'open' as const,
            models: { available: [], unavailable: ['gpt-4'] },
          },
          cache: {
            entries: 0,
            persistenceEnabled: false,
          },
        },
      };
      const result = HealthStatusOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('validates unhealthy status', () => {
      const output = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 60,
        services: {
          github: {
            connected: false,
          },
          ai: {
            available: false,
            circuitState: 'disabled' as const,
            models: { available: [], unavailable: [] },
          },
          cache: {
            entries: 0,
            persistenceEnabled: false,
          },
        },
      };
      const result = HealthStatusOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });
});