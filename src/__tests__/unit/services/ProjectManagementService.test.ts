import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectManagementService } from '../../../services/ProjectManagementService';
import { GitHubProjectRepository } from '../../../infrastructure/github/repositories/GitHubProjectRepository';
import { GitHubMilestoneRepository } from '../../../infrastructure/github/repositories/GitHubMilestoneRepository';
import { GitHubIssueRepository } from '../../../infrastructure/github/repositories/GitHubIssueRepository';
import { ResourceStatus, ResourceType } from '../../../domain/resource-types';
import { ValidationError, ResourceNotFoundError, DomainError } from '../../../domain/errors';

// Mock the repositories
jest.mock('../../../infrastructure/github/repositories/GitHubProjectRepository');
jest.mock('../../../infrastructure/github/repositories/GitHubMilestoneRepository');
jest.mock('../../../infrastructure/github/repositories/GitHubIssueRepository');

describe('ProjectManagementService', () => {
  let service: ProjectManagementService;
  let projectRepo: jest.Mocked<GitHubProjectRepository>;
  let milestoneRepo: jest.Mocked<GitHubMilestoneRepository>;
  let issueRepo: jest.Mocked<GitHubIssueRepository>;
  let mockGraphql: jest.MockedFunction<any>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock service with mock factories
    const owner = "test-owner";
    const repo = "test-repo";
    const token = "test-token";
    
    // Create service with proper constructor parameters
    service = new ProjectManagementService(owner, repo, token);
    
    // Mock the GraphQL factory method
    mockGraphql = jest.fn() as jest.MockedFunction<any>;
    Object.defineProperty(service, 'factory', {
      value: { graphql: mockGraphql }
    });
    
    // Mock the implementation of the getter methods to return our mocks
    const mockProjectRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    const mockMilestoneRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getIssues: jest.fn()
    };
    
    const mockIssueRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByMilestone: jest.fn()
    };
    
    // Create spy objects to replace getters
    Object.defineProperty(service, 'projectRepo', { 
      get: jest.fn().mockReturnValue(mockProjectRepo) 
    });
    Object.defineProperty(service, 'milestoneRepo', { 
      get: jest.fn().mockReturnValue(mockMilestoneRepo) 
    });
    Object.defineProperty(service, 'issueRepo', { 
      get: jest.fn().mockReturnValue(mockIssueRepo) 
    });
    
    // Store the mocks for later assertions
    projectRepo = mockProjectRepo as unknown as jest.Mocked<GitHubProjectRepository>;
    milestoneRepo = mockMilestoneRepo as unknown as jest.Mocked<GitHubMilestoneRepository>;
    issueRepo = mockIssueRepo as unknown as jest.Mocked<GitHubIssueRepository>;
  });
  
  it('should be properly initialized', () => {
    expect(service).toBeDefined();
  });

  describe('setFieldValue', () => {
    const mockFieldData = {
      projectId: 'PROJECT_ID',
      itemId: 'ITEM_ID',
      fieldId: 'FIELD_ID'
    };

    beforeEach(() => {
      // Clear previous mock calls but keep the implementation
      mockGraphql.mockClear();
    });

    describe('TEXT field type', () => {
      it('should set text field value successfully', async () => {
        // Mock field query response for TEXT field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Description',
              dataType: 'TEXT'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'Updated description'
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Description'"
        });
        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(mockGraphql).toHaveBeenNthCalledWith(2, 
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            text: 'Updated description'
          })
        );
      });
    });

    describe('NUMBER field type', () => {
      it('should set number field value successfully', async () => {
        // Mock field query response for NUMBER field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Story Points',
              dataType: 'NUMBER'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 5
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Story Points'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            number: 5
          })
        );
      });
    });

    describe('DATE field type', () => {
      it('should set date field value successfully', async () => {
        // Mock field query response for DATE field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Due Date',
              dataType: 'DATE'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: '2024-12-31'
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Due Date'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            date: '2024-12-31'
          })
        );
      });
    });

    describe('SINGLE_SELECT field type', () => {
      it('should set single select field value successfully', async () => {
        // Mock field query response for SINGLE_SELECT field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Status',
              dataType: 'SINGLE_SELECT',
              options: [
                { id: 'OPTION_1', name: 'To Do' },
                { id: 'OPTION_2', name: 'In Progress' },
                { id: 'OPTION_3', name: 'Done' }
              ]
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'In Progress'
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Status'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            optionId: 'OPTION_2'
          })
        );
      });

      it('should throw error for invalid option value', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Status',
              dataType: 'SINGLE_SELECT',
              options: [
                { id: 'OPTION_1', name: 'To Do' },
                { id: 'OPTION_2', name: 'In Progress' }
              ]
            }
          }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: 'Invalid Status'
        })).rejects.toThrow(DomainError);
      });
    });

    describe('ITERATION field type', () => {
      it('should set iteration field value successfully', async () => {
        // Mock field query response for ITERATION field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Sprint',
              dataType: 'ITERATION'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'ITERATION_ID_123'
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Sprint'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            iterationId: 'ITERATION_ID_123'
          })
        );
      });

      it('should throw error for invalid iteration value', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Sprint',
              dataType: 'ITERATION'
            }
          }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: null
        })).rejects.toThrow(DomainError);
      });
    });

    describe('MILESTONE field type', () => {
      it('should set milestone field value successfully', async () => {
        // Mock field query response for MILESTONE field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Milestone',
              dataType: 'MILESTONE'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'MILESTONE_ID_456'
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Milestone'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            milestoneId: 'MILESTONE_ID_456'
          })
        );
      });

      it('should throw error for invalid milestone value', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Milestone',
              dataType: 'MILESTONE'
            }
          }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: 123 // Should be string
        })).rejects.toThrow(DomainError);
      });
    });

    describe('ASSIGNEES field type', () => {
      it('should set assignees field value successfully with array', async () => {
        // Mock field query response for ASSIGNEES field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Assignees',
              dataType: 'ASSIGNEES'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: ['USER_ID_1', 'USER_ID_2']
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Assignees'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            userIds: ['USER_ID_1', 'USER_ID_2']
          })
        );
      });

      it('should set assignees field value successfully with single user', async () => {
        // Mock field query response for ASSIGNEES field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Assignees',
              dataType: 'ASSIGNEES'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'USER_ID_1'
        });

        expect(result.success).toBe(true);
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            userIds: ['USER_ID_1']
          })
        );
      });

      it('should throw error for invalid assignees value', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Assignees',
              dataType: 'ASSIGNEES'
            }
          }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: []
        })).rejects.toThrow(DomainError);
      });
    });

    describe('LABELS field type', () => {
      it('should set labels field value successfully', async () => {
        // Mock field query response for LABELS field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Labels',
              dataType: 'LABELS'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: ['LABEL_ID_1', 'LABEL_ID_2']
        });

        expect(result).toEqual({
          success: true,
          message: "Field value updated successfully for field 'Labels'"
        });
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            labelIds: ['LABEL_ID_1', 'LABEL_ID_2']
          })
        );
      });

      it('should handle single label value', async () => {
        // Mock field query response for LABELS field (first call)
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Labels',
              dataType: 'LABELS'
            }
          }
        });
        
        // Mock update mutation response (second call)
        mockGraphql.mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'ITEM_ID' }
          }
        });

        const result = await service.setFieldValue({
          ...mockFieldData,
          value: 'LABEL_ID_1'
        });

        expect(result.success).toBe(true);
        expect(mockGraphql).toHaveBeenNthCalledWith(2,
          expect.stringContaining('updateProjectV2ItemFieldValue'),
          expect.objectContaining({
            labelIds: ['LABEL_ID_1']
          })
        );
      });
    });

    describe('Error handling', () => {
      it('should throw error for field not found', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: { field: null }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: 'test'
        })).rejects.toThrow(DomainError);
      });

      it('should throw error for unsupported field type', async () => {
        mockGraphql.mockResolvedValueOnce({
          node: {
            field: {
              id: 'FIELD_ID',
              name: 'Unknown Field',
              dataType: 'UNKNOWN_TYPE'
            }
          }
        });

        await expect(service.setFieldValue({
          ...mockFieldData,
          value: 'test'
        })).rejects.toThrow(DomainError);
      });
    });
  });

  describe('getFieldValue', () => {
    const mockFieldData = {
      projectId: 'PROJECT_ID',
      itemId: 'ITEM_ID',
      fieldId: 'FIELD_ID'
    };

    it('should get text field value successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          item: {
            fieldValueByName: {
              text: 'Sample text',
              field: {
                name: 'Description',
                dataType: 'TEXT'
              }
            }
          }
        }
      });

      const result = await service.getFieldValue(mockFieldData);

      expect(result).toEqual({
        fieldName: 'Description',
        value: 'Sample text',
        fieldType: 'TEXT'
      });
    });

    it('should get iteration field value successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          item: {
            fieldValueByName: {
              iterationId: 'ITERATION_123',
              title: 'Sprint 1',
              field: {
                name: 'Sprint',
                dataType: 'ITERATION'
              }
            }
          }
        }
      });

      const result = await service.getFieldValue(mockFieldData);

      expect(result).toEqual({
        fieldName: 'Sprint',
        value: {
          iterationId: 'ITERATION_123',
          title: 'Sprint 1'
        },
        fieldType: 'ITERATION'
      });
    });

    it('should get milestone field value successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          item: {
            fieldValueByName: {
              milestoneId: 'MILESTONE_456',
              title: 'v1.0 Release',
              field: {
                name: 'Milestone',
                dataType: 'MILESTONE'
              }
            }
          }
        }
      });

      const result = await service.getFieldValue(mockFieldData);

      expect(result).toEqual({
        fieldName: 'Milestone',
        value: {
          milestoneId: 'MILESTONE_456',
          title: 'v1.0 Release'
        },
        fieldType: 'MILESTONE'
      });
    });

    it('should get assignees field value successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          item: {
            fieldValueByName: {
              users: {
                nodes: [
                  { id: 'USER_1', login: 'user1' },
                  { id: 'USER_2', login: 'user2' }
                ]
              },
              field: {
                name: 'Assignees',
                dataType: 'ASSIGNEES'
              }
            }
          }
        }
      });

      const result = await service.getFieldValue(mockFieldData);

      expect(result).toEqual({
        fieldName: 'Assignees',
        value: [
          { id: 'USER_1', login: 'user1' },
          { id: 'USER_2', login: 'user2' }
        ],
        fieldType: 'ASSIGNEES'
      });
    });

    it('should get labels field value successfully', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          item: {
            fieldValueByName: {
              labels: {
                nodes: [
                  { id: 'LABEL_1', name: 'bug' },
                  { id: 'LABEL_2', name: 'enhancement' }
                ]
              },
              field: {
                name: 'Labels',
                dataType: 'LABELS'
              }
            }
          }
        }
      });

      const result = await service.getFieldValue(mockFieldData);

      expect(result).toEqual({
        fieldName: 'Labels',
        value: [
          { id: 'LABEL_1', name: 'bug' },
          { id: 'LABEL_2', name: 'enhancement' }
        ],
        fieldType: 'LABELS'
      });
    });
  });
});