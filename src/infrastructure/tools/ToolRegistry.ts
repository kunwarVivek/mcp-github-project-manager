import zodToJsonSchema from "zod-to-json-schema";
import {
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ZodOptional,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodObject,
  ZodEnum,
  type ZodTypeAny,
} from "zod";
import { ToolDefinition, ToolAnnotations } from "./ToolValidator";
import {
  // Original tools
  createRoadmapTool,
  planSprintTool,
  getMilestoneMetricsTool,
  getSprintMetricsTool,
  getOverdueMilestonesTool,
  getUpcomingMilestonesTool,
  createProjectTool,
  listProjectsTool,
  getProjectTool,
  createMilestoneTool,
  listMilestonesTool,
  createIssueTool,
  listIssuesTool,
  getIssueTool,
  updateIssueTool,

  // Issue comment tools
  createIssueCommentTool,
  updateIssueCommentTool,
  deleteIssueCommentTool,
  listIssueCommentsTool,

  // Draft issue tools
  createDraftIssueTool,
  updateDraftIssueTool,
  deleteDraftIssueTool,

  // Pull Request tools
  createPullRequestTool,
  getPullRequestTool,
  listPullRequestsTool,
  updatePullRequestTool,
  mergePullRequestTool,
  listPullRequestReviewsTool,
  createPullRequestReviewTool,

  createSprintTool,
  listSprintsTool,
  getCurrentSprintTool,
  createProjectFieldTool,
  createProjectViewTool,

  // New project tools
  updateProjectTool,
  deleteProjectTool,
  getProjectReadmeTool,
  updateProjectReadmeTool,
  listProjectFieldsTool,
  updateProjectFieldTool,

  // Project item tools
  addProjectItemTool,
  removeProjectItemTool,
  listProjectItemsTool,
  archiveProjectItemTool,
  unarchiveProjectItemTool,

  // Field values tools
  setFieldValueTool,
  getFieldValueTool,
  clearFieldValueTool,

  // View tools
  listProjectViewsTool,
  updateProjectViewTool,
  deleteProjectViewTool,

  // Milestone tools
  updateMilestoneTool,
  deleteMilestoneTool,

  // Sprint tools
  updateSprintTool,
  addIssuesToSprintTool,
  removeIssuesFromSprintTool,

  // Label tools
  createLabelTool,
  listLabelsTool,

  // AI task management tools
  addFeatureTool,
  generatePRDTool,
  parsePRDTool,
  getNextTaskTool,
  analyzeTaskComplexityTool,
  expandTaskTool,
  enhancePRDTool,
  createTraceabilityMatrixTool,

  // Automation service tools
  createAutomationRuleTool,
  updateAutomationRuleTool,
  deleteAutomationRuleTool,
  getAutomationRuleTool,
  listAutomationRulesTool,
  enableAutomationRuleTool,
  disableAutomationRuleTool,

  // Iteration management tools
  getIterationConfigurationTool,
  getCurrentIterationTool,
  getIterationItemsTool,
  getIterationByDateTool,
  assignItemsToIterationTool,

  // AI-powered automation tools
  generateRoadmapTool,
  enrichIssueTool,
  enrichIssuesBulkTool,
  triageIssueTool,
  triageAllIssuesTool,
  scheduleTriagingTool,

  // Status update tools
  createStatusUpdateTool,
  listStatusUpdatesTool,
  getStatusUpdateTool,

  // Sub-issue management tools
  addSubIssueTool,
  listSubIssuesTool,
  getParentIssueTool,
  reprioritizeSubIssueTool,
  removeSubIssueTool,

  // Project template tools
  markProjectAsTemplateTool,
  unmarkProjectAsTemplateTool,
  copyProjectFromTemplateTool,
  listOrganizationTemplatesTool,
} from "./ToolSchemas";

// Sub-issue tool executors
import {
  executeAddSubIssue,
  executeListSubIssues,
  executeGetParentIssue,
  executeReprioritizeSubIssue,
  executeRemoveSubIssue,
} from "./sub-issue-tools";

// Health check tool
import { healthCheckTool } from "./health-tools";

// Project linking tools
import {
  linkProjectToRepositoryTool,
  unlinkProjectFromRepositoryTool,
  linkProjectToTeamTool,
  unlinkProjectFromTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  executeLinkProjectToRepository,
  executeUnlinkProjectFromRepository,
  executeLinkProjectToTeam,
  executeUnlinkProjectFromTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
} from "./project-linking-tools";

// Project lifecycle tools
import {
  closeProjectTool,
  reopenProjectTool,
  convertDraftIssueTool,
} from "./project-lifecycle-tools";

// Advanced operations tools
import {
  updateItemPositionTool,
  searchIssuesAdvancedTool,
  filterProjectItemsTool,
} from "./project-advanced-tools";

// Sprint AI tools (Phase 10)
import {
  sprintAITools,
  calculateSprintCapacityTool,
  prioritizeBacklogTool,
  assessSprintRiskTool,
  suggestSprintCompositionTool,
} from "./sprint-ai-tools";

// Roadmap AI tools (Phase 10)
import {
  roadmapAITools,
  generateRoadmapTool as generateAIRoadmapTool,
  generateRoadmapVisualizationTool,
} from "./roadmap-ai-tools";

// Issue Intelligence tools (Phase 11: AI-17 to AI-20)
import {
  enrichIssueTool as enrichIssueAITool,
  suggestLabelsTool,
  detectDuplicatesTool,
  findRelatedIssuesTool,
} from "./issue-intelligence-tools";

// Agent orchestration tools
import {
  registerAgentTool,
  listAgentsTool,
  deregisterAgentTool,
  checkoutTaskTool,
  releaseTaskTool,
  completeTaskTool,
  getTaskContextTool,
  agentHeartbeatTool,
  submitWorkProductTool,
  getAgentActivityTool,
  getBudgetStatusTool,
  setAgentBudgetTool,
  checkWorkStatusTool,
} from "./agent-orchestration-tools";

// Compound tool schemas
import {
  manageProjectSchema,
  manageIssuesSchema,
  managePrsSchema,
  manageMilestonesSchema,
  manageSprintsSchema,
  manageLabelsSchema,
  manageAutomationSchema,
  manageIterationsSchema,
  manageEventsSchema,
  manageStatusUpdatesSchema,
  aiGenerateSchema,
  aiAnalyzeSchema,
  aiPlanSchema,
  agentWorkSchema,
  agentManageSchema,
  systemSchema,
  discoverToolsSchema,
} from "./compound/compound-schemas";

/**
 * Convert a Zod schema to JSON Schema.
 *
 * `zodToJsonSchema`'s generic return type recurses infinitely when applied to a
 * broad `ZodType<unknown>` (TS2589). Binding it once to a concrete
 * `(schema: ZodTypeAny) => Record<string, unknown>` signature severs the deep
 * generic instantiation without changing runtime behavior.
 */
const zodToJson = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  options?: { $refStrategy?: string },
) => Record<string, unknown>;

const toJsonSchema = (schema: ZodTypeAny): Record<string, unknown> =>
  zodToJson(schema, { $refStrategy: "none" });

/**
 * Capability groups for compound tools.
 * Control which groups are exposed via MCP_TOOL_GROUPS env var.
 */
export type CompoundToolGroup = 'core' | 'ai' | 'agents' | 'events' | 'system';

/**
 * Compound tool definition — extends ToolDefinition with a capability group tag.
 */
export interface CompoundToolDef<TInput = unknown, TOutput = unknown> extends ToolDefinition<TInput, TOutput> {
  group: CompoundToolGroup;
}

/**
 * Central registry of all available tools.
 *
 * Internal (granular) tools live in `_internalTools` and are used for executor dispatch.
 * Public (compound) tools live in `_publicTools` and are the only tools exposed to MCP clients.
 */
export class ToolRegistry {
  private static _instance: ToolRegistry;

  /** Granular tools — internal dispatch targets, not exposed to MCP clients */
  private _internalTools: Map<string, ToolDefinition<unknown>>;

  /** Compound tools — the tools exposed to MCP clients */
  private _publicTools: Map<string, CompoundToolDef>;

  private _executors: Map<string, (args: any) => Promise<any>>;

  /** Which capability groups are enabled for MCP exposure */
  private _enabledGroups: Set<string>;

  private constructor() {
    this._internalTools = new Map();
    this._publicTools = new Map();
    this._executors = new Map();

    // Parse MCP_TOOL_GROUPS env var (default: expose all groups)
    const groups = process.env.MCP_TOOL_GROUPS || 'all';
    this._enabledGroups = groups === 'all'
      ? new Set<string>(['core', 'ai', 'agents', 'events', 'system'])
      : new Set(groups.split(',').map(g => g.trim()));

    this.registerBuiltInTools();
    this.registerCompoundTools();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ToolRegistry {
    if (!ToolRegistry._instance) {
      ToolRegistry._instance = new ToolRegistry();
    }
    return ToolRegistry._instance;
  }

  /**
   * Register a new internal (granular) tool
   */
  public registerTool<T>(tool: ToolDefinition<T>): void {
    if (this._internalTools.has(tool.name)) {
      process.stderr.write(`Tool '${tool.name}' is already registered and will be overwritten.\n`);
    }
    this._internalTools.set(tool.name, tool as ToolDefinition<unknown>);
  }

  /**
   * Register a compound tool for MCP exposure
   */
  public registerCompoundTool(tool: CompoundToolDef): void {
    if (this._publicTools.has(tool.name)) {
      process.stderr.write(`Compound tool '${tool.name}' is already registered and will be overwritten.\n`);
    }
    this._publicTools.set(tool.name, tool);
  }

  /**
   * Register an executor function for a tool by name.
   * Executors registered here take priority over ToolDefinition.execute.
   */
  public registerExecutor(toolName: string, executor: (args: any) => Promise<any>): void {
    this._executors.set(toolName, executor);
  }

  /**
   * Execute a tool by name. Dispatch priority:
   * 1. Registered executor (via registerExecutor)
   * 2. Internal ToolDefinition.execute property
   * 3. Public (compound) ToolDefinition.execute property
   * 4. Throws McpError(MethodNotFound)
   */
  public async execute(toolName: string, args: unknown): Promise<unknown> {
    const executor = this._executors.get(toolName);
    if (executor) {
      return executor(args);
    }
    const tool = this._internalTools.get(toolName) ?? this._publicTools.get(toolName);
    if (tool?.execute) {
      return tool.execute(args);
    }
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool handler not implemented: ${toolName}`,
    );
  }

  /**
   * Get a tool by name (searches internal first, then public/compound)
   */
  public getTool<T>(name: string): ToolDefinition<T> | undefined {
    return (this._internalTools.get(name) ?? this._publicTools.get(name)) as ToolDefinition<T> | undefined;
  }

  /**
   * Get all internal (granular) tools for internal dispatch
   */
  public getAllTools(): ToolDefinition<unknown>[] {
    return Array.from(this._internalTools.values());
  }

  /**
   * Convert compound tools to MCP format for list_tools response.
   * Only returns tools from enabled capability groups.
   * discover_tools is always included regardless of group filter.
   */
  public getToolsForMCP(): Array<{
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }> {
    const tools: CompoundToolDef[] = [];
    for (const tool of this._publicTools.values()) {
      if (tool.name === 'discover_tools' || this._enabledGroups.has(tool.group)) {
        tools.push(tool);
      }
    }
    return tools.map(tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toJsonSchema(tool.schema),
      outputSchema: tool.outputSchema ? toJsonSchema(tool.outputSchema) : undefined,
      annotations: tool.annotations,
    }));
  }

  /**
   * Register all built-in tools
   */
  private registerBuiltInTools(): void {
    // Register roadmap and planning tools
    this.registerTool(createRoadmapTool);
    this.registerTool(planSprintTool);
    this.registerTool(getMilestoneMetricsTool);
    this.registerTool(getSprintMetricsTool);
    this.registerTool(getOverdueMilestonesTool);
    this.registerTool(getUpcomingMilestonesTool);

    // Register project tools
    this.registerTool(createProjectTool);
    this.registerTool(listProjectsTool);
    this.registerTool(getProjectTool);
    this.registerTool(updateProjectTool);
    this.registerTool(deleteProjectTool);
    this.registerTool(getProjectReadmeTool);
    this.registerTool(updateProjectReadmeTool);

    // Register milestone tools
    this.registerTool(createMilestoneTool);
    this.registerTool(listMilestonesTool);
    this.registerTool(updateMilestoneTool);
    this.registerTool(deleteMilestoneTool);

    // Register issue tools
    this.registerTool(createIssueTool);
    this.registerTool(listIssuesTool);
    this.registerTool(getIssueTool);
    this.registerTool(updateIssueTool);

    // Register issue comment tools
    this.registerTool(createIssueCommentTool);
    this.registerTool(updateIssueCommentTool);
    this.registerTool(deleteIssueCommentTool);
    this.registerTool(listIssueCommentsTool);

    // Register draft issue tools
    this.registerTool(createDraftIssueTool);
    this.registerTool(updateDraftIssueTool);
    this.registerTool(deleteDraftIssueTool);

    // Register pull request tools
    this.registerTool(createPullRequestTool);
    this.registerTool(getPullRequestTool);
    this.registerTool(listPullRequestsTool);
    this.registerTool(updatePullRequestTool);
    this.registerTool(mergePullRequestTool);
    this.registerTool(listPullRequestReviewsTool);
    this.registerTool(createPullRequestReviewTool);

    // Register sprint tools
    this.registerTool(createSprintTool);
    this.registerTool(listSprintsTool);
    this.registerTool(getCurrentSprintTool);
    this.registerTool(updateSprintTool);
    this.registerTool(addIssuesToSprintTool);
    this.registerTool(removeIssuesFromSprintTool);

    // Register project field tools
    this.registerTool(createProjectFieldTool);
    this.registerTool(listProjectFieldsTool);
    this.registerTool(updateProjectFieldTool);

    // Register project view tools
    this.registerTool(createProjectViewTool);
    this.registerTool(listProjectViewsTool);
    this.registerTool(updateProjectViewTool);
    this.registerTool(deleteProjectViewTool);

    // Register project item tools
    this.registerTool(addProjectItemTool);
    this.registerTool(removeProjectItemTool);
    this.registerTool(listProjectItemsTool);
    this.registerTool(archiveProjectItemTool);
    this.registerTool(unarchiveProjectItemTool);

    // Register field value tools
    this.registerTool(setFieldValueTool);
    this.registerTool(getFieldValueTool);
    this.registerTool(clearFieldValueTool);

    // Register label tools
    this.registerTool(createLabelTool);
    this.registerTool(listLabelsTool);

    // Register AI task management tools
    this.registerTool(addFeatureTool);
    this.registerTool(generatePRDTool);
    this.registerTool(parsePRDTool);
    this.registerTool(getNextTaskTool);
    this.registerTool(analyzeTaskComplexityTool);
    this.registerTool(expandTaskTool);
    this.registerTool(enhancePRDTool);
    this.registerTool(createTraceabilityMatrixTool);

    // Register automation service tools
    this.registerTool(createAutomationRuleTool);
    this.registerTool(updateAutomationRuleTool);
    this.registerTool(deleteAutomationRuleTool);
    this.registerTool(getAutomationRuleTool);
    this.registerTool(listAutomationRulesTool);
    this.registerTool(enableAutomationRuleTool);
    this.registerTool(disableAutomationRuleTool);

    // Register iteration management tools
    this.registerTool(getIterationConfigurationTool);
    this.registerTool(getCurrentIterationTool);
    this.registerTool(getIterationItemsTool);
    this.registerTool(getIterationByDateTool);
    this.registerTool(assignItemsToIterationTool);

    // Register AI-powered automation tools
    this.registerTool(generateRoadmapTool);
    this.registerTool(enrichIssueTool);
    this.registerTool(enrichIssuesBulkTool);
    this.registerTool(triageIssueTool);
    this.registerTool(triageAllIssuesTool);
    this.registerTool(scheduleTriagingTool);

    // Register health check tool
    this.registerTool(healthCheckTool);

    // Register status update tools
    this.registerTool(createStatusUpdateTool);
    this.registerTool(listStatusUpdatesTool);
    this.registerTool(getStatusUpdateTool);

    // Register sub-issue management tools
    this.registerTool(addSubIssueTool);
    this.registerTool(listSubIssuesTool);
    this.registerTool(getParentIssueTool);
    this.registerTool(reprioritizeSubIssueTool);
    this.registerTool(removeSubIssueTool);

    // Register project template tools
    this.registerTool(markProjectAsTemplateTool);
    this.registerTool(unmarkProjectAsTemplateTool);
    this.registerTool(copyProjectFromTemplateTool);
    this.registerTool(listOrganizationTemplatesTool);

    // Register project linking tools
    this.registerTool(linkProjectToRepositoryTool);
    this.registerTool(unlinkProjectFromRepositoryTool);
    this.registerTool(linkProjectToTeamTool);
    this.registerTool(unlinkProjectFromTeamTool);
    this.registerTool(listLinkedRepositoriesTool);
    this.registerTool(listLinkedTeamsTool);

    // Register project lifecycle tools (Phase 8)
    this.registerTool(closeProjectTool);
    this.registerTool(reopenProjectTool);
    this.registerTool(convertDraftIssueTool);

    // Register advanced operations tools (Phase 8)
    this.registerTool(updateItemPositionTool);
    this.registerTool(searchIssuesAdvancedTool);
    this.registerTool(filterProjectItemsTool);

    // Register Sprint AI tools (Phase 10: AI-09 to AI-12)
    this.registerTool(calculateSprintCapacityTool);
    this.registerTool(prioritizeBacklogTool);
    this.registerTool(assessSprintRiskTool);
    this.registerTool(suggestSprintCompositionTool);

    // Register Roadmap AI tools (Phase 10: AI-13 to AI-16)
    this.registerTool(generateAIRoadmapTool);
    this.registerTool(generateRoadmapVisualizationTool);

    // Register Issue Intelligence tools (Phase 11: AI-17 to AI-20)
    // Note: enrichIssueAITool uses same name "enrich_issue" as ToolSchemas version
    // so it will be overwritten with the AI-powered implementation
    this.registerTool(enrichIssueAITool);
    this.registerTool(suggestLabelsTool);
    this.registerTool(detectDuplicatesTool);
    this.registerTool(findRelatedIssuesTool);

    // Register agent orchestration tools
    this.registerTool(registerAgentTool);
    this.registerTool(listAgentsTool);
    this.registerTool(deregisterAgentTool);
    this.registerTool(checkoutTaskTool);
    this.registerTool(releaseTaskTool);
    this.registerTool(completeTaskTool);
    this.registerTool(getTaskContextTool);
    this.registerTool(agentHeartbeatTool);
    this.registerTool(submitWorkProductTool);
    this.registerTool(getAgentActivityTool);
    this.registerTool(getBudgetStatusTool);
    this.registerTool(setAgentBudgetTool);
    this.registerTool(checkWorkStatusTool);
  }

  /**
   * Register compound tools for MCP exposure.
   * These aggregate granular tools into domain-oriented compound tools
   * so MCP clients see ~16 tools instead of 131.
   */
  private registerCompoundTools(): void {
    const compoundTools: CompoundToolDef[] = [
      {
        name: 'manage_project',
        title: 'Manage Projects',
        description: 'Manage GitHub Projects (v2): create, list, get, update, delete projects; manage readme, fields, views, items; handle templates and link to repos/teams. Use the `action` field to select the operation.',
        schema: manageProjectSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_issues',
        title: 'Manage Issues',
        description: 'Manage GitHub Issues: create, list, get, update issues; manage comments and drafts; search with advanced filters; manage sub-issues. Use the `action` field to select the operation.',
        schema: manageIssuesSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_prs',
        title: 'Manage Pull Requests',
        description: 'Manage Pull Requests: create, get, list, update, merge PRs; list and create reviews. Use the `action` field to select the operation.',
        schema: managePrsSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_milestones',
        title: 'Manage Milestones',
        description: 'Manage Milestones: create, list, update, delete milestones; get metrics; find overdue and upcoming milestones. Use the `action` field to select the operation.',
        schema: manageMilestonesSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_sprints',
        title: 'Manage Sprints',
        description: 'Manage Sprints: create, list, update sprints; get current sprint; add/remove issues; get metrics and plan. Use the `action` field to select the operation.',
        schema: manageSprintsSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_labels',
        title: 'Manage Labels',
        description: 'Manage repository Labels: create and list labels. Use the `action` field to select the operation.',
        schema: manageLabelsSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_automation',
        title: 'Manage Automation',
        description: 'Manage Automation Rules: create, update, delete, get, list rules; enable and disable rules. Use the `action` field to select the operation.',
        schema: manageAutomationSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_iterations',
        title: 'Manage Iterations',
        description: 'Manage Project Iterations: get configuration, current iteration, items; find by date; assign items. Use the `action` field to select the operation.',
        schema: manageIterationsSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'manage_events',
        title: 'Manage Events',
        description: 'Manage Events: subscribe to project events, get recent events, replay events. Use the `action` field to select the operation.',
        schema: manageEventsSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'events',
      },
      {
        name: 'manage_status_updates',
        title: 'Manage Status Updates',
        description: 'Manage project Status Updates: create, list, and get status updates. Use the `action` field to select the operation.',
        schema: manageStatusUpdatesSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'core',
      },
      {
        name: 'ai_generate',
        title: 'AI Generation',
        description: 'AI-powered generation: generate/enhance/parse PRDs, add features, get next tasks, analyze complexity, expand tasks, create traceability matrices. Use the `action` field to select the operation.',
        schema: aiGenerateSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'ai',
      },
      {
        name: 'ai_analyze',
        title: 'AI Analysis',
        description: 'AI-powered analysis: enrich issues (single/bulk), triage issues, schedule triaging, suggest labels, detect duplicates, find related issues. Use the `action` field to select the operation.',
        schema: aiAnalyzeSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'ai',
      },
      {
        name: 'ai_plan',
        title: 'AI Planning',
        description: 'AI-powered planning: calculate capacity, prioritize backlog, assess risk, suggest sprint composition, generate roadmaps and visualizations. Use the `action` field to select the operation.',
        schema: aiPlanSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'ai',
      },
      {
        name: 'agent_work',
        title: 'Agent Work',
        description: 'Agent work operations: register agents, checkout/release/complete tasks, send heartbeats, check work status, get task context. Use the `action` field to select the operation.',
        schema: agentWorkSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        group: 'agents',
      },
      {
        name: 'agent_manage',
        title: 'Agent Management',
        description: 'Agent management: list/deregister agents, get activity, submit work products, get/set budgets. Use the `action` field to select the operation.',
        schema: agentManageSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
        group: 'agents',
      },
      {
        name: 'system',
        title: 'System',
        description: 'System operations: health check and project field setup. Use the `action` field to select the operation.',
        schema: systemSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        group: 'system',
      },
      {
        name: 'discover_tools',
        title: 'Discover Tools',
        description: 'Discover available compound tools, their actions, and parameters. Always available regardless of group filter.',
        schema: discoverToolsSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        group: 'system',
      },
    ];

    for (const tool of compoundTools) {
      this.registerCompoundTool(tool);
    }
  }

}
