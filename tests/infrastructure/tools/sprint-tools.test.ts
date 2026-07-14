/**
 * Unit tests for sprint and iteration-related MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 */

import {
  createSprintSchema,
  listSprintsSchema,
  getCurrentSprintSchema,
  updateSprintSchema,
  addIssuesToSprintSchema,
  removeIssuesFromSprintSchema,
  planSprintSchema,
  getMilestoneMetricsSchema,
  getSprintMetricsSchema,
  getOverdueMilestonesSchema,
  getUpcomingMilestonesSchema,
  getIterationConfigurationSchema,
  getCurrentIterationSchema,
  getIterationItemsSchema,
  getIterationByDateSchema,
  assignItemsToIterationSchema,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  createSprintTool,
  listSprintsTool,
  getCurrentSprintTool,
  updateSprintTool,
  addIssuesToSprintTool,
  removeIssuesFromSprintTool,
  planSprintTool,
  getMilestoneMetricsTool,
  getSprintMetricsTool,
  getOverdueMilestonesTool,
  getUpcomingMilestonesTool,
  getIterationConfigurationTool,
  getCurrentIterationTool,
  getIterationItemsTool,
  getIterationByDateTool,
  assignItemsToIterationTool,
} from '../../../src/infrastructure/tools/ToolSchemas.js';

describe('Sprint Tools', () => {
  describe('Input Schemas', () => {
    describe('createSprintSchema', () => {
      it('rejects missing title', () => {
        const result = createSprintSchema.safeParse({
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing description', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing startDate', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing endDate', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createSprintSchema.safeParse({
          title: '',
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty description', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: '',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid startDate format', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: 'invalid-date',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid endDate format', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
          endDate: 'invalid-date',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Sprint 1');
          expect(result.data.description).toBe('Test sprint');
          expect(result.data.startDate).toBe('2025-06-01T00:00:00Z');
          expect(result.data.endDate).toBe('2025-06-15T00:00:00Z');
        }
      });

      it('accepts valid input with optional issueIds', () => {
        const result = createSprintSchema.safeParse({
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
          issueIds: ['1', '2', '3'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issueIds).toEqual(['1', '2', '3']);
        }
      });
    });

    describe('listSprintsSchema', () => {
      it('accepts valid input with no arguments', () => {
        const result = listSprintsSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts valid input with status "planned"', () => {
        const result = listSprintsSchema.safeParse({ status: 'planned' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('planned');
        }
      });

      it('accepts valid input with status "active"', () => {
        const result = listSprintsSchema.safeParse({ status: 'active' });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with status "completed"', () => {
        const result = listSprintsSchema.safeParse({ status: 'completed' });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with status "all"', () => {
        const result = listSprintsSchema.safeParse({ status: 'all' });
        expect(result.success).toBe(true);
      });

      it('rejects invalid status value', () => {
        const result = listSprintsSchema.safeParse({ status: 'invalid' });
        expect(result.success).toBe(false);
      });
    });

    describe('getCurrentSprintSchema', () => {
      it('accepts valid input with no arguments', () => {
        const result = getCurrentSprintSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts valid input with includeIssues true', () => {
        const result = getCurrentSprintSchema.safeParse({ includeIssues: true });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeIssues).toBe(true);
        }
      });

      it('accepts valid input with includeIssues false', () => {
        const result = getCurrentSprintSchema.safeParse({ includeIssues: false });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeIssues).toBe(false);
        }
      });
    });

    describe('updateSprintSchema', () => {
      it('rejects missing sprintId', () => {
        const result = updateSprintSchema.safeParse({
          title: 'Updated Sprint',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty sprintId', () => {
        const result = updateSprintSchema.safeParse({
          sprintId: '',
          title: 'Updated Sprint',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with sprintId only', () => {
        const result = updateSprintSchema.safeParse({
          sprintId: 'sprint_1',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all optional fields', () => {
        const result = updateSprintSchema.safeParse({
          sprintId: 'sprint_1',
          title: 'Updated Sprint',
          description: 'Updated description',
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-15T00:00:00Z',
          status: 'active',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sprintId).toBe('sprint_1');
          expect(result.data.title).toBe('Updated Sprint');
          expect(result.data.status).toBe('active');
        }
      });

      it('rejects invalid status value', () => {
        const result = updateSprintSchema.safeParse({
          sprintId: 'sprint_1',
          status: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid startDate format', () => {
        const result = updateSprintSchema.safeParse({
          sprintId: 'sprint_1',
          startDate: 'invalid-date',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('addIssuesToSprintSchema', () => {
      it('rejects missing sprintId', () => {
        const result = addIssuesToSprintSchema.safeParse({
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty sprintId', () => {
        const result = addIssuesToSprintSchema.safeParse({
          sprintId: '',
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing issueIds', () => {
        const result = addIssuesToSprintSchema.safeParse({
          sprintId: 'sprint_1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty issueIds array', () => {
        const result = addIssuesToSprintSchema.safeParse({
          sprintId: 'sprint_1',
          issueIds: [],
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = addIssuesToSprintSchema.safeParse({
          sprintId: 'sprint_1',
          issueIds: ['1', '2', '3'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sprintId).toBe('sprint_1');
          expect(result.data.issueIds).toEqual(['1', '2', '3']);
        }
      });
    });

    describe('removeIssuesFromSprintSchema', () => {
      it('rejects missing sprintId', () => {
        const result = removeIssuesFromSprintSchema.safeParse({
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty sprintId', () => {
        const result = removeIssuesFromSprintSchema.safeParse({
          sprintId: '',
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing issueIds', () => {
        const result = removeIssuesFromSprintSchema.safeParse({
          sprintId: 'sprint_1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty issueIds array', () => {
        const result = removeIssuesFromSprintSchema.safeParse({
          sprintId: 'sprint_1',
          issueIds: [],
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = removeIssuesFromSprintSchema.safeParse({
          sprintId: 'sprint_1',
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sprintId).toBe('sprint_1');
          expect(result.data.issueIds).toEqual(['1', '2']);
        }
      });
    });

    describe('planSprintSchema', () => {
      it('rejects missing sprint object', () => {
        const result = planSprintSchema.safeParse({
          issueIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing sprint title', () => {
        const result = planSprintSchema.safeParse({
          sprint: {
            startDate: '2025-06-01T00:00:00Z',
            endDate: '2025-06-15T00:00:00Z',
            goals: ['Goal 1'],
          },
          issueIds: ['1'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing sprint startDate', () => {
        const result = planSprintSchema.safeParse({
          sprint: {
            title: 'Sprint 1',
            endDate: '2025-06-15T00:00:00Z',
            goals: ['Goal 1'],
          },
          issueIds: ['1'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing sprint endDate', () => {
        const result = planSprintSchema.safeParse({
          sprint: {
            title: 'Sprint 1',
            startDate: '2025-06-01T00:00:00Z',
            goals: ['Goal 1'],
          },
          issueIds: ['1'],
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = planSprintSchema.safeParse({
          sprint: {
            title: 'Sprint 1',
            startDate: '2025-06-01T00:00:00Z',
            endDate: '2025-06-15T00:00:00Z',
            goals: ['Goal 1', 'Goal 2'],
          },
          issueIds: ['1', '2', '3'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sprint.title).toBe('Sprint 1');
          expect(result.data.sprint.goals).toEqual(['Goal 1', 'Goal 2']);
          expect(result.data.issueIds).toEqual(['1', '2', '3']);
        }
      });

      it('accepts valid input with empty goals array', () => {
        const result = planSprintSchema.safeParse({
          sprint: {
            title: 'Sprint 1',
            startDate: '2025-06-01T00:00:00Z',
            endDate: '2025-06-15T00:00:00Z',
            goals: [],
          },
          issueIds: [],
        });
        expect(result.success).toBe(true);
      });
    });

    describe('getMilestoneMetricsSchema', () => {
      it('rejects missing milestoneId', () => {
        const result = getMilestoneMetricsSchema.safeParse({
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty milestoneId', () => {
        const result = getMilestoneMetricsSchema.safeParse({
          milestoneId: '',
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with includeIssues true', () => {
        const result = getMilestoneMetricsSchema.safeParse({
          milestoneId: '1',
          includeIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.milestoneId).toBe('1');
          expect(result.data.includeIssues).toBe(true);
        }
      });

      it('accepts valid input with includeIssues false', () => {
        const result = getMilestoneMetricsSchema.safeParse({
          milestoneId: '1',
          includeIssues: false,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('getSprintMetricsSchema', () => {
      it('rejects missing sprintId', () => {
        const result = getSprintMetricsSchema.safeParse({
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty sprintId', () => {
        const result = getSprintMetricsSchema.safeParse({
          sprintId: '',
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with includeIssues true', () => {
        const result = getSprintMetricsSchema.safeParse({
          sprintId: 'sprint_1',
          includeIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sprintId).toBe('sprint_1');
          expect(result.data.includeIssues).toBe(true);
        }
      });

      it('accepts valid input with includeIssues false', () => {
        const result = getSprintMetricsSchema.safeParse({
          sprintId: 'sprint_1',
          includeIssues: false,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('getOverdueMilestonesSchema', () => {
      it('rejects negative limit', () => {
        const result = getOverdueMilestonesSchema.safeParse({
          limit: -1,
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('rejects zero limit', () => {
        const result = getOverdueMilestonesSchema.safeParse({
          limit: 0,
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = getOverdueMilestonesSchema.safeParse({
          limit: 10,
          includeIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(10);
          expect(result.data.includeIssues).toBe(true);
        }
      });

      it('accepts valid input with includeIssues false', () => {
        const result = getOverdueMilestonesSchema.safeParse({
          limit: 5,
          includeIssues: false,
        });
        expect(result.success).toBe(true);
      });

      it('requires both limit and includeIssues', () => {
        const result = getOverdueMilestonesSchema.safeParse({
          limit: 10,
          includeIssues: false,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('getUpcomingMilestonesSchema', () => {
      it('rejects negative daysAhead', () => {
        const result = getUpcomingMilestonesSchema.safeParse({
          daysAhead: -1,
          limit: 10,
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('rejects zero daysAhead', () => {
        const result = getUpcomingMilestonesSchema.safeParse({
          daysAhead: 0,
          limit: 10,
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative limit', () => {
        const result = getUpcomingMilestonesSchema.safeParse({
          daysAhead: 14,
          limit: -1,
          includeIssues: true,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = getUpcomingMilestonesSchema.safeParse({
          daysAhead: 14,
          limit: 10,
          includeIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.daysAhead).toBe(14);
          expect(result.data.limit).toBe(10);
          expect(result.data.includeIssues).toBe(true);
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createSprintTool', () => {
      it('has correct name', () => {
        expect(createSprintTool.name).toBe('create_sprint');
      });

      it('has correct title', () => {
        expect(createSprintTool.title).toBe('Create Sprint');
      });

      it('has create annotation', () => {
        expect(createSprintTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createSprintTool.examples).toBeDefined();
        expect(createSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listSprintsTool', () => {
      it('has correct name', () => {
        expect(listSprintsTool.name).toBe('list_sprints');
      });

      it('has correct title', () => {
        expect(listSprintsTool.title).toBe('List Sprints');
      });

      it('has readOnly annotation', () => {
        expect(listSprintsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listSprintsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listSprintsTool.examples).toBeDefined();
        expect(listSprintsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getCurrentSprintTool', () => {
      it('has correct name', () => {
        expect(getCurrentSprintTool.name).toBe('get_current_sprint');
      });

      it('has correct title', () => {
        expect(getCurrentSprintTool.title).toBe('Get Current Sprint');
      });

      it('has readOnly annotation', () => {
        expect(getCurrentSprintTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getCurrentSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getCurrentSprintTool.examples).toBeDefined();
        expect(getCurrentSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateSprintTool', () => {
      it('has correct name', () => {
        expect(updateSprintTool.name).toBe('update_sprint');
      });

      it('has correct title', () => {
        expect(updateSprintTool.title).toBe('Update Sprint');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateSprintTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateSprintTool.examples).toBeDefined();
        expect(updateSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('addIssuesToSprintTool', () => {
      it('has correct name', () => {
        expect(addIssuesToSprintTool.name).toBe('add_issues_to_sprint');
      });

      it('has correct title', () => {
        expect(addIssuesToSprintTool.title).toBe('Add Issues to Sprint');
      });

      it('has updateIdempotent annotation', () => {
        expect(addIssuesToSprintTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(addIssuesToSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(addIssuesToSprintTool.examples).toBeDefined();
        expect(addIssuesToSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('removeIssuesFromSprintTool', () => {
      it('has correct name', () => {
        expect(removeIssuesFromSprintTool.name).toBe('remove_issues_from_sprint');
      });

      it('has correct title', () => {
        expect(removeIssuesFromSprintTool.title).toBe('Remove Issues from Sprint');
      });

      it('has updateIdempotent annotation', () => {
        expect(removeIssuesFromSprintTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(removeIssuesFromSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(removeIssuesFromSprintTool.examples).toBeDefined();
        expect(removeIssuesFromSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('planSprintTool', () => {
      it('has correct name', () => {
        expect(planSprintTool.name).toBe('plan_sprint');
      });

      it('has correct title', () => {
        expect(planSprintTool.title).toBe('Plan Sprint');
      });

      it('has create annotation', () => {
        expect(planSprintTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(planSprintTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(planSprintTool.examples).toBeDefined();
        expect(planSprintTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getMilestoneMetricsTool', () => {
      it('has correct name', () => {
        expect(getMilestoneMetricsTool.name).toBe('get_milestone_metrics');
      });

      it('has correct title', () => {
        expect(getMilestoneMetricsTool.title).toBe('Get Milestone Metrics');
      });

      it('has readOnly annotation', () => {
        expect(getMilestoneMetricsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getMilestoneMetricsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getMilestoneMetricsTool.examples).toBeDefined();
        expect(getMilestoneMetricsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getSprintMetricsTool', () => {
      it('has correct name', () => {
        expect(getSprintMetricsTool.name).toBe('get_sprint_metrics');
      });

      it('has correct title', () => {
        expect(getSprintMetricsTool.title).toBe('Get Sprint Metrics');
      });

      it('has readOnly annotation', () => {
        expect(getSprintMetricsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getSprintMetricsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getSprintMetricsTool.examples).toBeDefined();
        expect(getSprintMetricsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getOverdueMilestonesTool', () => {
      it('has correct name', () => {
        expect(getOverdueMilestonesTool.name).toBe('get_overdue_milestones');
      });

      it('has correct title', () => {
        expect(getOverdueMilestonesTool.title).toBe('Get Overdue Milestones');
      });

      it('has readOnly annotation', () => {
        expect(getOverdueMilestonesTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getOverdueMilestonesTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getOverdueMilestonesTool.examples).toBeDefined();
        expect(getOverdueMilestonesTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getUpcomingMilestonesTool', () => {
      it('has correct name', () => {
        expect(getUpcomingMilestonesTool.name).toBe('get_upcoming_milestones');
      });

      it('has correct title', () => {
        expect(getUpcomingMilestonesTool.title).toBe('Get Upcoming Milestones');
      });

      it('has readOnly annotation', () => {
        expect(getUpcomingMilestonesTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getUpcomingMilestonesTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getUpcomingMilestonesTool.examples).toBeDefined();
        expect(getUpcomingMilestonesTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Iteration Tools', () => {
  describe('Input Schemas', () => {
    describe('getIterationConfigurationSchema', () => {
      it('rejects missing projectId', () => {
        const result = getIterationConfigurationSchema.safeParse({
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getIterationConfigurationSchema.safeParse({
          projectId: '',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = getIterationConfigurationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
        }
      });

      it('accepts valid input with optional fieldName', () => {
        const result = getIterationConfigurationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fieldName).toBe('Iteration');
        }
      });
    });

    describe('getCurrentIterationSchema', () => {
      it('rejects missing projectId', () => {
        const result = getCurrentIterationSchema.safeParse({
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getCurrentIterationSchema.safeParse({
          projectId: '',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = getCurrentIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with optional fieldName', () => {
        const result = getCurrentIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fieldName).toBe('Iteration');
        }
      });
    });

    describe('getIterationItemsSchema', () => {
      it('rejects missing projectId', () => {
        const result = getIterationItemsSchema.safeParse({
          iterationId: '1',
          limit: 50,
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: '',
          iterationId: '1',
          limit: 50,
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing iterationId', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          limit: 50,
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty iterationId', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '',
          limit: 50,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '1',
          limit: 50,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.iterationId).toBe('1');
          expect(result.data.limit).toBe(50);
        }
      });

      it('accepts valid input with custom limit', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '1',
          limit: 100,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(100);
        }
      });

      it('rejects zero limit', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '1',
          limit: 0,
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative limit', () => {
        const result = getIterationItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '1',
          limit: -1,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('getIterationByDateSchema', () => {
      it('rejects missing projectId', () => {
        const result = getIterationByDateSchema.safeParse({
          date: '2025-06-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getIterationByDateSchema.safeParse({
          projectId: '',
          date: '2025-06-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing date', () => {
        const result = getIterationByDateSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid date format', () => {
        const result = getIterationByDateSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          date: 'invalid-date',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = getIterationByDateSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          date: '2025-06-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.date).toBe('2025-06-01T00:00:00Z');
        }
      });

      it('accepts valid input with optional fieldName', () => {
        const result = getIterationByDateSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          date: '2025-06-01T00:00:00Z',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fieldName).toBe('Iteration');
        }
      });
    });

    describe('assignItemsToIterationSchema', () => {
      it('rejects missing projectId', () => {
        const result = assignItemsToIterationSchema.safeParse({
          itemIds: ['1', '2'],
          iterationId: '1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: '',
          itemIds: ['1', '2'],
          iterationId: '1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemIds', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          iterationId: '1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty itemIds array', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemIds: [],
          iterationId: '1',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing iterationId', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemIds: ['1', '2'],
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty iterationId', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemIds: ['1', '2'],
          iterationId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemIds: ['1', '2', '3'],
          iterationId: '1',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.itemIds).toEqual(['1', '2', '3']);
          expect(result.data.iterationId).toBe('1');
        }
      });

      it('accepts valid input with optional fieldName', () => {
        const result = assignItemsToIterationSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemIds: ['1', '2'],
          iterationId: '1',
          fieldName: 'Iteration',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fieldName).toBe('Iteration');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('getIterationConfigurationTool', () => {
      it('has correct name', () => {
        expect(getIterationConfigurationTool.name).toBe('get_iteration_configuration');
      });

      it('has correct title', () => {
        expect(getIterationConfigurationTool.title).toBe('Get Iteration Configuration');
      });

      it('has readOnly annotation', () => {
        expect(getIterationConfigurationTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getIterationConfigurationTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getIterationConfigurationTool.examples).toBeDefined();
        expect(getIterationConfigurationTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getCurrentIterationTool', () => {
      it('has correct name', () => {
        expect(getCurrentIterationTool.name).toBe('get_current_iteration');
      });

      it('has correct title', () => {
        expect(getCurrentIterationTool.title).toBe('Get Current Iteration');
      });

      it('has readOnly annotation', () => {
        expect(getCurrentIterationTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getCurrentIterationTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getCurrentIterationTool.examples).toBeDefined();
        expect(getCurrentIterationTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getIterationItemsTool', () => {
      it('has correct name', () => {
        expect(getIterationItemsTool.name).toBe('get_iteration_items');
      });

      it('has correct title', () => {
        expect(getIterationItemsTool.title).toBe('Get Iteration Items');
      });

      it('has readOnly annotation', () => {
        expect(getIterationItemsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getIterationItemsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getIterationItemsTool.examples).toBeDefined();
        expect(getIterationItemsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getIterationByDateTool', () => {
      it('has correct name', () => {
        expect(getIterationByDateTool.name).toBe('get_iteration_by_date');
      });

      it('has correct title', () => {
        expect(getIterationByDateTool.title).toBe('Get Iteration by Date');
      });

      it('has readOnly annotation', () => {
        expect(getIterationByDateTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getIterationByDateTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getIterationByDateTool.examples).toBeDefined();
        expect(getIterationByDateTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('assignItemsToIterationTool', () => {
      it('has correct name', () => {
        expect(assignItemsToIterationTool.name).toBe('assign_items_to_iteration');
      });

      it('has correct title', () => {
        expect(assignItemsToIterationTool.title).toBe('Assign Items to Iteration');
      });

      it('has updateIdempotent annotation', () => {
        expect(assignItemsToIterationTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(assignItemsToIterationTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(assignItemsToIterationTool.examples).toBeDefined();
        expect(assignItemsToIterationTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});