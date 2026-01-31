/**
 * Unit tests for project template MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  MarkProjectAsTemplateInputSchema,
  UnmarkProjectAsTemplateInputSchema,
  CopyProjectFromTemplateInputSchema,
  ListOrganizationTemplatesInputSchema,
} from '../../../src/infrastructure/tools/schemas/project-template-linking-schemas.js';
import {
  markProjectAsTemplateTool,
  unmarkProjectAsTemplateTool,
  copyProjectFromTemplateTool,
  listOrganizationTemplatesTool,
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
} from '../../../src/infrastructure/tools/project-template-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Project Template Tools', () => {
  describe('Input Schemas', () => {
    describe('MarkProjectAsTemplateInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
        }
      });
    });

    describe('UnmarkProjectAsTemplateInputSchema', () => {
      it('rejects missing projectId', () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({
          projectId: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest456',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest456');
        }
      });
    });

    describe('CopyProjectFromTemplateInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects missing projectId', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          targetOwner: 'my-org',
          title: 'New Project',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing targetOwner', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          title: 'New Project',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing title', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          targetOwner: 'my-org',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid required fields with default includeDraftIssues', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          targetOwner: 'my-org',
          title: 'New Project',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
          expect(result.data.targetOwner).toBe('my-org');
          expect(result.data.title).toBe('New Project');
          expect(result.data.includeDraftIssues).toBe(false); // default
        }
      });

      it('accepts all valid fields including optional includeDraftIssues', () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          targetOwner: 'my-org',
          title: 'New Project',
          includeDraftIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeDraftIssues).toBe(true);
        }
      });
    });

    describe('ListOrganizationTemplatesInputSchema', () => {
      it('rejects missing org', () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty org', () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid org with defaults applied', () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: 'my-organization',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.org).toBe('my-organization');
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it('accepts pagination parameters', () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: 'my-organization',
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
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: 'my-organization',
          first: 200, // exceeds max of 100
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative first value', () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: 'my-organization',
          first: -1,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    it('markProjectAsTemplateTool has correct name and title', () => {
      expect(markProjectAsTemplateTool.name).toBe('mark_project_as_template');
      expect(markProjectAsTemplateTool.title).toBe('Mark Project as Template');
    });

    it('markProjectAsTemplateTool has updateIdempotent annotation', () => {
      expect(markProjectAsTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('unmarkProjectAsTemplateTool has correct name and title', () => {
      expect(unmarkProjectAsTemplateTool.name).toBe('unmark_project_as_template');
      expect(unmarkProjectAsTemplateTool.title).toBe('Unmark Project as Template');
    });

    it('unmarkProjectAsTemplateTool has updateIdempotent annotation', () => {
      expect(unmarkProjectAsTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('copyProjectFromTemplateTool has correct name and title', () => {
      expect(copyProjectFromTemplateTool.name).toBe('copy_project_from_template');
      expect(copyProjectFromTemplateTool.title).toBe('Copy Project from Template');
    });

    it('copyProjectFromTemplateTool has create annotation', () => {
      expect(copyProjectFromTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
    });

    it('listOrganizationTemplatesTool has correct name and title', () => {
      expect(listOrganizationTemplatesTool.name).toBe('list_organization_templates');
      expect(listOrganizationTemplatesTool.title).toBe('List Organization Templates');
    });

    it('listOrganizationTemplatesTool has readOnly annotation', () => {
      expect(listOrganizationTemplatesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('all tools have output schemas defined', () => {
      expect(markProjectAsTemplateTool.outputSchema).toBeDefined();
      expect(unmarkProjectAsTemplateTool.outputSchema).toBeDefined();
      expect(copyProjectFromTemplateTool.outputSchema).toBeDefined();
      expect(listOrganizationTemplatesTool.outputSchema).toBeDefined();
    });

    it('all tools have examples', () => {
      expect(markProjectAsTemplateTool.examples).toBeDefined();
      expect(markProjectAsTemplateTool.examples!.length).toBeGreaterThan(0);
      expect(unmarkProjectAsTemplateTool.examples).toBeDefined();
      expect(copyProjectFromTemplateTool.examples).toBeDefined();
      expect(copyProjectFromTemplateTool.examples!.length).toBe(2); // Two examples
      expect(listOrganizationTemplatesTool.examples).toBeDefined();
      expect(listOrganizationTemplatesTool.examples!.length).toBe(2); // Two examples
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

    describe('executeMarkProjectAsTemplate', () => {
      it('calls mutation and returns project with isTemplate=true', async () => {
        mockGraphql.mockResolvedValue({
          markProjectV2AsTemplate: {
            projectV2: {
              id: 'PVT_kwDOTest123',
              title: 'Test Template',
              url: 'https://github.com/orgs/testorg/projects/1',
            },
          },
        });

        const input = MarkProjectAsTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeMarkProjectAsTemplate(input);

        expect(result.structuredContent.id).toBe('PVT_kwDOTest123');
        expect(result.structuredContent.title).toBe('Test Template');
        expect(result.structuredContent.isTemplate).toBe(true);
        expect(result.structuredContent.url).toBe('https://github.com/orgs/testorg/projects/1');
        expect(result.content[0].text).toContain('Marked project');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = MarkProjectAsTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });

        await expect(executeMarkProjectAsTemplate(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeUnmarkProjectAsTemplate', () => {
      it('calls mutation and returns project with isTemplate=false', async () => {
        mockGraphql.mockResolvedValue({
          unmarkProjectV2AsTemplate: {
            projectV2: {
              id: 'PVT_kwDOTest123',
              title: 'Test Project',
              url: 'https://github.com/orgs/testorg/projects/1',
            },
          },
        });

        const input = UnmarkProjectAsTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });
        const result = await executeUnmarkProjectAsTemplate(input);

        expect(result.structuredContent.id).toBe('PVT_kwDOTest123');
        expect(result.structuredContent.title).toBe('Test Project');
        expect(result.structuredContent.isTemplate).toBe(false);
        expect(result.content[0].text).toContain('Removed template status');
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = UnmarkProjectAsTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTest123',
        });

        await expect(executeUnmarkProjectAsTemplate(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeCopyProjectFromTemplate', () => {
      it('resolves org ID and calls copy mutation', async () => {
        // First call: resolve org ID
        // Second call: copy project
        mockGraphql
          .mockResolvedValueOnce({
            organization: { id: 'O_kwDOOrg123' },
          })
          .mockResolvedValueOnce({
            copyProjectV2: {
              projectV2: {
                id: 'PVT_kwDONew456',
                title: 'Q1 2025 Sprint Board',
                number: 5,
                url: 'https://github.com/orgs/my-org/projects/5',
                createdAt: '2026-01-31T10:00:00Z',
              },
            },
          });

        const input = CopyProjectFromTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTemplate123',
          targetOwner: 'my-org',
          title: 'Q1 2025 Sprint Board',
          includeDraftIssues: true,
        });
        const result = await executeCopyProjectFromTemplate(input);

        expect(result.structuredContent.id).toBe('PVT_kwDONew456');
        expect(result.structuredContent.title).toBe('Q1 2025 Sprint Board');
        expect(result.structuredContent.number).toBe(5);
        expect(result.structuredContent.url).toBe('https://github.com/orgs/my-org/projects/5');
        expect(result.structuredContent.createdAt).toBe('2026-01-31T10:00:00Z');
        expect(result.content[0].text).toContain('Created project');
        expect(result.content[0].text).toContain('#5');

        // Verify graphql was called twice
        expect(mockGraphql).toHaveBeenCalledTimes(2);
      });

      it('handles org not found error', async () => {
        mockGraphql.mockResolvedValueOnce({
          organization: null,
        });

        const input = CopyProjectFromTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTemplate123',
          targetOwner: 'nonexistent-org',
          title: 'New Project',
        });

        await expect(executeCopyProjectFromTemplate(input))
          .rejects.toThrow("Organization 'nonexistent-org' not found");
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = CopyProjectFromTemplateInputSchema.parse({
          projectId: 'PVT_kwDOTemplate123',
          targetOwner: 'my-org',
          title: 'New Project',
        });

        await expect(executeCopyProjectFromTemplate(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeListOrganizationTemplates', () => {
      it('filters by isTemplate field and returns templates', async () => {
        mockGraphql.mockResolvedValue({
          organization: {
            projectsV2: {
              nodes: [
                {
                  id: 'PVT_1',
                  title: 'Template 1',
                  number: 1,
                  shortDescription: 'First template',
                  url: 'https://github.com/orgs/my-org/projects/1',
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-15T00:00:00Z',
                  template: true,
                },
                {
                  id: 'PVT_2',
                  title: 'Regular Project',
                  number: 2,
                  shortDescription: 'Not a template',
                  url: 'https://github.com/orgs/my-org/projects/2',
                  createdAt: '2026-01-10T00:00:00Z',
                  updatedAt: '2026-01-20T00:00:00Z',
                  template: false,
                },
                {
                  id: 'PVT_3',
                  title: 'Template 2',
                  number: 3,
                  shortDescription: null,
                  url: 'https://github.com/orgs/my-org/projects/3',
                  createdAt: '2026-01-05T00:00:00Z',
                  updatedAt: '2026-01-25T00:00:00Z',
                  template: true,
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 3,
            },
          },
        });

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: 'my-org',
        });
        const result = await executeListOrganizationTemplates(input);

        // Should only include templates (filtered)
        expect(result.structuredContent.templates).toHaveLength(2);
        expect(result.structuredContent.templates[0].title).toBe('Template 1');
        expect(result.structuredContent.templates[0].isTemplate).toBe(true);
        expect(result.structuredContent.templates[1].title).toBe('Template 2');
        expect(result.structuredContent.templates[1].shortDescription).toBeNull();
        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.content[0].text).toContain('Found 2 template(s)');
      });

      it('returns empty array when no templates exist', async () => {
        mockGraphql.mockResolvedValue({
          organization: {
            projectsV2: {
              nodes: [
                {
                  id: 'PVT_1',
                  title: 'Regular Project',
                  number: 1,
                  shortDescription: 'Not a template',
                  url: 'https://github.com/orgs/my-org/projects/1',
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-15T00:00:00Z',
                  template: false,
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 1,
            },
          },
        });

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: 'my-org',
        });
        const result = await executeListOrganizationTemplates(input);

        expect(result.structuredContent.templates).toHaveLength(0);
        expect(result.structuredContent.totalCount).toBe(0);
        expect(result.content[0].text).toContain('Found 0 template(s)');
      });

      it('handles pagination correctly', async () => {
        mockGraphql.mockResolvedValue({
          organization: {
            projectsV2: {
              nodes: [
                {
                  id: 'PVT_4',
                  title: 'Template 4',
                  number: 4,
                  shortDescription: 'Page 2 template',
                  url: 'https://github.com/orgs/my-org/projects/4',
                  createdAt: '2026-01-20T00:00:00Z',
                  updatedAt: '2026-01-25T00:00:00Z',
                  template: true,
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

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: 'my-org',
          first: 10,
          after: 'cursor123',
        });
        const result = await executeListOrganizationTemplates(input);

        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe('cursor456');
      });

      it('handles org not found error', async () => {
        mockGraphql.mockResolvedValue({
          organization: null,
        });

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: 'nonexistent-org',
        });

        await expect(executeListOrganizationTemplates(input))
          .rejects.toThrow("Organization 'nonexistent-org' not found");
      });

      it('returns error when GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: 'my-org',
        });

        await expect(executeListOrganizationTemplates(input))
          .rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });
  });
});
