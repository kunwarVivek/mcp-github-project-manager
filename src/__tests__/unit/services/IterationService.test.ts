import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IterationService } from '../../../services/IterationService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { FieldValueService } from '../../../services/FieldValueService';
import { ProjectTemplateService } from '../../../services/ProjectTemplateService';
import { ProjectLinkingService } from '../../../services/ProjectLinkingService';
import { DomainError } from '../../../domain/errors';
import { ResourceType } from '../../../domain/resource-types';
import { CustomField, ProjectItem } from '../../../domain/types';

jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');
jest.mock('../../../services/FieldValueService');
jest.mock('../../../services/ProjectTemplateService');
jest.mock('../../../services/ProjectLinkingService');

describe('IterationService', () => {
  let service: IterationService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockFieldValueService: jest.Mocked<FieldValueService>;
  let mockTemplateService: jest.Mocked<ProjectTemplateService>;
  let mockLinkingService: jest.Mocked<ProjectLinkingService>;

  const projectId = 'PVT_proj1';

  const now = new Date();
  // An iteration that spans today
  const todayStart = new Date(now);
  todayStart.setDate(todayStart.getDate() - 3);
  const todayStartStr = todayStart.toISOString().split('T')[0];

  // A past iteration
  const pastStart = new Date(now);
  pastStart.setDate(pastStart.getDate() - 30);
  const pastStartStr = pastStart.toISOString().split('T')[0];

  // A future iteration
  const futureStart = new Date(now);
  futureStart.setDate(futureStart.getDate() + 20);
  const futureStartStr = futureStart.toISOString().split('T')[0];

  const iterationField: CustomField = {
    id: 'PVTF_iter',
    name: 'Sprint',
    type: 'iteration',
    config: {
      iterationDuration: 14,
      iterationStart: todayStartStr,
      iterations: [
        { id: 'iter-past', title: 'Sprint 1', startDate: pastStartStr, duration: 14 },
        { id: 'iter-current', title: 'Sprint 2', startDate: todayStartStr, duration: 14 },
        { id: 'iter-future', title: 'Sprint 3', startDate: futureStartStr, duration: 14 },
      ],
    },
  };

  const nonIterationField: CustomField = {
    id: 'PVTF_status',
    name: 'Status',
    type: 'single_select',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFactory = {} as jest.Mocked<GitHubRepositoryFactory>;
    mockFieldValueService = { setFieldValue: jest.fn() } as unknown as jest.Mocked<FieldValueService>;
    mockTemplateService = { listProjectFields: jest.fn() } as unknown as jest.Mocked<ProjectTemplateService>;
    mockLinkingService = { listProjectItems: jest.fn() } as unknown as jest.Mocked<ProjectLinkingService>;

    service = new IterationService(
      mockFactory,
      mockFieldValueService,
      mockTemplateService,
      mockLinkingService
    );
  });

  describe('getIterationConfiguration', () => {
    it('should return iteration config from project fields', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([nonIterationField, iterationField]);

      const result = await service.getIterationConfiguration({ projectId });

      expect(result.fieldId).toBe('PVTF_iter');
      expect(result.fieldName).toBe('Sprint');
      expect(result.duration).toBe(14);
      expect(result.iterations).toHaveLength(3);
      expect(result.iterations[0].id).toBe('iter-past');
    });

    it('should filter by fieldName when provided', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([nonIterationField, iterationField]);

      const result = await service.getIterationConfiguration({
        projectId, fieldName: 'Sprint',
      });

      expect(result.fieldId).toBe('PVTF_iter');
    });

    it('should throw when no iteration field found', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([nonIterationField]);

      await expect(
        service.getIterationConfiguration({ projectId })
      ).rejects.toThrow(DomainError);
    });

    it('should throw when iteration field has no config', async () => {
      const noConfigField: CustomField = { id: 'PVTF_x', name: 'Sprint', type: 'iteration' };
      mockTemplateService.listProjectFields.mockResolvedValueOnce([noConfigField]);

      await expect(
        service.getIterationConfiguration({ projectId })
      ).rejects.toThrow();
    });

    it('should default duration to 14 when not specified', async () => {
      const minimalField: CustomField = {
        id: 'PVTF_x', name: 'Sprint', type: 'iteration',
        config: { iterations: [] },
      };
      mockTemplateService.listProjectFields.mockResolvedValueOnce([minimalField]);

      const result = await service.getIterationConfiguration({ projectId });
      expect(result.duration).toBe(14);
    });
  });

  describe('getCurrentIteration', () => {
    it('should return the current iteration', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([iterationField]);

      const result = await service.getCurrentIteration({ projectId });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('iter-current');
      expect(result!.title).toBe('Sprint 2');
      expect(result!.duration).toBe(14);
    });

    it('should return null when no iteration covers today', async () => {
      const gapField: CustomField = {
        id: 'PVTF_iter', name: 'Sprint', type: 'iteration',
        config: {
          iterationDuration: 7,
          iterations: [
            { id: 'iter-past', title: 'Old', startDate: pastStartStr, duration: 7 },
          ],
        },
      };
      mockTemplateService.listProjectFields.mockResolvedValueOnce([gapField]);

      const result = await service.getCurrentIteration({ projectId });
      expect(result).toBeNull();
    });
  });

  describe('getIterationItems', () => {
    it('should return items matching the iteration ID', async () => {
      const items: ProjectItem[] = [
        {
          id: 'item-1', contentId: 'c1', contentType: ResourceType.ISSUE,
          projectId, fieldValues: { 'PVTF_iter': 'iter-current' },
          createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'item-2', contentId: 'c2', contentType: ResourceType.PULL_REQUEST,
          projectId, fieldValues: { 'PVTF_iter': 'iter-past' },
          createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
        },
      ];
      mockLinkingService.listProjectItems.mockResolvedValueOnce(items);

      const result = await service.getIterationItems({
        projectId, iterationId: 'iter-current',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('item-1');
    });

    it('should return empty array when no items match', async () => {
      mockLinkingService.listProjectItems.mockResolvedValueOnce([]);

      const result = await service.getIterationItems({
        projectId, iterationId: 'iter-none',
      });

      expect(result.items).toEqual([]);
    });
  });

  describe('getIterationByDate', () => {
    it('should return the iteration that contains the given date', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([iterationField]);

      // Use a date within the current iteration window
      const targetDate = new Date(todayStart);
      targetDate.setDate(targetDate.getDate() + 1);

      const result = await service.getIterationByDate({
        projectId, date: targetDate.toISOString(),
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('iter-current');
    });

    it('should return null for a date not in any iteration', async () => {
      const gapField: CustomField = {
        id: 'PVTF_iter', name: 'Sprint', type: 'iteration',
        config: { iterations: [] },
      };
      mockTemplateService.listProjectFields.mockResolvedValueOnce([gapField]);

      const result = await service.getIterationByDate({
        projectId, date: '2099-01-01',
      });

      expect(result).toBeNull();
    });
  });

  describe('assignItemsToIteration', () => {
    it('should assign multiple items and return count', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([iterationField]);
      mockFieldValueService.setFieldValue.mockResolvedValue({ success: true, message: 'ok' });

      const result = await service.assignItemsToIteration({
        projectId, itemIds: ['item-1', 'item-2'], iterationId: 'iter-current',
      });

      expect(result).toEqual({ success: true, assignedCount: 2 });
      expect(mockFieldValueService.setFieldValue).toHaveBeenCalledTimes(2);
    });

    it('should continue on individual item failure', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([iterationField]);
      mockFieldValueService.setFieldValue
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ success: true, message: 'ok' });

      const result = await service.assignItemsToIteration({
        projectId, itemIds: ['bad-item', 'good-item'], iterationId: 'iter-current',
      });

      expect(result).toEqual({ success: true, assignedCount: 1 });
    });

    it('should return success false when all items fail', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([iterationField]);
      mockFieldValueService.setFieldValue.mockRejectedValue(new Error('fail'));

      const result = await service.assignItemsToIteration({
        projectId, itemIds: ['bad-1', 'bad-2'], iterationId: 'iter-current',
      });

      expect(result).toEqual({ success: false, assignedCount: 0 });
    });

    it('should throw when no iteration field is found', async () => {
      mockTemplateService.listProjectFields.mockResolvedValueOnce([nonIterationField]);

      await expect(
        service.assignItemsToIteration({
          projectId, itemIds: ['item-1'], iterationId: 'iter-1',
        })
      ).rejects.toThrow(DomainError);
    });
  });
});
