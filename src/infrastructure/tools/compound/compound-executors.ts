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

// PM coordination services
import { AgentStore } from '../../agent/AgentStore';
import { WorkProductStore } from '../../agent/WorkProductStore';
import { AgentBudgetService } from '../../../services/agent/AgentBudgetService';
import { AgentContextService } from '../../../services/agent/AgentContextService';
import { TaskCheckoutService } from '../../../services/agent/TaskCheckoutService';

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
    case 'create': {
      if (!rest.projectId) {
        throw new Error('projectId is required for sprint create — sprints are iteration fields on a specific GitHub project');
      }
      return toPlain(await pms(svc, 'createSprint', rest));
    }
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
    case 'materialize_tasks':          return executeMaterializeTasks(rest);
    default: unknownAction('ai_generate', action);
  }
}

/**
 * Plan and materialize generated tasks as a structured GitHub project hierarchy.
 *
 * This is the PM's core planning action — the missing bridge between
 * "parse_prd → in-memory tasks" and "agent checkout_task → claims an issue."
 *
 * 1. Analyzes task dependencies via DependencyGraph → bottom-up execution order
 * 2. Groups into phases (milestones) by dependency depth — foundations first
 * 3. Creates sprints within each phase (real GitHub iterations)
 * 4. Creates issues with progressive context + validation criteria
 * 5. Adds issues to the project so agents can claim them via checkout_task
 *
 * Each issue body carries:
 * - Progressive context: only the PRD sections relevant to THAT task
 * - Concrete deliverable: the specific task to achieve
 * - Validation criteria: how the agent proves it's done
 * - Dependencies: which prior tasks must complete first
 */
async function executeMaterializeTasks(args: {
  tasks?: Array<{
    id?: string; title: string; description: string;
    complexity?: number; estimatedHours?: number; priority?: string;
    dependencies?: Array<{ id: string; type?: string; description?: string }>;
    acceptanceCriteria?: Array<{ id?: string; description: string; completed?: boolean }>;
    tags?: string[];
  }>;
  projectId?: string;
  labelPrefix?: string;
  addToProject?: boolean;
  prdContent?: string;
}): Promise<unknown> {
  const { tasks, projectId, labelPrefix = 'ai-generated', addToProject = true, prdContent } = args;

  if (!tasks || tasks.length === 0) {
    return { created: 0, milestones: [], sprints: [], issues: [], message: 'No tasks provided' };
  }
  if (!projectId) {
    return { created: 0, message: 'projectId is required — agents can only claim issues inside a project' };
  }

  const svc = getPMS();

  // ── 1. Build dependency graph and analyze bottom-up order ─────
  const { DependencyGraph } = await import('../../../analysis/DependencyGraph');
  const graph = new DependencyGraph();
  const taskMap = new Map<string, typeof tasks[0]>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskId = task.id || `task-${i}`;
    taskMap.set(taskId, task);

    graph.addTask({
      id: taskId,
      title: task.title,
      description: task.description,
      complexity: (task.complexity || 5) as any,
      estimatedHours: task.estimatedHours || 8,
      priority: (task.priority || 'medium') as any,
      status: 'pending' as any,
      dependencies: (task.dependencies || []).map(d => ({ id: d.id, type: (d.type || 'blocks') as 'blocks' | 'depends_on' | 'related_to', description: d.description })),
      acceptanceCriteria: (task.acceptanceCriteria || []).map(ac => ({ id: ac.id || `ac-${Math.random().toString(36).slice(2, 6)}`, description: ac.description, completed: ac.completed ?? false })),
      tags: task.tags || [],
      aiGenerated: true,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const errors: Array<{ title: string; error: string }> = [];
  // Rely on caller's explicit dependencies — detectImplicitDependencies()
  // does all-pairs keyword scan that creates bidirectional edges (A→B AND B→A)
  // for keyword-overlapping tasks, producing cycles that break topsort and
  // collapse parallelGroups to []. Don't call it.
  const analysis = graph.analyze();

  // parallelGroups = bottom-up layers: [roots (no deps), ..., leaves]
  let phases: string[][];
  if (analysis.cycles.length > 0) {
    // Cycles detected — surface them instead of silently collapsing
    // Fall back to execution order chunked by dependency depth
    const allIds = Array.from(taskMap.keys());
    phases = [allIds]; // Last resort: single phase
    errors.push({
      title: 'Dependency analysis',
      error: `Circular dependencies detected: ${analysis.cycles.map(c => c.join('→')).join('; ')}. All tasks placed in a single phase.`,
    });
  } else if (analysis.parallelGroups.length > 0) {
    phases = analysis.parallelGroups;
  } else {
    phases = [Array.from(taskMap.keys())];
  }

  // ── 2. Extract PRD sections for progressive disclosure ────────
  const prdSections = prdContent ? extractPRDSections(prdContent) : null;

  const phaseNames = ['Foundation', 'Core Implementation', 'Integration', 'Polish & Testing', 'Delivery'];
  const createdMilestones: Array<{ id: string; number: number; title: string; phase: number }> = [];
  const createdSprints: Array<{ id: string; title: string; phase: number }> = [];
  const createdIssues: Array<{ id: string; number: number; title: string; phase: number; milestone: string }> = [];

  // ── 3. Create milestones, sprints, and issues per phase ───────
  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    const phaseTaskIds = phases[phaseIdx];
    const phaseName = phaseNames[phaseIdx] || `Phase ${phaseIdx + 1}`;
    const sprintStart = new Date(Date.now() + phaseIdx * 14 * 24 * 60 * 60 * 1000);
    const sprintEnd = new Date(sprintStart.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Create milestone for this phase
    let milestoneNodeId: string | undefined;
    try {
      const milestone = await svc.createMilestone({
        title: `${phaseName} — ${labelPrefix}-${Date.now().toString(36).slice(-4)}`,
        description: `Phase ${phaseIdx + 1}/${phases.length}: ${phaseTaskIds.length} task(s). ${phaseIdx > 0 ? 'Requires prior phase completion.' : 'No dependencies — start here.'}`,
        dueDate: sprintEnd.toISOString(),
      });
      milestoneNodeId = milestone.id; // GraphQL createIssue needs node ID, not number
      createdMilestones.push({ id: milestone.id, number: milestone.number, title: milestone.title, phase: phaseIdx });
    } catch (e) {
      errors.push({ title: `Milestone: ${phaseName}`, error: e instanceof Error ? e.message : String(e) });
    }

    // Create sprint (real GitHub iteration) for this phase
    let sprintId: string | undefined;
    try {
      const sprint = await svc.createSprint({
        title: `${phaseName} Sprint`,
        description: `Sprint for ${phaseName} phase`,
        startDate: sprintStart.toISOString(),
        endDate: sprintEnd.toISOString(),
        issues: [],
        projectId,
      });
      sprintId = sprint.id;
      createdSprints.push({ id: sprint.id, title: sprint.title, phase: phaseIdx });
    } catch (e) {
      errors.push({ title: `Sprint: ${phaseName}`, error: e instanceof Error ? e.message : String(e) });
    }

    // Create issues for each task in this phase
    for (const taskId of phaseTaskIds) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      try {
        // ── Build progressive-disclosure issue body ──────────
        const deps = (task.dependencies || []).map(d => {
          const depTask = taskMap.get(d.id);
          return depTask
            ? `- [ ] **${depTask.title}** must be complete (${d.type || 'blocks'})`
            : `- [ ] ${d.id} (${d.type || 'dependency'})`;
        });

        // Progressive context: extract only PRD sections relevant to this task
        const relevantContext = prdSections
          ? findRelevantPRDSections(task.title, task.description, task.tags || [], prdSections)
          : null;

        // Validation criteria from task's acceptance criteria or generated defaults
        const validationCriteria = (task.acceptanceCriteria && task.acceptanceCriteria.length > 0)
          ? task.acceptanceCriteria.map(ac => `- [ ] ${ac.description}`)
          : [
            `- [ ] Implementation matches the task description`,
            `- [ ] Unit/integration tests cover the changed functionality`,
            `- [ ] No regressions — existing tests pass`,
            `- [ ] Code reviewed and approved`,
          ];

        const issueBody = [
          `## Deliverable`,
          ``,
          task.description,
          ``,
          `## Implementation Context`,
          ``,
          `| Property | Value |`,
          `|----------|-------|`,
          `| **Phase** | ${phaseName} (${phaseIdx + 1}/${phases.length}) |`,
          `| **Complexity** | ${task.complexity || 5}/10 |`,
          `| **Estimated hours** | ${task.estimatedHours || 'TBD'} |`,
          `| **Priority** | ${task.priority || 'medium'} |`,
          deps.length > 0 ? [
            ``,
            `## Dependencies (must complete first)`,
            ``,
            ...deps,
          ].join('\n') : '',
          relevantContext ? [
            ``,
            `## Relevant PRD Context`,
            ``,
            `<details><summary>Click to expand relevant requirements</summary>`,
            ``,
            relevantContext,
            ``,
            `</details>`,
          ].join('\n') : '',
          ``,
          `## Validation Criteria`,
          ``,
          ...validationCriteria,
          ``,
          `---`,
          `*Auto-generated by PM planning — ${labelPrefix}*`,
        ].filter(line => line !== undefined).join('\n');

        const labels: string[] = [labelPrefix, `phase:${phaseIdx + 1}`];
        if (task.priority) labels.push(`priority:${task.priority}`);
        if (task.tags) labels.push(...task.tags.slice(0, 3));

        const issue = await svc.createIssue({
          title: task.title,
          description: issueBody,
          labels,
          priority: task.priority,
          milestoneId: milestoneNodeId,
        });

        // Add to project so agents can claim via checkoutTask
        try {
          await svc.addProjectItem({ projectId, contentId: issue.id, contentType: 'issue' });
        } catch (addErr) {
          errors.push({ title: task.title, error: `Issue #${issue.number} created but project-add failed: ${addErr instanceof Error ? addErr.message : String(addErr)}` });
        }

        createdIssues.push({ id: issue.id, number: issue.number, title: issue.title, phase: phaseIdx, milestone: phaseName });
      } catch (createErr) {
        errors.push({ title: task.title, error: createErr instanceof Error ? createErr.message : String(createErr) });
      }
    }

    // Assign this phase's issues to the sprint
    const phaseIssueIds = createdIssues
      .filter(i => i.phase === phaseIdx)
      .map(i => i.id);
    if (sprintId && phaseIssueIds.length > 0) {
      try {
        await svc.addIssuesToSprint({
          sprintId,
          issueIds: phaseIssueIds,
        });
      } catch (sprintErr) {
        errors.push({ title: `Sprint assignment: ${phaseName}`, error: sprintErr instanceof Error ? sprintErr.message : String(sprintErr) });
      }
    }
  }

  return {
    summary: `Created ${createdMilestones.length} milestones, ${createdSprints.length} sprints, and ${createdIssues.length} issues across ${phases.length} phases`,
    phases: phases.length,
    executionOrder: analysis.executionOrder,
    criticalPath: analysis.criticalPath,
    milestones: createdMilestones,
    sprints: createdSprints,
    issues: createdIssues,
    errors: errors.length > 0 ? errors : undefined,
    projectId,
  };
}

// ── Progressive disclosure helpers ──────────────────────────────

/** Split a PRD into titled sections for targeted extraction. */
function extractPRDSections(prd: string): Map<string, string> {
  const sections = new Map<string, string>();
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  let lastHeading = 'Overview';
  let lastIndex = 0;
  let match;

  while ((match = headingRegex.exec(prd)) !== null) {
    if (match.index > lastIndex) {
      sections.set(lastHeading, prd.slice(lastIndex, match.index).trim());
    }
    lastHeading = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < prd.length) {
    sections.set(lastHeading, prd.slice(lastIndex).trim());
  }
  return sections;
}

/** Find PRD sections relevant to a specific task via keyword overlap. */
function findRelevantPRDSections(
  title: string, description: string, tags: string[],
  sections: Map<string, string>,
): string {
  const taskWords = new Set(
    `${title} ${description} ${tags.join(' ')}`
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3)
  );

  const scored: Array<[string, string, number]> = [];
  for (const [heading, content] of sections) {
    const sectionWords = `${heading} ${content}`.toLowerCase().split(/\W+/);
    const overlap = sectionWords.filter(w => taskWords.has(w)).length;
    if (overlap > 0) {
      scored.push([heading, content, overlap]);
    }
  }

  scored.sort((a, b) => b[2] - a[2]);
  // Return top 3 most relevant sections, truncated
  return scored.slice(0, 3)
    .map(([heading, content]) => `### ${heading}\n${content.slice(0, 500)}${content.length > 500 ? '...' : ''}`)
    .join('\n\n');
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
    case 'validate_work_product': {
      const factory = createGitHubFactory();
      const wpStore = new WorkProductStore(factory);
      const issueNumber = parseInt(rest.taskId as string, 10);
      if (Number.isNaN(issueNumber)) return { valid: false, findings: ['Invalid taskId — expected issue number'] };

      // 1. Get work products for this issue
      const products = await wpStore.listForIssue(issueNumber);
      if (products.length === 0) {
        return { valid: false, findings: ['No work product submitted for this task'], recommendation: 'reject' };
      }
      const latest = products[products.length - 1];

      // 2. Get issue body for acceptance criteria
      const config = factory.getConfig();
      const octokit = factory.getOctokit();
      const { data: issue } = await octokit.rest.issues.get({ owner: config.owner, repo: config.repo, issue_number: issueNumber });

      // 3. Extract acceptance criteria from issue body
      const body = issue.body || '';
      const criteriaLines: string[] = [];
      let inCriteria = false;
      for (const line of body.split('\n')) {
        if (/acceptance\s*criteria/i.test(line)) { inCriteria = true; continue; }
        if (inCriteria && /^\s*[-*]/.test(line)) {
          criteriaLines.push(line.replace(/^\s*[-*]\s*\[.?\]\s*/, '').trim());
        } else if (inCriteria && line.trim() === '') {
          // blank line after criteria section ends it
        } else if (inCriteria && /^#/.test(line)) {
          inCriteria = false;
        }
      }

      // 4. Validate
      const findings: string[] = [];
      if (latest.filesChanged.length === 0) findings.push('No files changed in work product');
      if (!latest.testResults) findings.push('No test results attached');
      else {
        if (latest.testResults.passed === 0) findings.push('Zero tests passing');
        if (latest.testResults.failed > 0) findings.push(`${latest.testResults.failed} test(s) failing`);
      }
      if (!latest.summary || latest.summary.length < 10) findings.push('Work product summary is too brief');

      const valid = findings.length === 0;
      const recommendation = valid ? 'approve' : (latest.testResults?.failed ?? 0) > 0 ? 'reject' : 'needs_work';

      return {
        valid,
        findings,
        workProduct: {
          id: latest.id,
          files: latest.filesChanged,
          tests: latest.testResults,
          branch: latest.branch,
          summary: latest.summary,
        },
        acceptanceCriteria: criteriaLines,
        recommendation,
      };
    }
    case 'get_handoff_context': {
      // Enriched context for subtask agents — includes parent issue,
      // prior work product, rejection feedback, and subtask scope
      const factory = createGitHubFactory();
      const config = factory.getConfig();
      const octokit = factory.getOctokit();
      const wpStore = new WorkProductStore(factory);
      const issueNumber = parseInt(rest.taskId as string, 10);
      if (Number.isNaN(issueNumber)) return { error: 'Invalid taskId' };

      // 1. Get this issue
      const { data: issue } = await octokit.rest.issues.get({ owner: config.owner, repo: config.repo, issue_number: issueNumber });

      // 2. Check if this is a sub-issue — look for parent reference in body
      let parentContext = null;
      const parentMatch = issue.body?.match(/\*\*Parent task:\*\*\s*#(\d+)/);
      if (parentMatch) {
        const parentNumber = parseInt(parentMatch[1], 10);
        const { data: parent } = await octokit.rest.issues.get({ owner: config.owner, repo: config.repo, issue_number: parentNumber });

        // Get parent's work products (what was already tried)
        const parentProducts = await wpStore.listForIssue(parentNumber);
        const latestParentWP = parentProducts.length > 0 ? parentProducts[parentProducts.length - 1] : null;

        // Get rejection feedback from parent's comments
        const { data: comments } = await octokit.rest.issues.listComments({ owner: config.owner, repo: config.repo, issue_number: parentNumber, per_page: 20 });
        const rejectionComment = comments.reverse().find(c => c.body?.includes('## Agent Work Rejected'));
        const rejectionFeedback = rejectionComment?.body || null;

        parentContext = {
          issueNumber: parentNumber,
          title: parent.title,
          body: parent.body?.slice(0, 2000),
          state: parent.state,
          priorWorkProduct: latestParentWP ? {
            files: latestParentWP.filesChanged,
            tests: latestParentWP.testResults,
            branch: latestParentWP.branch,
            summary: latestParentWP.summary,
          } : null,
          rejectionFeedback,
        };
      }

      // 3. Extract acceptance criteria from this issue
      const body = issue.body || '';
      const criteria: string[] = [];
      let inCriteria = false;
      for (const line of body.split('\n')) {
        if (/acceptance\s*criteria/i.test(line)) { inCriteria = true; continue; }
        if (inCriteria && /^\s*[-*]/.test(line)) criteria.push(line.replace(/^\s*[-*]\s*\[.?\]\s*/, '').trim());
        else if (inCriteria && /^#/.test(line)) inCriteria = false;
      }

      return {
        issue: { number: issue.number, title: issue.title, body: issue.body?.slice(0, 2000), labels: issue.labels.map((l) => typeof l === 'string' ? l : l.name) },
        acceptanceCriteria: criteria,
        isSubtask: !!parentContext,
        parentContext,
      };
    }
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

    // ── PM coordination ──────────────────────────────────────────

    case 'assign_task': {
      // PM explicitly assigns a task to an agent (bypasses self-service checkout)
      const factory = createGitHubFactory();
      const store = new AgentStore(factory);
      const contextService = new AgentContextService(factory);
      const service = new TaskCheckoutService(factory, store, contextService);
      const result = await service.checkoutTask(rest.agentId as string, {
        projectId: rest.projectId,
        issueNumber: rest.issueNumber,
      });
      return result;
    }

    case 'get_swarm_status': {
      // Dashboard: all agents, their tasks, heartbeats, budgets, blocked/stale detection
      const factory = createGitHubFactory();
      const store = new AgentStore(factory);
      const budgetService = new AgentBudgetService(store);
      const agents = await store.listAgents();
      const now = Date.now();
      const staleThreshold = (rest.staleAfterMinutes as number || 30) * 60 * 1000;

      const agentStatuses = await Promise.all(agents.map(async (agent) => {
        const lastHb = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).getTime() : 0;
        const isStale = agent.status === 'working' && (now - lastHb) > staleThreshold;
        const isBlocked = agent.status === 'blocked';
        let budget;
        try { budget = await budgetService.getBudgetStatus(agent.id); } catch { /* no budget */ }

        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          currentTask: agent.currentTaskId ? { id: agent.currentTaskId, title: agent.currentTaskTitle } : null,
          lastHeartbeat: agent.lastHeartbeat,
          heartbeatAge: lastHb ? `${Math.round((now - lastHb) / 60000)}m ago` : 'never',
          isStale,
          isBlocked,
          budget: budget ? { usagePercent: budget.usagePercent, isWarning: budget.isWarning, isExhausted: budget.isExhausted } : null,
        };
      }));

      return {
        totalAgents: agents.length,
        working: agentStatuses.filter(a => a.status === 'working').length,
        idle: agentStatuses.filter(a => a.status === 'idle').length,
        blocked: agentStatuses.filter(a => a.isBlocked).length,
        stale: agentStatuses.filter(a => a.isStale).length,
        exhausted: agentStatuses.filter(a => a.budget?.isExhausted).length,
        agents: agentStatuses,
      };
    }

    case 'rebalance_workload': {
      // Reclaim stale agents + return available unclaimed tasks
      const factory = createGitHubFactory();
      const store = new AgentStore(factory);
      const contextService = new AgentContextService(factory);
      const service = new TaskCheckoutService(factory, store, contextService);

      // Reclaim stale tasks
      const result = await service.reclaimStaleTasks(rest.staleAfterMinutes as number || 30);

      return {
        reclaimed: result.reclaimed,
        reclaimedTasks: result.details,
        message: result.reclaimed > 0
          ? `Reclaimed ${result.reclaimed} task(s) from stale agents. Tasks are now available for checkout.`
          : 'No stale agents found. All active agents have recent heartbeats.',
      };
    }

    case 'smart_assign': {
      // Capability-matched, budget-aware task assignment
      // PM specifies a projectId; the system finds the best agent for each unassigned issue
      const factory = createGitHubFactory();
      const config = factory.getConfig();
      const octokit = factory.getOctokit();
      const store = new AgentStore(factory);
      const budgetService = new AgentBudgetService(store);
      const contextService = new AgentContextService(factory);
      const checkoutService = new TaskCheckoutService(factory, store, contextService);
      const projectId = rest.projectId as string;

      if (!projectId) return { success: false, message: 'projectId is required' };

      // 1. Get all agents, filtering to eligible ones only
      const agents = await store.listAgents();
      const agentIdFilter = rest.agentIds as string[] | undefined;
      const roleFilter = rest.roleFilter as string | undefined;
      const staleMs = 60 * 60 * 1000; // 1 hour
      const now = Date.now();

      const eligibleAgents = agents.filter(a => {
        if (a.status !== 'idle') return false;
        if (agentIdFilter && !agentIdFilter.includes(a.id)) return false;
        if (roleFilter && a.role !== roleFilter) return false;
        // Skip stale agents — no heartbeat in last hour means they're likely dead
        if (a.lastHeartbeat) {
          const hbAge = now - new Date(a.lastHeartbeat).getTime();
          if (hbAge > staleMs) return false;
        } else {
          // Never heartbeated — only include if registered in the last hour
          const regAge = now - new Date(a.registeredAt).getTime();
          if (regAge > staleMs) return false;
        }
        return true;
      });
      if (eligibleAgents.length === 0) return { success: false, message: 'No eligible idle agents (check agentIds, roleFilter, or agent freshness)', assignments: [] };

      // 2. Get open issues that belong to THIS project (not all repo issues)
      const projectItemsResp = await factory.graphql<{
        node: { items: { nodes: Array<{ content: { number: number; title: string; state: string; labels: { nodes: Array<{ name: string }> } } | null }> } } | null;
      }>(`query($id: ID!) { node(id: $id) { ... on ProjectV2 { items(first: 100) { nodes { content { ... on Issue { number title state labels(first: 10) { nodes { name } } } } } } } } }`, { id: projectId });
      const openIssues = (projectItemsResp.node?.items?.nodes || [])
        .map(n => n.content)
        .filter((c): c is NonNullable<typeof c> => c !== null && c.state === 'OPEN');

      // 3. For each idle agent, find the best matching unassigned issue
      const assignments: Array<{ agentId: string; agentName: string; issueNumber: number; issueTitle: string; matchScore: number; reason: string }> = [];
      const assignedIssues = new Set<number>();
      const maxAssignments = rest.maxAssignments as number || eligibleAgents.length;

      for (const agent of eligibleAgents) {
        if (assignments.length >= maxAssignments) break;

        // Check budget
        let budget;
        try { budget = await budgetService.getBudgetStatus(agent.id); } catch {}
        if (budget?.isExhausted) continue;

        // Score each open issue against this agent's capabilities
        let bestIssue: (typeof openIssues)[number] | null = null;
        let bestScore = -1;
        let bestReason = '';

        for (const issue of openIssues) {
          if (assignedIssues.has(issue.number)) continue;
          // Skip issues already assigned (have agent comments)

          const labels = issue.labels.nodes.map(l => l.name);

          // Score: capability overlap with issue labels/title
          let score = 0;
          const matchReasons: string[] = [];

          for (const cap of agent.capabilities) {
            const capLower = cap.toLowerCase();
            if (labels.some(l => l.toLowerCase().includes(capLower))) {
              score += 3;
              matchReasons.push(`label:${cap}`);
            }
            if (issue.title.toLowerCase().includes(capLower)) {
              score += 2;
              matchReasons.push(`title:${cap}`);
            }
          }

          // Role match bonus
          if (agent.role === 'engineer' && !labels.includes('review')) score += 1;
          if (agent.role === 'reviewer' && labels.includes('review')) score += 3;
          if (agent.role === 'qa' && (labels.includes('testing') || labels.includes('qa'))) score += 3;

          // Budget-aware: prefer cheaper tasks for low-budget agents
          if (budget && budget.usagePercent > 70) score -= 1;

          if (score > bestScore) {
            bestScore = score;
            bestIssue = issue;
            bestReason = matchReasons.length > 0 ? matchReasons.join(', ') : 'general assignment';
          }
        }

        if (bestIssue && bestScore > 0) {
          // Attempt assignment
          try {
            const result = await checkoutService.checkoutTask(agent.id, { projectId, issueNumber: bestIssue.number });
            if (result.success) {
              assignments.push({
                agentId: agent.id, agentName: agent.name,
                issueNumber: bestIssue.number, issueTitle: bestIssue.title,
                matchScore: bestScore, reason: bestReason,
              });
              assignedIssues.add(bestIssue.number);
            }
          } catch { /* assignment failed, skip */ }
        }
      }

      return {
        success: assignments.length > 0,
        totalAssigned: assignments.length,
        totalIdleAgents: eligibleAgents.length,
        totalOpenIssues: openIssues.length,
        assignments,
      };
    }

    case 'decompose_task': {
      // PM splits a rejected task into smaller sub-issues, links each to
      // the parent via GitHub's native sub-issue relationship, and adds
      // them to the project.
      const factory = createGitHubFactory();
      const config = factory.getConfig();
      const octokit = factory.getOctokit();
      const issueNumber = rest.issueNumber as number;
      const subtaskDefs = rest.subtasks as Array<{ title: string; description: string; acceptanceCriteria?: string }>;
      const projectId = rest.projectId as string;

      if (!issueNumber || !subtaskDefs?.length) {
        return { success: false, message: 'issueNumber and subtasks[] are required' };
      }

      // Read parent issue for context
      const { data: parent } = await octokit.rest.issues.get({ owner: config.owner, repo: config.repo, issue_number: issueNumber });

      // Create sub-issues, link each to the parent, and add to the project
      const created: Array<{ number: number; title: string; linkedAsSubIssue: boolean }> = [];
      for (const sub of subtaskDefs) {
        const body = [
          sub.description,
          '',
          `**Parent task:** #${issueNumber} — ${parent.title}`,
          '',
          sub.acceptanceCriteria ? `### Acceptance Criteria\n\n- [ ] ${sub.acceptanceCriteria}` : '',
          '',
          `---`,
          `*Decomposed from #${issueNumber} by PM after review rejection.*`,
        ].filter(l => l !== undefined).join('\n');

        const { data: newIssue } = await octokit.rest.issues.create({
          owner: config.owner,
          repo: config.repo,
          title: sub.title,
          body,
          labels: parent.labels
            .map((l) => (typeof l === 'string' ? l : l.name))
            .filter((l): l is string => Boolean(l)),
        });

        // Link as a real GitHub sub-issue of the parent (non-fatal — some
        // plans/repos don't have the sub-issues API enabled).
        let linkedAsSubIssue = false;
        try {
          await executeAddSubIssue({
            owner: config.owner,
            repo: config.repo,
            parentIssueNumber: issueNumber,
            subIssueNumber: newIssue.number,
            replaceParent: false,
          });
          linkedAsSubIssue = true;
        } catch { /* non-fatal — issue is still created and comment-linked below */ }

        created.push({ number: newIssue.number, title: newIssue.title, linkedAsSubIssue });

        // Add to project if projectId provided
        if (projectId) {
          try {
            const svc = getPMS();
            await svc.addProjectItem({ projectId, contentId: newIssue.node_id, contentType: 'issue' });
          } catch { /* non-fatal */ }
        }
      }

      // Comment on parent
      const subtaskList = created.map(s => `- #${s.number} ${s.title}`).join('\n');
      await octokit.rest.issues.createComment({
        owner: config.owner,
        repo: config.repo,
        issue_number: issueNumber,
        body: `## Task Decomposed by PM\n\nThis task has been split into ${created.length} subtask(s) after review rejection:\n\n${subtaskList}\n\n**Decomposed at:** ${new Date().toISOString()}`,
      });

      return {
        parentIssue: issueNumber,
        subtasks: created,
        summary: `Decomposed #${issueNumber} into ${created.length} subtask(s): ${created.map(s => '#' + s.number).join(', ')}`,
      };
    }

    case 'converge_project': {
      // PM drives the project toward completion in one iteration:
      // For each open issue: validate → approve/reject → decompose rejected → assign unassigned
      const factory = createGitHubFactory();
      const config = factory.getConfig();
      const octokit = factory.getOctokit();
      const wpStore = new WorkProductStore(factory);
      const store = new AgentStore(factory);
      const contextService = new AgentContextService(factory);
      const checkoutService = new TaskCheckoutService(factory, store, contextService);
      const projectId = rest.projectId as string;

      if (!projectId) return { success: false, message: 'projectId is required' };

      const report = {
        approved: [] as Array<{ issue: number; title: string }>,
        rejected: [] as Array<{ issue: number; title: string; findings: string[] }>,
        decomposed: [] as Array<{ parent: number; subtasks: number[] }>,
        assigned: [] as Array<{ issue: number; agent: string }>,
        unchanged: [] as Array<{ issue: number; title: string; reason: string }>,
      };

      // 1. Get open issues that belong to THIS project (not all repo issues)
      const projectItemsResp = await factory.graphql<{
        node: { items: { nodes: Array<{ content: { number: number; title: string; state: string; body: string; labels: { nodes: Array<{ name: string }> } } | null }> } } | null;
      }>(`query($id: ID!) { node(id: $id) { ... on ProjectV2 { items(first: 100) { nodes { content { ... on Issue { number title state body labels(first: 10) { nodes { name } } } } } } } } }`, { id: projectId });
      const openIssues = (projectItemsResp.node?.items?.nodes || [])
        .map(n => n.content)
        .filter((c): c is NonNullable<typeof c> => c !== null && c.state === 'OPEN');

      for (const issue of openIssues) {
        // Check if issue has a work product
        const products = await wpStore.listForIssue(issue.number);
        if (products.length === 0) {
          report.unchanged.push({ issue: issue.number, title: issue.title, reason: 'No work product yet' });
          continue;
        }

        const latest = products[products.length - 1];

        // Validate the work product
        const findings: string[] = [];
        if (latest.filesChanged.length === 0) findings.push('No files changed');
        if (!latest.testResults) findings.push('No test results');
        else {
          if (latest.testResults.passed === 0) findings.push('Zero tests passing');
          if (latest.testResults.failed > 0) findings.push(`${latest.testResults.failed} test(s) failing`);
        }

        if (findings.length === 0) {
          // Auto-approve: close the issue with approval comment
          await octokit.rest.issues.createComment({
            owner: config.owner, repo: config.repo, issue_number: issue.number,
            body: `## Auto-Approved by Convergence Loop\n\nAll validation checks passed.\n**Approved at:** ${new Date().toISOString()}`,
          }).catch(() => {});
          await octokit.rest.issues.update({
            owner: config.owner, repo: config.repo, issue_number: issue.number, state: 'closed',
          }).catch(() => {});
          report.approved.push({ issue: issue.number, title: issue.title });
        } else {
          // Reject with findings
          await octokit.rest.issues.createComment({
            owner: config.owner, repo: config.repo, issue_number: issue.number,
            body: `## Auto-Rejected by Convergence Loop\n\nFindings:\n${findings.map(f => '- ' + f).join('\n')}\n\n**Rejected at:** ${new Date().toISOString()}`,
          }).catch(() => {});
          report.rejected.push({ issue: issue.number, title: issue.title, findings });

          // Auto-decompose if test failures (create a fix subtask)
          if (findings.some(f => f.includes('failing'))) {
            const subtaskTitle = `Fix: ${findings.filter(f => f.includes('failing')).join(', ')} in #${issue.number}`;
            try {
              const { data: sub } = await octokit.rest.issues.create({
                owner: config.owner, repo: config.repo,
                title: subtaskTitle,
                body: `**Parent task:** #${issue.number} — ${issue.title}\n\nFix the failing tests identified in the convergence review.\n\n### Findings\n${findings.map(f => '- ' + f).join('\n')}`,
                labels: issue.labels.nodes.map(l => l.name),
              });
              report.decomposed.push({ parent: issue.number, subtasks: [sub.number] });

              // Add to project
              if (projectId) {
                try {
                  const svc = getPMS();
                  await svc.addProjectItem({ projectId, contentId: sub.node_id, contentType: 'issue' });
                } catch { /* non-fatal */ }
              }
            } catch { /* decompose failed, continue */ }
          }
        }
      }

      return {
        summary: `Convergence: ${report.approved.length} approved, ${report.rejected.length} rejected, ${report.decomposed.length} decomposed`,
        ...report,
      };
    }

    case 'cleanup_registry': {
      // Remove stale/dead agents from the registry
      const factory = createGitHubFactory();
      const store = new AgentStore(factory);
      const agents = await store.listAgents();
      const staleThreshold = (rest.staleAfterMinutes as number || 60) * 60 * 1000;
      const now = Date.now();

      const staleAgents = agents.filter(a => {
        // Keep agents that are actively working
        if (a.status === 'working') return false;
        // Remove agents that haven't heartbeated in staleThreshold
        if (a.lastHeartbeat) {
          return (now - new Date(a.lastHeartbeat).getTime()) > staleThreshold;
        }
        // No heartbeat ever — stale if registered more than staleThreshold ago
        return (now - new Date(a.registeredAt).getTime()) > staleThreshold;
      });

      const removed: Array<{ id: string; name: string; role: string; lastSeen: string }> = [];
      for (const agent of staleAgents) {
        try {
          await store.removeAgent(agent.id);
          removed.push({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            lastSeen: agent.lastHeartbeat || agent.registeredAt,
          });
        } catch { /* continue with others */ }
      }

      return {
        cleaned: removed.length,
        remaining: agents.length - removed.length,
        removed,
        summary: `Removed ${removed.length} stale agent(s), ${agents.length - removed.length} remaining`,
      };
    }

    case 'converge_until_done': {
      // Multi-iteration convergence: loop converge → smart_assign → wait for signal
      // Returns after ONE iteration with a plan for what to do next.
      // The calling agent runs this in a loop until all issues are closed.
      const factory = createGitHubFactory();
      const wpStore = new WorkProductStore(factory);
      const projectId = rest.projectId as string;
      const iteration = rest.iteration as number || 1;
      const maxIterations = rest.maxIterations as number || 10;

      if (!projectId) return { success: false, message: 'projectId is required' };
      if (iteration > maxIterations) return { done: true, reason: 'Max iterations reached', iteration };

      // Get project issues
      const projectItemsResp = await factory.graphql<{
        node: { items: { nodes: Array<{ content: { number: number; title: string; state: string } | null }> } } | null;
      }>(`query($id: ID!) { node(id: $id) { ... on ProjectV2 { items(first: 100) { nodes { content { ... on Issue { number title state } } } } } } }`, { id: projectId });

      const allItems = (projectItemsResp.node?.items?.nodes || []).map(n => n.content).filter((c): c is NonNullable<typeof c> => c !== null);
      const openIssues = allItems.filter(i => i.state === 'OPEN');
      const closedIssues = allItems.filter(i => i.state === 'CLOSED');

      if (openIssues.length === 0) {
        return {
          done: true,
          reason: 'All issues closed',
          iteration,
          summary: `Project complete: ${closedIssues.length} issues closed in ${iteration} iteration(s)`,
          closedCount: closedIssues.length,
        };
      }

      // Categorize open issues
      const withWorkProduct: Array<{ number: number; title: string; hasFailures: boolean }> = [];
      const withoutWorkProduct: Array<{ number: number; title: string }> = [];

      for (const issue of openIssues) {
        const products = await wpStore.listForIssue(issue.number);
        if (products.length > 0) {
          const latest = products[products.length - 1];
          const hasFailures = (latest.testResults?.failed ?? 0) > 0;
          withWorkProduct.push({ number: issue.number, title: issue.title, hasFailures });
        } else {
          withoutWorkProduct.push({ number: issue.number, title: issue.title });
        }
      }

      // Build the next action plan for the calling agent
      const nextActions: string[] = [];

      if (withWorkProduct.some(i => !i.hasFailures)) {
        nextActions.push(`Run converge_project to auto-approve ${withWorkProduct.filter(i => !i.hasFailures).length} passing issue(s)`);
      }
      if (withWorkProduct.some(i => i.hasFailures)) {
        nextActions.push(`Run converge_project to auto-reject ${withWorkProduct.filter(i => i.hasFailures).length} failing issue(s) and decompose fix subtasks`);
      }
      if (withoutWorkProduct.length > 0) {
        nextActions.push(`Run smart_assign to assign ${withoutWorkProduct.length} unassigned issue(s) to idle agents`);
      }
      if (nextActions.length === 0) {
        nextActions.push('All issues have work products but none are ready — wait for agents to submit updates');
      }

      return {
        done: false,
        iteration,
        maxIterations,
        progress: {
          total: allItems.length,
          closed: closedIssues.length,
          open: openIssues.length,
          withWorkProduct: withWorkProduct.length,
          withoutWorkProduct: withoutWorkProduct.length,
          passing: withWorkProduct.filter(i => !i.hasFailures).length,
          failing: withWorkProduct.filter(i => i.hasFailures).length,
        },
        nextActions,
        hint: `Call converge_until_done again with iteration=${iteration + 1} after executing the suggested actions`,
      };
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
      'materialize_tasks',
    ],
    description: 'AI-powered generation — PRDs, tasks, features, traceability, task materialization to GitHub issues',
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
      'submit_for_review', 'approve_task', 'reject_task', 'validate_work_product', 'get_handoff_context',
      'list', 'deregister', 'get_activity', 'submit_work_product', 'get_budget', 'set_budget',
      'reclaim_stale', 'record_usage', 'get_metrics', 'setup_fields',
      'assign_task', 'get_swarm_status', 'rebalance_workload', 'decompose_task', 'smart_assign', 'converge_project', 'converge_until_done', 'cleanup_registry',
    ],
    description: 'Agent orchestration — task lifecycle (agent_work), administration (agent_manage), PM coordination (assign_task, get_swarm_status, rebalance_workload)',
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
