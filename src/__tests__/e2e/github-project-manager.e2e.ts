import { createProjectManagementService } from "../../container";
import { ResourceStatus } from "../../domain/resource-types";
import type { Sprint } from "../../domain/types";
import { resolveGitHubAuth } from "../../infrastructure/github/auth/resolveGitHubAuth";
import { GitHubTypeConverter } from "../../infrastructure/github/util/conversion";
import type { ProjectManagementService } from "../../services/ProjectManagementService";
import { TestFactory } from "../test-utils";
import { MCPToolTestUtils } from "./utils/MCPToolTestUtils";

// Live-API suite: it creates real roadmaps, milestones, issues and sprints, so it runs only when
// real GitHub credentials (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO) are configured. The fake values
// seeded by e2e/setup.ts do not count.
describe.skipIf(MCPToolTestUtils.shouldSkipTest("github"))(
  "GitHub Project Manager E2E Tests",
  () => {
    let service: ProjectManagementService;

    beforeAll(() => {
      const owner = process.env.GITHUB_OWNER || "test-owner";
      const repo = process.env.GITHUB_REPO || "test-repo";

      service = createProjectManagementService(owner, repo, resolveGitHubAuth());
    });

    describe("Roadmap Creation", () => {
      it("should create a roadmap with milestones and issues", async () => {
        const roadmapData = {
          project: TestFactory.createProject({
            title: "Test Roadmap",
            description: "A test roadmap project",
            visibility: "private",
          }),
          milestones: [
            {
              milestone: TestFactory.createMilestone({
                title: "Milestone 1",
                description: "First milestone",
                dueDate: TestFactory.futureDate(30),
                status: ResourceStatus.ACTIVE,
              }),
              issues: [
                TestFactory.createIssue({
                  title: "Feature 1",
                  description: "Implement feature 1",
                  status: ResourceStatus.ACTIVE,
                  priority: "high",
                  issueType: "feature",
                }),
                TestFactory.createIssue({
                  title: "Bug Fix 1",
                  description: "Fix critical bug",
                  status: ResourceStatus.ACTIVE,
                  priority: "high",
                  issueType: "bug",
                }),
              ],
            },
          ],
        };

        const result = await service.roadmap.createRoadmap(roadmapData);

        expect(result.project.title).toBe("Test Roadmap");
        expect(result.milestones).toHaveLength(1);
        expect(result.milestones[0].issues).toHaveLength(2);
      });
    });

    describe("Sprint Management", () => {
      let createdSprint: Sprint;

      beforeAll(async () => {
        const now = new Date();
        const twoWeeksFromNow = new Date(now);
        twoWeeksFromNow.setDate(now.getDate() + 14);
        const sprintData = {
          sprint: TestFactory.createSprint({
            title: "Test Sprint",
            startDate: GitHubTypeConverter.toISOString(now),
            endDate: GitHubTypeConverter.toISOString(twoWeeksFromNow),
            status: ResourceStatus.PLANNED,
            goals: ["Complete initial features"],
          }),
          issueIds: [],
        };

        createdSprint = await service.sprints.planSprint(sprintData);
      });

      it("should find all planned sprints", async () => {
        const sprints = await service.sprints.findSprints({ status: ResourceStatus.PLANNED });
        expect(sprints.length).toBeGreaterThan(0);
        expect(sprints[0].status).toBe(ResourceStatus.PLANNED);
      });

      it("should update sprint status", async () => {
        const updatedSprint = await service.sprints.updateSprint({
          sprintId: createdSprint.id,
          status: ResourceStatus.ACTIVE,
        });
        expect(updatedSprint.status).toBe(ResourceStatus.ACTIVE);
      });
    });

    describe("Issue and Milestone Management", () => {
      let testIssueId: string;

      beforeAll(async () => {
        const issue = await service.issues.createIssue(
          TestFactory.createIssue({
            title: "Test Issue",
            description: "Test description",
            status: ResourceStatus.ACTIVE,
            priority: "high",
            issueType: "feature",
            labels: ["test"],
          })
        );

        testIssueId = issue.id;

        await service.subIssues.updateIssueStatus(testIssueId, ResourceStatus.CLOSED);
        const closedIssue = await service.issues.getIssue(testIssueId);
        expect(closedIssue?.status).toBe(ResourceStatus.CLOSED);

        await service.subIssues.updateIssueStatus(testIssueId, ResourceStatus.ACTIVE);
        const reopenedIssue = await service.issues.getIssue(testIssueId);
        expect(reopenedIssue?.status).toBe(ResourceStatus.ACTIVE);

        const history = await service.subIssues.getIssueHistory(testIssueId);
        expect(history.length).toBeGreaterThan(0);
      });

      it("should manage milestones", async () => {
        const newMilestone = await service.milestones.createMilestone(
          TestFactory.createMilestone({
            title: "Test Milestone",
            description: "Test description",
            dueDate: TestFactory.futureDate(15),
            status: ResourceStatus.ACTIVE,
          })
        );

        await service.subIssues.assignIssueToMilestone(testIssueId, newMilestone.id);
        const issue = await service.issues.getIssue(testIssueId);
        expect(issue?.milestoneId).toBe(newMilestone.id);
      });

      it("should handle issue dependencies", async () => {
        const dependentIssue = await service.issues.createIssue(
          TestFactory.createIssue({
            title: "Dependent Issue",
            description: "This issue depends on the test issue",
            status: ResourceStatus.ACTIVE,
            priority: "medium",
            issueType: "feature",
            labels: ["dependency"],
          })
        );

        await service.subIssues.addIssueDependency(dependentIssue.id, testIssueId);
        const dependencies = await service.subIssues.getIssueDependencies(dependentIssue.id);
        expect(dependencies).toContain(testIssueId);
      });
    });

    afterAll(async () => {
      // Cleanup not needed for tests using mocked repositories
    });
  }
);
