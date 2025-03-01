import { describe, expect, it, beforeAll } from '@jest/globals';
import { ProjectManagementService } from "../../services/ProjectManagementService";
import { Issue, Milestone, Project, Sprint } from "../../domain/types";

// Test Configuration
const TEST_CONFIG = {
  token: process.env.GITHUB_TOKEN || "",
  owner: process.env.GITHUB_OWNER || "",
  repo: process.env.GITHUB_REPO || "",
};

describe("GitHub Project Manager E2E Tests", () => {
  let service: ProjectManagementService;
  let createdProject: Project;
  let createdSprint: Sprint;

  beforeAll(() => {
    service = new ProjectManagementService(
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      TEST_CONFIG.token
    );
  });

  describe("Roadmap Management", () => {
    it("should create a roadmap with milestones and issues", async () => {
      const roadmapData = {
        project: {
          title: "Test Roadmap E2E",
          description: "A test roadmap for E2E testing",
          visibility: "private" as const,
          status: "open" as const,
          views: [],
          fields: [],
        },
        milestones: [
          {
            milestone: {
              title: "Phase 1",
              description: "Initial phase of the project",
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: "open" as const,
            } satisfies Omit<Milestone, "id" | "progress">,
            issues: [
              {
                title: "Task 1",
                description: "First task in Phase 1",
                priority: "high" as const,
                type: "feature" as const,
                labels: ["e2e-test"],
                status: "open" as const,
                assignees: [],
                milestoneId: undefined,
              } satisfies Omit<Issue, "id" | "createdAt" | "updatedAt">,
              {
                title: "Task 2",
                description: "Second task in Phase 1",
                priority: "medium" as const,
                type: "bug" as const,
                labels: ["e2e-test"],
                status: "open" as const,
                assignees: [],
                milestoneId: undefined,
              } satisfies Omit<Issue, "id" | "createdAt" | "updatedAt">,
            ],
          },
        ],
      };

      const result = await service.createRoadmap(roadmapData);
      createdProject = result.project;

      expect(result.project.title).toBe(roadmapData.project.title);
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].issues).toHaveLength(2);
      expect(result.project.id).toBeDefined();
    });

    it("should customize project views", async () => {
      const boardView = await service.createProjectView(createdProject.id, {
        name: "Development Board",
        layout: "board",
        settings: {
          groupBy: "Status",
          sortBy: [{ field: "Priority", direction: "desc" }],
        },
      });

      expect(boardView.layout).toBe("board");
      expect(boardView.settings.groupBy).toBe("Status");

      const tableView = await service.createProjectView(createdProject.id, {
        name: "All Tasks",
        layout: "table",
        settings: {
          sortBy: [
            { field: "Title", direction: "asc" },
            { field: "Priority", direction: "desc" },
          ],
        },
      });

      expect(tableView.layout).toBe("table");
      expect(tableView.settings.sortBy).toHaveLength(2);
    });

    it("should add custom fields", async () => {
      const storyPointsField = await service.createCustomField(createdProject.id, {
        name: "Story Points",
        type: "number",
      });

      expect(storyPointsField.name).toBe("Story Points");
      expect(storyPointsField.type).toBe("number");

      const componentField = await service.createCustomField(createdProject.id, {
        name: "Component",
        type: "single_select",
        options: ["Frontend", "Backend", "Infrastructure"],
      });

      expect(componentField.name).toBe("Component");
      expect(componentField.options).toContain("Frontend");
    });
  });

  describe("Sprint Management", () => {
    it("should plan a sprint with selected issues", async () => {
      const now = new Date();
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const sprintData = {
        sprint: {
          title: "Sprint 1",
          startDate: now,
          endDate: twoWeeksFromNow,
          status: "planned" as const,
          goals: ["Complete initial features"],
          issues: [],
        } satisfies Omit<Sprint, "id">,
        issueIds: [1, 2], // Using the issues created in roadmap test
      };

      createdSprint = await service.planSprint(sprintData);
      expect(createdSprint.title).toBe("Sprint 1");
      expect(createdSprint.issues).toHaveLength(2);
    });

    it("should track sprint metrics", async () => {
      const metrics = await service.getSprintMetrics(createdSprint.id);
      expect(metrics.totalIssues).toBe(2);
      expect(metrics.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.completionPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe("Milestone Tracking", () => {
    it("should track milestone progress", async () => {
      const milestoneId = 1; // Using the milestone created in roadmap test
      const progress = await service.getMilestoneProgress(milestoneId);
      const percentage = await service.getMilestoneCompletionPercentage(milestoneId);

      expect(progress).toHaveProperty("openIssues");
      expect(progress).toHaveProperty("closedIssues");
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it("should identify overdue milestones", async () => {
      const overdueMilestones = await service.getOverdueMilestones();
      expect(Array.isArray(overdueMilestones)).toBe(true);
    });

    it("should find upcoming milestones", async () => {
      const upcomingMilestones = await service.getMilestonesInNext(30);
      expect(Array.isArray(upcomingMilestones)).toBe(true);
      expect(upcomingMilestones.length).toBeGreaterThan(0);
    });
  });

  describe("Issue Management", () => {
    let testIssueId: number;

    beforeAll(async () => {
      // Create a test issue for management operations
      const issue = await service.createIssue({
        title: "Test Management Issue",
        description: "Issue for testing management operations",
        priority: "medium",
        type: "feature",
        labels: ["e2e-test-management"],
        status: "open",
        assignees: [],
      });
      testIssueId = issue.id;
    });

    it("should update issue status and track changes", async () => {
      // Update status to closed
      await service.updateIssueStatus(testIssueId, "closed");
      let issue = await service.getIssue(testIssueId);
      expect(issue.status).toBe("closed");

      // Update status back to open
      await service.updateIssueStatus(testIssueId, "open");
      issue = await service.getIssue(testIssueId);
      expect(issue.status).toBe("open");

      // Get issue history
      const history = await service.getIssueHistory(testIssueId);
      expect(history).toHaveLength(2);
      expect(history[0].field).toBe("status");
    });

    it("should reassign issues between milestones", async () => {
      // Create a new milestone for reassignment
      const newMilestone = await service.createMilestone({
        title: "Reassignment Test",
        description: "Milestone for testing reassignment",
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: "open",
      });

      // Assign issue to milestone
      await service.assignIssueToMilestone(testIssueId, newMilestone.id);
      const issue = await service.getIssue(testIssueId);
      expect(issue.milestoneId).toBe(newMilestone.id);
    });

    it("should track issue dependencies", async () => {
      // Create dependent issue
      const dependentIssue = await service.createIssue({
        title: "Dependent Issue",
        description: "This issue depends on the test issue",
        priority: "low",
        type: "feature",
        labels: ["e2e-test-dependency"],
        status: "open",
        assignees: [],
      });

      // Add dependency relationship
      await service.addIssueDependency(dependentIssue.id, testIssueId);
      const dependencies = await service.getIssueDependencies(dependentIssue.id);
      expect(dependencies).toContainEqual(expect.objectContaining({ id: testIssueId }));
    });
  });
});