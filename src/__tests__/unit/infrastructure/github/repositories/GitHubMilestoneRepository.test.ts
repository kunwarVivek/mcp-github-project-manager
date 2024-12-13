import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubMilestoneRepository } from "../../../../../infrastructure/github/repositories/GitHubMilestoneRepository";
import { mockData } from "../../../../setup";

// Mock Octokit
jest.mock("@octokit/rest");

// Helper to create Octokit response for milestone operations
function createMilestoneResponse<
  T extends keyof RestEndpointMethodTypes["issues"],
>(
  data: RestEndpointMethodTypes["issues"][T]["response"]["data"],
  method: T
): RestEndpointMethodTypes["issues"][T]["response"] {
  const status = method === "createMilestone" ? 201 : 200;
  return {
    data,
    headers: {
      "content-type": "application/json",
      "x-github-media-type": "github.v3",
    },
    status,
    url: "https://api.github.com/test",
  } as RestEndpointMethodTypes["issues"][T]["response"];
}

describe("GitHubMilestoneRepository", () => {
  let repository: GitHubMilestoneRepository;
  let mockOctokit: jest.Mocked<Octokit>;
  const config = new GitHubConfig("test-owner", "test-repo", "test-token");

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Octokit instance
    mockOctokit = {
      issues: {
        createMilestone: jest.fn(),
        updateMilestone: jest.fn(),
        deleteMilestone: jest.fn(),
        getMilestone: jest.fn(),
        listMilestones: jest.fn(),
      },
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create repository instance
    repository = new GitHubMilestoneRepository(config);
  });

  describe("create", () => {
    it("should create a milestone successfully", async () => {
      // Arrange
      const milestoneData = {
        title: "Test Milestone",
        description: "Test Description",
        dueDate: new Date("2024-03-31T00:00:00Z"),
        status: "open" as const,
      };

      mockOctokit.issues.createMilestone.mockResolvedValueOnce(
        createMilestoneResponse(mockData.milestone, "createMilestone")
      );

      // Act
      const result = await repository.create(milestoneData);

      // Assert
      expect(result).toEqual({
        id: mockData.milestone.number,
        title: mockData.milestone.title,
        description: mockData.milestone.description,
        dueDate: new Date(mockData.milestone.due_on),
        status: mockData.milestone.state,
        progress: {
          openIssues: mockData.milestone.open_issues,
          closedIssues: mockData.milestone.closed_issues,
        },
      });

      expect(mockOctokit.issues.createMilestone).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        title: milestoneData.title,
        description: milestoneData.description,
        due_on: milestoneData.dueDate.toISOString(),
        state: milestoneData.status,
      });
    });

    it("should throw error if milestone creation fails", async () => {
      // Arrange
      const milestoneData = {
        title: "Test Milestone",
        description: "Test Description",
        dueDate: new Date("2024-03-31T00:00:00Z"),
        status: "open" as const,
      };

      mockOctokit.issues.createMilestone.mockRejectedValueOnce(
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
      mockOctokit.issues.getMilestone.mockResolvedValueOnce(
        createMilestoneResponse(mockData.milestone, "getMilestone")
      );

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(result).toEqual({
        id: mockData.milestone.number,
        title: mockData.milestone.title,
        description: mockData.milestone.description,
        dueDate: new Date(mockData.milestone.due_on),
        status: mockData.milestone.state,
        progress: {
          openIssues: mockData.milestone.open_issues,
          closedIssues: mockData.milestone.closed_issues,
        },
      });
    });

    it("should return null if milestone not found", async () => {
      // Arrange
      mockOctokit.issues.getMilestone.mockRejectedValueOnce({ status: 404 });

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getProgress", () => {
    it("should return milestone progress", async () => {
      // Arrange
      mockOctokit.issues.getMilestone.mockResolvedValueOnce(
        createMilestoneResponse(mockData.milestone, "getMilestone")
      );

      // Act
      const result = await repository.getProgress(1);

      // Assert
      expect(result).toEqual({
        openIssues: mockData.milestone.open_issues,
        closedIssues: mockData.milestone.closed_issues,
      });
    });
  });

  describe("getCompletionPercentage", () => {
    it("should calculate completion percentage correctly", async () => {
      // Arrange
      mockOctokit.issues.getMilestone.mockResolvedValueOnce(
        createMilestoneResponse(mockData.milestone, "getMilestone")
      );

      // Act
      const result = await repository.getCompletionPercentage(1);

      // Assert
      const total =
        mockData.milestone.open_issues + mockData.milestone.closed_issues;
      const expected = (mockData.milestone.closed_issues / total) * 100;
      expect(result).toBe(expected);
    });

    it("should return 0 when there are no issues", async () => {
      // Arrange
      mockOctokit.issues.getMilestone.mockResolvedValueOnce(
        createMilestoneResponse(
          {
            ...mockData.milestone,
            open_issues: 0,
            closed_issues: 0,
          },
          "getMilestone"
        )
      );

      // Act
      const result = await repository.getCompletionPercentage(1);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("getOverdue", () => {
    it("should return overdue milestones", async () => {
      // Arrange
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 1);

      const overdueMilestone = {
        ...mockData.milestone,
        due_on: pastDueDate.toISOString(),
      };

      mockOctokit.issues.listMilestones.mockResolvedValueOnce(
        createMilestoneResponse([overdueMilestone], "listMilestones")
      );

      // Act
      const result = await repository.getOverdue();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].dueDate).toEqual(pastDueDate);
    });
  });
});
