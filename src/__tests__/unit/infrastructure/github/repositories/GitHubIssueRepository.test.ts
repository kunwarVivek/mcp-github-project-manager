import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Octokit } from "@octokit/rest";
import { Issue } from "../../../../../domain/types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubIssueRepository } from "../../../../../infrastructure/github/repositories/GitHubIssueRepository";
import { mockData } from "../../../../setup";

// Mock Octokit
jest.mock("@octokit/rest");

describe("GitHubIssueRepository", () => {
  let repository: GitHubIssueRepository;
  let mockOctokit: jest.Mocked<Octokit>;
  const config = new GitHubConfig("test-owner", "test-repo", "test-token");

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Octokit instance
    mockOctokit = {
      issues: {
        create: jest.fn(),
        update: jest.fn(),
        get: jest.fn(),
        listForRepo: jest.fn(),
      },
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create repository instance
    repository = new GitHubIssueRepository(config);
  });

  describe("create", () => {
    it("should create an issue successfully", async () => {
      // Arrange
      const issueData: Omit<Issue, "id" | "createdAt" | "updatedAt"> = {
        title: "Test Issue",
        description: "Test Description",
        status: "open",
        priority: "high",
        type: "feature",
        assignees: ["user1"],
        labels: ["test-label"],
        milestoneId: 1,
      };

      mockOctokit.issues.create.mockResolvedValueOnce({
        data: mockData.issue,
        headers: {},
        status: 201,
        url: "https://api.github.com/repos/test-owner/test-repo/issues/1",
      });

      // Act
      const result = await repository.create(issueData);

      // Assert
      expect(result).toEqual({
        id: mockData.issue.number,
        title: mockData.issue.title,
        description: mockData.issue.body,
        status: mockData.issue.state,
        priority: "high",
        type: "feature",
        assignees: ["user1"],
        labels: ["test-label"],
        milestoneId: mockData.issue.milestone?.number,
        createdAt: new Date(mockData.issue.created_at),
        updatedAt: new Date(mockData.issue.updated_at),
      });

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        title: issueData.title,
        body: issueData.description,
        milestone: issueData.milestoneId,
        assignees: issueData.assignees,
        labels: [
          `priority:${issueData.priority}`,
          `type:${issueData.type}`,
          ...issueData.labels,
        ],
      });
    });

    it("should throw error if issue creation fails", async () => {
      // Arrange
      const issueData: Omit<Issue, "id" | "createdAt" | "updatedAt"> = {
        title: "Test Issue",
        description: "Test Description",
        status: "open",
        priority: "high",
        type: "feature",
        assignees: ["user1"],
        labels: ["test-label"],
      };

      mockOctokit.issues.create.mockRejectedValueOnce(
        new Error("Creation failed")
      );

      // Act & Assert
      await expect(repository.create(issueData)).rejects.toThrow(
        "GitHub API error: Creation failed"
      );
    });
  });

  describe("findById", () => {
    it("should find an issue by id", async () => {
      // Arrange
      mockOctokit.issues.get.mockResolvedValueOnce({
        data: mockData.issue,
        headers: {},
        status: 200,
        url: "https://api.github.com/repos/test-owner/test-repo/issues/1",
      });

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(result).toEqual({
        id: mockData.issue.number,
        title: mockData.issue.title,
        description: mockData.issue.body,
        status: mockData.issue.state,
        priority: "high",
        type: "feature",
        assignees: ["user1"],
        labels: ["test-label"],
        milestoneId: mockData.issue.milestone?.number,
        createdAt: new Date(mockData.issue.created_at),
        updatedAt: new Date(mockData.issue.updated_at),
      });
    });

    it("should return null if issue not found", async () => {
      // Arrange
      mockOctokit.issues.get.mockRejectedValueOnce({ status: 404 });

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should list all issues", async () => {
      // Arrange
      mockOctokit.issues.listForRepo.mockResolvedValueOnce({
        data: [mockData.issue],
        headers: {},
        status: 200,
        url: "https://api.github.com/repos/test-owner/test-repo/issues",
      });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockData.issue.number,
        title: mockData.issue.title,
        description: mockData.issue.body,
        status: mockData.issue.state,
        priority: "high",
        type: "feature",
        assignees: ["user1"],
        labels: ["test-label"],
        milestoneId: mockData.issue.milestone?.number,
        createdAt: new Date(mockData.issue.created_at),
        updatedAt: new Date(mockData.issue.updated_at),
      });
    });

    it("should filter issues by status and milestone", async () => {
      // Arrange
      mockOctokit.issues.listForRepo.mockResolvedValueOnce({
        data: [mockData.issue],
        headers: {},
        status: 200,
        url: "https://api.github.com/repos/test-owner/test-repo/issues",
      });

      // Act
      const result = await repository.findAll({
        status: "open",
        milestoneId: 1,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        state: "open",
        milestone: "1",
        per_page: 100,
      });
    });
  });

  describe("delete", () => {
    it("should close an issue (GitHub does not support true deletion)", async () => {
      // Arrange
      mockOctokit.issues.update.mockResolvedValueOnce({
        data: { ...mockData.issue, state: "closed" },
        headers: {},
        status: 200,
        url: "https://api.github.com/repos/test-owner/test-repo/issues/1",
      });

      // Act
      await repository.delete(1);

      // Assert
      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        issue_number: 1,
        state: "closed",
        state_reason: "not_planned",
      });
    });
  });
});
