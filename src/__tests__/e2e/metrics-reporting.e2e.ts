import { ProjectManagementService } from "../../services/ProjectManagementService";
import { ResourceStatus } from "../../domain/resource-types";
import { TestFactory } from "../test-utils";
import { GitHubTypeConverter } from "../../infrastructure/github/util/conversion";

describe.skip("Metrics and Reporting E2E Tests", () => {
  let service: ProjectManagementService;
  let testMilestoneId: number;
  let testSprintId: string;

  beforeAll(async () => {
    const token = process.env.GITHUB_TOKEN || "test-token";
    const owner = process.env.GITHUB_OWNER || "test-owner";
    const repo = process.env.GITHUB_REPO || "test-repo";

    service = new ProjectManagementService(owner, repo, token);

    // Create a test milestone with issues for metrics testing
    const milestone = await service.createMilestone(
      TestFactory.createMilestone({
        title: "Metrics Test Milestone",
        description: "For testing milestone metrics",
        dueDate: TestFactory.futureDate(7),
        status: ResourceStatus.ACTIVE,
      })
    );
    testMilestoneId = parseInt(milestone.id);

    // Create issues for the milestone
    await service.createIssue(
      TestFactory.createIssue({
        title: "Milestone Test Issue 1",
        description: "Open issue for milestone metrics",
        status: ResourceStatus.ACTIVE,
        priority: "high",
        issueType: "feature",
        milestoneId: milestone.id,
      })
    );

    const completedIssue = await service.createIssue(
      TestFactory.createIssue({
        title: "Milestone Test Issue 2",
        description: "Completed issue for milestone metrics",
        status: ResourceStatus.ACTIVE,
        priority: "medium",
        issueType: "task",
        milestoneId: milestone.id,
      })
    );
    
    // Mark one issue as completed
    await service.updateIssueStatus(completedIssue.id, ResourceStatus.COMPLETED);

    // Create a test sprint with issues for metrics testing
    const now = new Date();
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(now.getDate() + 14);
    const sprint = await service.planSprint({
      sprint: TestFactory.createSprint({
        title: "Metrics Test Sprint",
        startDate: GitHubTypeConverter.toISOString(now),
        endDate: GitHubTypeConverter.toISOString(twoWeeksFromNow),
        status: ResourceStatus.ACTIVE,
        goals: ["Testing sprint metrics"],
      }),
      issueIds: [],
    });

    testSprintId = sprint.id;

    // Create issues for the sprint
    const issue1 = await service.createIssue(
      TestFactory.createIssue({
        title: "Sprint Test Issue 1",
        description: "Open issue for sprint metrics",
        status: ResourceStatus.ACTIVE,
        priority: "high",
        issueType: "feature",
      })
    );

    const issue2 = await service.createIssue(
      TestFactory.createIssue({
        title: "Sprint Test Issue 2",
        description: "Completed issue for sprint metrics",
        status: ResourceStatus.ACTIVE,
        priority: "medium",
        issueType: "task",
      })
    );

    // Mark one issue as completed
    await service.updateIssueStatus(issue2.id, ResourceStatus.COMPLETED);

    // Add the issues to the sprint
    // Note: This assumes your implementation supports this operation
    await service.updateSprint({
      sprintId: testSprintId,
      issues: [issue1.id, issue2.id],
    });
  });

  describe("Milestone Metrics", () => {
    it("should retrieve accurate milestone metrics", async () => {
      const metrics = await service.getMilestoneMetrics(String(testMilestoneId), true);
      
      expect(metrics.id).toBe(testMilestoneId.toString());
      expect(metrics.title).toBe("Metrics Test Milestone");
      expect(metrics.totalIssues).toBe(2);
      expect(metrics.closedIssues).toBe(1);
      expect(metrics.openIssues).toBe(1);
      expect(metrics.completionPercentage).toBe(50);
      expect(metrics.isOverdue).toBe(false);
      expect(metrics.daysRemaining).toBeGreaterThan(0);
      expect(metrics.issues?.length).toBe(2);
    });

    it("should include only requested data in milestone metrics", async () => {
      const metricsWithoutIssues = await service.getMilestoneMetrics(String(testMilestoneId), false);
      
      expect(metricsWithoutIssues.id).toBe(testMilestoneId.toString());
      expect(metricsWithoutIssues.issues).toBeUndefined();
    });
  });

  describe("Sprint Metrics", () => {
    it("should retrieve accurate sprint metrics", async () => {
      const metrics = await service.getSprintMetrics(testSprintId, true);
      
      expect(metrics.id).toBe(testSprintId);
      expect(metrics.title).toBe("Metrics Test Sprint");
      expect(metrics.totalIssues).toBe(2);
      expect(metrics.completedIssues).toBe(1);
      expect(metrics.remainingIssues).toBe(1);
      expect(metrics.completionPercentage).toBe(50);
      expect(metrics.isActive).toBe(true);
      expect(metrics.daysRemaining).toBeGreaterThan(0);
      expect(metrics.issues?.length).toBe(2);
    });

    it("should include only requested data in sprint metrics", async () => {
      const metricsWithoutIssues = await service.getSprintMetrics(testSprintId, false);
      
      expect(metricsWithoutIssues.id).toBe(testSprintId);
      expect(metricsWithoutIssues.issues).toBeUndefined();
    });
  });

  describe("Overdue Milestones", () => {
    it("should find overdue milestones", async () => {
      // Create an overdue milestone
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      
      await service.createMilestone(
        TestFactory.createMilestone({
          title: "Overdue Milestone",
          description: "This milestone is already overdue",
          dueDate: pastDate.toISOString(),
          status: ResourceStatus.ACTIVE,
        })
      );

      const overdueMilestones = await service.getOverdueMilestones(5, false);
      
      expect(overdueMilestones.length).toBeGreaterThan(0);
      expect(overdueMilestones[0].isOverdue).toBe(true);
      expect(overdueMilestones[0].title).toContain("Overdue");
    });

    it("should limit the number of returned overdue milestones", async () => {
      const limitedOverdueMilestones = await service.getOverdueMilestones(1, false);
      
      expect(limitedOverdueMilestones.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Upcoming Milestones", () => {
    it("should find upcoming milestones within a time range", async () => {
      const upcomingMilestones = await service.getUpcomingMilestones(10, 5, false);
      
      expect(upcomingMilestones.length).toBeGreaterThan(0);
      expect(upcomingMilestones[0].isOverdue).toBe(false);
      expect(upcomingMilestones[0].daysRemaining).toBeLessThanOrEqual(10);
    });

    it("should respect the limit parameter for upcoming milestones", async () => {
      const limitedUpcomingMilestones = await service.getUpcomingMilestones(30, 1, false);
      
      expect(limitedUpcomingMilestones.length).toBeLessThanOrEqual(1);
    });
  });
});