/**
 * DI Container Configuration
 *
 * Centralizes dependency injection configuration using tsyringe.
 * Services are registered with string tokens to support both DI
 * resolution and direct instantiation.
 *
 * ## Root Dependencies
 *
 * - **ILogger** — registered as a singleton instance using the `logger` constant
 *   from infrastructure/logger. All services that need logging receive this via
 *   constructor injection (`@inject('ILogger')` or `c.resolve<ILogger>('ILogger')`).
 *   Services also accept an optional `ILogger` parameter for backward compatibility,
 *   falling back to `Logger.getInstance()` when not injected.
 *
 * - **GitHubRepositoryFactory** — root of the GitHub integration dependency tree.
 *
 * - **AIServiceFactory** — singleton factory for AI model access.
 *
 * ## Services intentionally outside DI
 *
 * The following services are NOT registered in the container by design:
 *
 * - **GitHubStateSyncService** — requires ResourceCache and FilePersistenceAdapter
 *   (infrastructure objects created at server startup in index.ts, not in the container).
 *
 * - **RequirementsTraceabilityService** — pure stateless utility with zero constructor
 *   dependencies. No benefit from container management.
 *
 * - **AI sub-services** (AITaskProcessor, DuplicateDetectionService, LabelSuggestionService,
 *   RelatedIssueLinkingService, RoadmapAIService, BacklogPrioritizer, SprintRiskAssessor,
 *   SprintSuggestionService, SprintCapacityAnalyzer, IssueEnrichmentAIService) — internal
 *   strategy/utility classes. Now accept AIServiceFactory and ILogger via constructor for
 *   proper DI, with graceful fallback to getInstance() when not injected.
 *
 * - **Context sub-services** (ContextualReferenceGenerator, DependencyContextGenerator,
 *   CodeExampleGenerator) — now accept AIServiceFactory and ILogger via constructor
 *   for proper DI.
 *
 * - **Pure utilities** (ConfidenceScorer, TokenCounter, AIResponseCache,
 *   ContextQualityValidator, DependencyGraph, EstimationCalibrator) — stateless helpers
 *   or value-object-like classes with optional config params. No DI deps.
 */
import "reflect-metadata";
import { container, type DependencyContainer } from "tsyringe";
import { GitHubRepositoryFactory } from "./infrastructure/github/GitHubRepositoryFactory";
import { SubIssueService } from "./services/SubIssueService";
import { MilestoneService } from "./services/MilestoneService";
import { SprintPlanningService } from "./services/SprintPlanningService";
import { ProjectStatusService } from "./services/ProjectStatusService";
import { ProjectTemplateService } from "./services/ProjectTemplateService";
import { ProjectLinkingService } from "./services/ProjectLinkingService";
import { IssueService } from "./services/IssueService";
import { RoadmapService } from "./services/RoadmapService";
import { ProjectAutomationService } from "./services/ProjectAutomationService";
import { PullRequestService } from "./services/PullRequestService";
import { FieldValueService } from "./services/FieldValueService";
import { LabelService } from "./services/LabelService";
import { IterationService } from "./services/IterationService";
import { type ILogger, Logger, logger } from "./infrastructure/logger";
import { ProjectManagementService } from "./services/ProjectManagementService";
import { AIServiceFactory } from "./services/ai/AIServiceFactory";
import { RoadmapPlanningService } from "./services/RoadmapPlanningService";
import { IssueEnrichmentService } from "./services/IssueEnrichmentService";
import { IssueTriagingService } from "./services/IssueTriagingService";
import { PRDGenerationService } from "./services/PRDGenerationService";
import { TaskGenerationService } from "./services/TaskGenerationService";
import { TaskContextGenerationService } from "./services/TaskContextGenerationService";
import { FeatureManagementService } from "./services/FeatureManagementService";
import { FeatureAnalysisService } from "./services/feature/FeatureAnalysisService";
import { FeaturePRDService } from "./services/feature/FeaturePRDService";
import { FeatureExpansionService } from "./services/feature/FeatureExpansionService";
import { TaskLifecycleService } from "./services/feature/TaskLifecycleService";
import { AgentStore } from "./infrastructure/agent/AgentStore";
import { WorkProductStore } from "./infrastructure/agent/WorkProductStore";
import { ProjectFieldSetup } from "./infrastructure/agent/ProjectFieldSetup";
import { TaskCheckoutService } from "./services/agent/TaskCheckoutService";
import { AgentContextService } from "./services/agent/AgentContextService";
import { WorkProductService } from "./services/agent/WorkProductService";
import { AgentBudgetService } from "./services/agent/AgentBudgetService";
import { AgentMetricsService } from "./services/agent/AgentMetricsService";
import { AgentReclaimScheduler } from "./services/agent/AgentReclaimScheduler";
import {
  AGENT_RECLAIM_ENABLED,
  AGENT_RECLAIM_INTERVAL_MS,
  AGENT_STALE_AFTER_MINUTES,
} from "./env";

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

  // Register Logger as ILogger for dependency injection
  container.registerInstance<ILogger>("ILogger", logger);

  // Register extracted services with factory resolution
  // Services that don't use @injectable/@inject decorators need useFactory
  container.register("SubIssueService", {
    useFactory: (c) => new SubIssueService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("MilestoneService", {
    useFactory: (c) => new MilestoneService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("SprintPlanningService", {
    useFactory: (c) => new SprintPlanningService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectStatusService", {
    useFactory: (c) => new ProjectStatusService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectTemplateService", {
    useFactory: (c) => new ProjectTemplateService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectLinkingService", {
    useFactory: (c) => new ProjectLinkingService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("IssueService", {
    useFactory: (c) => new IssueService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("RoadmapService", {
    useFactory: (c) => new RoadmapService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectAutomationService", {
    useFactory: (c) => {
      const f = c.resolve<GitHubRepositoryFactory>("GitHubRepositoryFactory");
      return new ProjectAutomationService(
        f.createAutomationRuleRepository(),
        f.createProjectRepository(),
        c.resolve<ILogger>("ILogger")
      );
    }
  });

  container.register("PullRequestService", {
    useFactory: (c) => new PullRequestService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("FieldValueService", {
    useFactory: (c) => new FieldValueService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("LabelService", {
    useFactory: (c) => new LabelService(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("IterationService", {
    useFactory: (c) => new IterationService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("FieldValueService"),
      c.resolve("ProjectTemplateService"),
      c.resolve("ProjectLinkingService")
    )
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
      c.resolve("ProjectLinkingService"),
      c.resolve("IssueService"),
      c.resolve("RoadmapService"),
      c.resolve("ProjectAutomationService"),
      c.resolve("PullRequestService"),
      c.resolve("FieldValueService"),
      c.resolve("LabelService"),
      c.resolve("IterationService")
    )
  });

  // Register AI services
  // AIServiceFactory is a singleton — register the existing instance
  container.registerInstance("AIServiceFactory", AIServiceFactory.getInstance(logger));

  container.register("RoadmapPlanningService", {
    useFactory: (c) => new RoadmapPlanningService(
      c.resolve("AIServiceFactory"),
      c.resolve("ProjectManagementService"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("IssueEnrichmentService", {
    useFactory: (c) => new IssueEnrichmentService(
      c.resolve("AIServiceFactory"),
      c.resolve("ProjectManagementService"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("IssueTriagingService", {
    useFactory: (c) => new IssueTriagingService(
      c.resolve("AIServiceFactory"),
      c.resolve("ProjectManagementService"),
      c.resolve("IssueEnrichmentService"),
      c.resolve<ILogger>("ILogger")
    )
  });

  // Register AI task-generation pipeline services
  // These now accept AIServiceFactory via constructor for proper DI.
  container.register("PRDGenerationService", {
    useFactory: (c) => new PRDGenerationService(c.resolve("AIServiceFactory"))
  });

  container.register("TaskContextGenerationService", {
    useFactory: (c) => new TaskContextGenerationService(
      c.resolve("AIServiceFactory"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("TaskGenerationService", {
    useFactory: (c) => new TaskGenerationService(
      c.resolve("AIServiceFactory"),
      c.resolve<ILogger>("ILogger")
    )
  });

  // Register feature management sub-services (SRP decomposition)
  container.register("FeatureAnalysisService", {
    useFactory: (c) => new FeatureAnalysisService(
      c.resolve("AIServiceFactory"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("FeaturePRDService", {
    useFactory: (c) => new FeaturePRDService(
      c.resolve("FeatureAnalysisService"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("FeatureExpansionService", {
    useFactory: (c) => new FeatureExpansionService(
      c.resolve("AIServiceFactory"),
      c.resolve("TaskGenerationService"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("TaskLifecycleService", {
    useFactory: (c) => new TaskLifecycleService(
      c.resolve("AIServiceFactory"),
      c.resolve<ILogger>("ILogger")
    )
  });

  container.register("FeatureManagementService", {
    useFactory: (c) => new FeatureManagementService(
      c.resolve("AIServiceFactory"),
      c.resolve<ILogger>("ILogger")
    )
  });

  // Register agent orchestration services
  container.register("AgentStore", {
    useFactory: (c) => new AgentStore(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("WorkProductStore", {
    useFactory: (c) => new WorkProductStore(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("ProjectFieldSetup", {
    useFactory: (c) => new ProjectFieldSetup(c.resolve("GitHubRepositoryFactory"))
  });

  container.register("AgentContextService", {
    useFactory: (c) => new AgentContextService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("AIServiceFactory")
    )
  });

  container.register("TaskCheckoutService", {
    useFactory: (c) => new TaskCheckoutService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("AgentStore"),
      c.resolve("AgentContextService"),
      c.resolve("AIServiceFactory")
    )
  });

  container.register("AgentReclaimScheduler", {
    useFactory: (c) => new AgentReclaimScheduler(
      c.resolve("TaskCheckoutService"),
      {
        enabled: AGENT_RECLAIM_ENABLED,
        intervalMs: AGENT_RECLAIM_INTERVAL_MS,
        staleAfterMinutes: AGENT_STALE_AFTER_MINUTES,
      }
    )
  });

  container.register("WorkProductService", {
    useFactory: (c) => new WorkProductService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("WorkProductStore")
    )
  });

  container.register("AgentBudgetService", {
    useFactory: (c) => new AgentBudgetService(c.resolve("AgentStore"))
  });

  container.register("AgentMetricsService", {
    useFactory: (c) => new AgentMetricsService(
      c.resolve("GitHubRepositoryFactory"),
      c.resolve("AgentStore"),
      c.resolve("WorkProductStore")
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
  const logger = Logger.getInstance();
  const templateService = new ProjectTemplateService(factory);
  const linkingService = new ProjectLinkingService(factory);
  const fieldValueService = new FieldValueService(factory);
  return new ProjectManagementService(
    factory,
    new SubIssueService(factory),
    new MilestoneService(factory),
    new SprintPlanningService(factory),
    new ProjectStatusService(factory),
    templateService,
    linkingService,
    new IssueService(factory),
    new RoadmapService(factory),
    new ProjectAutomationService(
      factory.createAutomationRuleRepository(),
      factory.createProjectRepository(),
      logger
    ),
    new PullRequestService(factory),
    fieldValueService,
    new LabelService(factory),
    new IterationService(factory, fieldValueService, templateService, linkingService)
  );
}

export { container };
