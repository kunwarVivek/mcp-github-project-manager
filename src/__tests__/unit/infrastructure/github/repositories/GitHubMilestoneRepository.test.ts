import { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, type Mock, type MockedClass, vi } from "vitest";
import { ResourceStatus } from "../../../../../domain/resource-types";
import type { CreateMilestone, Issue } from "../../../../../domain/types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubMilestoneRepository } from "../../../../../infrastructure/github/repositories/GitHubMilestoneRepository";
import { asOctokit, type GraphqlFn, type RestCallFn } from "../../../../helpers/mockTypes";

// Mock Octokit and GraphQL response
vi.mock("@octokit/rest");

describe("GitHubMilestoneRepository", () => {
  let repository: GitHubMilestoneRepository;
  let mockOctokit: {
    graphql: Mock<GraphqlFn>;
    rest: {
      issues: Record<
        | "createMilestone"
        | "updateMilestone"
        | "deleteMilestone"
        | "getMilestone"
        | "listMilestones",
        Mock<RestCallFn>
      >;
    };
  };
  let config: GitHubConfig;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock Octokit instance with GraphQL method
    mockOctokit = {
      graphql: vi.fn<GraphqlFn>(),
      // Include required REST methods that might be used
      rest: {
        issues: {
          createMilestone: vi.fn<RestCallFn>(),
          updateMilestone: vi.fn<RestCallFn>(),
          deleteMilestone: vi.fn<RestCallFn>(),
          getMilestone: vi.fn<RestCallFn>(),
          listMilestones: vi.fn<RestCallFn>(),
        },
      },
    };

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(() => asOctokit(mockOctokit));

    // Create configuration
    config = new GitHubConfig("test-owner", "test-repo");

    // Create repository instance with both octokit and config
    repository = new GitHubMilestoneRepository(asOctokit(mockOctokit), config);
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
          creator: null,
        },
        status: 201,
        url: "https://api.github.com/repos/test-owner/test-repo/milestones",
        headers: {},
      };

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
          total: 8,
        },
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
        dueDate: "2024-03-31T00:00:00Z",
      };

      mockOctokit.rest.issues.createMilestone.mockRejectedValueOnce(new Error("Creation failed"));

      // Act & Assert
      await expect(repository.create(milestoneData)).rejects.toThrow("Creation failed");
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
              completionPercentage: 37.5,
            },
          },
        },
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
          total: 8,
        },
      });
    });

    it("should return null if milestone not found", async () => {
      // Arrange
      const mockResponse = {
        repository: {
          milestone: null,
        },
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
        findByMilestone: vi.fn().mockImplementation(() =>
          Promise.resolve([
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
              milestoneId: "milestone-123",
            } as Issue,
          ])
        ),
      };

      // Mock the private factory field using reflection or replace it directly
      const repository = new GitHubMilestoneRepository(asOctokit(mockOctokit), config);
      Object.assign(repository, {
        factory: { createIssueRepository: () => mockIssueRepository },
      });

      // Act
      const milestoneId = "milestone-123";
      const result = await repository.getIssues(milestoneId);

      // Assert
      expect(mockIssueRepository.findByMilestone).toHaveBeenCalledWith(milestoneId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("issue-123");
    });
  });

  describe("due date queries", () => {
    const restMilestone = (number: number, dueOn: string | null, state = "open") => ({
      id: number,
      number,
      title: `Milestone ${number}`,
      description: null,
      due_on: dueOn,
      state,
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      open_issues: 0,
      closed_issues: 0,
      node_id: `MI_${number}`,
    });
    const restPage = (data: unknown[]) => ({ data, status: 200, url: "", headers: {} });

    it("asks REST for due-date ordering and keeps only milestones due by the cutoff", async () => {
      mockOctokit.rest.issues.listMilestones.mockResolvedValueOnce(
        restPage([
          restMilestone(1, "2023-01-01T00:00:00Z"),
          restMilestone(2, null),
          restMilestone(3, "2030-01-01T00:00:00Z"),
        ])
      );

      const result = await repository.findByDueDate(new Date("2024-01-01T00:00:00.000Z"));

      expect(result.map((m) => m.id)).toEqual(["MI_1"]);
      expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalledWith({
        owner: config.owner,
        repo: config.repo,
        state: "all",
        sort: "due_on",
        direction: "asc",
        per_page: 100,
        page: 1,
      });
      expect(mockOctokit.graphql).not.toHaveBeenCalled();
    });

    it("reads further pages while every milestone is still due", async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) =>
        restMilestone(i + 1, "2023-01-01T00:00:00Z")
      );
      mockOctokit.rest.issues.listMilestones
        .mockResolvedValueOnce(restPage(firstPage))
        .mockResolvedValueOnce(
          restPage([
            restMilestone(101, "2023-06-01T00:00:00Z"),
            restMilestone(102, "2030-01-01T00:00:00Z"),
          ])
        );

      const result = await repository.findByDueDate(new Date("2024-01-01T00:00:00.000Z"));

      expect(result).toHaveLength(101);
      expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.issues.listMilestones).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    it("stops scanning at the first milestone due after the cutoff", async () => {
      const firstPage = [
        restMilestone(1, "2023-01-01T00:00:00Z"),
        ...Array.from({ length: 99 }, (_, i) => restMilestone(i + 2, "2030-01-01T00:00:00Z")),
      ];
      mockOctokit.rest.issues.listMilestones.mockResolvedValueOnce(restPage(firstPage));

      const result = await repository.findByDueDate(new Date("2024-01-01T00:00:00.000Z"));

      expect(result).toHaveLength(1);
      expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalledTimes(1);
    });

    it("getOverdue lists only open milestones", async () => {
      mockOctokit.rest.issues.listMilestones.mockResolvedValueOnce(
        restPage([restMilestone(1, "2020-01-01T00:00:00Z")])
      );

      const result = await repository.getOverdue();

      expect(result).toHaveLength(1);
      expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalledWith(
        expect.objectContaining({ state: "open", sort: "due_on", direction: "asc" })
      );
    });
  });
});
