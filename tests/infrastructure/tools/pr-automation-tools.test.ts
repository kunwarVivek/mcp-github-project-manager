/**
 * Unit tests for PR, automation, and label MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 */

import {
  createPullRequestSchema,
  getPullRequestSchema,
  listPullRequestsSchema,
  updatePullRequestSchema,
  mergePullRequestSchema,
  listPullRequestReviewsSchema,
  createPullRequestReviewSchema,
  createAutomationRuleSchema,
  listAutomationRulesSchema,
  getAutomationRuleSchema,
  updateAutomationRuleSchema,
  deleteAutomationRuleSchema,
  enableAutomationRuleSchema,
  disableAutomationRuleSchema,
  createLabelSchema,
  listLabelsSchema,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  createPullRequestTool,
  getPullRequestTool,
  listPullRequestsTool,
  updatePullRequestTool,
  mergePullRequestTool,
  listPullRequestReviewsTool,
  createPullRequestReviewTool,
  createAutomationRuleTool,
  listAutomationRulesTool,
  getAutomationRuleTool,
  updateAutomationRuleTool,
  deleteAutomationRuleTool,
  enableAutomationRuleTool,
  disableAutomationRuleTool,
  createLabelTool,
  listLabelsTool,
} from '../../../src/infrastructure/tools/ToolSchemas.js';

describe('PR Tools', () => {
  describe('Input Schemas', () => {
    describe('createPullRequestSchema', () => {
      it('rejects missing title', () => {
        const result = createPullRequestSchema.safeParse({
          body: 'Test body',
          head: 'feature/test',
          base: 'main'
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing head branch', () => {
        const result = createPullRequestSchema.safeParse({
          title: 'Test PR',
          body: 'Test body',
          base: 'main'
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing base branch', () => {
        const result = createPullRequestSchema.safeParse({
          title: 'Test PR',
          body: 'Test body',
          head: 'feature/test'
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createPullRequestSchema.safeParse({
          title: '',
          head: 'feature/test',
          base: 'main'
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty head branch', () => {
        const result = createPullRequestSchema.safeParse({
          title: 'Test PR',
          head: '',
          base: 'main'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createPullRequestSchema.safeParse({
          title: 'Test PR',
          head: 'feature/test',
          base: 'main'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Test PR');
          expect(result.data.head).toBe('feature/test');
          expect(result.data.base).toBe('main');
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createPullRequestSchema.safeParse({
          title: 'Test PR',
          body: 'Test body content',
          head: 'feature/test',
          base: 'main',
          draft: true
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Test PR');
          expect(result.data.body).toBe('Test body content');
          expect(result.data.draft).toBe(true);
        }
      });
    });

    describe('getPullRequestSchema', () => {
      it('rejects missing pullNumber', () => {
        const result = getPullRequestSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects zero pullNumber', () => {
        const result = getPullRequestSchema.safeParse({
          pullNumber: 0
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative pullNumber', () => {
        const result = getPullRequestSchema.safeParse({
          pullNumber: -1
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-integer pullNumber', () => {
        const result = getPullRequestSchema.safeParse({
          pullNumber: 1.5
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with pullNumber', () => {
        const result = getPullRequestSchema.safeParse({
          pullNumber: 42
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pullNumber).toBe(42);
        }
      });
    });

    describe('listPullRequestsSchema', () => {
      it('accepts valid input without optional fields', () => {
        const result = listPullRequestsSchema.safeParse({});
        expect(result.success).toBe(true);
        // Note: defaults are not applied until runtime, safeParse returns undefined
        expect(result.data).toBeDefined();
      });

      it('accepts valid input with state: open', () => {
        const result = listPullRequestsSchema.safeParse({
          state: 'open'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with state: closed', () => {
        const result = listPullRequestsSchema.safeParse({
          state: 'closed'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with state: all', () => {
        const result = listPullRequestsSchema.safeParse({
          state: 'all'
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid state', () => {
        const result = listPullRequestsSchema.safeParse({
          state: 'invalid'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with perPage', () => {
        const result = listPullRequestsSchema.safeParse({
          perPage: 50
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.perPage).toBe(50);
        }
      });

      it('rejects perPage over 100', () => {
        const result = listPullRequestsSchema.safeParse({
          perPage: 101
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updatePullRequestSchema', () => {
      it('rejects missing pullNumber', () => {
        const result = updatePullRequestSchema.safeParse({
          title: 'Updated PR'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with pullNumber only', () => {
        const result = updatePullRequestSchema.safeParse({
          pullNumber: 42
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with title update', () => {
        const result = updatePullRequestSchema.safeParse({
          pullNumber: 42,
          title: 'Updated PR Title'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Updated PR Title');
        }
      });

      it('accepts valid input with body update', () => {
        const result = updatePullRequestSchema.safeParse({
          pullNumber: 42,
          body: 'Updated body content'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with state: open', () => {
        const result = updatePullRequestSchema.safeParse({
          pullNumber: 42,
          state: 'open'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with state: closed', () => {
        const result = updatePullRequestSchema.safeParse({
          pullNumber: 42,
          state: 'closed'
        });
        expect(result.success).toBe(true);
      });
    });

    describe('mergePullRequestSchema', () => {
      it('rejects missing pullNumber', () => {
        const result = mergePullRequestSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts valid input with pullNumber only', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pullNumber).toBe(42);
        }
      });

      it('accepts valid input with mergeMethod: merge', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42,
          mergeMethod: 'merge'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with mergeMethod: squash', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42,
          mergeMethod: 'squash'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with mergeMethod: rebase', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42,
          mergeMethod: 'rebase'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with commitTitle', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42,
          commitTitle: 'feat: Add feature'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with commitMessage', () => {
        const result = mergePullRequestSchema.safeParse({
          pullNumber: 42,
          commitMessage: 'This closes #42'
        });
        expect(result.success).toBe(true);
      });
    });

    describe('listPullRequestReviewsSchema', () => {
      it('rejects missing pullNumber', () => {
        const result = listPullRequestReviewsSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects zero pullNumber', () => {
        const result = listPullRequestReviewsSchema.safeParse({
          pullNumber: 0
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with pullNumber', () => {
        const result = listPullRequestReviewsSchema.safeParse({
          pullNumber: 42
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pullNumber).toBe(42);
        }
      });
    });

    describe('createPullRequestReviewSchema', () => {
      it('rejects missing pullNumber', () => {
        const result = createPullRequestReviewSchema.safeParse({
          event: 'APPROVE'
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing event', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with event: APPROVE', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42,
          event: 'APPROVE'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with event: REQUEST_CHANGES', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42,
          event: 'REQUEST_CHANGES',
          body: 'Please fix this'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with event: COMMENT', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42,
          event: 'COMMENT',
          body: 'Just a comment'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with inline comments', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42,
          event: 'REQUEST_CHANGES',
          body: 'Please address these comments',
          comments: [
            {
              path: 'src/auth.ts',
              position: 15,
              body: 'Consider using bcrypt'
            }
          ]
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.comments).toHaveLength(1);
          expect(result.data.comments![0].path).toBe('src/auth.ts');
        }
      });

      it('rejects invalid event', () => {
        const result = createPullRequestReviewSchema.safeParse({
          pullNumber: 42,
          event: 'INVALID'
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createPullRequestTool', () => {
      it('has correct name', () => {
        expect(createPullRequestTool.name).toBe('create_pull_request');
      });

      it('has correct title', () => {
        expect(createPullRequestTool.title).toBe('Create Pull Request');
      });

      it('has create annotation', () => {
        expect(createPullRequestTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createPullRequestTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createPullRequestTool.examples).toBeDefined();
        expect(createPullRequestTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getPullRequestTool', () => {
      it('has correct name', () => {
        expect(getPullRequestTool.name).toBe('get_pull_request');
      });

      it('has correct title', () => {
        expect(getPullRequestTool.title).toBe('Get Pull Request');
      });

      it('has readOnly annotation', () => {
        expect(getPullRequestTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('listPullRequestsTool', () => {
      it('has correct name', () => {
        expect(listPullRequestsTool.name).toBe('list_pull_requests');
      });

      it('has readOnly annotation', () => {
        expect(listPullRequestsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('updatePullRequestTool', () => {
      it('has correct name', () => {
        expect(updatePullRequestTool.name).toBe('update_pull_request');
      });

      it('has updateIdempotent annotation', () => {
        expect(updatePullRequestTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('mergePullRequestTool', () => {
      it('has correct name', () => {
        expect(mergePullRequestTool.name).toBe('merge_pull_request');
      });

      it('has updateNonIdempotent annotation', () => {
        expect(mergePullRequestTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });
    });

    describe('listPullRequestReviewsTool', () => {
      it('has correct name', () => {
        expect(listPullRequestReviewsTool.name).toBe('list_pull_request_reviews');
      });

      it('has readOnly annotation', () => {
        expect(listPullRequestReviewsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('createPullRequestReviewTool', () => {
      it('has correct name', () => {
        expect(createPullRequestReviewTool.name).toBe('create_pull_request_review');
      });

      it('has correct title', () => {
        expect(createPullRequestReviewTool.title).toBe('Create Pull Request Review');
      });

      it('has create annotation', () => {
        expect(createPullRequestReviewTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });
    });
  });
});

describe('Automation Tools', () => {
  describe('Input Schemas', () => {
    describe('createAutomationRuleSchema', () => {
      it('rejects missing name', () => {
        const result = createAutomationRuleSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          enabled: true,
          triggers: [{ type: 'pr_opened' }],
          actions: [{ type: 'add_label', parameters: { labelName: 'needs-review' } }]
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing projectId', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: 'Auto-label PRs',
          enabled: true,
          triggers: [{ type: 'pr_opened' }],
          actions: [{ type: 'add_label', parameters: { labelName: 'needs-review' } }]
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty name', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: '',
          projectId: 'PVT_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: 'Auto-label PRs',
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          triggers: [{ type: 'pr_opened' }],
          actions: [{ type: 'add_label', parameters: { labelName: 'needs-review' } }]
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('Auto-label PRs');
          expect(result.data.enabled).toBe(true);
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: 'Auto-label PRs',
          description: 'Automatically label new PRs',
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          enabled: false,
          triggers: [{ type: 'issue_labeled', conditions: [{ field: 'label', operator: 'equals', value: 'bug' }] }],
          actions: [{ type: 'assign_user', parameters: { username: 'maintainer' } }]
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.enabled).toBe(false);
          expect(result.data.description).toBe('Automatically label new PRs');
        }
      });

      it('accepts multiple triggers', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: 'Multi trigger rule',
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          triggers: [
            { type: 'pr_opened' },
            { type: 'pr_merged' }
          ],
          actions: [{ type: 'add_label', parameters: { labelName: 'done' } }]
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.triggers).toHaveLength(2);
        }
      });

      it('accepts multiple actions', () => {
        const result = createAutomationRuleSchema.safeParse({
          name: 'Multi action rule',
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          triggers: [{ type: 'pr_opened' }],
          actions: [
            { type: 'add_label', parameters: { labelName: 'needs-review' } },
            { type: 'assign_user', parameters: { username: 'reviewer' } }
          ]
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.actions).toHaveLength(2);
        }
      });
    });

    describe('listAutomationRulesSchema', () => {
      it('rejects missing projectId', () => {
        const result = listAutomationRulesSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = listAutomationRulesSchema.safeParse({
          projectId: ''
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with projectId', () => {
        const result = listAutomationRulesSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('getAutomationRuleSchema', () => {
      it('rejects missing ruleId', () => {
        const result = getAutomationRuleSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty ruleId', () => {
        const result = getAutomationRuleSchema.safeParse({
          ruleId: ''
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with ruleId', () => {
        const result = getAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.ruleId).toBe('AR_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('updateAutomationRuleSchema', () => {
      it('rejects missing ruleId', () => {
        const result = updateAutomationRuleSchema.safeParse({
          name: 'Updated rule name'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with ruleId only', () => {
        const result = updateAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with name update', () => {
        const result = updateAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH',
          name: 'Updated rule name'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('Updated rule name');
        }
      });

      it('accepts valid input with enabled update', () => {
        const result = updateAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH',
          enabled: false
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with triggers update', () => {
        const result = updateAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH',
          triggers: [{ type: 'issue_closed' }]
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with actions update', () => {
        const result = updateAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH',
          actions: [{ type: 'add_label', parameters: { labelName: 'closed' } }]
        });
        expect(result.success).toBe(true);
      });
    });

    describe('deleteAutomationRuleSchema', () => {
      it('rejects missing ruleId', () => {
        const result = deleteAutomationRuleSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty ruleId', () => {
        const result = deleteAutomationRuleSchema.safeParse({
          ruleId: ''
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with ruleId', () => {
        const result = deleteAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.ruleId).toBe('AR_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('enableAutomationRuleSchema', () => {
      it('rejects missing ruleId', () => {
        const result = enableAutomationRuleSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty ruleId', () => {
        const result = enableAutomationRuleSchema.safeParse({
          ruleId: ''
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with ruleId', () => {
        const result = enableAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.ruleId).toBe('AR_kwDOLhQ7gc4AOEbH');
        }
      });
    });

    describe('disableAutomationRuleSchema', () => {
      it('rejects missing ruleId', () => {
        const result = disableAutomationRuleSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty ruleId', () => {
        const result = disableAutomationRuleSchema.safeParse({
          ruleId: ''
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with ruleId', () => {
        const result = disableAutomationRuleSchema.safeParse({
          ruleId: 'AR_kwDOLhQ7gc4AOEbH'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.ruleId).toBe('AR_kwDOLhQ7gc4AOEbH');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(createAutomationRuleTool.name).toBe('create_automation_rule');
      });

      it('has correct title', () => {
        expect(createAutomationRuleTool.title).toBe('Create Automation Rule');
      });

      it('has create annotation', () => {
        expect(createAutomationRuleTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createAutomationRuleTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createAutomationRuleTool.examples).toBeDefined();
        expect(createAutomationRuleTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listAutomationRulesTool', () => {
      it('has correct name', () => {
        expect(listAutomationRulesTool.name).toBe('list_automation_rules');
      });

      it('has readOnly annotation', () => {
        expect(listAutomationRulesTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('getAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(getAutomationRuleTool.name).toBe('get_automation_rule');
      });

      it('has readOnly annotation', () => {
        expect(getAutomationRuleTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('updateAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(updateAutomationRuleTool.name).toBe('update_automation_rule');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateAutomationRuleTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('deleteAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(deleteAutomationRuleTool.name).toBe('delete_automation_rule');
      });

      it('has delete annotation', () => {
        expect(deleteAutomationRuleTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('enableAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(enableAutomationRuleTool.name).toBe('enable_automation_rule');
      });

      it('has updateIdempotent annotation', () => {
        expect(enableAutomationRuleTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });

    describe('disableAutomationRuleTool', () => {
      it('has correct name', () => {
        expect(disableAutomationRuleTool.name).toBe('disable_automation_rule');
      });

      it('has updateIdempotent annotation', () => {
        expect(disableAutomationRuleTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });
    });
  });
});

describe('Label Tools', () => {
  describe('Input Schemas', () => {
    describe('createLabelSchema', () => {
      it('rejects missing name', () => {
        const result = createLabelSchema.safeParse({
          color: 'ff0000',
          description: 'Bug label'
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing color', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          description: 'Bug label'
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty name', () => {
        const result = createLabelSchema.safeParse({
          name: '',
          color: 'ff0000'
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid color format', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: 'red'
        });
        expect(result.success).toBe(false);
      });

      it('rejects color with # prefix', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: '#ff0000'
        });
        expect(result.success).toBe(false);
      });

      it('rejects short color code', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: 'ff00'
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: 'ff0000'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('bug');
          expect(result.data.color).toBe('ff0000');
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: 'ff0000',
          description: 'Something isn\'t working'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe('Something isn\'t working');
        }
      });

      it('accepts uppercase color code', () => {
        const result = createLabelSchema.safeParse({
          name: 'bug',
          color: 'FF0000'
        });
        expect(result.success).toBe(true);
      });
    });

    describe('listLabelsSchema', () => {
      it('accepts valid input without optional fields', () => {
        const result = listLabelsSchema.safeParse({});
        expect(result.success).toBe(true);
        // Note: defaults are not applied until runtime, safeParse returns undefined
        expect(result.data).toBeDefined();
      });

      it('accepts valid input with limit', () => {
        const result = listLabelsSchema.safeParse({
          limit: 50
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(50);
        }
      });

      it('rejects zero limit', () => {
        const result = listLabelsSchema.safeParse({
          limit: 0
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative limit', () => {
        const result = listLabelsSchema.safeParse({
          limit: -1
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-integer limit', () => {
        const result = listLabelsSchema.safeParse({
          limit: 10.5
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createLabelTool', () => {
      it('has correct name', () => {
        expect(createLabelTool.name).toBe('create_label');
      });

      it('has correct title', () => {
        expect(createLabelTool.title).toBe('Create Label');
      });

      it('has create annotation', () => {
        expect(createLabelTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createLabelTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createLabelTool.examples).toBeDefined();
        expect(createLabelTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listLabelsTool', () => {
      it('has correct name', () => {
        expect(listLabelsTool.name).toBe('list_labels');
      });

      it('has correct title', () => {
        expect(listLabelsTool.title).toBe('List Labels');
      });

      it('has readOnly annotation', () => {
        expect(listLabelsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has examples', () => {
        expect(listLabelsTool.examples).toBeDefined();
        expect(listLabelsTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});