/**
 * Unit tests for issue-related MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 */

import {
  createIssueSchema,
  listIssuesSchema,
  getIssueSchema,
  updateIssueSchema,
  createIssueCommentSchema,
  updateIssueCommentSchema,
  deleteIssueCommentSchema,
  listIssueCommentsSchema,
  createDraftIssueSchema,
  updateDraftIssueSchema,
  deleteDraftIssueSchema,
  createMilestoneSchema,
  listMilestonesSchema,
  updateMilestoneSchema,
  deleteMilestoneSchema,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  createIssueTool,
  listIssuesTool,
  getIssueTool,
  updateIssueTool,
  createIssueCommentTool,
  updateIssueCommentTool,
  deleteIssueCommentTool,
  listIssueCommentsTool,
  createDraftIssueTool,
  updateDraftIssueTool,
  deleteDraftIssueTool,
  createMilestoneTool,
  listMilestonesTool,
  updateMilestoneTool,
  deleteMilestoneTool,
} from '../../../src/infrastructure/tools/ToolSchemas.js';

describe('Issue Tools', () => {
  describe('Input Schemas', () => {
    describe('createIssueSchema', () => {
      it('rejects missing title', () => {
        const result = createIssueSchema.safeParse({
          description: 'Test description',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing description', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createIssueSchema.safeParse({
          title: '',
          description: 'Test description',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty description', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: 'Test description',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Test Issue');
          expect(result.data.description).toBe('Test description');
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: 'Test description',
          milestoneId: 'MT_kwDOTest123',
          assignees: ['user1', 'user2'],
          labels: ['bug', 'priority'],
          priority: 'high',
          type: 'bug',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.milestoneId).toBe('MT_kwDOTest123');
          expect(result.data.assignees).toEqual(['user1', 'user2']);
          expect(result.data.labels).toEqual(['bug', 'priority']);
          expect(result.data.priority).toBe('high');
          expect(result.data.type).toBe('bug');
        }
      });

      it('accepts valid input with required fields', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: 'Test description',
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid priority value', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: 'Test description',
          priority: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid type value', () => {
        const result = createIssueSchema.safeParse({
          title: 'Test Issue',
          description: 'Test description',
          type: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('listIssuesSchema', () => {
      it('accepts valid input', () => {
        const result = listIssuesSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all optional fields', () => {
        const result = listIssuesSchema.safeParse({
          status: 'closed',
          milestone: 'MT_kwDOTest123',
          labels: ['bug', 'enhancement'],
          assignee: 'user1',
          sort: 'updated',
          direction: 'asc',
          limit: 50,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('closed');
          expect(result.data.milestone).toBe('MT_kwDOTest123');
          expect(result.data.labels).toEqual(['bug', 'enhancement']);
          expect(result.data.assignee).toBe('user1');
          expect(result.data.sort).toBe('updated');
          expect(result.data.direction).toBe('asc');
          expect(result.data.limit).toBe(50);
        }
      });

      it('rejects invalid status value', () => {
        const result = listIssuesSchema.safeParse({
          status: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid sort value', () => {
        const result = listIssuesSchema.safeParse({
          sort: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid direction value', () => {
        const result = listIssuesSchema.safeParse({
          direction: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-positive limit', () => {
        const result = listIssuesSchema.safeParse({
          limit: 0,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('getIssueSchema', () => {
      it('rejects missing issueId', () => {
        const result = getIssueSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty issueId', () => {
        const result = getIssueSchema.safeParse({
          issueId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid issueId', () => {
        const result = getIssueSchema.safeParse({
          issueId: '42',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issueId).toBe('42');
        }
      });
    });

    describe('updateIssueSchema', () => {
      it('rejects missing issueId', () => {
        const result = updateIssueSchema.safeParse({
          title: 'Updated Title',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty issueId', () => {
        const result = updateIssueSchema.safeParse({
          issueId: '',
          title: 'Updated Title',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with issueId only', () => {
        const result = updateIssueSchema.safeParse({
          issueId: '42',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all optional fields', () => {
        const result = updateIssueSchema.safeParse({
          issueId: '42',
          title: 'Updated Title',
          description: 'Updated description',
          status: 'closed',
          milestoneId: 'MT_kwDOTest123',
          assignees: ['user1'],
          labels: ['bug'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issueId).toBe('42');
          expect(result.data.title).toBe('Updated Title');
          expect(result.data.description).toBe('Updated description');
          expect(result.data.status).toBe('closed');
          expect(result.data.milestoneId).toBe('MT_kwDOTest123');
          expect(result.data.assignees).toEqual(['user1']);
          expect(result.data.labels).toEqual(['bug']);
        }
      });

      it('rejects invalid status value', () => {
        const result = updateIssueSchema.safeParse({
          issueId: '42',
          status: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createIssueTool', () => {
      it('has correct name', () => {
        expect(createIssueTool.name).toBe('create_issue');
      });

      it('has correct title', () => {
        expect(createIssueTool.title).toBe('Create Issue');
      });

      it('has create annotation', () => {
        expect(createIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createIssueTool.examples).toBeDefined();
        expect(createIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listIssuesTool', () => {
      it('has correct name', () => {
        expect(listIssuesTool.name).toBe('list_issues');
      });

      it('has correct title', () => {
        expect(listIssuesTool.title).toBe('List Issues');
      });

      it('has readOnly annotation', () => {
        expect(listIssuesTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listIssuesTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listIssuesTool.examples).toBeDefined();
        expect(listIssuesTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getIssueTool', () => {
      it('has correct name', () => {
        expect(getIssueTool.name).toBe('get_issue');
      });

      it('has correct title', () => {
        expect(getIssueTool.title).toBe('Get Issue');
      });

      it('has readOnly annotation', () => {
        expect(getIssueTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getIssueTool.examples).toBeDefined();
        expect(getIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateIssueTool', () => {
      it('has correct name', () => {
        expect(updateIssueTool.name).toBe('update_issue');
      });

      it('has correct title', () => {
        expect(updateIssueTool.title).toBe('Update Issue');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateIssueTool.examples).toBeDefined();
        expect(updateIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Issue Comment Tools', () => {
  describe('Input Schemas', () => {
    describe('createIssueCommentSchema', () => {
      it('rejects missing issueNumber', () => {
        const result = createIssueCommentSchema.safeParse({
          body: 'Test comment',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing body', () => {
        const result = createIssueCommentSchema.safeParse({
          issueNumber: 42,
        });
        expect(result.success).toBe(false);
      });

      it('rejects zero issueNumber', () => {
        const result = createIssueCommentSchema.safeParse({
          issueNumber: 0,
          body: 'Test comment',
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative issueNumber', () => {
        const result = createIssueCommentSchema.safeParse({
          issueNumber: -1,
          body: 'Test comment',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty body', () => {
        const result = createIssueCommentSchema.safeParse({
          issueNumber: 42,
          body: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = createIssueCommentSchema.safeParse({
          issueNumber: 42,
          body: 'Test comment',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issueNumber).toBe(42);
          expect(result.data.body).toBe('Test comment');
        }
      });
    });

    describe('updateIssueCommentSchema', () => {
      it('rejects missing commentId', () => {
        const result = updateIssueCommentSchema.safeParse({
          body: 'Updated comment',
        });
        expect(result.success).toBe(false);
      });

      it('rejects zero commentId', () => {
        const result = updateIssueCommentSchema.safeParse({
          commentId: 0,
          body: 'Updated comment',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing body', () => {
        const result = updateIssueCommentSchema.safeParse({
          commentId: 123,
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty body', () => {
        const result = updateIssueCommentSchema.safeParse({
          commentId: 123,
          body: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = updateIssueCommentSchema.safeParse({
          commentId: 123,
          body: 'Updated comment',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.commentId).toBe(123);
          expect(result.data.body).toBe('Updated comment');
        }
      });
    });

    describe('deleteIssueCommentSchema', () => {
      it('rejects missing commentId', () => {
        const result = deleteIssueCommentSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects zero commentId', () => {
        const result = deleteIssueCommentSchema.safeParse({
          commentId: 0,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = deleteIssueCommentSchema.safeParse({
          commentId: 123,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.commentId).toBe(123);
        }
      });
    });

describe('listIssueCommentsSchema', () => {
      it('accepts valid input with issueNumber', () => {
        const result = listIssueCommentsSchema.safeParse({
          issueNumber: 42,
        });
        expect(result.success).toBe(true);
      });

      it('rejects zero issueNumber', () => {
        const result = listIssueCommentsSchema.safeParse({
          issueNumber: 0,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input without perPage', () => {
        const result = listIssueCommentsSchema.safeParse({
          issueNumber: 42,
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with perPage', () => {
        const result = listIssueCommentsSchema.safeParse({
          issueNumber: 42,
          perPage: 50,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.perPage).toBe(50);
        }
      });

      it('rejects perPage over 100', () => {
        const result = listIssueCommentsSchema.safeParse({
          issueNumber: 42,
          perPage: 101,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createIssueCommentTool', () => {
      it('has correct name', () => {
        expect(createIssueCommentTool.name).toBe('create_issue_comment');
      });

      it('has correct title', () => {
        expect(createIssueCommentTool.title).toBe('Create Issue Comment');
      });

      it('has create annotation', () => {
        expect(createIssueCommentTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createIssueCommentTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createIssueCommentTool.examples).toBeDefined();
        expect(createIssueCommentTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateIssueCommentTool', () => {
      it('has correct name', () => {
        expect(updateIssueCommentTool.name).toBe('update_issue_comment');
      });

      it('has correct title', () => {
        expect(updateIssueCommentTool.title).toBe('Update Issue Comment');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateIssueCommentTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateIssueCommentTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateIssueCommentTool.examples).toBeDefined();
        expect(updateIssueCommentTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('deleteIssueCommentTool', () => {
      it('has correct name', () => {
        expect(deleteIssueCommentTool.name).toBe('delete_issue_comment');
      });

      it('has correct title', () => {
        expect(deleteIssueCommentTool.title).toBe('Delete Issue Comment');
      });

      it('has delete annotation', () => {
        expect(deleteIssueCommentTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(deleteIssueCommentTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(deleteIssueCommentTool.examples).toBeDefined();
        expect(deleteIssueCommentTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listIssueCommentsTool', () => {
      it('has correct name', () => {
        expect(listIssueCommentsTool.name).toBe('list_issue_comments');
      });

      it('has correct title', () => {
        expect(listIssueCommentsTool.title).toBe('List Issue Comments');
      });

      it('has readOnly annotation', () => {
        expect(listIssueCommentsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listIssueCommentsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listIssueCommentsTool.examples).toBeDefined();
        expect(listIssueCommentsTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Draft Issue Tools', () => {
  describe('Input Schemas', () => {
    describe('createDraftIssueSchema', () => {
      it('rejects missing projectId', () => {
        const result = createDraftIssueSchema.safeParse({
          title: 'Draft Issue',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = createDraftIssueSchema.safeParse({
          projectId: '',
          title: 'Draft Issue',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing title', () => {
        const result = createDraftIssueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createDraftIssueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          title: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createDraftIssueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          title: 'Draft Issue',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.title).toBe('Draft Issue');
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createDraftIssueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          title: 'Draft Issue',
          body: 'Draft body',
          assigneeIds: ['U_kgDOTestUser'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body).toBe('Draft body');
          expect(result.data.assigneeIds).toEqual(['U_kgDOTestUser']);
        }
      });
    });

    describe('updateDraftIssueSchema', () => {
      it('rejects missing draftIssueId', () => {
        const result = updateDraftIssueSchema.safeParse({
          title: 'Updated Draft',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty draftIssueId', () => {
        const result = updateDraftIssueSchema.safeParse({
          draftIssueId: '',
          title: 'Updated Draft',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with draftIssueId only', () => {
        const result = updateDraftIssueSchema.safeParse({
          draftIssueId: 'PVTI_lADOTest123',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all fields', () => {
        const result = updateDraftIssueSchema.safeParse({
          draftIssueId: 'PVTI_lADOTest123',
          title: 'Updated Draft',
          body: 'Updated body',
          assigneeIds: ['U_kgDOTestUser'],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.draftIssueId).toBe('PVTI_lADOTest123');
          expect(result.data.title).toBe('Updated Draft');
          expect(result.data.body).toBe('Updated body');
          expect(result.data.assigneeIds).toEqual(['U_kgDOTestUser']);
        }
      });
    });

    describe('deleteDraftIssueSchema', () => {
      it('rejects missing draftIssueId', () => {
        const result = deleteDraftIssueSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty draftIssueId', () => {
        const result = deleteDraftIssueSchema.safeParse({
          draftIssueId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = deleteDraftIssueSchema.safeParse({
          draftIssueId: 'PVTI_lADOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.draftIssueId).toBe('PVTI_lADOTest123');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createDraftIssueTool', () => {
      it('has correct name', () => {
        expect(createDraftIssueTool.name).toBe('create_draft_issue');
      });

      it('has correct title', () => {
        expect(createDraftIssueTool.title).toBe('Create Draft Issue');
      });

      it('has create annotation', () => {
        expect(createDraftIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createDraftIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createDraftIssueTool.examples).toBeDefined();
        expect(createDraftIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateDraftIssueTool', () => {
      it('has correct name', () => {
        expect(updateDraftIssueTool.name).toBe('update_draft_issue');
      });

      it('has correct title', () => {
        expect(updateDraftIssueTool.title).toBe('Update Draft Issue');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateDraftIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateDraftIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateDraftIssueTool.examples).toBeDefined();
        expect(updateDraftIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('deleteDraftIssueTool', () => {
      it('has correct name', () => {
        expect(deleteDraftIssueTool.name).toBe('delete_draft_issue');
      });

      it('has correct title', () => {
        expect(deleteDraftIssueTool.title).toBe('Delete Draft Issue');
      });

      it('has delete annotation', () => {
        expect(deleteDraftIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(deleteDraftIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(deleteDraftIssueTool.examples).toBeDefined();
        expect(deleteDraftIssueTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Milestone Tools', () => {
  describe('Input Schemas', () => {
    describe('createMilestoneSchema', () => {
      it('rejects missing title', () => {
        const result = createMilestoneSchema.safeParse({
          description: 'Test description',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing description', () => {
        const result = createMilestoneSchema.safeParse({
          title: 'Test Milestone',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createMilestoneSchema.safeParse({
          title: '',
          description: 'Test description',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty description', () => {
        const result = createMilestoneSchema.safeParse({
          title: 'Test Milestone',
          description: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createMilestoneSchema.safeParse({
          title: 'Test Milestone',
          description: 'Test description',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Test Milestone');
          expect(result.data.description).toBe('Test description');
        }
      });

      it('accepts valid input with optional dueDate', () => {
        const result = createMilestoneSchema.safeParse({
          title: 'Test Milestone',
          description: 'Test description',
          dueDate: '2025-06-30T00:00:00Z',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.dueDate).toBe('2025-06-30T00:00:00Z');
        }
      });

      it('rejects invalid dueDate format', () => {
        const result = createMilestoneSchema.safeParse({
          title: 'Test Milestone',
          description: 'Test description',
          dueDate: 'invalid-date',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('listMilestonesSchema', () => {
      it('accepts valid input', () => {
        const result = listMilestonesSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all optional fields', () => {
        const result = listMilestonesSchema.safeParse({
          status: 'closed',
          sort: 'due_date',
          direction: 'desc',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('closed');
          expect(result.data.sort).toBe('due_date');
          expect(result.data.direction).toBe('desc');
        }
      });

      it('rejects invalid status value', () => {
        const result = listMilestonesSchema.safeParse({
          status: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid sort value', () => {
        const result = listMilestonesSchema.safeParse({
          sort: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid direction value', () => {
        const result = listMilestonesSchema.safeParse({
          direction: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updateMilestoneSchema', () => {
      it('rejects missing milestoneId', () => {
        const result = updateMilestoneSchema.safeParse({
          title: 'Updated Milestone',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty milestoneId', () => {
        const result = updateMilestoneSchema.safeParse({
          milestoneId: '',
          title: 'Updated Milestone',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with milestoneId only', () => {
        const result = updateMilestoneSchema.safeParse({
          milestoneId: 'MT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all fields', () => {
        const result = updateMilestoneSchema.safeParse({
          milestoneId: 'MT_kwDOTest123',
          title: 'Updated Milestone',
          description: 'Updated description',
          dueDate: '2025-07-15T00:00:00Z',
          state: 'closed',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.milestoneId).toBe('MT_kwDOTest123');
          expect(result.data.title).toBe('Updated Milestone');
          expect(result.data.description).toBe('Updated description');
          expect(result.data.dueDate).toBe('2025-07-15T00:00:00Z');
          expect(result.data.state).toBe('closed');
        }
      });

      it('rejects null dueDate to clear it', () => {
        const result = updateMilestoneSchema.safeParse({
          milestoneId: 'MT_kwDOTest123',
          dueDate: null,
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid state value', () => {
        const result = updateMilestoneSchema.safeParse({
          milestoneId: 'MT_kwDOTest123',
          state: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('deleteMilestoneSchema', () => {
      it('rejects missing milestoneId', () => {
        const result = deleteMilestoneSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty milestoneId', () => {
        const result = deleteMilestoneSchema.safeParse({
          milestoneId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = deleteMilestoneSchema.safeParse({
          milestoneId: 'MT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.milestoneId).toBe('MT_kwDOTest123');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createMilestoneTool', () => {
      it('has correct name', () => {
        expect(createMilestoneTool.name).toBe('create_milestone');
      });

      it('has correct title', () => {
        expect(createMilestoneTool.title).toBe('Create Milestone');
      });

      it('has create annotation', () => {
        expect(createMilestoneTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createMilestoneTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createMilestoneTool.examples).toBeDefined();
        expect(createMilestoneTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listMilestonesTool', () => {
      it('has correct name', () => {
        expect(listMilestonesTool.name).toBe('list_milestones');
      });

      it('has correct title', () => {
        expect(listMilestonesTool.title).toBe('List Milestones');
      });

      it('has readOnly annotation', () => {
        expect(listMilestonesTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listMilestonesTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listMilestonesTool.examples).toBeDefined();
        expect(listMilestonesTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateMilestoneTool', () => {
      it('has correct name', () => {
        expect(updateMilestoneTool.name).toBe('update_milestone');
      });

      it('has correct title', () => {
        expect(updateMilestoneTool.title).toBe('Update Milestone');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateMilestoneTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateMilestoneTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateMilestoneTool.examples).toBeDefined();
        expect(updateMilestoneTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('deleteMilestoneTool', () => {
      it('has correct name', () => {
        expect(deleteMilestoneTool.name).toBe('delete_milestone');
      });

      it('has correct title', () => {
        expect(deleteMilestoneTool.title).toBe('Delete Milestone');
      });

      it('has delete annotation', () => {
        expect(deleteMilestoneTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(deleteMilestoneTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(deleteMilestoneTool.examples).toBeDefined();
        expect(deleteMilestoneTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});