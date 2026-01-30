import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectStatusService } from '../../../services/ProjectStatusService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { GitHubProjectRepository } from '../../../infrastructure/github/repositories/GitHubProjectRepository';
import { ResourceStatus, ResourceType } from '../../../domain/resource-types';
import { Project } from '../../../domain/types';

// Mock tsyringe decorators
jest.mock('tsyringe', () => ({
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

describe('ProjectStatusService', () => {
  let service: ProjectStatusService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockProjectRepo: jest.Mocked<GitHubProjectRepository>;

  const mockProject: Project = {
    id: 'project-1',
    type: ResourceType.PROJECT,
    title: 'Test Project',
    description: 'Test description',
    owner: 'test-owner',
    number: 1,
    url: 'https://github.com/users/test-owner/projects/1',
    visibility: 'private',
    status: ResourceStatus.ACTIVE,
    closed: false,
    views: [],
    fields: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockClosedProject: Project = {
    ...mockProject,
    id: 'project-2',
    title: 'Closed Project',
    status: ResourceStatus.CLOSED,
    closed: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockProjectRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as unknown as jest.Mocked<GitHubProjectRepository>;

    // Create mock factory
    mockFactory = {
      createProjectRepository: jest.fn().mockReturnValue(mockProjectRepo),
      getConfig: jest.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' })
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new ProjectStatusService(mockFactory);
  });

  describe('createProject', () => {
    it('should create a project with default visibility', async () => {
      mockProjectRepo.create.mockResolvedValue(mockProject);

      const result = await service.createProject({
        title: 'Test Project',
        shortDescription: 'Short desc'
      });

      expect(result).toEqual(mockProject);
      expect(mockProjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Project',
          shortDescription: 'Short desc',
          owner: 'test-owner',
          visibility: 'private'
        })
      );
    });

    it('should create a project with public visibility', async () => {
      mockProjectRepo.create.mockResolvedValue({
        ...mockProject,
        visibility: 'public'
      });

      await service.createProject({
        title: 'Public Project',
        visibility: 'public'
      });

      expect(mockProjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public'
        })
      );
    });

    it('should handle creation errors', async () => {
      mockProjectRepo.create.mockRejectedValue(new Error('Creation failed'));

      await expect(service.createProject({
        title: 'Test Project'
      })).rejects.toThrow();
    });
  });

  describe('listProjects', () => {
    const projects: Project[] = [mockProject, mockClosedProject];

    it('should return active projects by default', async () => {
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await service.listProjects();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.ACTIVE);
    });

    it('should return all projects when status is "all"', async () => {
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await service.listProjects('all');

      expect(result).toHaveLength(2);
    });

    it('should filter by closed status', async () => {
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await service.listProjects('closed');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.CLOSED);
    });

    it('should respect the limit parameter', async () => {
      const manyProjects = Array(20).fill(null).map((_, i) => ({
        ...mockProject,
        id: `project-${i}`
      }));
      mockProjectRepo.findAll.mockResolvedValue(manyProjects);

      const result = await service.listProjects('all', 5);

      expect(result).toHaveLength(5);
    });

    it('should use default limit of 10', async () => {
      const manyProjects = Array(20).fill(null).map((_, i) => ({
        ...mockProject,
        id: `project-${i}`
      }));
      mockProjectRepo.findAll.mockResolvedValue(manyProjects);

      const result = await service.listProjects('all');

      expect(result).toHaveLength(10);
    });
  });

  describe('getProject', () => {
    it('should return a project by ID', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);

      const result = await service.getProject('project-1');

      expect(result).toEqual(mockProject);
      expect(mockProjectRepo.findById).toHaveBeenCalledWith('project-1');
    });

    it('should return null when project not found', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      const result = await service.getProject('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('should update project title', async () => {
      mockProjectRepo.update.mockResolvedValue({
        ...mockProject,
        title: 'Updated Title'
      });

      const result = await service.updateProject({
        projectId: 'project-1',
        title: 'Updated Title'
      });

      expect(result.title).toBe('Updated Title');
      expect(mockProjectRepo.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ title: 'Updated Title' })
      );
    });

    it('should convert status string to ResourceStatus', async () => {
      mockProjectRepo.update.mockResolvedValue({
        ...mockProject,
        status: ResourceStatus.CLOSED
      });

      await service.updateProject({
        projectId: 'project-1',
        status: 'closed'
      });

      expect(mockProjectRepo.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: ResourceStatus.CLOSED })
      );
    });

    it('should update multiple fields at once', async () => {
      mockProjectRepo.update.mockResolvedValue({
        ...mockProject,
        title: 'New Title',
        visibility: 'public'
      });

      await service.updateProject({
        projectId: 'project-1',
        title: 'New Title',
        visibility: 'public'
      });

      expect(mockProjectRepo.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          title: 'New Title',
          visibility: 'public'
        })
      );
    });

    it('should not include undefined values in update', async () => {
      mockProjectRepo.update.mockResolvedValue(mockProject);

      await service.updateProject({
        projectId: 'project-1',
        title: 'New Title'
        // description is not provided
      });

      // The update should only include title, not description
      const updateCall = mockProjectRepo.update.mock.calls[0][1];
      expect(updateCall).not.toHaveProperty('description');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      mockProjectRepo.delete.mockResolvedValue(undefined);

      const result = await service.deleteProject({ projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('project-1');
      expect(mockProjectRepo.delete).toHaveBeenCalledWith('project-1');
    });

    it('should handle deletion errors', async () => {
      mockProjectRepo.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteProject({ projectId: 'project-1' })).rejects.toThrow();
    });
  });
});
