import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectLinkingService } from '../../../services/ProjectLinkingService';
import { ResourceType } from '../../../domain/resource-types';

describe('ProjectLinkingService', () => {
  let service: ProjectLinkingService;
  let mockGraphql: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock GraphQL function
    mockGraphql = jest.fn() as jest.MockedFunction<any>;

    // Create mock factory
    const mockFactory = {
      graphql: mockGraphql
    };

    // Create service with mock factory
    service = new ProjectLinkingService(mockFactory as any);
  });

  it('should be properly initialized', () => {
    expect(service).toBeDefined();
  });

  describe('addProjectItem', () => {
    it('should add an issue to project successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: {
            id: 'ITEM_123',
            content: {
              id: 'ISSUE_456',
              title: 'Test Issue'
            }
          }
        }
      });

      const result = await service.addProjectItem({
        projectId: 'PROJECT_123',
        contentId: 'ISSUE_456',
        contentType: 'issue'
      });

      expect(result).toEqual(expect.objectContaining({
        id: 'ITEM_123',
        contentId: 'ISSUE_456',
        contentType: ResourceType.ISSUE,
        projectId: 'PROJECT_123',
        fieldValues: {}
      }));
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: AddProjectV2ItemByIdInput!)'),
        expect.objectContaining({
          input: {
            projectId: 'PROJECT_123',
            contentId: 'ISSUE_456'
          }
        })
      );
    });

    it('should add a pull request to project successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: {
            id: 'ITEM_789',
            content: {
              id: 'PR_101',
              title: 'Test PR'
            }
          }
        }
      });

      const result = await service.addProjectItem({
        projectId: 'PROJECT_123',
        contentId: 'PR_101',
        contentType: 'pull_request'
      });

      expect(result.contentType).toBe(ResourceType.PULL_REQUEST);
    });

    it('should handle GraphQL errors when adding item', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Content not found'));

      await expect(service.addProjectItem({
        projectId: 'PROJECT_123',
        contentId: 'NONEXISTENT',
        contentType: 'issue'
      })).rejects.toThrow();
    });
  });

  describe('removeProjectItem', () => {
    it('should remove item from project successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        deleteProjectV2Item: {
          deletedItemId: 'ITEM_123'
        }
      });

      const result = await service.removeProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'ITEM_123'
      });

      expect(result).toEqual({
        success: true,
        message: 'Item ITEM_123 has been removed from project PROJECT_123'
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: DeleteProjectV2ItemInput!)'),
        expect.objectContaining({
          input: {
            projectId: 'PROJECT_123',
            itemId: 'ITEM_123'
          }
        })
      );
    });

    it('should handle errors when removing non-existent item', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Item not found'));

      await expect(service.removeProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'NONEXISTENT'
      })).rejects.toThrow();
    });
  });

  describe('archiveProjectItem', () => {
    it('should archive item successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        archiveProjectV2Item: {
          item: {
            id: 'ITEM_123',
            isArchived: true
          }
        }
      });

      const result = await service.archiveProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'ITEM_123'
      });

      expect(result).toEqual({
        success: true,
        message: 'Item ITEM_123 has been archived in project PROJECT_123'
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: ArchiveProjectV2ItemInput!)'),
        expect.objectContaining({
          input: {
            projectId: 'PROJECT_123',
            itemId: 'ITEM_123'
          }
        })
      );
    });

    it('should handle archive errors', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Archive failed'));

      await expect(service.archiveProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'ITEM_123'
      })).rejects.toThrow();
    });
  });

  describe('unarchiveProjectItem', () => {
    it('should unarchive item successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        unarchiveProjectV2Item: {
          item: {
            id: 'ITEM_123',
            isArchived: false
          }
        }
      });

      const result = await service.unarchiveProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'ITEM_123'
      });

      expect(result).toEqual({
        success: true,
        message: 'Item ITEM_123 has been unarchived in project PROJECT_123'
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation($input: UnarchiveProjectV2ItemInput!)'),
        expect.objectContaining({
          input: {
            projectId: 'PROJECT_123',
            itemId: 'ITEM_123'
          }
        })
      );
    });

    it('should handle unarchive errors', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Unarchive failed'));

      await expect(service.unarchiveProjectItem({
        projectId: 'PROJECT_123',
        itemId: 'ITEM_123'
      })).rejects.toThrow();
    });
  });

  describe('listProjectItems', () => {
    it('should list project items successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              {
                id: 'ITEM_1',
                content: {
                  id: 'ISSUE_1',
                  title: 'Issue 1',
                  __typename: 'Issue'
                },
                fieldValues: {
                  nodes: [
                    {
                      text: 'Some text',
                      field: { id: 'FIELD_1', name: 'Description' }
                    }
                  ]
                }
              },
              {
                id: 'ITEM_2',
                content: {
                  id: 'PR_1',
                  title: 'PR 1',
                  __typename: 'PullRequest'
                },
                fieldValues: {
                  nodes: []
                }
              }
            ]
          }
        }
      });

      const result = await service.listProjectItems({ projectId: 'PROJECT_123' });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'ITEM_1',
        contentId: 'ISSUE_1',
        contentType: ResourceType.ISSUE,
        projectId: 'PROJECT_123'
      }));
      expect(result[0].fieldValues).toHaveProperty('FIELD_1', 'Some text');
      expect(result[1]).toEqual(expect.objectContaining({
        id: 'ITEM_2',
        contentId: 'PR_1',
        contentType: ResourceType.PULL_REQUEST
      }));
    });

    it('should respect limit parameter', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: []
          }
        }
      });

      await service.listProjectItems({ projectId: 'PROJECT_123', limit: 10 });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          projectId: 'PROJECT_123',
          limit: 10
        })
      );
    });

    it('should return empty array when project has no items', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: []
          }
        }
      });

      const result = await service.listProjectItems({ projectId: 'PROJECT_123' });

      expect(result).toEqual([]);
    });

    it('should return empty array when project not found', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: null
      });

      const result = await service.listProjectItems({ projectId: 'NONEXISTENT' });

      expect(result).toEqual([]);
    });

    it('should handle items with date field values', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              {
                id: 'ITEM_1',
                content: {
                  id: 'ISSUE_1',
                  title: 'Issue 1',
                  __typename: 'Issue'
                },
                fieldValues: {
                  nodes: [
                    {
                      date: '2025-01-15',
                      field: { id: 'FIELD_DUE', name: 'Due Date' }
                    }
                  ]
                }
              }
            ]
          }
        }
      });

      const result = await service.listProjectItems({ projectId: 'PROJECT_123' });

      expect(result[0].fieldValues).toHaveProperty('FIELD_DUE', '2025-01-15');
    });

    it('should handle items with single select field values', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              {
                id: 'ITEM_1',
                content: {
                  id: 'ISSUE_1',
                  title: 'Issue 1',
                  __typename: 'Issue'
                },
                fieldValues: {
                  nodes: [
                    {
                      name: 'In Progress',
                      field: { id: 'FIELD_STATUS', name: 'Status' }
                    }
                  ]
                }
              }
            ]
          }
        }
      });

      const result = await service.listProjectItems({ projectId: 'PROJECT_123' });

      expect(result[0].fieldValues).toHaveProperty('FIELD_STATUS', 'In Progress');
    });

    it('should handle items without content', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              {
                id: 'ITEM_1',
                content: undefined,
                fieldValues: {
                  nodes: []
                }
              }
            ]
          }
        }
      });

      const result = await service.listProjectItems({ projectId: 'PROJECT_123' });

      expect(result[0].contentId).toBe('');
      expect(result[0].contentType).toBe(ResourceType.ISSUE); // Default
    });
  });
});
