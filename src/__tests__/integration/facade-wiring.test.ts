/**
 * Integration tests for facade wiring via DI container.
 *
 * Verifies that:
 * - DI container correctly resolves all services
 * - ProjectManagementService exposes every feature service through a typed getter
 * - Service dependencies are properly wired
 */
import { beforeEach, describe, expect, it } from "vitest";
import { configureContainer, container, createProjectManagementService } from "../../container";
import { createAppInstallationAuth } from "../../infrastructure/github/auth/credentials";
import { FieldValueService } from "../../services/FieldValueService";
import { IssueService } from "../../services/IssueService";
import { IterationService } from "../../services/IterationService";
import { LabelService } from "../../services/LabelService";
import { MilestoneService } from "../../services/MilestoneService";
import { ProjectAutomationService } from "../../services/ProjectAutomationService";
import { ProjectLinkingService } from "../../services/ProjectLinkingService";
import { ProjectManagementService } from "../../services/ProjectManagementService";
import { ProjectStatusService } from "../../services/ProjectStatusService";
import { ProjectTemplateService } from "../../services/ProjectTemplateService";
import { PullRequestService } from "../../services/PullRequestService";
import { RoadmapService } from "../../services/RoadmapService";
import { SprintPlanningService } from "../../services/SprintPlanningService";
import { SubIssueService } from "../../services/SubIssueService";
import { tokenAuth } from "../helpers/githubAuth";

const pat = tokenAuth();
const app = createAppInstallationAuth({
  appId: "1",
  privateKey: "test-private-key",
  installationId: "2",
});

describe("Facade Wiring Integration", () => {
  beforeEach(() => {
    // Clear container instances for clean state
    container.clearInstances();
  });

  describe("Container Configuration", () => {
    it("should configure container with test credentials", () => {
      const configured = configureContainer(pat, "test-owner", "test-repo");
      expect(configured).toBeDefined();
    });

    it("should resolve GitHubRepositoryFactory from container", () => {
      configureContainer(pat, "test-owner", "test-repo");
      const factory = container.resolve("GitHubRepositoryFactory");
      expect(factory).toBeDefined();
    });

    it("should resolve all extracted services from container", () => {
      configureContainer(pat, "test-owner", "test-repo");

      expect(container.resolve("SubIssueService")).toBeDefined();
      expect(container.resolve("MilestoneService")).toBeDefined();
      expect(container.resolve("SprintPlanningService")).toBeDefined();
      expect(container.resolve("ProjectStatusService")).toBeDefined();
      expect(container.resolve("ProjectTemplateService")).toBeDefined();
      expect(container.resolve("ProjectLinkingService")).toBeDefined();
    });

    it("should resolve ProjectManagementService from container", () => {
      configureContainer(pat, "test-owner", "test-repo");
      const service = container.resolve("ProjectManagementService");
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ProjectManagementService);
    });
  });

  describe("Entry-point components and App-only auth", () => {
    it("configures the container with GitHub App credentials and no PAT", () => {
      configureContainer(app, "test-owner", "test-repo");
      expect(container.resolve("ProjectManagementService")).toBeInstanceOf(
        ProjectManagementService
      );
    });

    it("resolves the entry-point singletons", () => {
      configureContainer(pat, "test-owner", "test-repo");
      const names = [
        "ResourceCache",
        "FilePersistenceAdapter",
        "GitHubWebhookHandler",
        "EventStore",
        "EventSubscriptionManager",
        "GracefulShutdown",
        "MutationAuditLog",
        "TelemetryConfig",
      ];
      for (const name of names) {
        expect(container.resolve(name)).toBeDefined();
      }
      expect(container.resolve("EventStore")).toBe(container.resolve("EventStore"));
    });
  });

  describe("Direct Instantiation Helper", () => {
    it("should create ProjectManagementService via helper function", () => {
      const service = createProjectManagementService("test-owner", "test-repo", tokenAuth());
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ProjectManagementService);
    });

    it("exposes every feature service through its typed getter", () => {
      const service = createProjectManagementService("test-owner", "test-repo", tokenAuth());

      expect(service.issues).toBeInstanceOf(IssueService);
      expect(service.subIssues).toBeInstanceOf(SubIssueService);
      expect(service.milestones).toBeInstanceOf(MilestoneService);
      expect(service.sprints).toBeInstanceOf(SprintPlanningService);
      expect(service.projects).toBeInstanceOf(ProjectStatusService);
      expect(service.templates).toBeInstanceOf(ProjectTemplateService);
      expect(service.linking).toBeInstanceOf(ProjectLinkingService);
      expect(service.roadmap).toBeInstanceOf(RoadmapService);
      expect(service.automation).toBeInstanceOf(ProjectAutomationService);
      expect(service.pullRequests).toBeInstanceOf(PullRequestService);
      expect(service.fieldValues).toBeInstanceOf(FieldValueService);
      expect(service.labels).toBeInstanceOf(LabelService);
      expect(service.iterations).toBeInstanceOf(IterationService);
    });
  });
});
