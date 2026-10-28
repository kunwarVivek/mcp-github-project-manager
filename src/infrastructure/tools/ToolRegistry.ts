import { INTERNAL_ERROR, METHOD_NOT_FOUND, ProtocolError } from "@modelcontextprotocol/server";
import { z } from "zod";

/** v2 compatibility aliases (McpError -> ProtocolError, ErrorCode enum -> constants). */
const McpError = ProtocolError;
const ErrorCode = { InternalError: INTERNAL_ERROR, MethodNotFound: METHOD_NOT_FOUND } as const;

import type { ZodTypeAny } from "zod";
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
// Compound tool schemas
import {
  agentManageSchema,
  agentWorkSchema,
  aiAnalyzeSchema,
  aiGenerateSchema,
  aiPlanSchema,
  discoverToolsSchema,
  manageAutomationSchema,
  manageEventsSchema,
  manageIssuesSchema,
  manageIterationsSchema,
  manageLabelsSchema,
  manageMilestonesSchema,
  manageProjectSchema,
  managePrsSchema,
  manageSprintsSchema,
  manageStatusUpdatesSchema,
  systemSchema,
} from "./compound/compound-schemas";

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
// Branch protection compound tool schema (lives outside compound/ per convention)
import { manageBranchesSchema } from "./schemas/branch-protection-schemas";
// Releases compound tool schema (lives outside compound/ per convention)
import { manageReleasesSchema } from "./schemas/release-schemas";
// Workflows compound tool schema (lives outside compound/ per convention)
import { manageWorkflowsSchema } from "./schemas/workflow-schemas";
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
import type { ToolAnnotations, ToolDefinition } from "./ToolValidator";

/** A JSON Schema document as produced by zod's converter. */
type JsonSchema = Record<string, unknown>;

/**
 * Merge the properties of every union variant into one flat map.
 *
 * A name that several variants declare with DIFFERENT shapes is widened to the
 * union of the observed shapes (`anyOf`) instead of silently taking the first
 * one: the top level must never be stricter than the variant that actually
 * matches the call, or a valid call would be rejected before the handler runs.
 * `anyOf` of the observed shapes is a superset of each of them, so widening
 * always succeeds — a shape that cannot be represented at all is left out of
 * the top level rather than described with a lie.
 */
const mergeVariantProperties = (variants: JsonSchema[]): JsonSchema => {
  const byName = new Map<string, JsonSchema[]>();
  for (const variant of variants) {
    const properties = (variant.properties ?? {}) as Record<string, JsonSchema>;
    for (const [name, propertySchema] of Object.entries(properties)) {
      const seen = byName.get(name);
      if (seen) {
        seen.push(propertySchema);
      } else {
        byName.set(name, [propertySchema]);
      }
    }
  }

  const merged: JsonSchema = {};
  for (const [name, schemas] of byName) {
    const distinct: JsonSchema[] = [];
    for (const candidate of schemas) {
      const serialized = JSON.stringify(candidate);
      if (!distinct.some((known) => JSON.stringify(known) === serialized)) {
        distinct.push(candidate);
      }
    }

    if (distinct.length === 1) {
      merged[name] = distinct[0];
      continue;
    }

    const widened: JsonSchema = { anyOf: distinct };
    // Hoist a default only when every observed shape agrees on it, so the
    // advertised default is never a value some variant would reject.
    const defaults = distinct.map((shape) => shape.default);
    if (
      defaults.every((value) => value !== undefined) &&
      new Set(defaults.map((value) => JSON.stringify(value))).size === 1
    ) {
      widened.default = defaults[0];
    }
    merged[name] = widened;
  }

  return merged;
};

/**
 * Convert a Zod schema to JSON Schema.
 *
 * Uses zod 4's native `z.toJSONSchema()`.
 *
 * `zod-to-json-schema` silently produces an EMPTY schema for zod 4 types — it
 * returns `{ type: "object" }` with no `properties` at all rather than
 * throwing. Since the zod 3 -> 4 upgrade every tool has therefore advertised a
 * parameterless input schema, so no MCP client could discover a single tool
 * argument. The native converter emits the full schema.
 *
 * `io: "input"` matters: schemas carry `.default()`s, and the input view is
 * what a caller must satisfy (the output view marks defaulted fields required).
 * Output schemas are converted with `io: "output"` for the same reason — the
 * value the server returns does contain the defaults.
 *
 * A union (the compound tools are discriminated unions of one variant per
 * action) is published as a HYBRID: the per-action `oneOf` variants are kept,
 * so a client that understands them still gets the per-action required
 * arguments, AND every argument of every action is merged into the top-level
 * `properties`, so a client that only reads the top level (the flat shape
 * every other tool has) still sees the complete argument list. The top level
 * requires only `action`; the per-action required arguments are enforced by
 * the `oneOf` branch that matches.
 */
const toJsonSchema = (schema: ZodTypeAny, io: "input" | "output" = "input"): JsonSchema => {
  const json = z.toJSONSchema(schema as never, {
    io,
    // Inline definitions: MCP clients expect a self-contained schema per tool.
    unrepresentable: "any",
  }) as JsonSchema;

  const variants = (json.oneOf ?? json.anyOf) as JsonSchema[] | undefined;
  if (!json.type && variants?.every((variant) => variant.type === "object")) {
    const actionValues = variants
      .map((variant) => {
        const properties = variant.properties as Record<string, { const?: unknown }> | undefined;
        return properties?.action?.const;
      })
      .filter((value): value is string => typeof value === "string");

    const merged = mergeVariantProperties(variants);
    // The discriminator is published as an enum of every action, not as the
    // per-variant `const`.
    delete merged.action;

    const actionRequired = variants.some((variant) => {
      const required = variant.required as string[] | undefined;
      return Array.isArray(required) && required.includes("action");
    });

    return {
      ...json,
      type: "object",
      properties: {
        ...merged,
        ...(actionValues.length ? { action: { type: "string", enum: actionValues } } : {}),
      },
      required: actionRequired ? ["action"] : [],
    };
  }

  return json;
};

/**
 * Capability groups for compound tools.
 * Control which groups are exposed via MCP_TOOL_GROUPS env var.
 */
export type CompoundToolGroup = "core" | "ai" | "agents" | "events" | "system";

/**
 * Compound tool definition — extends ToolDefinition with a capability group tag.
 */
export interface CompoundToolDef<TInput = unknown, TOutput = unknown>
  extends ToolDefinition<TInput, TOutput> {
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
      if (tool.name === "discover_tools" || this._enabledGroups.has(tool.group)) {
        tools.push(tool);
      }
    }
    return tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toJsonSchema(tool.schema),
      // The output view is the one the server's result must satisfy: the
      // value it returns carries the defaults, so they are required there.
      outputSchema: tool.outputSchema ? toJsonSchema(tool.outputSchema, "output") : undefined,
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
    const compoundTools: CompoundToolDef[] = [
      {
        name: "manage_project",
        title: "Manage Projects",
        description:
          "Manage GitHub Projects (v2): create, list, get, update, delete projects; manage readme, fields, views, items; handle templates and link to repos/teams. Use the `action` field to select the operation.",
        schema: manageProjectSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_issues",
        title: "Manage Issues",
        description:
          "Manage GitHub Issues: create, list, get, update issues; manage comments and drafts; search with advanced filters; manage sub-issues. Use the `action` field to select the operation.",
        schema: manageIssuesSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_prs",
        title: "Manage Pull Requests",
        description:
          "Manage Pull Requests: create, get, list, update, merge PRs; list and create reviews. Use the `action` field to select the operation.",
        schema: managePrsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_milestones",
        title: "Manage Milestones",
        description:
          "Manage Milestones: create, list, update, delete milestones; get metrics; find overdue and upcoming milestones. Use the `action` field to select the operation.",
        schema: manageMilestonesSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_sprints",
        title: "Manage Sprints",
        description:
          "Manage Sprints: create, list, update sprints; get current sprint; add/remove issues; get metrics and plan. Use the `action` field to select the operation.",
        schema: manageSprintsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_labels",
        title: "Manage Labels",
        description:
          "Manage repository Labels: create and list labels. Use the `action` field to select the operation.",
        schema: manageLabelsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_automation",
        title: "Manage Automation",
        description:
          "Manage Project Automations: list, get and delete the automation workflows of a GitHub project. Use the `action` field to select the operation.",
        schema: manageAutomationSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_iterations",
        title: "Manage Iterations",
        description:
          "Manage Project Iterations: get configuration, current iteration, items; find by date; assign items. Use the `action` field to select the operation.",
        schema: manageIterationsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_events",
        title: "Manage Events",
        description:
          "Manage Events: subscribe to project events, get recent events, replay events. Use the `action` field to select the operation.",
        schema: manageEventsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "events",
      },
      {
        name: "manage_status_updates",
        title: "Manage Status Updates",
        description:
          "Manage project Status Updates: create, list, and get status updates. Use the `action` field to select the operation.",
        schema: manageStatusUpdatesSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "ai_generate",
        title: "AI Generation",
        description:
          "AI-powered generation: generate/enhance/parse PRDs, add features, get next tasks, analyze complexity, expand tasks, create traceability matrices. Use the `action` field to select the operation.",
        schema: aiGenerateSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "ai",
      },
      {
        name: "ai_analyze",
        title: "AI Analysis",
        description:
          "AI-powered analysis: enrich issues (single/bulk), triage issues, schedule triaging, suggest labels, detect duplicates, find related issues. Use the `action` field to select the operation.",
        schema: aiAnalyzeSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "ai",
      },
      {
        name: "ai_plan",
        title: "AI Planning",
        description:
          "AI-powered planning: calculate capacity, prioritize backlog, assess risk, suggest sprint composition, generate roadmaps and visualizations. Use the `action` field to select the operation.",
        schema: aiPlanSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "ai",
      },
      {
        name: "agent_work",
        title: "Agent Work",
        description:
          "Agent work operations: register agents, checkout/release/complete tasks, send heartbeats, submit/check review state, validate work products, and get handoff context. Use the `action` field to select the operation.",
        schema: agentWorkSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "agents",
      },
      {
        name: "agent_manage",
        title: "Agent Management",
        description:
          "Agent management: list/deregister agents, activity, work products, budgets (warningFraction or warningThreshold), stale reclaim, smart assignment, workload rebalancing, convergence, and registry cleanup. Use the `action` field to select the operation.",
        schema: agentManageSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "agents",
      },
      {
        name: "system",
        title: "System",
        description:
          "System operations: health check and project field setup. Use the `action` field to select the operation.",
        schema: systemSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
        group: "system",
      },
      {
        name: "discover_tools",
        title: "Discover Tools",
        description:
          "Discover available compound tools, their actions, and parameters. Always available regardless of group filter.",
        schema: discoverToolsSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        group: "system",
      },
      {
        name: "manage_branches",
        title: "Manage Branches",
        description:
          "Manage GitHub Branch Protection: get, update, and delete a branch's protection rules; list repository branches. Use the `action` field to select the operation.",
        schema: manageBranchesSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_releases",
        title: "Manage Releases",
        description:
          "Manage GitHub Releases: create, list, get, update, delete releases; get the latest release. Use the `action` field to select the operation.",
        schema: manageReleasesSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
      {
        name: "manage_workflows",
        title: "Manage Workflows",
        description:
          "Manage GitHub Actions Workflows: list workflows, trigger dispatch events, inspect run status and logs, list runs, and cancel runs. Use the `action` field to select the operation.",
        schema: manageWorkflowsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        group: "core",
      },
    ];

    for (const tool of compoundTools) {
      this.registerCompoundTool(tool);
    }
  }
}
