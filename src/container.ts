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
 * ## Components owned by the entry point
 *
 * The singletons `src/index.ts` needs (ResourceCache, FilePersistenceAdapter,
 * GitHubWebhookHandler, EventStore, EventSubscriptionManager,
 * GracefulShutdown, MutationAuditLog, TelemetryConfig) are registered here and
 * resolved by `index.ts`; it constructs none of them by hand.
 *
 * ## Services intentionally outside DI
 *
 * - **Tool executors** — compound executors build their own services per call
 *   through the one shared factory (`createGitHubFactory`, `shared-services`);
 *   they are not resolved from this container. See AGENTS.md ("Composition root").
 *
 * - **GitHubStateSyncService** — built by `index.ts` at sync time from the
 *   container's ResourceCache, FilePersistenceAdapter and repository factory
 *   (it only exists when SYNC_ENABLED).
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
import { container, type DependencyContainer, instanceCachingFactory } from "tsyringe";
import { domainEventBus } from "./domain/events/DomainEventBus";
import {
  AGENT_RECLAIM_ENABLED,
  AGENT_RECLAIM_INTERVAL_MS,
  AGENT_STALE_AFTER_MINUTES,
  CACHE_DIRECTORY,
  WEBHOOK_SECRET,
} from "./env";
import { AgentStore } from "./infrastructure/agent/AgentStore";
import { ProjectFieldSetup } from "./infrastructure/agent/ProjectFieldSetup";
import { WorkProductStore } from "./infrastructure/agent/WorkProductStore";
import { ResourceCache } from "./infrastructure/cache/ResourceCache";
import { EventStore } from "./infrastructure/events/EventStore";
import { EventSubscriptionManager } from "./infrastructure/events/EventSubscriptionManager";
import { GitHubWebhookHandler } from "./infrastructure/events/GitHubWebhookHandler";
import type { GitHubAuth } from "./infrastructure/github/auth/GitHubAuth";
import { GitHubRepositoryFactory } from "./infrastructure/github/GitHubRepositoryFactory";
import { GracefulShutdown } from "./infrastructure/lifecycle/GracefulShutdown";
import { type ILogger, Logger, logger } from "./infrastructure/logger";
import {
  auditLogConfigFromEnv,
  createMutationAuditLog,
  telemetryConfigFromEnv,
} from "./infrastructure/observability";
import { FilePersistenceAdapter } from "./infrastructure/persistence/FilePersistenceAdapter";
import { AgentBudgetService } from "./services/agent/AgentBudgetService";
import { AgentContextService } from "./services/agent/AgentContextService";
import { AgentMetricsService } from "./services/agent/AgentMetricsService";
import { AgentReclaimScheduler } from "./services/agent/AgentReclaimScheduler";
import { TaskCheckoutService } from "./services/agent/TaskCheckoutService";
import { UnpaidDebitLedger } from "./services/agent/UnpaidDebitLedger";
import { WorkProductService } from "./services/agent/WorkProductService";
import { AIServiceFactory } from "./services/ai/AIServiceFactory";
import { FeatureManagementService } from "./services/FeatureManagementService";
import { FieldValueService } from "./services/FieldValueService";
import { FeatureAnalysisService } from "./services/feature/FeatureAnalysisService";
import { FeatureExpansionService } from "./services/feature/FeatureExpansionService";
import { FeaturePRDService } from "./services/feature/FeaturePRDService";
import { TaskLifecycleService } from "./services/feature/TaskLifecycleService";
import { IssueEnrichmentService } from "./services/IssueEnrichmentService";
import { IssueService } from "./services/IssueService";
import { IssueTriagingService } from "./services/IssueTriagingService";
import { IterationService } from "./services/IterationService";
import { LabelService } from "./services/LabelService";
import { MilestoneService } from "./services/MilestoneService";
import { PRDGenerationService } from "./services/PRDGenerationService";
import { ProjectAutomationService } from "./services/ProjectAutomationService";
import { ProjectLinkingService } from "./services/ProjectLinkingService";
import { ProjectManagementService } from "./services/ProjectManagementService";
import { ProjectStatusService } from "./services/ProjectStatusService";
import { ProjectTemplateService } from "./services/ProjectTemplateService";
import { PullRequestService } from "./services/PullRequestService";
import { RoadmapPlanningService } from "./services/RoadmapPlanningService";
import { RoadmapService } from "./services/RoadmapService";
import { SprintPlanningService } from "./services/SprintPlanningService";
import { SubIssueService } from "./services/SubIssueService";
import { TaskContextGenerationService } from "./services/TaskContextGenerationService";
import { TaskGenerationService } from "./services/TaskGenerationService";

/**
 * Configure the DI container with all services.
 *
 * This function sets up the dependency graph:
 * - GitHubRepositoryFactory is the root dependency (instance)
 * - Extracted services depend on the factory
 * - ProjectManagementService (facade) depends on all extracted services
 *
 * @param auth - Resolved GitHub credential
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Configured dependency container
 */
export function configureContainer(
  auth: GitHubAuth,
  owner: string,
  repo: string
): DependencyContainer {
  // Clear any previous registrations to ensure clean state
  container.clearInstances();

  // Route domain event handler failures through the redacting logger.
  domainEventBus.setErrorReporter((message, error) => logger.error(message, error));

  // Register factory instance - root of dependency tree
  const factory = GitHubRepositoryFactory.fromAuth(auth, owner, repo);
  container.registerInstance("GitHubRepositoryFactory", factory);

  // Register Logger as ILogger for dependency injection
  container.registerInstance<ILogger>("ILogger", logger);

  // Register extracted services with factory resolution
  // Services that don't use @injectable/@inject decorators need useFactory
  container.register("SubIssueService", {
    useFactory: (c) => new SubIssueService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("MilestoneService", {
    useFactory: (c) => new MilestoneService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("SprintPlanningService", {
    useFactory: (c) => new SprintPlanningService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("ProjectStatusService", {
    useFactory: (c) => new ProjectStatusService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("ProjectTemplateService", {
    useFactory: (c) => new ProjectTemplateService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("ProjectLinkingService", {
    useFactory: (c) => new ProjectLinkingService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("IssueService", {
    useFactory: (c) => new IssueService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("RoadmapService", {
    useFactory: (c) => new RoadmapService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("ProjectAutomationService", {
    useFactory: (c) => {
      const f = c.resolve<GitHubRepositoryFactory>("GitHubRepositoryFactory");
      return new ProjectAutomationService(
        f.createProjectWorkflowRepository(),
        f.createProjectRepository(),
        c.resolve<ILogger>("ILogger")
      );
    },
  });

  container.register("PullRequestService", {
    useFactory: (c) => new PullRequestService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("FieldValueService", {
    useFactory: (c) => new FieldValueService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("LabelService", {
    useFactory: (c) => new LabelService(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("IterationService", {
    useFactory: (c) =>
      new IterationService(
        c.resolve("FieldValueService"),
        c.resolve("ProjectTemplateService"),
        c.resolve("ProjectLinkingService")
      ),
  });

  // Register facade - depends on all extracted services
  container.register("ProjectManagementService", {
    useFactory: (c) =>
      new ProjectManagementService(
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
      ),
  });

  // Register AI services
  // AIServiceFactory is a singleton — register the existing instance
  container.registerInstance("AIServiceFactory", AIServiceFactory.getInstance(logger));

  container.register("RoadmapPlanningService", {
    useFactory: (c) =>
      new RoadmapPlanningService(
        c.resolve("AIServiceFactory"),
        c.resolve("ProjectManagementService"),
        c.resolve<ILogger>("ILogger")
      ),
  });

  container.register("IssueEnrichmentService", {
    useFactory: (c) =>
      new IssueEnrichmentService(
        c.resolve("AIServiceFactory"),
        c.resolve("ProjectManagementService"),
        c.resolve<ILogger>("ILogger")
      ),
  });

  container.register("IssueTriagingService", {
    useFactory: (c) =>
      new IssueTriagingService(
        c.resolve("AIServiceFactory"),
        c.resolve("ProjectManagementService"),
        c.resolve<ILogger>("ILogger")
      ),
  });

  // Register AI task-generation pipeline services
  // These now accept AIServiceFactory via constructor for proper DI.
  container.register("PRDGenerationService", {
    useFactory: (c) => new PRDGenerationService(c.resolve("AIServiceFactory")),
  });

  container.register("TaskContextGenerationService", {
    useFactory: (c) =>
      new TaskContextGenerationService(
        c.resolve("AIServiceFactory"),
        c.resolve<ILogger>("ILogger")
      ),
  });

  container.register("TaskGenerationService", {
    useFactory: (c) =>
      new TaskGenerationService(c.resolve("AIServiceFactory"), c.resolve<ILogger>("ILogger")),
  });

  // Register feature management sub-services (SRP decomposition)
  container.register("FeatureAnalysisService", {
    useFactory: (c) =>
      new FeatureAnalysisService(c.resolve("AIServiceFactory"), c.resolve<ILogger>("ILogger")),
  });

  container.register("FeaturePRDService", {
    useFactory: (c) =>
      new FeaturePRDService(c.resolve("FeatureAnalysisService"), c.resolve<ILogger>("ILogger")),
  });

  container.register("FeatureExpansionService", {
    useFactory: (c) =>
      new FeatureExpansionService(
        c.resolve("AIServiceFactory"),
        c.resolve("TaskGenerationService"),
        c.resolve<ILogger>("ILogger")
      ),
  });

  container.register("TaskLifecycleService", {
    useFactory: (c) =>
      new TaskLifecycleService(c.resolve("AIServiceFactory"), c.resolve<ILogger>("ILogger")),
  });

  container.register("FeatureManagementService", {
    useFactory: (c) => new FeatureManagementService(c.resolve("AIServiceFactory")),
  });

  // Register agent orchestration services
  container.register("AgentStore", {
    useFactory: (c) => new AgentStore(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("WorkProductStore", {
    useFactory: (c) => new WorkProductStore(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("ProjectFieldSetup", {
    useFactory: (c) => new ProjectFieldSetup(c.resolve("GitHubRepositoryFactory")),
  });

  container.register("AgentContextService", {
    useFactory: (c) =>
      new AgentContextService(c.resolve("GitHubRepositoryFactory"), c.resolve("AIServiceFactory")),
  });

  container.register("TaskCheckoutService", {
    useFactory: (c) =>
      new TaskCheckoutService(
        c.resolve("GitHubRepositoryFactory"),
        c.resolve("AgentStore"),
        c.resolve("AgentContextService"),
        c.resolve("AIServiceFactory"),
        c.resolve("AgentBudgetService")
      ),
  });

  container.register("AgentReclaimScheduler", {
    useFactory: (c) =>
      new AgentReclaimScheduler(c.resolve("TaskCheckoutService"), {
        enabled: AGENT_RECLAIM_ENABLED,
        intervalMs: AGENT_RECLAIM_INTERVAL_MS,
        staleAfterMinutes: AGENT_STALE_AFTER_MINUTES,
      }),
  });

  container.register("WorkProductService", {
    useFactory: (c) =>
      new WorkProductService(c.resolve("GitHubRepositoryFactory"), c.resolve("WorkProductStore")),
  });

  // One ledger per process: tool executors build their services per call and
  // default to the same shared instance.
  container.register("UnpaidDebitLedger", {
    useFactory: () => UnpaidDebitLedger.shared(),
  });

  container.register("AgentBudgetService", {
    useFactory: (c) =>
      new AgentBudgetService(c.resolve("AgentStore"), c.resolve("UnpaidDebitLedger")),
  });

  container.register("AgentMetricsService", {
    useFactory: (c) =>
      new AgentMetricsService(
        c.resolve("GitHubRepositoryFactory"),
        c.resolve("AgentStore"),
        c.resolve("WorkProductStore")
      ),
  });

  // Components owned by the entry point. Singletons per configured container.
  container.register("ResourceCache", { useFactory: () => ResourceCache.getInstance() });

  container.register("FilePersistenceAdapter", {
    useFactory: instanceCachingFactory(
      () =>
        new FilePersistenceAdapter({
          cacheDirectory: CACHE_DIRECTORY,
          enableCompression: true,
          maxBackups: 5,
          atomicWrites: true,
        })
    ),
  });

  container.register("GitHubWebhookHandler", {
    useFactory: instanceCachingFactory(() => new GitHubWebhookHandler(WEBHOOK_SECRET)),
  });

  container.register("EventSubscriptionManager", {
    useFactory: instanceCachingFactory(() => new EventSubscriptionManager()),
  });

  container.register("EventStore", {
    useFactory: instanceCachingFactory(
      () =>
        new EventStore({
          storageDirectory: `${CACHE_DIRECTORY}/events`,
          enableCompression: true,
        })
    ),
  });

  container.register("GracefulShutdown", {
    useFactory: instanceCachingFactory(() => new GracefulShutdown({ logger })),
  });

  container.register("MutationAuditLog", {
    useFactory: instanceCachingFactory(() => createMutationAuditLog(auditLogConfigFromEnv())),
  });

  container.registerInstance("TelemetryConfig", telemetryConfigFromEnv());

  return container;
}

/**
 * Create a ProjectManagementService instance directly without DI container.
 *
 * This provides backward compatibility for code that instantiates the service
 * directly using owner/repo/auth parameters.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param auth - Resolved GitHub credential
 * @returns Fully wired ProjectManagementService instance
 */
export function createProjectManagementService(
  owner: string,
  repo: string,
  auth: GitHubAuth
): ProjectManagementService {
  const factory = GitHubRepositoryFactory.fromAuth(auth, owner, repo);
  const logger = Logger.getInstance();
  domainEventBus.setErrorReporter((message, error) => logger.error(message, error));
  const templateService = new ProjectTemplateService(factory);
  const linkingService = new ProjectLinkingService(factory);
  const fieldValueService = new FieldValueService(factory);
  return new ProjectManagementService(
    new SubIssueService(factory),
    new MilestoneService(factory),
    new SprintPlanningService(factory),
    new ProjectStatusService(factory),
    templateService,
    linkingService,
    new IssueService(factory),
    new RoadmapService(factory),
    new ProjectAutomationService(
      factory.createProjectWorkflowRepository(),
      factory.createProjectRepository(),
      logger
    ),
    new PullRequestService(factory),
    fieldValueService,
    new LabelService(factory),
    new IterationService(fieldValueService, templateService, linkingService)
  );
}

export { container };
