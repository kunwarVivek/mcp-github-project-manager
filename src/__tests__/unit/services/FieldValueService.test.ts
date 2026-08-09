import { type Mocked, type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldValueService } from '../../../services/FieldValueService';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { DomainError, } from '../../../domain/errors';

vi.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('FieldValueService', () => {
  let service: FieldValueService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let mockGraphql: MockedFunction<any>;

  const projectId = 'PVT_proj1';
  const itemId = 'PVTI_item1';
  const fieldId = 'PVTF_field1';

  beforeEach(() => {
    vi.clearAllMocks();

    mockGraphql = vi.fn();

    mockFactory = {
      graphql: mockGraphql,
    } as unknown as Mocked<GitHubRepositoryFactory>;

    service = new FieldValueService(mockFactory);
  });

  describe('setFieldValue', () => {
    it('should set a TEXT field value', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          node: { field: { id: fieldId, name: 'Description', dataType: 'TEXT' } },
        })
        .mockResolvedValueOnce({ updateProjectV2ItemFieldValue: { projectV2Item: { id: itemId } } });

      const result = await service.setFieldValue({ projectId, itemId, fieldId, value: 'hello' });

      expect(result).toEqual({ success: true, message: 'Field Description updated successfully' });
      expect(mockGraphql).toHaveBeenCalledTimes(2);
      // Verify mutation variables include stringified value
      const mutationVars = mockGraphql.mock.calls[1][1];
      expect(mutationVars.value).toBe('hello');
    });

    it('should set a NUMBER field value', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          node: { field: { id: fieldId, name: 'Points', dataType: 'NUMBER' } },
        })
        .mockResolvedValueOnce({});

      const result = await service.setFieldValue({ projectId, itemId, fieldId, value: 42 });

      expect(result.success).toBe(true);
      const mutationVars = mockGraphql.mock.calls[1][1];
      expect(mutationVars.value).toBe(42);
    });

    it('should set a DATE field value', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          node: { field: { id: fieldId, name: 'Due', dataType: 'DATE' } },
        })
        .mockResolvedValueOnce({});

      const result = await service.setFieldValue({ projectId, itemId, fieldId, value: '2024-06-01' });

      expect(result.success).toBe(true);
      const mutationVars = mockGraphql.mock.calls[1][1];
      expect(mutationVars.value).toBe('2024-06-01');
    });

    it('should set a SINGLE_SELECT field value by option name', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          node: {
            field: {
              id: fieldId,
              name: 'Status',
              dataType: 'SINGLE_SELECT',
              options: [
                { id: 'opt-1', name: 'Todo' },
                { id: 'opt-2', name: 'Done' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({});

      const result = await service.setFieldValue({ projectId, itemId, fieldId, value: 'Done' });

      expect(result.success).toBe(true);
      const mutationVars = mockGraphql.mock.calls[1][1];
      expect(mutationVars.value).toBe('opt-2');
    });

    it('should set an ITERATION field value', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          node: { field: { id: fieldId, name: 'Sprint', dataType: 'ITERATION' } },
        })
        .mockResolvedValueOnce({});

      const result = await service.setFieldValue({
        projectId, itemId, fieldId,
        value: { iterationId: 'iter-1' },
      });

      expect(result.success).toBe(true);
      const mutationVars = mockGraphql.mock.calls[1][1];
      expect(mutationVars.value).toBe('iter-1');
    });

    it('should throw when field is not found', async () => {
      mockGraphql.mockResolvedValueOnce({ node: { field: null } });

      await expect(
        service.setFieldValue({ projectId, itemId, fieldId, value: 'x' })
      ).rejects.toThrow(DomainError);
    });

    it('should throw mapped error for unsupported field type', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: { field: { id: fieldId, name: 'Custom', dataType: 'UNSUPPORTED' } },
      });

      await expect(
        service.setFieldValue({ projectId, itemId, fieldId, value: 'x' })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('getFieldValue', () => {
    it('should return a TEXT field value', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          fieldValues: {
            nodes: [
              { field: { id: fieldId, name: 'Description' }, text: 'hello world' },
            ],
          },
        },
      });

      const result = await service.getFieldValue({ projectId, itemId, fieldId });

      expect(result).toEqual({
        fieldId, fieldName: 'Description', value: 'hello world', type: 'TEXT',
      });
    });

    it('should return a NUMBER field value', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          fieldValues: {
            nodes: [
              { field: { id: fieldId, name: 'Points' }, number: 5 },
            ],
          },
        },
      });

      const result = await service.getFieldValue({ projectId, itemId, fieldId });
      expect(result.value).toBe(5);
      expect(result.type).toBe('NUMBER');
    });

    it('should return a SINGLE_SELECT field value', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          fieldValues: {
            nodes: [
              { field: { id: fieldId, name: 'Status' }, optionId: 'opt-1', name: 'Todo' },
            ],
          },
        },
      });

      const result = await service.getFieldValue({ projectId, itemId, fieldId });
      expect(result.value).toEqual({ optionId: 'opt-1', name: 'Todo' });
      expect(result.type).toBe('SINGLE_SELECT');
    });

    it('should return null value when field not among item field values', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          fieldValues: {
            nodes: [
              { field: { id: 'other-field', name: 'Other' }, text: 'val' },
            ],
          },
        },
      });

      const result = await service.getFieldValue({ projectId, itemId, fieldId });
      expect(result).toEqual({ fieldId, fieldName: 'unknown', value: null, type: 'unknown' });
    });

    it('should throw when item has no fieldValues', async () => {
      mockGraphql.mockResolvedValueOnce({ node: { fieldValues: null } });

      await expect(
        service.getFieldValue({ projectId, itemId, fieldId })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('clearFieldValue', () => {
    it('should clear a field value', async () => {
      mockGraphql.mockResolvedValueOnce({
        clearProjectV2ItemFieldValue: { projectV2Item: { id: itemId } },
      });

      const result = await service.clearFieldValue({ projectId, itemId, fieldId });

      expect(result).toEqual({ success: true, message: `Field ${fieldId} cleared successfully` });
      expect(mockGraphql).toHaveBeenCalledTimes(1);
    });

    it('should throw mapped error on graphql failure', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.clearFieldValue({ projectId, itemId, fieldId })
      ).rejects.toThrow(DomainError);
    });
  });
});
