import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectTemplateService } from '../../../services/ProjectTemplateService';
import { ResourceType } from '../../../domain/resource-types';

describe('ProjectTemplateService', () => {
  let service: ProjectTemplateService;
  let mockGraphql: jest.MockedFunction<any>;
  let mockProjectRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock GraphQL function
    mockGraphql = jest.fn() as jest.MockedFunction<any>;

    // Create mock project repository
    mockProjectRepo = {
      findById: jest.fn(),
      createView: jest.fn(),
      updateField: jest.fn(),
      deleteView: jest.fn()
    };

    // Create mock factory
    const mockFactory = {
      graphql: mockGraphql,
      createProjectRepository: jest.fn().mockReturnValue(mockProjectRepo)
    };

    // Create service with mock factory
    service = new ProjectTemplateService(mockFactory as any);
  });

  it('should be properly initialized', () => {
    expect(service).toBeDefined();
  });

  describe('getProjectReadme', () => {
    it('should get project README successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          readme: '# Project README\n\nThis is the project description.'
        }
      });

      const result = await service.getProjectReadme({ projectId: 'PROJECT_123' });

      expect(result).toEqual({
        readme: '# Project README\n\nThis is the project description.'
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('query($projectId: ID!)'),
        expect.objectContaining({ projectId: 'PROJECT_123' })
      );
    });

    it('should return empty string when README is null', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          readme: null
        }
      });

      const result = await service.getProjectReadme({ projectId: 'PROJECT_123' });

      expect(result).toEqual({ readme: '' });
    });

    it('should handle GraphQL errors', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('GraphQL error'));

      await expect(service.getProjectReadme({ projectId: 'PROJECT_123' }))
        .rejects.toThrow();
    });
  });

  describe('updateProjectReadme', () => {
    it('should update project README successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        updateProjectV2: {
          projectV2: {
            id: 'PROJECT_123',
            readme: '# Updated README'
          }
        }
      });

      const result = await service.updateProjectReadme({
        projectId: 'PROJECT_123',
        readme: '# Updated README'
      });

      expect(result).toEqual({
        success: true,
        message: 'Project README updated successfully'
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: UpdateProjectV2Input!)'),
        expect.objectContaining({
          input: {
            projectId: 'PROJECT_123',
            readme: '# Updated README'
          }
        })
      );
    });

    it('should handle update errors', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.updateProjectReadme({
        projectId: 'PROJECT_123',
        readme: '# Test'
      })).rejects.toThrow();
    });
  });

  describe('listProjectFields', () => {
    it('should list project fields successfully', async () => {
      const mockFields = [
        { id: 'FIELD_1', name: 'Status', type: 'single_select' as const },
        { id: 'FIELD_2', name: 'Priority', type: 'single_select' as const }
      ];

      mockProjectRepo.findById.mockResolvedValueOnce({
        id: 'PROJECT_123',
        fields: mockFields
      });

      const result = await service.listProjectFields({ projectId: 'PROJECT_123' });

      expect(result).toEqual(mockFields);
      expect(mockProjectRepo.findById).toHaveBeenCalledWith('PROJECT_123');
    });

    it('should return empty array when project has no fields', async () => {
      mockProjectRepo.findById.mockResolvedValueOnce({
        id: 'PROJECT_123',
        fields: undefined
      });

      const result = await service.listProjectFields({ projectId: 'PROJECT_123' });

      expect(result).toEqual([]);
    });

    it('should throw error when project not found', async () => {
      mockProjectRepo.findById.mockResolvedValueOnce(null);

      await expect(service.listProjectFields({ projectId: 'NONEXISTENT' }))
        .rejects.toThrow();
    });
  });

  describe('updateProjectField', () => {
    it('should update field name successfully', async () => {
      const updatedField = { id: 'FIELD_1', name: 'New Name', type: 'text' as const };
      mockProjectRepo.updateField.mockResolvedValueOnce(updatedField);

      const result = await service.updateProjectField({
        projectId: 'PROJECT_123',
        fieldId: 'FIELD_1',
        name: 'New Name'
      });

      expect(result).toEqual(updatedField);
      expect(mockProjectRepo.updateField).toHaveBeenCalledWith(
        'PROJECT_123',
        'FIELD_1',
        { name: 'New Name' }
      );
    });

    it('should update field options successfully', async () => {
      const updatedField = {
        id: 'FIELD_1',
        name: 'Status',
        type: 'single_select' as const,
        options: [
          { id: '', name: 'Open', color: 'green' },
          { id: '', name: 'Closed', color: 'red' }
        ]
      };
      mockProjectRepo.updateField.mockResolvedValueOnce(updatedField);

      const result = await service.updateProjectField({
        projectId: 'PROJECT_123',
        fieldId: 'FIELD_1',
        options: [
          { name: 'Open', color: 'green' },
          { name: 'Closed', color: 'red' }
        ]
      });

      expect(result).toEqual(updatedField);
    });
  });

  describe('createProjectView', () => {
    it('should create a board view successfully', async () => {
      const newView = {
        id: 'VIEW_1',
        name: 'Sprint Board',
        layout: 'board' as const,
        fields: [],
        sortBy: [],
        filters: []
      };
      mockProjectRepo.createView.mockResolvedValueOnce(newView);

      const result = await service.createProjectView({
        projectId: 'PROJECT_123',
        name: 'Sprint Board',
        layout: 'board'
      });

      expect(result).toEqual(newView);
      expect(mockProjectRepo.createView).toHaveBeenCalledWith(
        'PROJECT_123',
        'Sprint Board',
        'board'
      );
    });

    it('should create a table view successfully', async () => {
      const newView = {
        id: 'VIEW_2',
        name: 'All Items',
        layout: 'table' as const,
        fields: [],
        sortBy: [],
        filters: []
      };
      mockProjectRepo.createView.mockResolvedValueOnce(newView);

      const result = await service.createProjectView({
        projectId: 'PROJECT_123',
        name: 'All Items',
        layout: 'table'
      });

      expect(result).toEqual(newView);
    });
  });

  describe('listProjectViews', () => {
    it('should list project views successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          views: {
            nodes: [
              { id: 'VIEW_1', name: 'Board', layout: 'BOARD' },
              { id: 'VIEW_2', name: 'Table', layout: 'TABLE' }
            ]
          }
        }
      });

      const result = await service.listProjectViews({ projectId: 'PROJECT_123' });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'VIEW_1',
        name: 'Board',
        layout: 'board'
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        id: 'VIEW_2',
        name: 'Table',
        layout: 'table'
      }));
    });

    it('should return empty array when project has no views', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          views: null
        }
      });

      const result = await service.listProjectViews({ projectId: 'PROJECT_123' });

      expect(result).toEqual([]);
    });
  });

  describe('updateProjectView', () => {
    it('should update view name successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        updateProjectV2View: {
          projectV2View: {
            id: 'VIEW_1',
            name: 'Updated Board',
            layout: 'BOARD'
          }
        }
      });

      const result = await service.updateProjectView({
        projectId: 'PROJECT_123',
        viewId: 'VIEW_1',
        name: 'Updated Board'
      });

      expect(result).toEqual(expect.objectContaining({
        id: 'VIEW_1',
        name: 'Updated Board',
        layout: 'board'
      }));
    });

    it('should update view layout successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        updateProjectV2View: {
          projectV2View: {
            id: 'VIEW_1',
            name: 'Sprint View',
            layout: 'TABLE'
          }
        }
      });

      const result = await service.updateProjectView({
        projectId: 'PROJECT_123',
        viewId: 'VIEW_1',
        layout: 'table'
      });

      expect(result.layout).toBe('table');
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: UpdateProjectV2ViewInput!)'),
        expect.objectContaining({
          input: expect.objectContaining({
            layout: 'TABLE'
          })
        })
      );
    });
  });

  describe('deleteProjectView', () => {
    it('should delete view successfully', async () => {
      mockProjectRepo.deleteView.mockResolvedValueOnce(undefined);

      const result = await service.deleteProjectView({
        projectId: 'PROJECT_123',
        viewId: 'VIEW_1'
      });

      expect(result).toEqual({
        success: true,
        message: 'View VIEW_1 deleted successfully from project PROJECT_123'
      });
      expect(mockProjectRepo.deleteView).toHaveBeenCalledWith('PROJECT_123', 'VIEW_1');
    });

    it('should handle delete errors', async () => {
      mockProjectRepo.deleteView.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.deleteProjectView({
        projectId: 'PROJECT_123',
        viewId: 'VIEW_1'
      })).rejects.toThrow();
    });
  });
});
