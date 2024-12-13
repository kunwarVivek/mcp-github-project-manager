import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Octokit } from "@octokit/rest";
import { Project } from "../../../../../domain/types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectRepository";
import { mockData } from "../../../../setup";

// Mock Octokit
jest.mock("@octokit/rest");

describe("GitHubProjectRepository", () => {
  let repository: GitHubProjectRepository;
  let mockOctokit: jest.Mocked<Octokit>;
  const config = new GitHubConfig("test-owner", "test-repo", "test-token");

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Octokit instance
    mockOctokit = {
      graphql: jest.fn(),
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create repository instance
    repository = new GitHubProjectRepository(config);
  });

  describe("create", () => {
    it("should create a project successfully", async () => {
      // Arrange
      const projectData: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
        title: "Test Project",
        description: "Test Description",
        visibility: "private",
        status: "open",
      };

      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          createProjectV2: {
            projectV2: mockData.project,
          },
        },
      });

      // Act
      const result = await repository.create(projectData);

      // Assert
      expect(result).toEqual({
        id: mockData.project.number.toString(),
        title: mockData.project.title,
        description: mockData.project.description,
        visibility: "public",
        status: "open",
        createdAt: new Date(mockData.project.createdAt),
        updatedAt: new Date(mockData.project.updatedAt),
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            ownerId: config.owner,
            title: projectData.title,
            description: projectData.description,
            visibility: projectData.visibility.toUpperCase(),
          }),
        })
      );
    });

    it("should throw error if project creation fails", async () => {
      // Arrange
      const projectData: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
        title: "Test Project",
        description: "Test Description",
        visibility: "private",
        status: "open",
      };

      mockOctokit.graphql.mockRejectedValueOnce(new Error("Creation failed"));

      // Act & Assert
      await expect(repository.create(projectData)).rejects.toThrow(
        "GitHub API error: Creation failed"
      );
    });
  });

  describe("findById", () => {
    it("should find a project by id", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          repository: {
            projectV2: mockData.project,
          },
        },
      });

      // Act
      const result = await repository.findById("1");

      // Assert
      expect(result).toEqual({
        id: mockData.project.number.toString(),
        title: mockData.project.title,
        description: mockData.project.description,
        visibility: "public",
        status: "open",
        createdAt: new Date(mockData.project.createdAt),
        updatedAt: new Date(mockData.project.updatedAt),
      });
    });

    it("should return null if project not found", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          repository: {
            projectV2: null,
          },
        },
      });

      // Act
      const result = await repository.findById("1");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should list all projects", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          repository: {
            projectsV2: {
              nodes: [mockData.project],
            },
          },
        },
      });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockData.project.number.toString(),
        title: mockData.project.title,
        description: mockData.project.description,
        visibility: "public",
        status: "open",
        createdAt: new Date(mockData.project.createdAt),
        updatedAt: new Date(mockData.project.updatedAt),
      });
    });

    it("should filter projects by status", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          repository: {
            projectsV2: {
              nodes: [mockData.project],
            },
          },
        },
      });

      // Act
      const result = await repository.findAll({ status: "open" });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("open");
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      // Arrange
      mockOctokit.graphql.mockResolvedValueOnce({
        data: {
          deleteProjectV2: {
            projectV2: {
              id: "1",
            },
          },
        },
      });

      // Act & Assert
      await expect(repository.delete("1")).resolves.not.toThrow();
      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: {
            projectId: "1",
          },
        })
      );
    });
  });
});
