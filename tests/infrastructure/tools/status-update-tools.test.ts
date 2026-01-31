/**
 * Unit tests for status update MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  CreateStatusUpdateInputSchema,
  ListStatusUpdatesInputSchema,
  GetStatusUpdateInputSchema,
} from '../../../src/infrastructure/tools/schemas/status-update-schemas.js';
import {
  createStatusUpdateTool,
  listStatusUpdatesTool,
  getStatusUpdateTool,
  executeCreateStatusUpdate,
  executeListStatusUpdates,
  executeGetStatusUpdate,
} from '../../../src/infrastructure/tools/status-update-tools.js';
import { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';
import { StatusUpdateStatus } from '../../../src/infrastructure/github/repositories/types.js';

// Mock the repository factory
jest.mock('../../../src/infrastructure/github/GitHubRepositoryFactory.js');

const MockedFactory = GitHubRepositoryFactory as jest.MockedClass<typeof GitHubRepositoryFactory>;

describe('Status Update Tools', () => {
  describe('Input Schemas', () => {
    describe('CreateStatusUpdateInputSchema', () => {
      it('rejects missing required fields', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({
          projectId: '',
          body: 'Update message',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty body', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({
          projectId: 'PVT_123',
          body: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with body only', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          body: 'Sprint is on track',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid input with all options', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          body: 'Project at risk',
          status: 'AT_RISK',
          startDate: '2026-01-01',
          targetDate: '2026-03-31',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('AT_RISK');
          expect(result.data.startDate).toBe('2026-01-01');
          expect(result.data.targetDate).toBe('2026-03-31');
        }
      });

      it('rejects invalid status value', () => {
        const result = CreateStatusUpdateInputSchema.safeParse({
          projectId: 'PVT_123',
          body: 'Update',
          status: 'INVALID_STATUS',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('ListStatusUpdatesInputSchema', () => {
      it('accepts valid input with projectId only', () => {
        const result = ListStatusUpdatesInputSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          // Zod optional().default() makes the default available via schema.parse(),
          // but safeParse doesn't apply defaults to optional fields automatically
          // The executor will handle the default value
          expect(result.data.first).toBeUndefined();
        }
      });

      it('accepts pagination parameters', () => {
        const result = ListStatusUpdatesInputSchema.safeParse({
          projectId: 'PVT_kwDOLhQ7gc4AOEbH',
          first: 50,
          after: 'cursor_abc',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50);
          expect(result.data.after).toBe('cursor_abc');
        }
      });

      it('rejects first > 100', () => {
        const result = ListStatusUpdatesInputSchema.safeParse({
          projectId: 'PVT_123',
          first: 150,
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative first', () => {
        const result = ListStatusUpdatesInputSchema.safeParse({
          projectId: 'PVT_123',
          first: -1,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('GetStatusUpdateInputSchema', () => {
      it('accepts valid input', () => {
        const result = GetStatusUpdateInputSchema.safeParse({
          statusUpdateId: 'PVTSU_lADOLhQ7gc4AOEbHzM4AOrKa',
        });
        expect(result.success).toBe(true);
      });

      it('rejects empty statusUpdateId', () => {
        const result = GetStatusUpdateInputSchema.safeParse({
          statusUpdateId: '',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing statusUpdateId', () => {
        const result = GetStatusUpdateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    it('createStatusUpdateTool has correct name and title', () => {
      expect(createStatusUpdateTool.name).toBe('create_status_update');
      expect(createStatusUpdateTool.title).toBe('Create Status Update');
    });

    it('createStatusUpdateTool has create annotation', () => {
      expect(createStatusUpdateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false, // create is not idempotent
        openWorldHint: true,
      });
    });

    it('listStatusUpdatesTool has readOnly annotation', () => {
      expect(listStatusUpdatesTool.name).toBe('list_status_updates');
      expect(listStatusUpdatesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('getStatusUpdateTool has readOnly annotation', () => {
      expect(getStatusUpdateTool.name).toBe('get_status_update');
      expect(getStatusUpdateTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it('all tools have output schemas defined', () => {
      expect(createStatusUpdateTool.outputSchema).toBeDefined();
      expect(listStatusUpdatesTool.outputSchema).toBeDefined();
      expect(getStatusUpdateTool.outputSchema).toBeDefined();
    });

    it('all tools have examples', () => {
      expect(createStatusUpdateTool.examples).toBeDefined();
      expect(createStatusUpdateTool.examples!.length).toBe(2); // Two examples
      expect(listStatusUpdatesTool.examples).toBeDefined();
      expect(getStatusUpdateTool.examples).toBeDefined();
    });

    it('createStatusUpdateTool description mentions status values', () => {
      expect(createStatusUpdateTool.description).toContain('ON_TRACK');
      expect(createStatusUpdateTool.description).toContain('AT_RISK');
      expect(createStatusUpdateTool.description).toContain('OFF_TRACK');
    });
  });

  describe('Executors', () => {
    const originalEnv = process.env;
    let mockStatusUpdateRepo: jest.Mocked<{
      createStatusUpdate: jest.Mock;
      listStatusUpdates: jest.Mock;
      getStatusUpdate: jest.Mock;
    }>;

    beforeEach(() => {
      jest.resetAllMocks();
      process.env = { ...originalEnv, GITHUB_TOKEN: 'test-token' };

      mockStatusUpdateRepo = {
        createStatusUpdate: jest.fn(),
        listStatusUpdates: jest.fn(),
        getStatusUpdate: jest.fn(),
      };

      MockedFactory.mockImplementation(() => ({
        createStatusUpdateRepository: jest.fn().mockReturnValue(mockStatusUpdateRepo),
      } as unknown as GitHubRepositoryFactory));
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('executeCreateStatusUpdate', () => {
      it('creates with body only', async () => {
        mockStatusUpdateRepo.createStatusUpdate.mockResolvedValue({
          id: 'SU_123',
          body: 'Sprint is on track',
          bodyHTML: '<p>Sprint is on track</p>',
          status: StatusUpdateStatus.ON_TRACK,
          startDate: undefined,
          targetDate: undefined,
          createdAt: '2026-01-31T10:00:00Z',
          creator: { login: 'testuser' },
        });

        const result = await executeCreateStatusUpdate({
          projectId: 'PVT_123',
          body: 'Sprint is on track',
        });

        expect(result.content[0].text).toContain('SU_123');
        expect(result.structuredContent.id).toBe('SU_123');
        expect(result.structuredContent.body).toBe('Sprint is on track');
        expect(result.structuredContent.startDate).toBeNull();
      });

      it('creates with all options', async () => {
        mockStatusUpdateRepo.createStatusUpdate.mockResolvedValue({
          id: 'SU_456',
          body: 'Project at risk',
          bodyHTML: '<p>Project at risk</p>',
          status: StatusUpdateStatus.AT_RISK,
          startDate: '2026-01-01',
          targetDate: '2026-03-31',
          createdAt: '2026-01-31T10:00:00Z',
          creator: { login: 'pm' },
        });

        const result = await executeCreateStatusUpdate({
          projectId: 'PVT_456',
          body: 'Project at risk',
          status: 'AT_RISK',
          startDate: '2026-01-01',
          targetDate: '2026-03-31',
        });

        expect(result.structuredContent.status).toBe(StatusUpdateStatus.AT_RISK);
        expect(result.structuredContent.startDate).toBe('2026-01-01');
        expect(result.structuredContent.targetDate).toBe('2026-03-31');
      });

      it('returns error when token is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        await expect(
          executeCreateStatusUpdate({
            projectId: 'PVT_123',
            body: 'Test',
          })
        ).rejects.toThrow('GITHUB_TOKEN environment variable is required');
      });
    });

    describe('executeListStatusUpdates', () => {
      it('returns paginated list', async () => {
        mockStatusUpdateRepo.listStatusUpdates.mockResolvedValue({
          statusUpdates: [
            {
              id: 'SU_1',
              body: 'Update 1',
              bodyHTML: '<p>Update 1</p>',
              status: StatusUpdateStatus.ON_TRACK,
              startDate: '2026-01-01',
              targetDate: '2026-02-01',
              createdAt: '2026-01-15T10:00:00Z',
              creator: { login: 'user1' },
            },
            {
              id: 'SU_2',
              body: 'Update 2',
              bodyHTML: '<p>Update 2</p>',
              status: StatusUpdateStatus.AT_RISK,
              startDate: undefined,
              targetDate: undefined,
              createdAt: '2026-01-14T09:00:00Z',
              creator: { login: 'user2' },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'cursor_abc' },
          totalCount: 5,
        });

        const result = await executeListStatusUpdates({
          projectId: 'PVT_123',
        });

        expect(result.content[0].text).toContain('5 status updates');
        expect(result.structuredContent.statusUpdates).toHaveLength(2);
        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.totalCount).toBe(5);
      });

      it('handles null dates in list', async () => {
        mockStatusUpdateRepo.listStatusUpdates.mockResolvedValue({
          statusUpdates: [
            {
              id: 'SU_1',
              body: 'No dates',
              bodyHTML: '<p>No dates</p>',
              status: StatusUpdateStatus.INACTIVE,
              startDate: undefined,
              targetDate: undefined,
              createdAt: '2026-01-15T10:00:00Z',
              creator: { login: 'user' },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: undefined },
          totalCount: 1,
        });

        const result = await executeListStatusUpdates({
          projectId: 'PVT_123',
        });

        expect(result.structuredContent.statusUpdates[0].startDate).toBeNull();
        expect(result.structuredContent.statusUpdates[0].targetDate).toBeNull();
        expect(result.structuredContent.pageInfo.endCursor).toBeNull();
      });
    });

    describe('executeGetStatusUpdate', () => {
      it('returns null when not found', async () => {
        mockStatusUpdateRepo.getStatusUpdate.mockResolvedValue(null);

        const result = await executeGetStatusUpdate({
          statusUpdateId: 'SU_notfound',
        });

        expect(result.content[0].text).toContain('not found');
        expect(result.structuredContent).toBeNull();
      });

      it('returns status update when found', async () => {
        mockStatusUpdateRepo.getStatusUpdate.mockResolvedValue({
          id: 'SU_found',
          body: 'Found update',
          bodyHTML: '<p>Found update</p>',
          status: StatusUpdateStatus.COMPLETE,
          startDate: '2025-01-01',
          targetDate: '2025-12-31',
          createdAt: '2025-12-31T23:59:00Z',
          creator: { login: 'lead' },
        });

        const result = await executeGetStatusUpdate({
          statusUpdateId: 'SU_found',
        });

        expect(result.content[0].text).toContain('SU_found');
        expect(result.structuredContent).not.toBeNull();
        expect(result.structuredContent!.id).toBe('SU_found');
        expect(result.structuredContent!.status).toBe(StatusUpdateStatus.COMPLETE);
      });

      it('handles null dates in result', async () => {
        mockStatusUpdateRepo.getStatusUpdate.mockResolvedValue({
          id: 'SU_nodates',
          body: 'No dates',
          bodyHTML: '<p>No dates</p>',
          status: StatusUpdateStatus.ON_TRACK,
          startDate: undefined,
          targetDate: undefined,
          createdAt: '2026-01-31T00:00:00Z',
          creator: { login: 'user' },
        });

        const result = await executeGetStatusUpdate({
          statusUpdateId: 'SU_nodates',
        });

        expect(result.structuredContent!.startDate).toBeNull();
        expect(result.structuredContent!.targetDate).toBeNull();
      });
    });
  });
});
