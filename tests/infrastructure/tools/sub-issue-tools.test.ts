/**
 * Unit tests for sub-issue MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  AddSubIssueInputSchema,
  ListSubIssuesInputSchema,
  GetParentIssueInputSchema,
  ReprioritizeSubIssueInputSchema,
  RemoveSubIssueInputSchema,
} from '../../../src/infrastructure/tools/schemas/sub-issue-schemas.js';
import {
  addSubIssueTool,
  listSubIssuesTool,
  getParentIssueTool,
  reprioritizeSubIssueTool,
  removeSubIssueTool,
  executeAddSubIssue,
  executeListSubIssues,
  executeGetParentIssue,
  executeReprioritizeSubIssue,
  executeRemoveSubIssue,
} from '../../../src/infrastructure/tools/sub-issue-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Sub-issue Tools', () => {
  describe('Input Schemas', () => {
    describe('AddSubIssueInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = AddSubIssueInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects missing owner', () => {
        const result = AddSubIssueInputSchema.safeParse({
          repo: 'test-repo',
          parentIssueNumber: 1,
          subIssueNumber: 2,
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = AddSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.replaceParent).toBe(false); // default
        }
      });

      it('accepts replaceParent option', () => {
        const result = AddSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
          replaceParent: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.replaceParent).toBe(true);
        }
      });
    });

    describe('ListSubIssuesInputSchema', () => {
      it('accepts valid input with defaults', () => {
        const result = ListSubIssuesInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 100,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(20); // default
        }
      });

      it('accepts pagination parameters', () => {
        const result = ListSubIssuesInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 100,
          first: 50,
          after: 'cursor123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50);
          expect(result.data.after).toBe('cursor123');
        }
      });
    });

    describe('GetParentIssueInputSchema', () => {
      it('accepts valid input', () => {
        const result = GetParentIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 123,
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid issue number', () => {
        const result = GetParentIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 'not-a-number',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('ReprioritizeSubIssueInputSchema', () => {
      it('accepts input without afterIssueNumber', () => {
        const result = ReprioritizeSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.afterIssueNumber).toBeUndefined();
        }
      });

      it('accepts input with afterIssueNumber', () => {
        const result = ReprioritizeSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
          afterIssueNumber: 122,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.afterIssueNumber).toBe(122);
        }
      });
    });

    describe('RemoveSubIssueInputSchema', () => {
      it('accepts valid input', () => {
        const result = RemoveSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
        });
        expect(result.success).toBe(true);
      });

      it('rejects missing subIssueNumber', () => {
        const result = RemoveSubIssueInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    it('addSubIssueTool has correct name and title', () => {
      expect(addSubIssueTool.name).toBe('add_sub_issue');
      expect(addSubIssueTool.title).toBe('Add Sub-Issue');
    });

    it('addSubIssueTool has updateIdempotent annotation', () => {
      expect(addSubIssueTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('listSubIssuesTool has readOnly annotation', () => {
      expect(listSubIssuesTool.name).toBe('list_sub_issues');
      expect(listSubIssuesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('getParentIssueTool has readOnly annotation', () => {
      expect(getParentIssueTool.name).toBe('get_parent_issue');
      expect(getParentIssueTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('reprioritizeSubIssueTool has updateIdempotent annotation', () => {
      expect(reprioritizeSubIssueTool.name).toBe('reprioritize_sub_issue');
      expect(reprioritizeSubIssueTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('removeSubIssueTool has delete annotation with destructiveHint', () => {
      expect(removeSubIssueTool.name).toBe('remove_sub_issue');
      expect(removeSubIssueTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('all tools have output schemas defined', () => {
      expect(addSubIssueTool.outputSchema).toBeDefined();
      expect(listSubIssuesTool.outputSchema).toBeDefined();
      expect(getParentIssueTool.outputSchema).toBeDefined();
      expect(reprioritizeSubIssueTool.outputSchema).toBeDefined();
      expect(removeSubIssueTool.outputSchema).toBeDefined();
    });

    it('all tools have examples', () => {
      expect(addSubIssueTool.examples).toBeDefined();
      expect(addSubIssueTool.examples!.length).toBeGreaterThan(0);
      expect(listSubIssuesTool.examples).toBeDefined();
      expect(getParentIssueTool.examples).toBeDefined();
      expect(reprioritizeSubIssueTool.examples).toBeDefined();
      expect(reprioritizeSubIssueTool.examples!.length).toBe(2); // Two examples
      expect(removeSubIssueTool.examples).toBeDefined();
    });
  });

  describe('Executors', () => {
    const originalEnv = process.env;
    let mockSubIssueRepo: jest.Mocked<{
      addSubIssue: jest.Mock;
      listSubIssues: jest.Mock;
      getParentIssue: jest.Mock;
      reprioritizeSubIssue: jest.Mock;
      removeSubIssue: jest.Mock;
    }>;
    let mockGraphql: jest.Mock;

    beforeEach(() => {
      jest.resetAllMocks();
      process.env = { ...originalEnv, GITHUB_TOKEN: 'test-token' };

      mockSubIssueRepo = {
        addSubIssue: jest.fn(),
        listSubIssues: jest.fn(),
        getParentIssue: jest.fn(),
        reprioritizeSubIssue: jest.fn(),
        removeSubIssue: jest.fn(),
      };

      mockGraphql = jest.fn();

      MockedFactory.mockImplementation(() => ({
        createSubIssueRepository: jest.fn().mockReturnValue(mockSubIssueRepo),
        graphql: mockGraphql,
        getConfig: jest.fn().mockReturnValue({ owner: 'octocat', repo: 'hello-world' }),
      } as unknown as GitHubRepositoryFactory));
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('executeAddSubIssue', () => {
      it('calls repository with correct params', async () => {
        // Mock issue node ID resolution
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_parent123' } },
        });

        mockSubIssueRepo.addSubIssue.mockResolvedValue({
          issue: { id: 'I_parent123', title: 'Parent Issue' },
          subIssue: {
            id: 'I_sub456',
            number: 456,
            title: 'Sub Issue',
            state: 'OPEN',
            url: 'http://url',
          },
        });

        // Parse through schema to get defaults applied
        const input = AddSubIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 456,
        });
        const result = await executeAddSubIssue(input);

        expect(result.parentIssue.id).toBe('I_parent123');
        expect(result.subIssue.number).toBe(456);
        expect(result.subIssue.state).toBe('open'); // normalized
      });

      it('returns error when token is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = AddSubIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 456,
        });

        await expect(executeAddSubIssue(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeListSubIssues', () => {
      it('returns structured result', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_parent' } },
        });

        mockSubIssueRepo.listSubIssues.mockResolvedValue({
          subIssues: [
            { id: 'I_1', number: 1, title: 'First', state: 'OPEN', url: 'http://1', position: 0 },
            { id: 'I_2', number: 2, title: 'Second', state: 'CLOSED', url: 'http://2', position: 1 },
          ],
          summary: { total: 2, completed: 1, percentCompleted: 50 },
          pageInfo: { hasNextPage: false, endCursor: undefined },
          totalCount: 2,
        });

        // Parse through schema to get defaults applied
        const input = ListSubIssuesInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 100,
        });
        const result = await executeListSubIssues(input);

        expect(result.subIssues).toHaveLength(2);
        expect(result.subIssues[0].state).toBe('open'); // normalized
        expect(result.subIssues[1].state).toBe('closed'); // normalized
        expect(result.summary.percentCompleted).toBe(50);
        expect(result.totalCount).toBe(2);
      });
    });

    describe('executeGetParentIssue', () => {
      it('returns null for issue without parent', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_orphan' } },
        });

        mockSubIssueRepo.getParentIssue.mockResolvedValue(null);

        const input = GetParentIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 123,
        });
        const result = await executeGetParentIssue(input);

        expect(result.parent).toBeNull();
      });

      it('returns parent when exists', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_child' } },
        });

        mockSubIssueRepo.getParentIssue.mockResolvedValue({
          id: 'I_parent',
          number: 100,
          title: 'Parent Issue',
          state: 'OPEN',
          url: 'http://parent',
        });

        const input = GetParentIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          issueNumber: 123,
        });
        const result = await executeGetParentIssue(input);

        expect(result.parent).not.toBeNull();
        expect(result.parent!.number).toBe(100);
        expect(result.parent!.state).toBe('open'); // normalized
      });
    });

    describe('executeReprioritizeSubIssue', () => {
      it('passes afterId correctly when moving to beginning', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_node' } },
        });

        mockSubIssueRepo.reprioritizeSubIssue.mockResolvedValue({
          issue: { id: 'I_parent', title: 'Parent' },
          subIssue: { id: 'I_sub', number: 123, title: 'Sub', state: 'OPEN', url: 'http://u' },
        });

        const input = ReprioritizeSubIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
          // No afterIssueNumber = move to beginning
        });
        const result = await executeReprioritizeSubIssue(input);

        expect(result.subIssue.number).toBe(123);
        expect(mockSubIssueRepo.reprioritizeSubIssue).toHaveBeenCalledWith(
          'I_node', // parentNodeId
          'I_node', // subIssueNodeId (same mock for all calls)
          undefined  // afterNodeId
        );
      });

      it('passes afterId correctly when moving after specific issue', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_node' } },
        });

        mockSubIssueRepo.reprioritizeSubIssue.mockResolvedValue({
          issue: { id: 'I_parent', title: 'Parent' },
          subIssue: { id: 'I_sub', number: 123, title: 'Sub', state: 'CLOSED', url: 'http://u' },
        });

        const input = ReprioritizeSubIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
          afterIssueNumber: 122,
        });
        await executeReprioritizeSubIssue(input);

        // Should have called graphql 3 times for node ID resolution
        expect(mockGraphql).toHaveBeenCalledTimes(3);
      });
    });

    describe('executeRemoveSubIssue', () => {
      it('returns success message', async () => {
        mockGraphql.mockResolvedValue({
          repository: { issue: { id: 'I_node' } },
        });

        mockSubIssueRepo.removeSubIssue.mockResolvedValue(undefined);

        const input = RemoveSubIssueInputSchema.parse({
          owner: 'octocat',
          repo: 'hello-world',
          parentIssueNumber: 100,
          subIssueNumber: 123,
        });
        const result = await executeRemoveSubIssue(input);

        expect(result.success).toBe(true);
        expect(result.message).toContain('#123');
        expect(result.message).toContain('#100');
      });
    });
  });
});
