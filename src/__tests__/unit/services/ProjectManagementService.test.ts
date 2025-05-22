import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectManagementService } from '../../../services/ProjectManagementService';
import { GitHubProjectRepository } from '../../../infrastructure/github/repositories/GitHubProjectRepository';
import { GitHubMilestoneRepository } from '../../../infrastructure/github/repositories/GitHubMilestoneRepository';
import { GitHubIssueRepository } from '../../../infrastructure/github/repositories/GitHubIssueRepository';
import { ResourceStatus, ResourceType } from '../../../domain/resource-types';

// Mock the repositories
jest.mock('../../../infrastructure/github/repositories/GitHubProjectRepository');
jest.mock('../../../infrastructure/github/repositories/GitHubMilestoneRepository');
jest.mock('../../../infrastructure/github/repositories/GitHubIssueRepository');

describe('ProjectManagementService', () => {
  let service: ProjectManagementService;
  let projectRepo: jest.Mocked<GitHubProjectRepository>;
  let milestoneRepo: jest.Mocked<GitHubMilestoneRepository>;
  let issueRepo: jest.Mocked<GitHubIssueRepository>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock service with mock factories
    const owner = "test-owner";
    const repo = "test-repo";
    const token = "test-token";
    
    // Create service with proper constructor parameters
    service = new ProjectManagementService(owner, repo, token);
    
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
});