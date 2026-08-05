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
 * Central registry of all available tools
 */
export class ToolRegistry {
  private static _instance: ToolRegistry;
  private _tools: Map<string, ToolDefinition<unknown>>;
  private _executors: Map<string, (args: any) => Promise<any>>;

  private constructor() {
    this._tools = new Map();
    this._executors = new Map();
    this.registerBuiltInTools();
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
   * Register a new tool
   */
  public registerTool<T>(tool: ToolDefinition<T>): void {
    if (this._tools.has(tool.name)) {
      process.stderr.write(`Tool '${tool.name}' is already registered and will be overwritten.\n`);
    }
    this._tools.set(tool.name, tool as ToolDefinition<unknown>);
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
   * 2. ToolDefinition.execute property
   * 3. Throws McpError(MethodNotFound)
   */
  public async execute(toolName: string, args: any): Promise<any> {
    const executor = this._executors.get(toolName);
    if (executor) {
      return executor(args);
    }
    const tool = this._tools.get(toolName);
    if (tool?.execute) {
      return tool.execute(args);
    }
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool handler not implemented: ${toolName}`,
    );
  }

  /**
   * Get a tool by name
   */
  public getTool<T>(name: string): ToolDefinition<T> | undefined {
    return this._tools.get(name) as ToolDefinition<T> | undefined;
  }

  /**
   * Get all registered tools
   */
  public getAllTools(): ToolDefinition<unknown>[] {
    return Array.from(this._tools.values());
  }

  /**
   * Convert tools to MCP format for list_tools response.
   * Uses zod-to-json-schema for proper JSON Schema conversion.
   * Includes annotations and outputSchema per MCP specification 2025-11-25.
   */
  public getToolsForMCP(): Array<{
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }> {
    return this.getAllTools().map(tool => ({
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
  }

}
