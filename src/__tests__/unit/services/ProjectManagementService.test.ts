import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Issue, Milestone, Project, Sprint } from "../../../domain/types";
import { GitHubIssueRepository } from "../../../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../../../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "../../../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "../../../infrastructure/github/repositories/GitHubSprintRepository";
import { ProjectManagementService } from "../../../services/ProjectManagementService";

// Mock repositories
jest.mock(
  "../../../infrastructure/github/repositories/GitHubProjectRepository"
);
jest.mock("../../../infrastructure/github/repositories/GitHubIssueRepository");
jest.mock(
  "../../../infrastructure/github/repositories/GitHubMilestoneRepository"
);
jest.mock("../../../infrastructure/github/repositories/GitHubSprintRepository");

describe("ProjectManagementService", () => {
  let service: ProjectManagementService;
  let mockProjectRepo: jest.Mocked<GitHubProjectRepository>;
  let mockIssueRepo: jest.Mocked<GitHubIssueRepository>;
  let mockMilestoneRepo: jest.Mocked<GitHubMilestoneRepository>;
  let mockSprintRepo: jest.Mocked<GitHubSprintRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    service = new ProjectManagementService(
      "test-owner",
      "test-repo",
      "test-token"
    );

    // Get mock instances
    mockProjectRepo =
      GitHubProjectRepository.prototype as jest.Mocked<GitHubProjectRepository>;
    mockIssueRepo =
      GitHubIssueRepository.prototype as jest.Mocked<GitHubIssueRepository>;
    mockMilestoneRepo =
      GitHubMilestoneRepository.prototype as jest.Mocked<GitHubMilestoneRepository>;
    mockSprintRepo =
      GitHubSprintRepository.prototype as jest.Mocked<GitHubSprintRepository>;
  });

  describe("createRoadmap", () => {
    it("should create a project with milestones and issues", async () => {
      // Arrange
      const roadmapData = {
        project: {
          title: "Q1 2024 Roadmap",
          description: "Product roadmap for Q1 2024",
          visibility: "private" as const,
          status: "open" as const,
        } satisfies Omit<Project, "id" | "createdAt" | "updatedAt">,
        milestones: [
          {
            milestone: {
              title: "MVP Release",
              description: "Initial feature set",
              dueDate: new Date("2024-03-31"),
              status: "open" as const,
            } satisfies Omit<Milestone, "id" | "progress">,
            issues: [
              {
                title: "User Authentication",
                description: "Implement OAuth login",
                status: "open" as const,
                priority: "high" as const,
                type: "feature" as const,
                assignees: ["developer1"],
                labels: ["auth"],
              } satisfies Omit<Issue, "id" | "createdAt" | "updatedAt">,
            ],
          },
        ],
      };

      // Mock repository responses
      const createdProject: Project = {
        ...roadmapData.project,
        id: "1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdMilestone: Milestone = {
        ...roadmapData.milestones[0].milestone,
        id: 1,
        progress: { openIssues: 1, closedIssues: 0 },
      };

      const createdIssue: Issue = {
        ...roadmapData.milestones[0].issues[0],
        id: 1,
        milestoneId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProjectRepo.create.mockResolvedValueOnce(createdProject);
      mockMilestoneRepo.create.mockResolvedValueOnce(createdMilestone);
      mockIssueRepo.create.mockResolvedValueOnce(createdIssue);

      // Act
      const result = await service.createRoadmap(roadmapData);

      // Assert
      expect(mockProjectRepo.create).toHaveBeenCalledWith(roadmapData.project);
      expect(mockMilestoneRepo.create).toHaveBeenCalledWith(
        roadmapData.milestones[0].milestone
      );
      expect(mockIssueRepo.create).toHaveBeenCalledWith({
        ...roadmapData.milestones[0].issues[0],
        milestoneId: 1,
      });

      expect(result.project.id).toBe("1");
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].milestone.id).toBe(1);
      expect(result.milestones[0].issues).toHaveLength(1);
      expect(result.milestones[0].issues[0].id).toBe(1);
    });

    it("should handle errors during roadmap creation", async () => {
      // Arrange
      const roadmapData = {
        project: {
          title: "Q1 2024 Roadmap",
          description: "Product roadmap for Q1 2024",
          visibility: "private" as const,
          status: "open" as const,
        } satisfies Omit<Project, "id" | "createdAt" | "updatedAt">,
        milestones: [],
      };

      mockProjectRepo.create.mockRejectedValueOnce(
        new Error("Project creation failed")
      );

      // Act & Assert
      await expect(service.createRoadmap(roadmapData)).rejects.toThrow(
        "Project creation failed"
      );
    });
  });

  describe("planSprint", () => {
    it("should create a sprint and verify issues", async () => {
      // Arrange
      const sprintData = {
        sprint: {
          title: "Sprint 1",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-14"),
          status: "planned" as const,
          goals: ["Complete authentication features"],
          issues: [],
        } satisfies Omit<Sprint, "id">,
        issueIds: [1, 2],
      };

      const issue1: Issue = {
        id: 1,
        title: "Issue 1",
        description: "Test",
        status: "open",
        priority: "high",
        type: "feature",
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const issue2: Issue = {
        id: 2,
        title: "Issue 2",
        description: "Test",
        status: "open",
        priority: "medium",
        type: "bug",
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockIssueRepo.findById.mockResolvedValueOnce(issue1);
      mockIssueRepo.findById.mockResolvedValueOnce(issue2);

      const createdSprint: Sprint = {
        ...sprintData.sprint,
        id: "sprint-1",
        issues: sprintData.issueIds,
      };

      mockSprintRepo.create.mockResolvedValueOnce(createdSprint);

      // Act
      const result = await service.planSprint(sprintData);

      // Assert
      expect(mockIssueRepo.findById).toHaveBeenCalledTimes(2);
      expect(mockSprintRepo.create).toHaveBeenCalledWith({
        ...sprintData.sprint,
        issues: sprintData.issueIds,
      });
      expect(result.id).toBe("sprint-1");
      expect(result.issues).toEqual(sprintData.issueIds);
    });

    it("should throw error if issue not found", async () => {
      // Arrange
      const sprintData = {
        sprint: {
          title: "Sprint 1",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-14"),
          status: "planned" as const,
          goals: ["Complete authentication features"],
          issues: [],
        } satisfies Omit<Sprint, "id">,
        issueIds: [1],
      };

      mockIssueRepo.findById.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.planSprint(sprintData)).rejects.toThrow(
        "Issue #1 not found"
      );
    });
  });
});
