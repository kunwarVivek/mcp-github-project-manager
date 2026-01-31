/**
 * Unit tests for project linking MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  LinkProjectToRepositoryInputSchema,
  UnlinkProjectFromRepositoryInputSchema,
  LinkProjectToTeamInputSchema,
  UnlinkProjectFromTeamInputSchema,
  ListLinkedRepositoriesInputSchema,
  ListLinkedTeamsInputSchema,
} from '../../../src/infrastructure/tools/schemas/project-template-linking-schemas.js';
import {
  linkProjectToRepositoryTool,
  unlinkProjectFromRepositoryTool,
  linkProjectToTeamTool,
  unlinkProjectFromTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  executeLinkProjectToRepository,
  executeUnlinkProjectFromRepository,
  executeLinkProjectToTeam,
  executeUnlinkProjectFromTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
} from '../../../src/infrastructure/tools/project-linking-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Project Linking Tools', () => {
  describe('Input Schemas', () => {
    describe('LinkProjectToRepositoryInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects missing projectId', () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          owner: 'octocat',
          repo: 'hello-world',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing owner', () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          repo: 'hello-world',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing repo', () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.owner).toBe('octocat');
          expect(result.data.repo).toBe('hello-world');
        }
      });
    });

    describe('UnlinkProjectFromRepositoryInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = UnlinkProjectFromRepositoryInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = UnlinkProjectFromRepositoryInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.owner).toBe('octocat');
          expect(result.data.repo).toBe('hello-world');
        }
      });
    });

    describe('LinkProjectToTeamInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = LinkProjectToTeamInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects missing projectId', () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          org: 'octocat-org',
          teamSlug: 'engineering',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing org', () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          teamSlug: 'engineering',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing teamSlug', () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with teamSlug', () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.org).toBe('octocat-org');
          expect(result.data.teamSlug).toBe('engineering');
        }
      });
    });

    describe('UnlinkProjectFromTeamInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = UnlinkProjectFromTeamInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = UnlinkProjectFromTeamInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.org).toBe('octocat-org');
          expect(result.data.teamSlug).toBe('engineering');
        }
      });
    });

    describe('ListLinkedRepositoriesInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId with defaults applied', () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it('accepts pagination parameters', () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          first: 50,
          after: 'cursor123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50);
          expect(result.data.after).toBe('cursor123');
        }
      });

      it('rejects invalid first value exceeding max', () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          first: 200,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('ListLinkedTeamsInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = ListLinkedTeamsInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId with defaults applied', () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it('accepts pagination parameters', () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          first: 30,
          after: 'cursor456',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(30);
          expect(result.data.after).toBe('cursor456');
        }
      });

      it('rejects negative first value', () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          first: -5,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    it('linkProjectToRepositoryTool has correct name and title', () => {
      expect(linkProjectToRepositoryTool.name).toBe('link_project_to_repository');
      expect(linkProjectToRepositoryTool.title).toBe('Link Project to Repository');
    });

    it('linkProjectToRepositoryTool has updateIdempotent annotation', () => {
      expect(linkProjectToRepositoryTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('unlinkProjectFromRepositoryTool has correct name and title', () => {
      expect(unlinkProjectFromRepositoryTool.name).toBe('unlink_project_from_repository');
      expect(unlinkProjectFromRepositoryTool.title).toBe('Unlink Project from Repository');
    });

    it('unlinkProjectFromRepositoryTool has delete annotation with destructiveHint', () => {
      expect(unlinkProjectFromRepositoryTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('linkProjectToTeamTool has correct name and title', () => {
      expect(linkProjectToTeamTool.name).toBe('link_project_to_team');
      expect(linkProjectToTeamTool.title).toBe('Link Project to Team');
    });

    it('linkProjectToTeamTool has updateIdempotent annotation', () => {
      expect(linkProjectToTeamTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('unlinkProjectFromTeamTool has correct name and title', () => {
      expect(unlinkProjectFromTeamTool.name).toBe('unlink_project_from_team');
      expect(unlinkProjectFromTeamTool.title).toBe('Unlink Project from Team');
    });

    it('unlinkProjectFromTeamTool has delete annotation', () => {
      expect(unlinkProjectFromTeamTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('listLinkedRepositoriesTool has correct name and title', () => {
      expect(listLinkedRepositoriesTool.name).toBe('list_linked_repositories');
      expect(listLinkedRepositoriesTool.title).toBe('List Linked Repositories');
    });

    it('listLinkedRepositoriesTool has readOnly annotation', () => {
      expect(listLinkedRepositoriesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('listLinkedTeamsTool has correct name and title', () => {
      expect(listLinkedTeamsTool.name).toBe('list_linked_teams');
      expect(listLinkedTeamsTool.title).toBe('List Linked Teams');
    });

    it('listLinkedTeamsTool has readOnly annotation', () => {
      expect(listLinkedTeamsTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('all tools have output schemas defined', () => {
      expect(linkProjectToRepositoryTool.outputSchema).toBeDefined();
      expect(unlinkProjectFromRepositoryTool.outputSchema).toBeDefined();
      expect(linkProjectToTeamTool.outputSchema).toBeDefined();
      expect(unlinkProjectFromTeamTool.outputSchema).toBeDefined();
      expect(listLinkedRepositoriesTool.outputSchema).toBeDefined();
      expect(listLinkedTeamsTool.outputSchema).toBeDefined();
    });

    it('all tools have examples', () => {
      expect(linkProjectToRepositoryTool.examples).toBeDefined();
      expect(linkProjectToRepositoryTool.examples!.length).toBeGreaterThan(0);
      expect(unlinkProjectFromRepositoryTool.examples).toBeDefined();
      expect(linkProjectToTeamTool.examples).toBeDefined();
      expect(unlinkProjectFromTeamTool.examples).toBeDefined();
      expect(listLinkedRepositoriesTool.examples).toBeDefined();
      expect(listLinkedTeamsTool.examples).toBeDefined();
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

    describe('executeLinkProjectToRepository', () => {
      it('resolves repo ID and links to project', async () => {
        // First call: resolve repo ID
        // Second call: link mutation
        mockGraphql
          .mockResolvedValueOnce({
            repository: { id: 'R_kgTest123' },
          })
          .mockResolvedValueOnce({
            linkProjectV2ToRepository: {
              repository: {
                id: 'R_kgTest123',
                name: 'hello-world',
                nameWithOwner: 'octocat/hello-world',
                url: 'https://github.com/octocat/hello-world',
                description: 'Test repository',
              },
            },
          });

        const input = LinkProjectToRepositoryInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });
        const result = await executeLinkProjectToRepository(input);

        expect(result.structuredContent.id).toBe('R_kgTest123');
        expect(result.structuredContent.name).toBe('hello-world');
        expect(result.structuredContent.nameWithOwner).toBe('octocat/hello-world');
        expect(result.structuredContent.url).toBe('https://github.com/octocat/hello-world');
        expect(result.structuredContent.description).toBe('Test repository');
        expect(result.content[0].text).toContain('Linked repository');
        expect(result.content[0].text).toContain('octocat/hello-world');
      });

      it('handles repo not found error', async () => {
        mockGraphql.mockResolvedValueOnce({
          repository: null,
        });

        const input = LinkProjectToRepositoryInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'nonexistent-repo',
        });

        await expect(executeLinkProjectToRepository(input))
          .rejects.toThrow('Repository octocat/nonexistent-repo not found');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = LinkProjectToRepositoryInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });

        await expect(executeLinkProjectToRepository(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeUnlinkProjectFromRepository', () => {
      it('unlinks repository and returns success', async () => {
        // First call: resolve repo ID
        // Second call: unlink mutation
        mockGraphql
          .mockResolvedValueOnce({
            repository: { id: 'R_kgTest123' },
          })
          .mockResolvedValueOnce({
            unlinkProjectV2FromRepository: {
              repository: { id: 'R_kgTest123' },
            },
          });

        const input = UnlinkProjectFromRepositoryInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });
        const result = await executeUnlinkProjectFromRepository(input);

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.message).toContain('Successfully unlinked');
        expect(result.structuredContent.message).toContain('octocat/hello-world');
        expect(result.content[0].text).toContain('Successfully unlinked');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = UnlinkProjectFromRepositoryInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          owner: 'octocat',
          repo: 'hello-world',
        });

        await expect(executeUnlinkProjectFromRepository(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeLinkProjectToTeam', () => {
      it('resolves team ID and links to project', async () => {
        // First call: resolve team ID
        // Second call: link mutation
        mockGraphql
          .mockResolvedValueOnce({
            organization: {
              team: { id: 'T_kwTest123' },
            },
          })
          .mockResolvedValueOnce({
            linkProjectV2ToTeam: {
              team: {
                id: 'T_kwTest123',
                name: 'Engineering Team',
                slug: 'engineering',
                description: 'The engineering team',
              },
            },
          });

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });
        const result = await executeLinkProjectToTeam(input);

        expect(result.structuredContent.id).toBe('T_kwTest123');
        expect(result.structuredContent.name).toBe('Engineering Team');
        expect(result.structuredContent.slug).toBe('engineering');
        expect(result.structuredContent.description).toBe('The engineering team');
        expect(result.content[0].text).toContain('Linked team');
        expect(result.content[0].text).toContain('Engineering Team');
      });

      it('handles org not found error', async () => {
        mockGraphql.mockResolvedValueOnce({
          organization: null,
        });

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'nonexistent-org',
          teamSlug: 'engineering',
        });

        await expect(executeLinkProjectToTeam(input))
          .rejects.toThrow('Organization nonexistent-org not found');
      });

      it('handles team not found error', async () => {
        mockGraphql.mockResolvedValueOnce({
          organization: {
            team: null,
          },
        });

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'nonexistent-team',
        });

        await expect(executeLinkProjectToTeam(input))
          .rejects.toThrow('Team nonexistent-team not found in organization octocat-org');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });

        await expect(executeLinkProjectToTeam(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeUnlinkProjectFromTeam', () => {
      it('unlinks team and returns success', async () => {
        // First call: resolve team ID
        // Second call: unlink mutation
        mockGraphql
          .mockResolvedValueOnce({
            organization: {
              team: { id: 'T_kwTest123' },
            },
          })
          .mockResolvedValueOnce({
            unlinkProjectV2FromTeam: {
              team: { id: 'T_kwTest123' },
            },
          });

        const input = UnlinkProjectFromTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });
        const result = await executeUnlinkProjectFromTeam(input);

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.message).toContain('Successfully unlinked');
        expect(result.structuredContent.message).toContain('engineering');
        expect(result.content[0].text).toContain('Successfully unlinked');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = UnlinkProjectFromTeamInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          org: 'octocat-org',
          teamSlug: 'engineering',
        });

        await expect(executeUnlinkProjectFromTeam(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeListLinkedRepositories', () => {
      it('returns paginated list of linked repositories', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            repositories: {
              nodes: [
                {
                  id: 'R_kg1',
                  name: 'repo-one',
                  nameWithOwner: 'org/repo-one',
                  url: 'https://github.com/org/repo-one',
                  description: 'First repository',
                },
                {
                  id: 'R_kg2',
                  name: 'repo-two',
                  nameWithOwner: 'org/repo-two',
                  url: 'https://github.com/org/repo-two',
                  description: null,
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 2,
            },
          },
        });

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeListLinkedRepositories(input);

        expect(result.structuredContent.repositories).toHaveLength(2);
        expect(result.structuredContent.repositories[0].name).toBe('repo-one');
        expect(result.structuredContent.repositories[0].description).toBe('First repository');
        expect(result.structuredContent.repositories[1].name).toBe('repo-two');
        expect(result.structuredContent.repositories[1].description).toBeNull();
        expect(result.structuredContent.pageInfo.hasNextPage).toBe(false);
        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.content[0].text).toContain('Found 2 linked repositories');
      });

      it('handles empty list', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            repositories: {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 0,
            },
          },
        });

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeListLinkedRepositories(input);

        expect(result.structuredContent.repositories).toHaveLength(0);
        expect(result.structuredContent.totalCount).toBe(0);
        expect(result.content[0].text).toContain('Found 0 linked repositories');
      });

      it('handles pagination cursor', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            repositories: {
              nodes: [
                {
                  id: 'R_kg3',
                  name: 'repo-three',
                  nameWithOwner: 'org/repo-three',
                  url: 'https://github.com/org/repo-three',
                  description: 'Third repository',
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor456',
              },
              totalCount: 5,
            },
          },
        });

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          first: 10,
          after: 'cursor123',
        });
        const result = await executeListLinkedRepositories(input);

        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe('cursor456');
        expect(result.structuredContent.totalCount).toBe(5);
      });

      it('handles project not found', async () => {
        mockGraphql.mockResolvedValue({
          node: null,
        });

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: 'PVT_nonexistent',
        });

        await expect(executeListLinkedRepositories(input))
          .rejects.toThrow('Project PVT_nonexistent not found');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });

        await expect(executeListLinkedRepositories(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeListLinkedTeams', () => {
      it('returns paginated list of linked teams', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            teams: {
              nodes: [
                {
                  id: 'T_kw1',
                  name: 'Engineering',
                  slug: 'engineering',
                  description: 'Engineering team',
                },
                {
                  id: 'T_kw2',
                  name: 'Design',
                  slug: 'design',
                  description: null,
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 2,
            },
          },
        });

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeListLinkedTeams(input);

        expect(result.structuredContent.teams).toHaveLength(2);
        expect(result.structuredContent.teams[0].name).toBe('Engineering');
        expect(result.structuredContent.teams[0].slug).toBe('engineering');
        expect(result.structuredContent.teams[0].description).toBe('Engineering team');
        expect(result.structuredContent.teams[1].name).toBe('Design');
        expect(result.structuredContent.teams[1].description).toBeNull();
        expect(result.structuredContent.pageInfo.hasNextPage).toBe(false);
        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.content[0].text).toContain('Found 2 linked teams');
      });

      it('handles empty list', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            teams: {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 0,
            },
          },
        });

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeListLinkedTeams(input);

        expect(result.structuredContent.teams).toHaveLength(0);
        expect(result.structuredContent.totalCount).toBe(0);
        expect(result.content[0].text).toContain('Found 0 linked teams');
      });

      it('handles pagination correctly', async () => {
        mockGraphql.mockResolvedValue({
          node: {
            teams: {
              nodes: [
                {
                  id: 'T_kw3',
                  name: 'QA',
                  slug: 'qa',
                  description: 'Quality Assurance',
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: 'teamCursor789',
              },
              totalCount: 3,
            },
          },
        });

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
          first: 5,
          after: 'teamCursor456',
        });
        const result = await executeListLinkedTeams(input);

        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe('teamCursor789');
        expect(result.structuredContent.totalCount).toBe(3);
      });

      it('handles project not found', async () => {
        mockGraphql.mockResolvedValue({
          node: null,
        });

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: 'PVT_nonexistent',
        });

        await expect(executeListLinkedTeams(input))
          .rejects.toThrow('Project PVT_nonexistent not found');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });

        await expect(executeListLinkedTeams(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });
  });
});
