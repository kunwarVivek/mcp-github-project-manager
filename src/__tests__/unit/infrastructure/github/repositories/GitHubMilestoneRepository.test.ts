import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubMilestoneRepository } from "../../../../../infrastructure/github/repositories/GitHubMilestoneRepository";
import { mockData } from "../../../../setup";
import { ResourceType, ResourceStatus } from "../../../../../domain/resource-types";
import { CreateMilestone, MilestoneId, Issue } from "../../../../../domain/types";

// Mock Octokit and GraphQL response
jest.mock("@octokit/rest");

describe("GitHubMilestoneRepository", () => {
  let repository: GitHubMilestoneRepository;
  let mockOctokit: jest.Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Octokit instance with GraphQL method
    mockOctokit = {
      graphql: jest.fn(),
      // Include required REST methods that might be used
      rest: {
        issues: {
          createMilestone: jest.fn(),
          updateMilestone: jest.fn(),
          deleteMilestone: jest.fn(),
          getMilestone: jest.fn(),
          listMilestones: jest.fn(),
        }
      }
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create configuration
    config = new GitHubConfig("test-owner", "test-repo", "test-token");

    // Create repository instance with both octokit and config
    repository = new GitHubMilestoneRepository(mockOctokit, config);
  });

  describe("create", () => {
    it("should create a milestone successfully", async () => {
      // Arrange
      const milestoneData: CreateMilestone = {
        title: "Test Milestone",
        description: "Test Description",
        dueDate: "2024-03-31T00:00:00Z",
      };

      // Mock GraphQL response
      const mockRestResponse = {
        data: {
          id: 123,
          number: 1,
          title: milestoneData.title,
          description: milestoneData.description,
          due_on: milestoneData.dueDate,
          state: "open" as const,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
          open_issues: 5,
          closed_issues: 3,
          url: "https://api.github.com/repos/test-owner/test-repo/milestones/1",
          html_url: "https://github.com/test-owner/test-repo/milestone/1",
          labels_url: "https://api.github.com/repos/test-owner/test-repo/milestones/1/labels",
          node_id: "MDk6TWlsZXN0b25lMQ==",
          creator: null
        },
        status: 201,
        url: "https://api.github.com/repos/test-owner/test-repo/milestones",
        headers: {}
      } as any;

      mockOctokit.rest.issues.createMilestone.mockResolvedValueOnce(mockRestResponse);

      // Act
      const result = await repository.create(milestoneData);

      // Assert
      expect(result).toEqual({
        id: "MDk6TWlsZXN0b25lMQ==", // node_id from the mock response
        number: 1,
        title: milestoneData.title,
        description: milestoneData.description,
        dueDate: milestoneData.dueDate,
        status: ResourceStatus.ACTIVE,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
        url: `https://github.com/${config.owner}/${config.repo}/milestone/1`,
        progress: {
          percent: 0,
          complete: 3,
          total: 8
        }
      });

      // Verify the REST API call was made correctly
      expect(mockOctokit.rest.issues.createMilestone).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        title: milestoneData.title,
        description: milestoneData.description,
        due_on: milestoneData.dueDate,
        state: "open",
      });
    });

    it("should throw error if milestone creation fails", async () => {
      // Arrange
      const milestoneData: CreateMilestone = {
        title: "Test Milestone",
        description: "Test Description",
        dueDate: "2024-03-31T00:00:00Z"
      };

      mockOctokit.rest.issues.createMilestone.mockRejectedValueOnce(
        new Error("Creation failed")
      );

      // Act & Assert
      await expect(repository.create(milestoneData)).rejects.toThrow(
        "Creation failed"
      );
    });
  });

  describe("findById", () => {
    it("should find a milestone by id", async () => {
      // Arrange
      const mockResponse = {
        repository: {
          milestone: {
            id: "milestone-123",
            number: 1,
            title: "Test Milestone",
            description: "Test Description",
            dueOn: "2024-03-31T00:00:00Z",
            state: "open",
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
            progress: {
              enabled: true,
              openIssues: 5,
              closedIssues: 3,
              completionPercentage: 37.5
            }
          }
        }
      };

      mockOctokit.graphql.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await repository.findById("1");

      // Assert
      expect(result).toEqual({
        id: "milestone-123",
        number: 1,
        title: "Test Milestone",
        description: "Test Description",
        dueDate: "2024-03-31T00:00:00Z",
        status: ResourceStatus.ACTIVE,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
        url: `https://github.com/${config.owner}/${config.repo}/milestone/1`,
        progress: {
          percent: 37.5,
          complete: 3,
          total: 8
        }
      });
    });

    it("should return null if milestone not found", async () => {
      // Arrange
      const mockResponse = {
        repository: {
          milestone: null
        }
      };

      mockOctokit.graphql.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await repository.findById("1");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getIssues", () => {
    it("should get issues for a milestone", async () => {
      // Arrange - need to mock the factory.createIssueRepository method
      const mockIssueRepository = {
        findByMilestone: jest.fn().mockImplementation(() => {
          return Promise.resolve([
            {
              id: "issue-123",
              number: 42,
              title: "Test Issue",
              description: "Description",
              status: ResourceStatus.ACTIVE,
              assignees: ["user1"],
              labels: ["bug"],
              createdAt: "2023-01-01T00:00:00Z",
              updatedAt: "2023-01-01T00:00:00Z",
              url: "https://github.com/test-owner/test-repo/issues/42",
              milestoneId: "milestone-123"
            } as Issue
          ]);
        })
      };

      // Mock the private factory field using reflection or replace it directly
      const repository: any = new GitHubMilestoneRepository(mockOctokit, config);
      repository.factory = {
        createIssueRepository: () => mockIssueRepository
      };

      // Act
      const milestoneId = "milestone-123";
      const result = await repository.getIssues(milestoneId);

      // Assert
      expect(mockIssueRepository.findByMilestone).toHaveBeenCalledWith(milestoneId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("issue-123");
    });
  });

  describe("findByDueDate", () => {
    it("should filter milestones by due date", async () => {
      // Arrange
      const mockMilestones = [
        {
          id: "milestone-1",
          number: 1,
          title: "Past Due",
          description: "Should be included",
          dueOn: "2023-01-01T00:00:00Z",
          state: "open",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-01T00:00:00Z"
        },
        {
          id: "milestone-2",
          number: 2,
          title: "Future Due",
          description: "Should be excluded",
          dueOn: "2030-01-01T00:00:00Z",
          state: "open",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-01T00:00:00Z"
        }
      ];

      // Mock the findAll method to return these milestones
      const mockResponse = {
        repository: {
          milestones: {
            nodes: mockMilestones
          }
        }
      };

      mockOctokit.graphql.mockResolvedValueOnce(mockResponse);

      // Act
      const cutoffDate = '2024-01-01T00:00:00.000Z';
      const result = await repository.findByDueDate(new Date(cutoffDate));

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("milestone-1");
    });
  });
});
