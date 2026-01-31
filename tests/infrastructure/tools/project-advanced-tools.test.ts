/**
 * Unit tests for project advanced MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 *
 * Note: filter_project_items performs client-side filtering, which is
 * thoroughly tested to ensure the workaround for GitHub API limitations works.
 */

import {
  UpdateItemPositionInputSchema,
  SearchIssuesAdvancedInputSchema,
  FilterProjectItemsInputSchema,
} from '../../../src/infrastructure/tools/schemas/project-lifecycle-schemas.js';
import {
  updateItemPositionTool,
  searchIssuesAdvancedTool,
  filterProjectItemsTool,
  executeUpdateItemPosition,
  executeSearchIssuesAdvanced,
  executeFilterProjectItems,
} from '../../../src/infrastructure/tools/project-advanced-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Project Advanced Tools', () => {
  describe('Input Schemas', () => {
    describe('UpdateItemPositionInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          itemId: 'PVTI_test',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          projectId: 'PVT_test',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          projectId: '',
          itemId: 'PVTI_test',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty itemId', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          projectId: 'PVT_test',
          itemId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with afterId', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
          afterId: 'PVTI_lADOTest789',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.itemId).toBe('PVTI_lADOTest456');
          expect(result.data.afterId).toBe('PVTI_lADOTest789');
        }
      });

      it('accepts valid input without afterId (move to top)', () => {
        const result = UpdateItemPositionInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.itemId).toBe('PVTI_lADOTest456');
          expect(result.data.afterId).toBeUndefined();
        }
      });
    });

    describe('SearchIssuesAdvancedInputSchema', () => {
      it('rejects missing query', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty query', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid query with default first', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: 'is:issue AND repo:owner/repo',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query).toBe('is:issue AND repo:owner/repo');
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it('accepts valid query with pagination', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: 'is:issue AND label:bug',
          first: 50,
          after: 'cursor123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50);
          expect(result.data.after).toBe('cursor123');
        }
      });

      it('rejects first exceeding max of 100', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: 'is:issue',
          first: 150,
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative first value', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: 'is:issue',
          first: -10,
        });
        expect(result.success).toBe(false);
      });

      it('rejects zero first value', () => {
        const result = SearchIssuesAdvancedInputSchema.safeParse({
          query: 'is:issue',
          first: 0,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('FilterProjectItemsInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          filter: {},
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing filter', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_test',
        });
        expect(result.success).toBe(false);
      });

      it('accepts empty filter (returns all)', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.filter).toEqual({});
        }
      });

      it('accepts filter with status', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            status: 'In Progress',
          },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter.status).toBe('In Progress');
        }
      });

      it('accepts filter with labels array', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            labels: ['bug', 'critical'],
          },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter.labels).toEqual(['bug', 'critical']);
        }
      });

      it('accepts filter with assignee', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            assignee: 'octocat',
          },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter.assignee).toBe('octocat');
        }
      });

      it('accepts filter with type Issue', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            type: 'Issue',
          },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter.type).toBe('Issue');
        }
      });

      it('accepts filter with type PullRequest', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            type: 'PullRequest',
          },
        });
        expect(result.success).toBe(true);
      });

      it('accepts filter with type DraftIssue', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            type: 'DraftIssue',
          },
        });
        expect(result.success).toBe(true);
      });

      it('rejects filter with invalid type', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            type: 'InvalidType',
          },
        });
        expect(result.success).toBe(false);
      });

      it('accepts filter with multiple criteria', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            status: 'In Review',
            labels: ['feature'],
            assignee: 'developer1',
            type: 'Issue',
          },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter.status).toBe('In Review');
          expect(result.data.filter.labels).toEqual(['feature']);
          expect(result.data.filter.assignee).toBe('developer1');
          expect(result.data.filter.type).toBe('Issue');
        }
      });

      it('applies default first value', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50); // default for filter
        }
      });

      it('rejects first exceeding max of 100', () => {
        const result = FilterProjectItemsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
          first: 200,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('updateItemPositionTool', () => {
      it('has correct name', () => {
        expect(updateItemPositionTool.name).toBe('update_item_position');
      });

      it('has correct title', () => {
        expect(updateItemPositionTool.title).toBe('Update Item Position');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateItemPositionTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateItemPositionTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateItemPositionTool.examples).toBeDefined();
        expect(updateItemPositionTool.examples!.length).toBe(2); // move to top + move after
      });
    });

    describe('searchIssuesAdvancedTool', () => {
      it('has correct name', () => {
        expect(searchIssuesAdvancedTool.name).toBe('search_issues_advanced');
      });

      it('has correct title', () => {
        expect(searchIssuesAdvancedTool.title).toBe('Search Issues with Advanced Query');
      });

      it('has readOnly annotation', () => {
        expect(searchIssuesAdvancedTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(searchIssuesAdvancedTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(searchIssuesAdvancedTool.examples).toBeDefined();
        expect(searchIssuesAdvancedTool.examples!.length).toBe(2);
      });
    });

    describe('filterProjectItemsTool', () => {
      it('has correct name', () => {
        expect(filterProjectItemsTool.name).toBe('filter_project_items');
      });

      it('has correct title', () => {
        expect(filterProjectItemsTool.title).toBe('Filter Project Items');
      });

      it('has readOnly annotation', () => {
        expect(filterProjectItemsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(filterProjectItemsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(filterProjectItemsTool.examples).toBeDefined();
        expect(filterProjectItemsTool.examples!.length).toBe(4); // status, labels, type, combined
      });
    });
  });

  describe('Executors', () => {
    const originalEnv = process.env;
    let mockGraphql: jest.Mock;

    beforeEach(() => {
      jest.resetAllMocks();
      process.env = { ...originalEnv, GITHUB_TOKEN: 'test-token' };

      mockGraphql = jest.fn();

      MockedFactory.mockImplementation(() => ({
        graphql: mockGraphql,
        getConfig: jest.fn().mockReturnValue({ owner: 'placeholder', repo: 'placeholder' }),
      } as unknown as GitHubRepositoryFactory));
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('executeUpdateItemPosition', () => {
      it('moves item to top when no afterId provided', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2ItemPosition: {
            items: {
              nodes: [{ id: 'PVTI_test' }],
            },
          },
        });

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
        });
        const result = await executeUpdateItemPosition(input);

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.itemId).toBe('PVTI_lADOTest456');
        expect(result.structuredContent.position).toBe('first');
        expect(result.content[0].text).toContain('first position');
      });

      it('moves item after another item when afterId provided', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2ItemPosition: {
            items: {
              nodes: [{ id: 'PVTI_test' }],
            },
          },
        });

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
          afterId: 'PVTI_lADOTest789',
        });
        const result = await executeUpdateItemPosition(input);

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.itemId).toBe('PVTI_lADOTest456');
        expect(result.structuredContent.position).toBe('after PVTI_lADOTest789');
        expect(result.content[0].text).toContain('after PVTI_lADOTest789');
      });

      it('passes correct mutation input without afterId', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2ItemPosition: {
            items: { nodes: [] },
          },
        });

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
        });
        await executeUpdateItemPosition(input);

        expect(mockGraphql).toHaveBeenCalledWith(
          expect.any(String),
          {
            input: {
              projectId: 'PVT_kwDOTest123',
              itemId: 'PVTI_lADOTest456',
              // afterId should NOT be present
            },
          }
        );
      });

      it('passes correct mutation input with afterId', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2ItemPosition: {
            items: { nodes: [] },
          },
        });

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
          afterId: 'PVTI_lADOTest789',
        });
        await executeUpdateItemPosition(input);

        expect(mockGraphql).toHaveBeenCalledWith(
          expect.any(String),
          {
            input: {
              projectId: 'PVT_kwDOTest123',
              itemId: 'PVTI_lADOTest456',
              afterId: 'PVTI_lADOTest789',
            },
          }
        );
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest456',
        });

        await expect(executeUpdateItemPosition(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });

      it('propagates GraphQL errors', async () => {
        mockGraphql.mockRejectedValue(new Error('Project not found'));

        const input = UpdateItemPositionInputSchema.parse({
          projectId: 'PVT_kwDONotFound',
          itemId: 'PVTI_test',
        });

        await expect(executeUpdateItemPosition(input))
          .rejects.toThrow('Project not found');
      });
    });

    describe('executeSearchIssuesAdvanced', () => {
      it('returns issues matching query', async () => {
        mockGraphql.mockResolvedValue({
          search: {
            issueCount: 2,
            nodes: [
              {
                id: 'I_kwDO1',
                number: 1,
                title: 'Bug: Login fails',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/1',
                labels: { nodes: [{ name: 'bug' }] },
                assignees: { nodes: [{ login: 'dev1' }] },
                repository: { nameWithOwner: 'owner/repo' },
              },
              {
                id: 'I_kwDO2',
                number: 2,
                title: 'Feature: Add dark mode',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/2',
                labels: { nodes: [{ name: 'feature' }, { name: 'ui' }] },
                assignees: { nodes: [] },
                repository: { nameWithOwner: 'owner/repo' },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        });

        const input = SearchIssuesAdvancedInputSchema.parse({
          query: 'is:issue AND repo:owner/repo',
        });
        const result = await executeSearchIssuesAdvanced(input);

        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.structuredContent.issues).toHaveLength(2);
        expect(result.structuredContent.issues[0].number).toBe(1);
        expect(result.structuredContent.issues[0].title).toBe('Bug: Login fails');
        expect(result.structuredContent.issues[0].labels).toEqual(['bug']);
        expect(result.structuredContent.issues[0].assignees).toEqual(['dev1']);
        expect(result.structuredContent.issues[1].labels).toEqual(['feature', 'ui']);
        expect(result.content[0].text).toContain('Found 2 issue(s)');
      });

      it('handles pagination parameters', async () => {
        mockGraphql.mockResolvedValue({
          search: {
            issueCount: 100,
            nodes: [
              {
                id: 'I_kwDO21',
                number: 21,
                title: 'Issue 21',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/21',
                labels: { nodes: [] },
                assignees: { nodes: [] },
                repository: { nameWithOwner: 'owner/repo' },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor_page3',
            },
          },
        });

        const input = SearchIssuesAdvancedInputSchema.parse({
          query: 'is:issue',
          first: 20,
          after: 'cursor_page2',
        });
        const result = await executeSearchIssuesAdvanced(input);

        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe('cursor_page3');
      });

      it('filters out empty nodes from results', async () => {
        mockGraphql.mockResolvedValue({
          search: {
            issueCount: 3,
            nodes: [
              {
                id: 'I_kwDO1',
                number: 1,
                title: 'Valid Issue',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/1',
                labels: { nodes: [] },
                assignees: { nodes: [] },
                repository: { nameWithOwner: 'owner/repo' },
              },
              {}, // Empty node (deleted item)
              {
                id: 'I_kwDO2',
                number: 2,
                title: 'Another Valid Issue',
                state: 'CLOSED',
                url: 'https://github.com/owner/repo/issues/2',
                labels: { nodes: [] },
                assignees: { nodes: [] },
                repository: { nameWithOwner: 'owner/repo' },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        });

        const input = SearchIssuesAdvancedInputSchema.parse({
          query: 'is:issue',
        });
        const result = await executeSearchIssuesAdvanced(input);

        // Should only have 2 valid issues (empty node filtered out)
        expect(result.structuredContent.issues).toHaveLength(2);
        expect(result.structuredContent.issues[0].number).toBe(1);
        expect(result.structuredContent.issues[1].number).toBe(2);
      });

      it('handles empty results', async () => {
        mockGraphql.mockResolvedValue({
          search: {
            issueCount: 0,
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        });

        const input = SearchIssuesAdvancedInputSchema.parse({
          query: 'is:issue AND label:nonexistent',
        });
        const result = await executeSearchIssuesAdvanced(input);

        expect(result.structuredContent.totalCount).toBe(0);
        expect(result.structuredContent.issues).toHaveLength(0);
        expect(result.content[0].text).toContain('Found 0 issue(s)');
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = SearchIssuesAdvancedInputSchema.parse({
          query: 'is:issue',
        });

        await expect(executeSearchIssuesAdvanced(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeFilterProjectItems', () => {
      const createMockProjectItem = (overrides: {
        id: string;
        type: 'Issue' | 'PullRequest' | 'DraftIssue';
        title: string;
        state?: string;
        labels?: string[];
        assignees?: string[];
        statusValue?: string;
      }) => ({
        id: overrides.id,
        content: {
          __typename: overrides.type,
          id: `content_${overrides.id}`,
          title: overrides.title,
          state: overrides.state,
          labels: { nodes: (overrides.labels || []).map(name => ({ name })) },
          assignees: { nodes: (overrides.assignees || []).map(login => ({ login })) },
        },
        fieldValues: {
          nodes: overrides.statusValue
            ? [{ name: overrides.statusValue, field: { name: 'Status' } }]
            : [],
        },
      });

      it('returns all items when no filter criteria provided', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 3,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'Issue 1',
                  state: 'OPEN',
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'PullRequest',
                  title: 'PR 1',
                  state: 'OPEN',
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'DraftIssue',
                  title: 'Draft 1',
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.totalCount).toBe(3);
        expect(result.structuredContent.filteredCount).toBe(3);
        expect(result.structuredContent.items).toHaveLength(3);
      });

      it('filters by status field value', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 3,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'In Progress Issue',
                  statusValue: 'In Progress',
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'Issue',
                  title: 'Done Issue',
                  statusValue: 'Done',
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'Issue',
                  title: 'Another In Progress',
                  statusValue: 'In Progress',
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { status: 'In Progress' },
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.filteredCount).toBe(2);
        expect(result.structuredContent.items[0].title).toBe('In Progress Issue');
        expect(result.structuredContent.items[1].title).toBe('Another In Progress');
      });

      it('filters by labels (any match)', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 4,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'Bug Issue',
                  labels: ['bug'],
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'Issue',
                  title: 'Critical Bug',
                  labels: ['bug', 'critical'],
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'Issue',
                  title: 'Feature Issue',
                  labels: ['feature'],
                }),
                createMockProjectItem({
                  id: 'PVTI_4',
                  type: 'Issue',
                  title: 'Critical Feature',
                  labels: ['feature', 'critical'],
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { labels: ['bug', 'critical'] },
        });
        const result = await executeFilterProjectItems(input);

        // Items with 'bug' OR 'critical' label
        expect(result.structuredContent.filteredCount).toBe(3);
        const titles = result.structuredContent.items.map(i => i.title);
        expect(titles).toContain('Bug Issue');
        expect(titles).toContain('Critical Bug');
        expect(titles).toContain('Critical Feature');
        expect(titles).not.toContain('Feature Issue');
      });

      it('filters by assignee', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 3,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'Octocat Issue',
                  assignees: ['octocat'],
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'Issue',
                  title: 'Team Issue',
                  assignees: ['octocat', 'developer1'],
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'Issue',
                  title: 'Other Issue',
                  assignees: ['developer1'],
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { assignee: 'octocat' },
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.filteredCount).toBe(2);
        const titles = result.structuredContent.items.map(i => i.title);
        expect(titles).toContain('Octocat Issue');
        expect(titles).toContain('Team Issue');
      });

      it('filters by type Issue', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 3,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'An Issue',
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'PullRequest',
                  title: 'A PR',
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'DraftIssue',
                  title: 'A Draft',
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { type: 'Issue' },
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.filteredCount).toBe(1);
        expect(result.structuredContent.items[0].title).toBe('An Issue');
        expect(result.structuredContent.items[0].type).toBe('Issue');
      });

      it('filters by type DraftIssue', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 3,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'An Issue',
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'DraftIssue',
                  title: 'Draft 1',
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'DraftIssue',
                  title: 'Draft 2',
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { type: 'DraftIssue' },
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.filteredCount).toBe(2);
        expect(result.structuredContent.items.every(i => i.type === 'DraftIssue')).toBe(true);
      });

      it('combines multiple filter criteria with AND logic', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 4,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'Perfect Match',
                  statusValue: 'In Review',
                  labels: ['bug'],
                  assignees: ['octocat'],
                }),
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'Issue',
                  title: 'Wrong Status',
                  statusValue: 'Done',
                  labels: ['bug'],
                  assignees: ['octocat'],
                }),
                createMockProjectItem({
                  id: 'PVTI_3',
                  type: 'Issue',
                  title: 'Wrong Assignee',
                  statusValue: 'In Review',
                  labels: ['bug'],
                  assignees: ['developer1'],
                }),
                createMockProjectItem({
                  id: 'PVTI_4',
                  type: 'PullRequest', // Wrong type
                  title: 'A PR',
                  statusValue: 'In Review',
                  labels: ['bug'],
                  assignees: ['octocat'],
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {
            type: 'Issue',
            status: 'In Review',
            labels: ['bug'],
            assignee: 'octocat',
          },
        });
        const result = await executeFilterProjectItems(input);

        // Only the first item matches ALL criteria
        expect(result.structuredContent.filteredCount).toBe(1);
        expect(result.structuredContent.items[0].title).toBe('Perfect Match');
      });

      it('handles pagination correctly', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 100,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_51',
                  type: 'Issue',
                  title: 'Issue 51',
                }),
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor_page3',
              },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
          first: 20,
          after: 'cursor_page2',
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.totalCount).toBe(100);
        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe('cursor_page3');
      });

      it('throws error when project not found', async () => {
        mockGraphql.mockResolvedValue({
          node: null,
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDONotFound',
          filter: {},
        });

        await expect(executeFilterProjectItems(input))
          .rejects.toThrow("Project 'PVT_kwDONotFound' not found");
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });

        await expect(executeFilterProjectItems(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });

      it('handles items with null content correctly', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 2,
              nodes: [
                {
                  id: 'PVTI_1',
                  content: null, // Item with deleted content
                  fieldValues: { nodes: [] },
                },
                createMockProjectItem({
                  id: 'PVTI_2',
                  type: 'Issue',
                  title: 'Valid Issue',
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });
        const result = await executeFilterProjectItems(input);

        // Both items returned (null content item has defaults applied)
        expect(result.structuredContent.filteredCount).toBe(2);
      });

      it('maps field values to output correctly', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 1,
              nodes: [
                {
                  id: 'PVTI_1',
                  content: {
                    __typename: 'Issue',
                    id: 'I_1',
                    title: 'Issue with fields',
                    state: 'OPEN',
                    labels: { nodes: [{ name: 'bug' }] },
                    assignees: { nodes: [{ login: 'dev' }] },
                  },
                  fieldValues: {
                    nodes: [
                      { name: 'High', field: { name: 'Priority' } },
                      { name: 'In Progress', field: { name: 'Status' } },
                      { text: 'Some notes', field: { name: 'Notes' } },
                    ],
                  },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: {},
        });
        const result = await executeFilterProjectItems(input);

        expect(result.structuredContent.items[0].fieldValues).toEqual({
          Priority: 'High',
          Status: 'In Progress',
          Notes: 'Some notes',
        });
      });

      it('returns correct content message with counts', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            items: {
              totalCount: 10,
              nodes: [
                createMockProjectItem({
                  id: 'PVTI_1',
                  type: 'Issue',
                  title: 'Matched Issue',
                  labels: ['bug'],
                }),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const input = FilterProjectItemsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          filter: { labels: ['bug'] },
        });
        const result = await executeFilterProjectItems(input);

        expect(result.content[0].text).toContain('Found 1 item(s) matching filter');
        expect(result.content[0].text).toContain('10 total in project');
      });
    });
  });
});
