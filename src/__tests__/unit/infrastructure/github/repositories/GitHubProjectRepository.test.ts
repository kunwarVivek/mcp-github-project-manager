// filepath: /Users/vivek/grad-saas/mcp-github-project-manager/src/__tests__/unit/infrastructure/github/repositories/GitHubProjectRepository.test.ts
import { beforeEach, describe, expect, it, vi, type Mocked, type MockedClass, } from 'vitest';
import { Octokit } from "@octokit/rest";
import type { CreateProject, } from "../../../../../domain/types";
import { ResourceStatus } from "../../../../../domain/resource-types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectRepository";

// Mock Octokit
vi.mock("@octokit/rest");

describe("GitHubProjectRepository", () => {
  // createProjectV2 takes GraphQL node IDs, not the owner login / repo name, so
  // `create()` resolves them first via GetUserNodeId + GetRepositoryNodeId.
  const OWNER_NODE_ID = "U_kgDOtest-owner";
  const REPO_NODE_ID = "R_kgDOtest-repo";

  let repository: GitHubProjectRepository;
  let mockOctokit: Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock Octokit instance
    mockOctokit = {
      graphql: vi.fn(),
    } as any;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create configuration
    config = new GitHubConfig("test-owner", "test-repo", "test-token");

    // Create repository instance with octokit
    repository = new GitHubProjectRepository(mockOctokit, config);
  });

  describe("create", () => {
    it("should create a project successfully with description", async () => {
      // Arrange
      const projectData: CreateProject = {
        title: "Test Project",
        shortDescription: "Test Description",
        owner: "test-owner",
        visibility: "private",
        fields: [],
        views: []
      };

      const mockCreateResponse = {
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: projectData.title,
        shortDescription: null, // No description on creation
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockUpdateResponse = {
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: projectData.title,
        shortDescription: projectData.shortDescription,
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      mockOctokit.graphql
        // Owner login -> node ID
        .mockResolvedValueOnce({ user: { id: OWNER_NODE_ID } })
        // Repo name -> node ID
        .mockResolvedValueOnce({ repository: { id: REPO_NODE_ID } })
        // Create mutation
        .mockResolvedValueOnce({
          createProjectV2: {
            projectV2: mockCreateResponse
          }
        })
        // Update mutation (description)
        .mockResolvedValueOnce({
          updateProjectV2: {
            projectV2: mockUpdateResponse
          }
        });

      // Act
      const result = await repository.create(projectData);

      // Assert
      expect(result).toEqual({
        id: mockUpdateResponse.id,
        type: "project",
        title: mockUpdateResponse.title,
        description: mockUpdateResponse.shortDescription,
        owner: config.owner,
        number: parseInt(mockUpdateResponse.id.split('_').pop() || '0', 10),
        url: `https://github.com/orgs/${config.owner}/projects/${parseInt(mockUpdateResponse.id.split('_').pop() || '0', 10)}`,
        status: ResourceStatus.ACTIVE,
        visibility: projectData.visibility,
        views: projectData.views,
        fields: projectData.fields,
        createdAt: mockUpdateResponse.createdAt,
        updatedAt: mockUpdateResponse.updatedAt,
        closed: mockUpdateResponse.closed
      });

      // Verify node-ID resolution happens before the mutation
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(1,
        expect.stringContaining("query GetUserNodeId"),
        expect.objectContaining({ login: config.owner })
      );
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(2,
        expect.stringContaining("query GetRepositoryNodeId"),
        expect.objectContaining({ owner: config.owner, repo: config.repo })
      );

      // Verify third call - create project with resolved node IDs (no description)
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(3,
        expect.stringContaining("mutation($input: CreateProjectV2Input!)"),
        expect.objectContaining({
          input: expect.objectContaining({
            ownerId: OWNER_NODE_ID,
            title: projectData.title,
            repositoryId: REPO_NODE_ID,
          })
        })
      );

      // Verify the input does NOT contain description (schema compliance)
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(3,
        expect.stringContaining("mutation($input: CreateProjectV2Input!)"),
        expect.objectContaining({
          input: expect.not.objectContaining({
            description: expect.anything(),
            shortDescription: expect.anything()
          })
        })
      );

      // Verify fourth call - update project with description
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(4,
        expect.stringContaining("mutation($input: UpdateProjectV2Input!)"),
        expect.objectContaining({
          input: expect.objectContaining({
            projectId: mockCreateResponse.id,
            shortDescription: projectData.shortDescription
          })
        })
      );

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(4);
    });

    it("should create a project successfully without description", async () => {
      // Arrange
      const projectData: CreateProject = {
        title: "Test Project",
        owner: "test-owner",
        visibility: "private",
        fields: [],
        views: []
      };

      const mockCreateResponse = {
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: projectData.title,
        shortDescription: null,
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      mockOctokit.graphql
        .mockResolvedValueOnce({ user: { id: OWNER_NODE_ID } })
        .mockResolvedValueOnce({ repository: { id: REPO_NODE_ID } })
        .mockResolvedValueOnce({
          createProjectV2: {
            projectV2: mockCreateResponse
          }
        });

      // Act
      const result = await repository.create(projectData);

      // Assert
      expect(result).toEqual({
        id: mockCreateResponse.id,
        type: "project",
        title: mockCreateResponse.title,
        description: "", // Empty when no description provided
        owner: config.owner,
        number: parseInt(mockCreateResponse.id.split('_').pop() || '0', 10),
        url: `https://github.com/orgs/${config.owner}/projects/${parseInt(mockCreateResponse.id.split('_').pop() || '0', 10)}`,
        status: ResourceStatus.ACTIVE,
        visibility: projectData.visibility,
        views: projectData.views,
        fields: projectData.fields,
        createdAt: mockCreateResponse.createdAt,
        updatedAt: mockCreateResponse.updatedAt,
        closed: mockCreateResponse.closed
      });

      // Two node-ID lookups + the create mutation; no description update needed
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(3);
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(3,
        expect.stringContaining("mutation($input: CreateProjectV2Input!)"),
        expect.objectContaining({
          input: expect.objectContaining({
            ownerId: OWNER_NODE_ID,
            title: projectData.title,
            repositoryId: REPO_NODE_ID,
          })
        })
      );
    });

    it("should throw error if project creation fails", async () => {
      // Arrange
      const projectData: CreateProject = {
        title: "Test Project",
        shortDescription: "Test Description",
        owner: "test-owner",
        visibility: "private",
        fields: [],
        views: []
      };

      mockOctokit.graphql.mockRejectedValueOnce(new Error("Creation failed"));

      // Act & Assert
      await expect(repository.create(projectData)).rejects.toThrow(/Creation failed/);
    });

    it("should handle error if project creation succeeds but description update fails", async () => {
      // Arrange
      const projectData: CreateProject = {
        title: "Test Project",
        shortDescription: "Test Description",
        owner: "test-owner",
        visibility: "private",
        fields: [],
        views: []
      };

      const mockCreateResponse = {
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: projectData.title,
        shortDescription: null,
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      // Mock successful creation but failed description update
      mockOctokit.graphql
        .mockResolvedValueOnce({
          createProjectV2: {
            projectV2: mockCreateResponse
          }
        })
        .mockRejectedValueOnce(new Error("Update failed"));

      // Act & Assert
      await expect(repository.create(projectData)).rejects.toThrow(/Update failed/);
    });
  });

  describe("findById", () => {
    it("should find a project by id", async () => {
      // Arrange
      const projectId = "PVT_kwDOLhQ7gc4AOEbH";
      const mockProjectResponse = {
        id: projectId,
        title: "Test Project",
        shortDescription: "Test Description",
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      mockOctokit.graphql.mockResolvedValueOnce({
        node: mockProjectResponse
      });

      // Act
      const result = await repository.findById(projectId);

      // Assert
      expect(result).toEqual({
        id: projectId,
        type: "project",
        title: mockProjectResponse.title,
        description: mockProjectResponse.shortDescription || "",
        owner: config.owner,
        number: parseInt(projectId.split('_').pop() || '0', 10),
        url: `https://github.com/orgs/${config.owner}/projects/${parseInt(projectId.split('_').pop() || '0', 10)}`,
        status: ResourceStatus.ACTIVE,
        visibility: "private", // Default value when not provided
        views: [],
        fields: [],
        createdAt: mockProjectResponse.createdAt,
        updatedAt: mockProjectResponse.updatedAt,
        closed: false
      });
    });

    it("should return null if project not found", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        node: null
      });

      // Act
      const result = await repository.findById("non-existent-id");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should list all projects", async () => {
      // Arrange
      const mockProjects = [{
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: "Test Project",
        shortDescription: "Test Description",
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      }];

      mockOctokit.graphql.mockResolvedValueOnce({
        repository: {
          projectsV2: {
            nodes: mockProjects
          }
        }
      });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProjects[0].id);
      expect(result[0].title).toBe(mockProjects[0].title);
    });

    it("should filter projects by status", async () => {
      // Arrange
      const mockProjects = [{
        id: "PVT_kwDOLhQ7gc4AOEbH",
        title: "Active Project",
        shortDescription: "Should be included",
        closed: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      }, {
        id: "PVT_kwDOLhQ7gc4AOEbI",
        title: "Closed Project",
        shortDescription: "Should be excluded",
        closed: true,
        createdAt: '2023-01-01T00:00:00Z', 
        updatedAt: '2023-01-01T00:00:00Z',
      }];

      mockOctokit.graphql.mockResolvedValueOnce({
        repository: {
          projectsV2: {
            nodes: mockProjects
          }
        }
      });

      // Act
      const result = await repository.findAll();
      const filteredResult = result.filter(p => p.status === ResourceStatus.ACTIVE);

      // Assert
      expect(filteredResult.length).toBe(1);
      expect(filteredResult[0].title).toBe("Active Project");
      expect(filteredResult[0].status).toBe(ResourceStatus.ACTIVE);
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      // Arrange
      const projectId = "PVT_kwDOLhQ7gc4AOEbH";
      
      mockOctokit.graphql.mockResolvedValueOnce({
        deleteProjectV2: {
          projectV2: {
            id: projectId
          }
        }
      });

      // Act & Assert
      await expect(repository.delete(projectId)).resolves.not.toThrow();
      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: DeleteProjectV2Input!)"),
        expect.objectContaining({
          input: {
            projectId: projectId
          }
        })
      );
    });
  });
});
