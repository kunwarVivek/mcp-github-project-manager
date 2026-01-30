/**
 * DI Container Configuration
 *
 * Centralizes dependency injection configuration using tsyringe.
 * Services are registered with string tokens to support both DI
 * resolution and direct instantiation.
 */
import "reflect-metadata";
import { container, DependencyContainer } from "tsyringe";
import { GitHubRepositoryFactory } from "./infrastructure/github/GitHubRepositoryFactory";
import { SubIssueService } from "./services/SubIssueService";
import { MilestoneService } from "./services/MilestoneService";
import { SprintPlanningService } from "./services/SprintPlanningService";
import { ProjectStatusService } from "./services/ProjectStatusService";
import { ProjectTemplateService } from "./services/ProjectTemplateService";
import { ProjectLinkingService } from "./services/ProjectLinkingService";
import { ProjectManagementService } from "./services/ProjectManagementService";

/**
 * Configure the DI container with all services.
 *
 * This function sets up the dependency graph:
 * - GitHubRepositoryFactory is the root dependency (instance)
 * - Extracted services depend on the factory
 * - ProjectManagementService (facade) depends on all extracted services
 *
 * @param token - GitHub API token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Configured dependency container
 */
export function configureContainer(
  token: string,
  owner: string,
  repo: string
): DependencyContainer {
  // Clear any previous registrations to ensure clean state
  container.clearInstances();

  // Register factory instance - root of dependency tree
  const factory = new GitHubRepositoryFactory(token, owner, repo);
  container.registerInstance("GitHubRepositoryFactory", factory);

  // Register extracted services with factory resolution
  // Services that don't use @injectable/@inject decorators need useFactory
  container.register("SubIssueService", {
    useFactory: (c) => new SubIssueService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("MilestoneService", {
    useFactory: (c) => new MilestoneService(c.resolve("GitHubRepositoryFactory"))
  });

  // SprintPlanningService uses @injectable/@inject, so useClass works
  container.register("SprintPlanningService", { useClass: SprintPlanningService });

  // ProjectStatusService uses @injectable/@inject, so useClass works
  container.register("ProjectStatusService", { useClass: ProjectStatusService });

  container.register("ProjectTemplateService", {
    useFactory: (c) => new ProjectTemplateService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectLinkingService", {
    useFactory: (c) => new ProjectLinkingService(c.resolve("GitHubRepositoryFactory"))
  });

  // Register facade - depends on all extracted services
  container.register("ProjectManagementService", {
    useFactory: (c) => new ProjectManagementService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("SubIssueService"),
      c.resolve("MilestoneService"),
      c.resolve("SprintPlanningService"),
      c.resolve("ProjectStatusService"),
      c.resolve("ProjectTemplateService"),
      c.resolve("ProjectLinkingService")
    )
  });

  return container;
}

/**
 * Create a ProjectManagementService instance directly without DI container.
 *
 * This provides backward compatibility for code that instantiates the service
 * directly using owner/repo/token parameters.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param token - GitHub API token
 * @returns Fully wired ProjectManagementService instance
 */
export function createProjectManagementService(
  owner: string,
  repo: string,
  token: string
): ProjectManagementService {
  const factory = new GitHubRepositoryFactory(token, owner, repo);
  return new ProjectManagementService(
    factory,
    new SubIssueService(factory),
    new MilestoneService(factory),
    new SprintPlanningService(factory),
    new ProjectStatusService(factory),
    new ProjectTemplateService(factory),
    new ProjectLinkingService(factory)
  );
}

export { container };
