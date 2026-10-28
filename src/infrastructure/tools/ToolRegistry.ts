import { INTERNAL_ERROR, METHOD_NOT_FOUND, ProtocolError } from "@modelcontextprotocol/server";

/** v2 compatibility aliases (McpError -> ProtocolError, ErrorCode enum -> constants). */
const McpError = ProtocolError;
const ErrorCode = { InternalError: INTERNAL_ERROR, MethodNotFound: METHOD_NOT_FOUND } as const;

// Agent orchestration tools
import {
  agentHeartbeatTool,
  approveTaskTool,
  checkoutTaskTool,
  checkWorkStatusTool,
  completeTaskTool,
  deregisterAgentTool,
  getAgentActivityTool,
  getAgentMetricsTool,
  getBudgetStatusTool,
  getTaskContextTool,
  listAgentsTool,
  reclaimStaleTasksTool,
  recordUsageTool,
  registerAgentTool,
  rejectTaskTool,
  releaseTaskTool,
  setAgentBudgetTool,
  setupAgentFieldsTool,
  submitForReviewTool,
  submitWorkProductTool,
} from "./agent-orchestration-tools";
import {
  type CompoundToolDef,
  compoundToolDefinitions,
  type McpToolListing,
  toMcpTool,
} from "./compound/compound-tool-definitions";
// Health check tool
import { healthCheckTool } from "./health-tools";
// Issue Intelligence tools (Phase 11: AI-17 to AI-20)
import {
  detectDuplicatesTool,
  enrichIssueTool as enrichIssueAITool,
  findRelatedIssuesTool,
  suggestLabelsTool,
} from "./issue-intelligence-tools";
// Advanced operations tools
import {
  filterProjectItemsTool,
  searchIssuesAdvancedTool,
  updateItemPositionTool,
} from "./project-advanced-tools";
// Project lifecycle tools
import {
  closeProjectTool,
  convertDraftIssueTool,
  reopenProjectTool,
} from "./project-lifecycle-tools";
// Project linking tools
import {
  linkProjectToRepositoryTool,
  linkProjectToTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  unlinkProjectFromRepositoryTool,
  unlinkProjectFromTeamTool,
} from "./project-linking-tools";
// Roadmap AI tools (Phase 10)
import {
  generateRoadmapTool as generateAIRoadmapTool,
  generateRoadmapVisualizationTool,
} from "./roadmap-ai-tools";
// Sprint AI tools (Phase 10)
import {
  assessSprintRiskTool,
  calculateSprintCapacityTool,
  prioritizeBacklogTool,
  suggestSprintCompositionTool,
} from "./sprint-ai-tools";
import {
  // AI task management tools
  addFeatureTool,
  addIssuesToSprintTool,
  // Project item tools
  addProjectItemTool,
  // Sub-issue management tools
  addSubIssueTool,
  analyzeTaskComplexityTool,
  archiveProjectItemTool,
  assignItemsToIterationTool,
  clearFieldValueTool,
  copyProjectFromTemplateTool,
  // Draft issue tools
  createDraftIssueTool,
  // Issue comment tools
  createIssueCommentTool,
  createIssueTool,
  // Label tools
  createLabelTool,
  createMilestoneTool,
  createProjectFieldTool,
  createProjectTool,
  createProjectViewTool,
  createPullRequestReviewTool,
  // Pull Request tools
  createPullRequestTool,
  // Original tools
  createRoadmapTool,
  createSprintTool,
  // Status update tools
  createStatusUpdateTool,
  createTraceabilityMatrixTool,
  deleteDraftIssueTool,
  deleteIssueCommentTool,
  deleteMilestoneTool,
  deleteProjectTool,
  deleteProjectViewTool,
  // Project automation workflow tools
  deleteProjectWorkflowTool,
  enhancePRDTool,
  enrichIssuesBulkTool,
  enrichIssueTool,
  expandTaskTool,
  generatePRDTool,
  // AI-powered automation tools
  generateRoadmapTool,
  getCurrentIterationTool,
  getCurrentSprintTool,
  getFieldValueTool,
  getIssueTool,
  getIterationByDateTool,
  // Iteration management tools
  getIterationConfigurationTool,
  getIterationItemsTool,
  getMilestoneMetricsTool,
  getNextTaskTool,
  getOverdueMilestonesTool,
  getParentIssueTool,
  getProjectReadmeTool,
  getProjectTool,
  // Project automation workflow tools
  getProjectWorkflowTool,
  getPullRequestTool,
  getSprintMetricsTool,
  getStatusUpdateTool,
  getUpcomingMilestonesTool,
  listIssueCommentsTool,
  listIssuesTool,
  listLabelsTool,
  listMilestonesTool,
  listOrganizationTemplatesTool,
  listProjectFieldsTool,
  listProjectItemsTool,
  listProjectsTool,
  // View tools
  listProjectViewsTool,
  // Project automation workflow tools
  listProjectWorkflowsTool,
  listPullRequestReviewsTool,
  listPullRequestsTool,
  listSprintsTool,
  listStatusUpdatesTool,
  listSubIssuesTool,
  // Project template tools
  markProjectAsTemplateTool,
  mergePullRequestTool,
  parsePRDTool,
  planSprintTool,
  removeIssuesFromSprintTool,
  removeProjectItemTool,
  removeSubIssueTool,
  reprioritizeSubIssueTool,
  // Field values tools
  setFieldValueTool,
  triageAllIssuesTool,
  triageIssueTool,
  unarchiveProjectItemTool,
  unmarkProjectAsTemplateTool,
  updateDraftIssueTool,
  updateIssueCommentTool,
  updateIssueTool,
  // Milestone tools
  updateMilestoneTool,
  updateProjectFieldTool,
  updateProjectReadmeTool,
  // New project tools
  updateProjectTool,
  updateProjectViewTool,
  updatePullRequestTool,
  // Sprint tools
  updateSprintTool,
} from "./ToolSchemas";
import type { ToolDefinition } from "./ToolValidator";

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

  private _executors: Map<string, (args: unknown) => Promise<unknown>>;

  /** Which capability groups are enabled for MCP exposure */
  private _enabledGroups: Set<string>;

  private constructor() {
    this._internalTools = new Map();
    this._publicTools = new Map();
    this._executors = new Map();

    // Parse MCP_TOOL_GROUPS env var (default: expose all groups)
    const groups = process.env.MCP_TOOL_GROUPS || "all";
    this._enabledGroups =
      groups === "all"
        ? new Set<string>(["core", "ai", "agents", "events", "system"])
        : new Set(groups.split(",").map((g) => g.trim()));

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
      process.stderr.write(
        `Compound tool '${tool.name}' is already registered and will be overwritten.\n`
      );
    }
    this._publicTools.set(tool.name, tool);
  }

  /**
   * Register an executor function for a tool by name.
   * Executors registered here take priority over ToolDefinition.execute.
   */
  public registerExecutor<TArgs>(
    toolName: string,
    executor: (args: TArgs) => Promise<unknown>
  ): void {
    // Arguments are validated against the tool's schema in `dispatchTool` before
    // they reach `execute`, so the executor's declared `TArgs` holds at call time.
    this._executors.set(toolName, executor as (args: unknown) => Promise<unknown>);
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
    throw new McpError(ErrorCode.MethodNotFound, `Tool handler not implemented: ${toolName}`);
  }

  /**
   * Get a tool by name (searches internal first, then public/compound)
   */
  public getTool<T>(name: string): ToolDefinition<T> | undefined {
    return (this._internalTools.get(name) ?? this._publicTools.get(name)) as
      | ToolDefinition<T>
      | undefined;
  }

  /**
   * Get all internal (granular) tools for internal dispatch
   */
  public getAllTools(): ToolDefinition<unknown>[] {
    return Array.from(this._internalTools.values());
  }

  /**
   * Names of every registered executor.
   *
   * An executor is only reachable through `execute(toolName)`, and the only
   * caller passes the name of a tool an MCP client called - so a registered
   * executor whose name is not a public tool name can never run. Exposing the
   * names lets a test pin that invariant instead of leaving it to be
   * re-derived by inspection.
   */
  public getExecutorNames(): string[] {
    return Array.from(this._executors.keys());
  }

  /**
   * Convert compound tools to MCP format for list_tools response.
   * Only returns tools from enabled capability groups.
   * discover_tools is always included regardless of group filter.
   */
  public getToolsForMCP(): McpToolListing[] {
    const tools: CompoundToolDef[] = [];
    for (const tool of this._publicTools.values()) {
      if (tool.name === "discover_tools" || this._enabledGroups.has(tool.group)) {
        tools.push(tool);
      }
    }
    return tools.map(toMcpTool);
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

    // Register project automation workflow tools
    this.registerTool(listProjectWorkflowsTool);
    this.registerTool(getProjectWorkflowTool);
    this.registerTool(deleteProjectWorkflowTool);

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
    // Note: enrichIssueAITool is named "enrich_issue_sections" — the
    // "enrich_issue" name belongs to the ai-automation enrichment tool
    // registered above, and the compound action ai_analyze.enrich_issue
    // routes to that implementation. Both are distinct features.
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
    this.registerTool(reclaimStaleTasksTool);
    this.registerTool(recordUsageTool);
    this.registerTool(submitForReviewTool);
    this.registerTool(approveTaskTool);
    this.registerTool(rejectTaskTool);
    this.registerTool(getAgentMetricsTool);
    this.registerTool(setupAgentFieldsTool);
  }

  /**
   * Register compound tools for MCP exposure.
   * These aggregate granular tools into domain-oriented compound tools
   * so MCP clients see ~16 tools instead of 131.
   */
  private registerCompoundTools(): void {
    for (const tool of compoundToolDefinitions) {
      this.registerCompoundTool(tool);
    }
  }
}
