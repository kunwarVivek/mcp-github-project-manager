/**
 * Unit tests for project lifecycle MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  CloseProjectInputSchema,
  ReopenProjectInputSchema,
  ConvertDraftIssueInputSchema,
} from '../../../src/infrastructure/tools/schemas/project-lifecycle-schemas.js';
import {
  closeProjectTool,
  reopenProjectTool,
  convertDraftIssueTool,
  executeCloseProject,
  executeReopenProject,
  executeConvertDraftIssue,
} from '../../../src/infrastructure/tools/project-lifecycle-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Project Lifecycle Tools', () => {
  describe('Input Schemas', () => {
    describe('CloseProjectInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = CloseProjectInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = CloseProjectInputSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = CloseProjectInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
        }
      });

      it('rejects non-string projectId', () => {
        const result = CloseProjectInputSchema.safeParse({
          projectId: 12345,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('ReopenProjectInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = ReopenProjectInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = ReopenProjectInputSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = ReopenProjectInputSchema.safeParse({
          projectId: 'PVT_kwDOTest456',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest456');
        }
      });

      it('rejects non-string projectId', () => {
        const result = ReopenProjectInputSchema.safeParse({
          projectId: null,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('ConvertDraftIssueInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          owner: 'my-org',
          repo: 'my-repo',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing owner', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: 'PVTI_lADOTest123',
          repo: 'my-repo',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing repo', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty itemId', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: '',
          owner: 'my-org',
          repo: 'my-repo',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty owner', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: 'PVTI_lADOTest123',
          owner: '',
          repo: 'my-repo',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty repo', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
          repo: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with all required fields', () => {
        const result = ConvertDraftIssueInputSchema.safeParse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
          repo: 'my-repo',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.itemId).toBe('PVTI_lADOTest123');
          expect(result.data.owner).toBe('my-org');
          expect(result.data.repo).toBe('my-repo');
        }
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('closeProjectTool', () => {
      it('has correct name', () => {
        expect(closeProjectTool.name).toBe('close_project');
      });

      it('has correct title', () => {
        expect(closeProjectTool.title).toBe('Close Project');
      });

      it('has updateIdempotent annotation', () => {
        expect(closeProjectTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(closeProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(closeProjectTool.examples).toBeDefined();
        expect(closeProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('reopenProjectTool', () => {
      it('has correct name', () => {
        expect(reopenProjectTool.name).toBe('reopen_project');
      });

      it('has correct title', () => {
        expect(reopenProjectTool.title).toBe('Reopen Project');
      });

      it('has updateIdempotent annotation', () => {
        expect(reopenProjectTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(reopenProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(reopenProjectTool.examples).toBeDefined();
        expect(reopenProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('convertDraftIssueTool', () => {
      it('has correct name', () => {
        expect(convertDraftIssueTool.name).toBe('convert_draft_issue');
      });

      it('has correct title', () => {
        expect(convertDraftIssueTool.title).toBe('Convert Draft Issue to Real Issue');
      });

      it('has create annotation', () => {
        expect(convertDraftIssueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(convertDraftIssueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(convertDraftIssueTool.examples).toBeDefined();
        expect(convertDraftIssueTool.examples!.length).toBeGreaterThan(0);
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

    describe('executeCloseProject', () => {
      it('calls mutation and returns project with closed=true', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2: {
            projectV2: {
              id: 'PVT_kwDOTest123',
              title: 'My Project',
              closed: true,
              url: 'https://github.com/orgs/testorg/projects/1',
            },
          },
        });

        const input = CloseProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeCloseProject(input);

        expect(result.structuredContent.id).toBe('PVT_kwDOTest123');
        expect(result.structuredContent.title).toBe('My Project');
        expect(result.structuredContent.closed).toBe(true);
        expect(result.structuredContent.url).toBe('https://github.com/orgs/testorg/projects/1');
        expect(result.content[0].text).toContain('Closed project');
        expect(result.content[0].text).toContain('My Project');
      });

      it('passes correct mutation input', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2: {
            projectV2: {
              id: 'PVT_kwDOTest123',
              title: 'Test',
              closed: true,
              url: 'https://github.com/orgs/test/projects/1',
            },
          },
        });

        const input = CloseProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        await executeCloseProject(input);

        expect(mockGraphql).toHaveBeenCalledWith(
          expect.any(String),
          {
            input: {
              projectId: 'PVT_kwDOTest123',
              closed: true,
            },
          }
        );
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = CloseProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });

        await expect(executeCloseProject(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });

      it('propagates GraphQL errors', async () => {
        mockGraphql.mockRejectedValue(new Error('Project not found'));

        const input = CloseProjectInputSchema.parse({
          projectId: 'PVT_kwDONotFound',
        });

        await expect(executeCloseProject(input))
          .rejects.toThrow('Project not found');
      });
    });

    describe('executeReopenProject', () => {
      it('calls mutation and returns project with closed=false', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2: {
            projectV2: {
              id: 'PVT_kwDOTest456',
              title: 'Reopened Project',
              closed: false,
              url: 'https://github.com/orgs/testorg/projects/2',
            },
          },
        });

        const input = ReopenProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest456',
        });
        const result = await executeReopenProject(input);

        expect(result.structuredContent.id).toBe('PVT_kwDOTest456');
        expect(result.structuredContent.title).toBe('Reopened Project');
        expect(result.structuredContent.closed).toBe(false);
        expect(result.structuredContent.url).toBe('https://github.com/orgs/testorg/projects/2');
        expect(result.content[0].text).toContain('Reopened project');
        expect(result.content[0].text).toContain('Reopened Project');
      });

      it('passes correct mutation input', async () => {
        mockGraphql.mockResolvedValue({
          updateProjectV2: {
            projectV2: {
              id: 'PVT_kwDOTest456',
              title: 'Test',
              closed: false,
              url: 'https://github.com/orgs/test/projects/2',
            },
          },
        });

        const input = ReopenProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest456',
        });
        await executeReopenProject(input);

        expect(mockGraphql).toHaveBeenCalledWith(
          expect.any(String),
          {
            input: {
              projectId: 'PVT_kwDOTest456',
              closed: false,
            },
          }
        );
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = ReopenProjectInputSchema.parse({
          projectId: 'PVT_kwDOTest456',
        });

        await expect(executeReopenProject(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });

      it('propagates GraphQL errors', async () => {
        mockGraphql.mockRejectedValue(new Error('Project not found'));

        const input = ReopenProjectInputSchema.parse({
          projectId: 'PVT_kwDONotFound',
        });

        await expect(executeReopenProject(input))
          .rejects.toThrow('Project not found');
      });
    });

    describe('executeConvertDraftIssue', () => {
      it('resolves repository ID and calls conversion mutation', async () => {
        // First call: resolve repository ID
        // Second call: convert draft issue
        mockGraphql
          .mockResolvedValueOnce({
            repository: { id: 'R_kgDOTestRepo' },
          })
          .mockResolvedValueOnce({
            convertProjectV2DraftIssueItemToIssue: {
              item: {
                id: 'PVTI_lADOUpdated',
                content: {
                  id: 'I_kwDOTestIssue',
                  number: 42,
                  title: 'Converted Issue',
                  url: 'https://github.com/my-org/my-repo/issues/42',
                  repository: {
                    nameWithOwner: 'my-org/my-repo',
                  },
                },
              },
            },
          });

        const input = ConvertDraftIssueInputSchema.parse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
          repo: 'my-repo',
        });
        const result = await executeConvertDraftIssue(input);

        expect(result.structuredContent.itemId).toBe('PVTI_lADOUpdated');
        expect(result.structuredContent.issueId).toBe('I_kwDOTestIssue');
        expect(result.structuredContent.issueNumber).toBe(42);
        expect(result.structuredContent.title).toBe('Converted Issue');
        expect(result.structuredContent.url).toBe('https://github.com/my-org/my-repo/issues/42');
        expect(result.structuredContent.repository).toBe('my-org/my-repo');
        expect(result.content[0].text).toContain('#42');
        expect(result.content[0].text).toContain('Converted Issue');
        expect(result.content[0].text).toContain('my-org/my-repo');

        // Verify graphql was called twice
        expect(mockGraphql).toHaveBeenCalledTimes(2);
      });

      it('passes correct conversion mutation input', async () => {
        mockGraphql
          .mockResolvedValueOnce({
            repository: { id: 'R_kgDOTestRepo' },
          })
          .mockResolvedValueOnce({
            convertProjectV2DraftIssueItemToIssue: {
              item: {
                id: 'PVTI_test',
                content: {
                  id: 'I_test',
                  number: 1,
                  title: 'Test',
                  url: 'https://github.com/test/test/issues/1',
                  repository: { nameWithOwner: 'test/test' },
                },
              },
            },
          });

        const input = ConvertDraftIssueInputSchema.parse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
          repo: 'my-repo',
        });
        await executeConvertDraftIssue(input);

        // Second call should have the conversion mutation
        expect(mockGraphql).toHaveBeenNthCalledWith(
          2,
          expect.any(String),
          {
            input: {
              itemId: 'PVTI_lADOTest123',
              repositoryId: 'R_kgDOTestRepo',
            },
          }
        );
      });

      it('throws error when repository not found', async () => {
        mockGraphql.mockResolvedValueOnce({
          repository: null,
        });

        const input = ConvertDraftIssueInputSchema.parse({
          itemId: 'PVTI_lADOTest123',
          owner: 'nonexistent-org',
          repo: 'nonexistent-repo',
        });

        await expect(executeConvertDraftIssue(input))
          .rejects.toThrow("Repository 'nonexistent-org/nonexistent-repo' not found");
      });

      it('throws error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = ConvertDraftIssueInputSchema.parse({
          itemId: 'PVTI_lADOTest123',
          owner: 'my-org',
          repo: 'my-repo',
        });

        await expect(executeConvertDraftIssue(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });

      it('propagates conversion mutation errors', async () => {
        mockGraphql
          .mockResolvedValueOnce({
            repository: { id: 'R_kgDOTestRepo' },
          })
          .mockRejectedValueOnce(new Error('Item is not a draft issue'));

        const input = ConvertDraftIssueInputSchema.parse({
          itemId: 'PVTI_lADONotADraft',
          owner: 'my-org',
          repo: 'my-repo',
        });

        await expect(executeConvertDraftIssue(input))
          .rejects.toThrow('Item is not a draft issue');
      });
    });
  });
});
