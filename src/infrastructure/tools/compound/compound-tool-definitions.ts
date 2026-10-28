import { type ZodTypeAny, z } from "zod";
import { manageBranchesSchema } from "../schemas/branch-protection-schemas";
import { manageReleasesSchema } from "../schemas/release-schemas";
import { manageWorkflowsSchema } from "../schemas/workflow-schemas";
import type { ToolAnnotations, ToolDefinition } from "../ToolValidator";
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
} from "./compound-schemas";

/**
 * The public (compound) tool surface, kept free of any executor or service
 * import so that the advertised tool list and its JSON Schemas can be produced
 * without loading the server runtime (and therefore without server
 * configuration) - e.g. by the OpenAPI generator.
 */

/** A JSON Schema document as produced by zod's converter. */
export type JsonSchema = Record<string, unknown>;

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
export const toJsonSchema = (schema: ZodTypeAny, io: "input" | "output" = "input"): JsonSchema => {
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

export const compoundToolDefinitions: CompoundToolDef[] = [
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

/** The shape of one entry of the MCP `tools/list` response. */
export interface McpToolListing {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

/** Convert a compound tool definition to its `tools/list` entry. */
export function toMcpTool(tool: CompoundToolDef): McpToolListing {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toJsonSchema(tool.schema),
    // The output view is the one the server's result must satisfy: the
    // value it returns carries the defaults, so they are required there.
    outputSchema: tool.outputSchema ? toJsonSchema(tool.outputSchema, "output") : undefined,
    annotations: tool.annotations,
  };
}
