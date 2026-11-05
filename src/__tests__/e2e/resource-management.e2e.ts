import { createProjectManagementService } from "../../container";
import { ResourceStatus } from "../../domain/resource-types";
import type { Issue, Milestone } from "../../domain/types";
import { createTokenAuth } from "../../infrastructure/github/auth/credentials";
import type { ProjectManagementService } from "../../services/ProjectManagementService";
import { TestFactory } from "../test-utils";
import { MCPToolTestUtils } from "./utils/MCPToolTestUtils";

// Live-API suite: it creates real issues and milestones, so it runs only when real GitHub
// credentials (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO) are configured. The fake values seeded by
// e2e/setup.ts do not count.
describe.skipIf(MCPToolTestUtils.shouldSkipTest("github"))("Resource Management E2E Tests", () => {
  let service: ProjectManagementService;

  beforeAll(() => {
    const { GITHUB_TOKEN: token, GITHUB_OWNER: owner, GITHUB_REPO: repo } = process.env;
    if (!token || !owner || !repo) {
      throw new Error("GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO are required");
    }

    service = createProjectManagementService(
      owner,
      repo,
      createTokenAuth(() => token, "env")
    );
  });

  describe("Issue Relationship Management", () => {
    let parentIssue: Issue;
    const childIssues: Issue[] = [];

    beforeAll(async () => {
      // Create a parent issue
      parentIssue = await service.issues.createIssue(
        TestFactory.createIssue({
          title: "Parent Feature",
          description: "A parent feature with dependencies",
          status: ResourceStatus.ACTIVE,
          issueType: "feature",
          labels: ["parent"],
        })
      );

      // Create child issues
      for (let i = 1; i <= 3; i++) {
        const childIssue = await service.issues.createIssue(
          TestFactory.createIssue({
            title: `Child Task ${i}`,
            description: `Implementation task ${i} for parent feature`,
            status: ResourceStatus.ACTIVE,
            issueType: "task",
            labels: ["child"],
          })
        );
        childIssues.push(childIssue);
      }
    });

    it("should create dependency relationships between issues", async () => {
      // Add dependencies
      for (const childIssue of childIssues) {
        await service.subIssues.addIssueDependency(childIssue.id, parentIssue.id);
      }

      // Verify dependencies
      for (const childIssue of childIssues) {
        const dependencies = await service.subIssues.getIssueDependencies(childIssue.id);
        expect(dependencies).toContain(parentIssue.id);
      }
    });

    it("should handle bulk status updates", async () => {
      // Update parent issue status
      await service.subIssues.updateIssueStatus(parentIssue.id, ResourceStatus.CLOSED);

      // Verify parent issue status
      const updatedParent = await service.issues.getIssue(parentIssue.id);
      expect(updatedParent?.status).toBe(ResourceStatus.CLOSED);

      // Verify impact on child issues (assuming your implementation has this relationship logic)
      // You might need to adapt this depending on how dependencies affect status in your system
      for (const childIssue of childIssues) {
        const child = await service.issues.getIssue(childIssue.id);
        expect(child).not.toBeNull();
      }
    });
  });

  describe("Milestone Assignment Operations", () => {
    let testMilestone: Milestone;
    const testIssues: Issue[] = [];

    beforeAll(async () => {
      // Create a test milestone
      testMilestone = await service.milestones.createMilestone(
        TestFactory.createMilestone({
          title: "Batch Assignment Milestone",
          description: "For testing batch assignment operations",
          dueDate: TestFactory.futureDate(14),
          status: ResourceStatus.ACTIVE,
        })
      );

      // Create multiple test issues
      for (let i = 1; i <= 5; i++) {
        const issue = await service.issues.createIssue(
          TestFactory.createIssue({
            title: `Assignment Test Issue ${i}`,
            description: `Issue ${i} for batch assignment testing`,
            status: ResourceStatus.ACTIVE,
            issueType: "task",
          })
        );
        testIssues.push(issue);
      }
    });

    it("should assign multiple issues to a milestone", async () => {
      // Assign all test issues to the milestone
      for (const issue of testIssues) {
        await service.subIssues.assignIssueToMilestone(issue.id, testMilestone.id);
      }

      // Verify all issues are assigned to the milestone
      for (const issue of testIssues) {
        const updatedIssue = await service.issues.getIssue(issue.id);
        expect(updatedIssue?.milestoneId).toBe(testMilestone.id);
      }
    });

    it("should update milestone progress when issues are completed", async () => {
      // Complete half of the issues
      const halfIndex = Math.floor(testIssues.length / 2);

      for (let i = 0; i < halfIndex; i++) {
        await service.subIssues.updateIssueStatus(testIssues[i].id, ResourceStatus.COMPLETED);
      }

      // Get milestone metrics
      const metrics = await service.milestones.getMilestoneMetrics(testMilestone.id, true);

      // Verify milestone progress reflects the completed issues
      expect(metrics.totalIssues).toBe(testIssues.length);
      expect(metrics.closedIssues).toBe(halfIndex);
      expect(metrics.openIssues).toBe(testIssues.length - halfIndex);
      expect(metrics.completionPercentage).toBe(Math.round((halfIndex / testIssues.length) * 100));
    });
  });

  describe("Resource History Tracking", () => {
    let testIssue: Issue;

    beforeAll(async () => {
      // Create a test issue for history tracking
      testIssue = await service.issues.createIssue(
        TestFactory.createIssue({
          title: "History Tracking Issue",
          description: "For testing issue history",
          status: ResourceStatus.ACTIVE,
          issueType: "task",
          labels: ["history-test"],
        })
      );
    });

    it("should track issue status changes in history", async () => {
      // Make multiple status changes
      await service.subIssues.updateIssueStatus(testIssue.id, ResourceStatus.IN_PROGRESS);
      await service.subIssues.updateIssueStatus(testIssue.id, ResourceStatus.COMPLETED);
      await service.subIssues.updateIssueStatus(testIssue.id, ResourceStatus.CLOSED);

      // Get issue history
      const history = await service.subIssues.getIssueHistory(testIssue.id);

      // Verify history is being tracked
      expect(history.length).toBeGreaterThan(0);
    });

    it("should track issue field updates in history", async () => {
      // Update issue fields
      await service.issues.updateIssue(testIssue.id, {
        title: "Updated History Test Issue",
        description: "Updated description for history tracking",
      });

      // Get updated issue and history
      const updatedIssue = await service.issues.getIssue(testIssue.id);
      const history = await service.subIssues.getIssueHistory(testIssue.id);

      // Verify issue was updated
      expect(updatedIssue?.title).toBe("Updated History Test Issue");

      // Verify history is being tracked
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
