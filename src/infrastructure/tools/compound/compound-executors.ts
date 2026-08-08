/**
 * Compound tool executors that route action-based compound tool calls
 * to existing granular executors and PMS service methods.
 *
 * Each executor extracts the `action` discriminator, strips it from the
 * args, and dispatches to the underlying implementation — either a PMS
 * facade method or a standalone execute* function.
 */

import { createProjectManagementService } from '../../../container';
import { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, CACHE_DIRECTORY } from '../../../env';
import { createGitHubFactory } from '../tool-factory';
import { ProjectFieldSetup } from '../../agent/ProjectFieldSetup';
import type { ProjectManagementService } from '../../../services/ProjectManagementService';

// Standalone executors — project lifecycle & advanced
import {
  executeCloseProject,
  executeReopenProject,
  executeConvertDraftIssue,
} from '../project-lifecycle-tools';
import {
  executeUpdateItemPosition,
  executeSearchIssuesAdvanced,
  executeFilterProjectItems,
} from '../project-advanced-tools';

// Standalone executors — sub-issues
import {
  executeAddSubIssue,
  executeListSubIssues,
  executeGetParentIssue,
  executeReprioritizeSubIssue,
  executeRemoveSubIssue,
} from '../sub-issue-tools';

// Standalone executors — templates & linking
import {
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
} from '../project-template-tools';
import {
  executeLinkProjectToRepository,
  executeUnlinkProjectFromRepository,
  executeLinkProjectToTeam,
  executeUnlinkProjectFromTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
} from '../project-linking-tools';

// Standalone executors — status updates
import {
  executeCreateStatusUpdate,
  executeListStatusUpdates,
  executeGetStatusUpdate,
} from '../status-update-tools';

// Standalone executors — AI generation
import { executeGeneratePRD } from '../ai-tasks/GeneratePRDTool';
import { executeEnhancePRD } from '../ai-tasks/EnhancePRDTool';
import { executeParsePRD } from '../ai-tasks/ParsePRDTool';
import { executeAddFeature } from '../ai-tasks/AddFeatureTool';
import { executeGetNextTask } from '../ai-tasks/GetNextTaskTool';
import { executeAnalyzeTaskComplexity } from '../ai-tasks/AnalyzeTaskComplexityTool';
import { executeExpandTask } from '../ai-tasks/ExpandTaskTool';
import { executeCreateTraceabilityMatrix } from '../ai-tasks/CreateTraceabilityMatrixTool';

// Standalone executors — sprint AI
import {
  executeCalculateSprintCapacity,
  executePrioritizeBacklog,
  executeAssessSprintRisk,
  executeSuggestSprintComposition,
} from '../sprint-ai-tools';

// Standalone executors — roadmap AI
import {
  executeGenerateRoadmap,
  executeGenerateRoadmapVisualization,
} from '../roadmap-ai-tools';

// Standalone executors — issue intelligence
import {
  executeSuggestLabels,
  executeDetectDuplicates,
  executeFindRelatedIssues,
} from '../issue-intelligence-tools';

// Standalone executors — agent orchestration
import {
  executeRegisterAgent,
  executeListAgents,
  executeDeregisterAgent,
  executeCheckoutTask,
  executeReleaseTask,
  executeCompleteTask,
  executeGetTaskContext,
  executeAgentHeartbeat,
  executeSubmitWorkProduct,
  executeGetAgentActivity,
  executeGetBudgetStatus,
  executeSetAgentBudget,
  executeCheckWorkStatus,
  executeRecordUsage,
  executeGetAgentMetrics,
  executeSubmitForReview,
  executeApproveTask,
  executeRejectTask,
  executeReclaimStaleTasks,
} from '../agent-orchestration-tools';

// Standalone executors — health
import { executeHealthCheck } from '../health-tools';

// Services for server-bound handler replication (enrich/triage/events)
import { AIServiceFactory } from '../../../services/ai/AIServiceFactory';
import { IssueEnrichmentService } from '../../../services/IssueEnrichmentService';
import { IssueTriagingService } from '../../../services/IssueTriagingService';
import { EventSubscriptionManager } from '../../events/EventSubscriptionManager';
import { EventStore } from '../../events/EventStore';

// Type imports for compound args
import type {
  ManageProjectArgs,
  ManageIssuesArgs,
  ManagePrsArgs,
  ManageMilestonesArgs,
  ManageSprintsArgs,
  ManageLabelsArgs,
  ManageAutomationArgs,
  ManageIterationsArgs,
  ManageEventsArgs,
  ManageStatusUpdatesArgs,
  AiGenerateArgs,
  AiAnalyzeArgs,
  AiPlanArgs,
  AgentWorkArgs,
  AgentManageArgs,
  SystemArgs,
  DiscoverToolsArgs,
} from './compound-schemas';

// ============================================================================
// Dispatch Helpers
// ============================================================================

/**
 * Dynamic PMS facade dispatch. Each compound action maps to exactly one
 * PMS method; the switch/case structure enforces the mapping at compile time.
 *
 * Uses `as unknown as` because PMS methods are individually typed but
 * compound dispatch routes by action string — the compound schema
 * guarantees the required fields per action.
 */
function pms(
  svc: ProjectManagementService,
  method: string,
  ...args: unknown[]
): unknown {
  const target = svc as unknown as Record<string, (...a: unknown[]) => unknown>;
  return target[method](...args);
}

/**
 * Routes compound args to a granular executor function. The action
 * discriminator guarantees structural compatibility; the executor provides
 * its own runtime validation.
 */
function route<TArgs, TResult>(
  executor: (args: TArgs) => Promise<TResult>,
  args: unknown,
): Promise<TResult> {
  return executor(args as TArgs);
}

/**
 * Serialize a result to a plain JSON-safe object.
 * Domain entities have methods and non-enumerable properties that
 * JSON.stringify strips. This ensures the MCP response is a plain record.
 */
function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  // Arrays need element-wise serialization
  if (Array.isArray(value)) return value.map(toPlain) as T;
  // Already a plain object — avoid re-wrapping
  if (Object.getPrototypeOf(value) === Object.prototype) return value;
  // Entity / class instance → copy enumerable own properties
  return JSON.parse(JSON.stringify(value));
}

// ============================================================================
// Lazy Service Singletons
// ============================================================================

let _pms: ProjectManagementService | null = null;
function getPMS(): ProjectManagementService {
  if (!_pms) {
    _pms = createProjectManagementService(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
  }
  return _pms;
}

let _enrichmentService: IssueEnrichmentService | null = null;
function getEnrichmentService(): IssueEnrichmentService {
  if (!_enrichmentService) {
    _enrichmentService = new IssueEnrichmentService(
      AIServiceFactory.getInstance(),
      getPMS(),
    );
  }
  return _enrichmentService;
}

let _triagingService: IssueTriagingService | null = null;
function getTriagingService(): IssueTriagingService {
  if (!_triagingService) {
    _triagingService = new IssueTriagingService(
      AIServiceFactory.getInstance(),
      getPMS(),
      getEnrichmentService(),
    );
  }
  return _triagingService;
}

let _eventSubMgr: EventSubscriptionManager | null = null;
function getEventSubscriptionManager(): EventSubscriptionManager {
  if (!_eventSubMgr) {
    _eventSubMgr = new EventSubscriptionManager();
  }
  return _eventSubMgr;
}

let _eventStore: EventStore | null = null;
function getEventStore(): EventStore {
  if (!_eventStore) {
    _eventStore = new EventStore({
      storageDirectory: `${CACHE_DIRECTORY}/events`,
      enableCompression: true,
    });
  }
  return _eventStore;
}

// ============================================================================
// Helper
// ============================================================================

/** Throws a consistent error for unrecognised actions. */
function unknownAction(tool: string, action: string): never {
  throw new Error(`Unknown ${tool} action: ${action}`);
}

// ============================================================================
// 1. manage_project
// ============================================================================

export async function executeManageProject(args: ManageProjectArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    // ── PMS passthrough (single-object arg) — serialize entity results ─
    case 'create':        return toPlain(await pms(svc, 'createProject', rest));
    case 'update':        return toPlain(await pms(svc, 'updateProject', rest));
    case 'delete':        return toPlain(await pms(svc, 'deleteProject', rest));
    case 'get_readme':    return toPlain(await pms(svc, 'getProjectReadme', rest));
    case 'update_readme': return toPlain(await pms(svc, 'updateProjectReadme', rest));
    case 'create_field':  return toPlain(await pms(svc, 'createProjectField', rest));
    case 'list_fields':   return toPlain(await pms(svc, 'listProjectFields', rest));
    case 'update_field':  return toPlain(await pms(svc, 'updateProjectField', rest));
    case 'create_view':   return toPlain(await pms(svc, 'createProjectView', rest));
    case 'list_views':    return toPlain(await pms(svc, 'listProjectViews', rest));
    case 'update_view':   return toPlain(await pms(svc, 'updateProjectView', rest));
    case 'delete_view':   return toPlain(await pms(svc, 'deleteProjectView', rest));
    case 'add_item':      return toPlain(await pms(svc, 'addProjectItem', rest));
    case 'remove_item':   return toPlain(await pms(svc, 'removeProjectItem', rest));
    case 'list_items':    return toPlain(await pms(svc, 'listProjectItems', rest));
    case 'archive_item':  return toPlain(await pms(svc, 'archiveProjectItem', rest));
    case 'unarchive_item': return toPlain(await pms(svc, 'unarchiveProjectItem', rest));
    case 'set_field_value':   return toPlain(await pms(svc, 'setFieldValue', rest));
    case 'get_field_value':   return toPlain(await pms(svc, 'getFieldValue', rest));
    case 'clear_field_value': return toPlain(await pms(svc, 'clearFieldValue', rest));

    // ── PMS destructured ─────────────────────────────────────────
    case 'list': return toPlain(await pms(svc, 'listProjects', rest.status, rest.limit));
    case 'get':  return toPlain(await pms(svc, 'getProject', rest.projectId));

    // ── Standalone executors — lifecycle ──────────────────────────
    case 'close':  return route(executeCloseProject, rest);
    case 'reopen': return route(executeReopenProject, rest);

    // ── Standalone executors — templates ──────────────────────────
    case 'mark_as_template':   return route(executeMarkProjectAsTemplate, rest);
    case 'unmark_as_template': return route(executeUnmarkProjectAsTemplate, rest);
    case 'copy_from_template': return route(executeCopyProjectFromTemplate, rest);
    case 'list_templates':     return route(executeListOrganizationTemplates, rest);

    // ── Standalone executors — linking ────────────────────────────
    case 'link_to_repo':     return route(executeLinkProjectToRepository, rest);
    case 'unlink_from_repo': return route(executeUnlinkProjectFromRepository, rest);
    case 'link_to_team':     return route(executeLinkProjectToTeam, rest);
    case 'unlink_from_team': return route(executeUnlinkProjectFromTeam, rest);
    case 'list_linked_repos': return route(executeListLinkedRepositories, rest);
    case 'list_linked_teams': return route(executeListLinkedTeams, rest);

    // ── Standalone executors — advanced ──────────────────────────
    case 'update_item_position': return route(executeUpdateItemPosition, rest);
    case 'filter_items':         return route(executeFilterProjectItems, rest);

    // ── Agent field setup ────────────────────────────────────────
    case 'setup_agent_fields': {
      const factory = createGitHubFactory();
      const setup = new ProjectFieldSetup(factory);
      return setup.ensureFields(rest.projectId as string);
    }

    default: unknownAction('manage_project', action);
  }
}

// ============================================================================
// 2. manage_issues
// ============================================================================

export async function executeManageIssues(args: ManageIssuesArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    // ── PMS passthrough — serialize entity results ────────────────
    case 'create':         return toPlain(await pms(svc, 'createIssue', rest));
    case 'list':           return toPlain(await pms(svc, 'listIssues', rest));
    case 'create_comment': return toPlain(await pms(svc, 'createIssueComment', rest));
    case 'update_comment': return toPlain(await pms(svc, 'updateIssueComment', rest));
    case 'delete_comment': return toPlain(await pms(svc, 'deleteIssueComment', rest));
    case 'list_comments':  return toPlain(await pms(svc, 'listIssueComments', rest));
    case 'create_draft':   return toPlain(await pms(svc, 'createDraftIssue', rest));
    case 'update_draft':   return toPlain(await pms(svc, 'updateDraftIssue', rest));
    case 'delete_draft':   return toPlain(await pms(svc, 'deleteDraftIssue', rest));

    // ── PMS destructured ─────────────────────────────────────────
    case 'get': return toPlain(await pms(svc, 'getIssue', rest.issueId));
    case 'update': return toPlain(await pms(svc, 'updateIssue', rest.issueId, {
      title: rest.title,
      description: rest.description,
      status: rest.status,
      milestoneId: rest.milestoneId,
      assignees: rest.assignees,
      labels: rest.labels,
    }));

    // ── Standalone executors ─────────────────────────────────────
    case 'convert_draft':          return route(executeConvertDraftIssue, rest);
    case 'search_advanced':        return route(executeSearchIssuesAdvanced, rest);
    case 'add_sub_issue':          return route(executeAddSubIssue, rest);
    case 'list_sub_issues':        return route(executeListSubIssues, rest);
    case 'get_parent_issue':       return route(executeGetParentIssue, rest);
    case 'reprioritize_sub_issue': return route(executeReprioritizeSubIssue, rest);
    case 'remove_sub_issue':       return route(executeRemoveSubIssue, rest);

    default: unknownAction('manage_issues', action);
  }
}

// ============================================================================
// 3. manage_prs
// ============================================================================

export async function executeManagePrs(args: ManagePrsArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    case 'create':        return toPlain(await pms(svc, 'createPullRequest', rest));
    case 'get':           return toPlain(await pms(svc, 'getPullRequest', rest));
    case 'list':          return toPlain(await pms(svc, 'listPullRequests', rest));
    case 'update':        return toPlain(await pms(svc, 'updatePullRequest', rest));
    case 'merge':         return toPlain(await pms(svc, 'mergePullRequest', rest));
    case 'list_reviews':  return toPlain(await pms(svc, 'listPullRequestReviews', rest));
    case 'create_review': return toPlain(await pms(svc, 'createPullRequestReview', rest));
    default: unknownAction('manage_prs', action);
  }
}

// ============================================================================
// 4. manage_milestones
// ============================================================================

export async function executeManageMilestones(args: ManageMilestonesArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    // ── PMS passthrough — serialize entity results ────────────────
    case 'create': return toPlain(await pms(svc, 'createMilestone', rest));
    case 'update': return toPlain(await pms(svc, 'updateMilestone', rest));
    case 'delete': return toPlain(await pms(svc, 'deleteMilestone', rest));

    // ── PMS destructured ─────────────────────────────────────────
    case 'list':
      return toPlain(await pms(svc, 'listMilestones', rest.status, rest.sort, rest.direction));
    case 'get_metrics':
      return toPlain(await pms(svc, 'getMilestoneMetrics', rest.milestoneId, rest.includeIssues));
    case 'get_overdue':
      return toPlain(await pms(svc, 'getOverdueMilestones', rest.limit, rest.includeIssues));
    case 'get_upcoming':
      return toPlain(await pms(svc, 'getUpcomingMilestones', rest.daysAhead, rest.limit, rest.includeIssues));

    default: unknownAction('manage_milestones', action);
  }
}

// ============================================================================
// 5. manage_sprints
// ============================================================================

export async function executeManageSprints(args: ManageSprintsArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    // ── PMS passthrough — serialize entity results ────────────────
    case 'create':        return toPlain(await pms(svc, 'createSprint', rest));
    case 'update':        return toPlain(await pms(svc, 'updateSprint', rest));
    case 'add_issues':    return toPlain(await pms(svc, 'addIssuesToSprint', rest));
    case 'remove_issues': return toPlain(await pms(svc, 'removeIssuesFromSprint', rest));
    case 'plan':          return toPlain(await pms(svc, 'planSprint', rest));

    // ── PMS destructured ─────────────────────────────────────────
    case 'list':        return toPlain(await pms(svc, 'listSprints', rest.status));
    case 'get_current': return toPlain(await pms(svc, 'getCurrentSprint', rest.includeIssues));
    case 'get_metrics': return toPlain(await pms(svc, 'getSprintMetrics', rest.sprintId, rest.includeIssues));

    default: unknownAction('manage_sprints', action);
  }
}

// ============================================================================
// 6. manage_labels
// ============================================================================

export async function executeManageLabels(args: ManageLabelsArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    case 'create': return pms(svc, 'createLabel', rest);
    case 'list':   return pms(svc, 'listLabels', rest);
    default: unknownAction('manage_labels', action);
  }
}

// ============================================================================
// 7. manage_automation
// ============================================================================

export async function executeManageAutomation(args: ManageAutomationArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    case 'create_rule':  return pms(svc, 'createAutomationRule', rest);
    case 'update_rule':  return pms(svc, 'updateAutomationRule', rest);
    case 'delete_rule':  return pms(svc, 'deleteAutomationRule', rest);
    case 'get_rule':     return pms(svc, 'getAutomationRule', rest);
    case 'list_rules':   return pms(svc, 'listAutomationRules', rest);
    case 'enable_rule':  return pms(svc, 'enableAutomationRule', rest);
    case 'disable_rule': return pms(svc, 'disableAutomationRule', rest);
    default: unknownAction('manage_automation', action);
  }
}

// ============================================================================
// 8. manage_iterations
// ============================================================================

export async function executeManageIterations(args: ManageIterationsArgs): Promise<unknown> {
  const { action, ...rest } = args;
  const svc = getPMS();

  switch (action) {
    case 'get_config':    return pms(svc, 'getIterationConfiguration', rest);
    case 'get_current':   return pms(svc, 'getCurrentIteration', rest);
    case 'get_items':     return pms(svc, 'getIterationItems', rest);
    case 'get_by_date':   return pms(svc, 'getIterationByDate', rest);
    case 'assign_items':  return pms(svc, 'assignItemsToIteration', rest);
    default: unknownAction('manage_iterations', action);
  }
}

// ============================================================================
// 9. manage_events
// ============================================================================

export async function executeManageEvents(args: ManageEventsArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'subscribe': {
      const mgr = getEventSubscriptionManager();
      const subscriptionId = mgr.subscribe({
        clientId: rest.clientId as string,
        filters: (rest.filters as Array<Record<string, unknown>>) || [],
        transport: (rest.transport as 'sse' | 'webhook' | 'internal') || 'internal',
        endpoint: rest.endpoint,
        expiresAt: rest.expiresAt,
      });
      return {
        success: true,
        subscriptionId,
        message: `Subscription created successfully for client ${rest.clientId}`,
      };
    }

    case 'get_recent': {
      const store = getEventStore();
      const query: Record<string, unknown> = {};
      if (rest.resourceType) query.resourceType = rest.resourceType;
      if (rest.resourceId) query.resourceId = rest.resourceId;
      if (rest.eventType) query.eventType = rest.eventType;
      if (rest.limit) query.limit = rest.limit;
      const events = await store.getEvents(query as Parameters<typeof store.getEvents>[0]);
      return { success: true, events, count: events.length };
    }

    case 'replay': {
      const store = getEventStore();
      const query: Record<string, unknown> = {
        fromTimestamp: rest.fromTimestamp,
        limit: rest.limit ?? 1000,
      };
      if (rest.toTimestamp) query.toTimestamp = rest.toTimestamp;
      if (rest.resourceType) query.resourceType = rest.resourceType;
      if (rest.resourceId) query.resourceId = rest.resourceId;
      const events = await store.getEvents(query as Parameters<typeof store.getEvents>[0]);
      return {
        success: true,
        events,
        count: events.length,
        fromTimestamp: rest.fromTimestamp,
        toTimestamp: rest.toTimestamp,
      };
    }

    default: unknownAction('manage_events', action);
  }
}

// ============================================================================
// 10. manage_status_updates
// ============================================================================

export async function executeManageStatusUpdates(args: ManageStatusUpdatesArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'create': return route(executeCreateStatusUpdate, rest);
    case 'list':   return route(executeListStatusUpdates, rest);
    case 'get':    return route(executeGetStatusUpdate, rest);
    default: unknownAction('manage_status_updates', action);
  }
}

// ============================================================================
// 11. ai_generate
// ============================================================================

export async function executeAiGenerate(args: AiGenerateArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'generate_prd':             return route(executeGeneratePRD, rest);
    case 'enhance_prd':              return route(executeEnhancePRD, rest);
    case 'parse_prd':                return route(executeParsePRD, rest);
    case 'add_feature':              return route(executeAddFeature, rest);
    case 'get_next_task':            return route(executeGetNextTask, rest);
    case 'analyze_complexity':       return route(executeAnalyzeTaskComplexity, rest);
    case 'expand_task':              return route(executeExpandTask, rest);
    case 'create_traceability_matrix': return route(executeCreateTraceabilityMatrix, rest);
    default: unknownAction('ai_generate', action);
  }
}

// ============================================================================
// 12. ai_analyze
// ============================================================================

export async function executeAiAnalyze(args: AiAnalyzeArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    // ── Standalone executors ─────────────────────────────────────
    case 'suggest_labels':    return route(executeSuggestLabels, rest);
    case 'detect_duplicates': return route(executeDetectDuplicates, rest);
    case 'find_related':      return route(executeFindRelatedIssues, rest);

    // ── Server-bound replications ────────────────────────────────
    case 'enrich_issue': {
      const svc = getEnrichmentService();
      const enrichment = await svc.enrichIssue({
        projectId: rest.projectId as string,
        issueId: rest.issueId as string,
        issueTitle: rest.issueTitle as string,
        issueDescription: rest.issueDescription,
        projectContext: rest.projectContext,
      });
      if (rest.autoApply) {
        await svc.applyEnrichment({
          projectId: rest.projectId as string,
          issueNumber: rest.issueNumber as number,
          enrichment,
          applyLabels: true,
        });
      }
      return { success: true, enrichment };
    }

    case 'enrich_bulk': {
      const svc = getEnrichmentService();
      const pmsSvc = getPMS();
      const items = await pmsSvc.listProjectItems({
        projectId: rest.projectId as string,
        limit: 200,
      });
      const issueIds = rest.issueIds
        ?? items.map((item) => item.id);
      const enrichments = await svc.enrichIssues({
        projectId: rest.projectId as string,
        issueIds,
        projectContext: rest.projectContext,
      });
      return { success: true, enriched: enrichments.length, enrichments };
    }

    case 'triage_issue': {
      const svc = getTriagingService();
      const triage = await svc.triageIssue({
        projectId: rest.projectId as string,
        issueId: rest.issueId as string,
        issueNumber: rest.issueNumber as number,
        issueTitle: rest.issueTitle as string,
        issueDescription: rest.issueDescription,
        projectContext: rest.projectContext,
        autoApply: rest.autoApply,
      });
      return { success: true, triage };
    }

    case 'triage_all': {
      const svc = getTriagingService();
      const result = await svc.triageAllIssues({
        projectId: rest.projectId as string,
        onlyUntriaged: rest.onlyUntriaged,
        autoApply: rest.autoApply,
        projectContext: rest.projectContext,
      });
      return { success: true, triaged: result.triaged, results: result.results };
    }

    case 'schedule_triaging': {
      const svc = getTriagingService();
      const result = await svc.scheduleTriaging({
        projectId: rest.projectId as string,
        schedule: rest.schedule as 'hourly' | 'daily' | 'weekly',
        autoApply: rest.autoApply as boolean,
      });
      return { success: true, ruleId: result.ruleId, schedule: rest.schedule };
    }

    default: unknownAction('ai_analyze', action);
  }
}

// ============================================================================
// 13. ai_plan
// ============================================================================

export async function executeAiPlan(args: AiPlanArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'calculate_capacity':     return route(executeCalculateSprintCapacity, rest);
    case 'prioritize_backlog':     return route(executePrioritizeBacklog, rest);
    case 'assess_risk':            return route(executeAssessSprintRisk, rest);
    case 'suggest_composition':    return route(executeSuggestSprintComposition, rest);
    case 'generate_roadmap':       return route(executeGenerateRoadmap, rest);
    case 'generate_visualization': return route(executeGenerateRoadmapVisualization, rest);
    default: unknownAction('ai_plan', action);
  }
}

// ============================================================================
// 14. agent_work
// ============================================================================

export async function executeAgentWork(args: AgentWorkArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'register':          return route(executeRegisterAgent, rest);
    case 'checkout_task':     return route(executeCheckoutTask, rest);
    case 'release_task':      return route(executeReleaseTask, rest);
    case 'complete_task':     return route(executeCompleteTask, rest);
    case 'heartbeat':         return route(executeAgentHeartbeat, rest);
    case 'check_work_status': return route(executeCheckWorkStatus, rest);
    case 'get_task_context':  return route(executeGetTaskContext, rest);
    case 'submit_for_review': return route(executeSubmitForReview, rest);
    case 'approve_task':      return route(executeApproveTask, rest);
    case 'reject_task':       return route(executeRejectTask, rest);
    default: unknownAction('agent_work', action);
  }
}

// ============================================================================
// 15. agent_manage
// ============================================================================

export async function executeAgentManage(args: AgentManageArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'list':                return route(executeListAgents, rest);
    case 'deregister':          return route(executeDeregisterAgent, rest);
    case 'get_activity':        return route(executeGetAgentActivity, rest);
    case 'submit_work_product': return route(executeSubmitWorkProduct, rest);
    case 'get_budget':          return route(executeGetBudgetStatus, rest);
    case 'set_budget':          return route(executeSetAgentBudget, rest);
    case 'record_usage':        return route(executeRecordUsage, rest);
    case 'get_metrics':         return route(executeGetAgentMetrics, rest);
    case 'reclaim_stale':       return route(executeReclaimStaleTasks, rest);
    case 'setup_fields': {
      const factory = createGitHubFactory();
      const setup = new ProjectFieldSetup(factory);
      return setup.ensureFields(rest.projectId as string);
    }
    default: unknownAction('agent_manage', action);
  }
}

// ============================================================================
// 16. system
// ============================================================================

export async function executeSystem(args: SystemArgs): Promise<unknown> {
  const { action, ...rest } = args;

  switch (action) {
    case 'health_check':
      return executeHealthCheck();

    case 'setup_project_fields': {
      const factory = createGitHubFactory();
      const setup = new ProjectFieldSetup(factory);
      return setup.ensureFields(rest.projectId as string);
    }

    default: unknownAction('system', action);
  }
}

// ============================================================================
// 17. discover_tools (meta-tool)
// ============================================================================

/** Tool catalog keyed by domain. */
const TOOL_CATALOG: Record<string, {
  tool: string;
  actions: string[];
  description: string;
}> = {
  projects: {
    tool: 'manage_project',
    actions: [
      'create', 'list', 'get', 'update', 'delete',
      'get_readme', 'update_readme',
      'create_field', 'list_fields', 'update_field',
      'create_view', 'list_views', 'update_view', 'delete_view',
      'add_item', 'remove_item', 'list_items', 'archive_item', 'unarchive_item',
      'set_field_value', 'get_field_value', 'clear_field_value',
      'close', 'reopen',
      'mark_as_template', 'unmark_as_template', 'copy_from_template', 'list_templates',
      'link_to_repo', 'unlink_from_repo', 'link_to_team', 'unlink_from_team',
      'list_linked_repos', 'list_linked_teams',
      'update_item_position', 'filter_items', 'setup_agent_fields',
    ],
    description: 'GitHub Projects v2 management — CRUD, fields, views, items, templates, linking',
  },
  issues: {
    tool: 'manage_issues',
    actions: [
      'create', 'list', 'get', 'update',
      'create_comment', 'update_comment', 'delete_comment', 'list_comments',
      'create_draft', 'update_draft', 'delete_draft', 'convert_draft',
      'search_advanced',
      'add_sub_issue', 'list_sub_issues', 'get_parent_issue',
      'reprioritize_sub_issue', 'remove_sub_issue',
    ],
    description: 'GitHub Issues — CRUD, comments, drafts, sub-issues, advanced search',
  },
  pull_requests: {
    tool: 'manage_prs',
    actions: ['create', 'get', 'list', 'update', 'merge', 'list_reviews', 'create_review'],
    description: 'Pull requests — create, review, merge',
  },
  milestones: {
    tool: 'manage_milestones',
    actions: ['create', 'list', 'update', 'delete', 'get_metrics', 'get_overdue', 'get_upcoming'],
    description: 'Milestones — CRUD, metrics, overdue/upcoming tracking',
  },
  sprints: {
    tool: 'manage_sprints',
    actions: ['create', 'list', 'get_current', 'update', 'add_issues', 'remove_issues', 'get_metrics', 'plan'],
    description: 'Sprints — CRUD, issue assignment, metrics, AI-powered planning',
  },
  labels: {
    tool: 'manage_labels',
    actions: ['create', 'list'],
    description: 'Labels — create and list repository labels',
  },
  automation: {
    tool: 'manage_automation',
    actions: ['create_rule', 'update_rule', 'delete_rule', 'get_rule', 'list_rules', 'enable_rule', 'disable_rule'],
    description: 'Automation rules — CRUD, enable/disable project automation',
  },
  iterations: {
    tool: 'manage_iterations',
    actions: ['get_config', 'get_current', 'get_items', 'get_by_date', 'assign_items'],
    description: 'Iterations — configuration, current iteration, item assignment',
  },
  events: {
    tool: 'manage_events',
    actions: ['subscribe', 'get_recent', 'replay'],
    description: 'Event system — subscribe to webhooks, query recent events, replay history',
  },
  status_updates: {
    tool: 'manage_status_updates',
    actions: ['create', 'list', 'get'],
    description: 'Project status updates — create, list, retrieve status reports',
  },
  ai_generation: {
    tool: 'ai_generate',
    actions: [
      'generate_prd', 'enhance_prd', 'parse_prd', 'add_feature',
      'get_next_task', 'analyze_complexity', 'expand_task', 'create_traceability_matrix',
    ],
    description: 'AI-powered generation — PRDs, tasks, features, traceability matrices',
  },
  ai_analysis: {
    tool: 'ai_analyze',
    actions: [
      'enrich_issue', 'enrich_bulk', 'triage_issue', 'triage_all',
      'schedule_triaging', 'suggest_labels', 'detect_duplicates', 'find_related',
    ],
    description: 'AI-powered analysis — issue enrichment, triaging, labels, duplicates, relationships',
  },
  ai_planning: {
    tool: 'ai_plan',
    actions: [
      'calculate_capacity', 'prioritize_backlog', 'assess_risk',
      'suggest_composition', 'generate_roadmap', 'generate_visualization',
    ],
    description: 'AI-powered planning — capacity, backlog prioritization, risk, roadmaps',
  },
  agents: {
    tool: 'agent_work / agent_manage',
    actions: [
      'register', 'checkout_task', 'release_task', 'complete_task',
      'heartbeat', 'check_work_status', 'get_task_context',
      'submit_for_review', 'approve_task', 'reject_task',
      'list', 'deregister', 'get_activity', 'submit_work_product', 'get_budget', 'set_budget',
      'reclaim_stale', 'record_usage', 'get_metrics', 'setup_fields',
    ],
    description: 'Agent orchestration — task lifecycle (agent_work) and administration (agent_manage)',
  },
  system: {
    tool: 'system',
    actions: ['health_check', 'setup_project_fields'],
    description: 'System operations — health check, project field setup',
  },
};

export async function executeDiscoverTools(args: DiscoverToolsArgs): Promise<unknown> {
  const { domain, query } = args;

  if (domain) {
    const entry = TOOL_CATALOG[domain];
    if (!entry) {
      return {
        error: `Unknown domain: ${domain}`,
        available_domains: Object.keys(TOOL_CATALOG),
      };
    }
    return entry;
  }

  if (query) {
    const q = query.toLowerCase();
    const matches = Object.entries(TOOL_CATALOG).filter(
      ([, v]) =>
        v.description.toLowerCase().includes(q) ||
        v.actions.some((a) => a.includes(q)),
    );
    return Object.fromEntries(matches);
  }

  return TOOL_CATALOG;
}
