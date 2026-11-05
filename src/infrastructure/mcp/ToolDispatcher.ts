import { randomUUID } from "node:crypto";
import { type CallToolResult, METHOD_NOT_FOUND, ProtocolError } from "@modelcontextprotocol/server";
import { MCPContentType } from "../../domain/mcp-types";
import {
  type AgentBudgetService,
  type BudgetDebitFailure,
  BudgetExhaustedError,
} from "../../services/agent/AgentBudgetService";
import type { ILogger } from "../logger/index";
import { traceContext } from "../observability/CorrelationContext";
import type { MutationAuditLog } from "../observability/MutationAuditLog";
import { withSpan } from "../observability/otel";
import { isAiSpendingTool } from "../tools/ai-spending-tools";
import { TOOL_SCHEMA_VERSIONS } from "../tools/compound/schema-version";
import { ToolResultFormatter } from "../tools/ToolResultFormatter";
import { ToolTelemetry } from "../tools/ToolTelemetry";
import { type ToolDefinition, ToolValidator } from "../tools/ToolValidator";
import { withBudgetDebitFailure } from "./budget-debit-meta";

/** Error code reported when a hard-stop agent budget refuses an AI tool call. */
export const BUDGET_EXHAUSTED_CODE = "BudgetExhausted";

/**
 * Actions that only read. Anything else on a tool not annotated read-only is
 * treated as state-changing, so an unrecognised action is audited rather than
 * silently skipped.
 */
const READ_ACTION = /^(get|list|search|find|check|describe|health|replay|validate|calculate)(_|$)/;

/** Argument keys that identify the target of a mutation, most specific first. */
const TARGET_KEYS = [
  "issueNumber",
  "issueId",
  "pullNumber",
  "prNumber",
  "milestoneId",
  "sprintId",
  "itemId",
  "fieldId",
  "viewId",
  "projectId",
  "agentId",
  "taskId",
  "releaseId",
  "branch",
  "name",
] as const;

type ArgBag = Record<string, unknown>;

function asArgs(args: unknown): ArgBag {
  return args !== null && typeof args === "object" ? (args as ArgBag) : {};
}

function actionOf(args: unknown): string {
  const action = asArgs(args).action;
  return typeof action === "string" ? action : "call";
}

/**
 * Whether a call changes state: false for read-only annotated tools and for
 * read-only actions of action-based (compound) tools.
 */
export function isMutatingCall(
  tool: Pick<ToolDefinition<unknown>, "annotations">,
  args: unknown
): boolean {
  if (tool.annotations?.readOnlyHint === true) {
    return false;
  }
  const action = asArgs(args).action;
  return !(typeof action === "string" && READ_ACTION.test(action));
}

/** `key:value` of the first identifying argument, or the tool name as fallback. */
function targetOf(toolName: string, args: unknown): string {
  const bag = asArgs(args);
  const repo =
    typeof bag.owner === "string" && typeof bag.repo === "string" ? `${bag.owner}/${bag.repo}` : "";
  for (const key of TARGET_KEYS) {
    const value = bag[key];
    if (typeof value === "string" || typeof value === "number") {
      return `${key}:${repo ? `${repo}#` : ""}${value}`;
    }
  }
  return repo ? `repo:${repo}` : toolName;
}

function agentIdOf(args: unknown): string | undefined {
  const agentId = asArgs(args).agentId;
  return typeof agentId === "string" ? agentId : undefined;
}

export interface ToolDispatcherDeps {
  registry: {
    getTool<T>(name: string): ToolDefinition<T> | undefined;
    execute(toolName: string, args: unknown): Promise<unknown>;
  };
  /** Resolved lazily: only agent calls ever touch the budget registry. */
  budget: () => Pick<AgentBudgetService, "assertCanSpend" | "debitMeteredWithRetry">;
  audit: MutationAuditLog;
  logger: ILogger;
}

/**
 * Runs one tool call end to end: argument validation, the budget gate for AI
 * tools, the audited execution inside a trace context and an OTel span, the
 * post-call budget debit and result shaping.
 *
 * Error contract: an unknown tool is a protocol fault and throws a
 * `ProtocolError`. Every other failure (invalid arguments, GitHub errors,
 * exhausted budget, executor errors) is returned as `{ isError: true }` so the
 * model can read it and recover.
 */
export class ToolDispatcher {
  constructor(private readonly deps: ToolDispatcherDeps) {}

  async dispatch(toolName: string, args: unknown): Promise<CallToolResult> {
    const tool = this.deps.registry.getTool<unknown>(toolName);
    if (!tool) {
      throw new ProtocolError(METHOD_NOT_FOUND, `Unknown tool: ${toolName}`);
    }

    const start = Date.now();
    const agentId = agentIdOf(args);
    const schemaVersion = Object.hasOwn(TOOL_SCHEMA_VERSIONS, toolName)
      ? TOOL_SCHEMA_VERSIONS[toolName]
      : undefined;
    // Every result, success or error, carries the tool's contract version.
    const stamp = (result: CallToolResult): CallToolResult =>
      schemaVersion ? { ...result, _meta: { ...result._meta, schemaVersion } } : result;
    return withSpan(
      `tool.${toolName}`,
      {
        "tool.name": toolName,
        "tool.action": actionOf(args),
        ...(agentId ? { "agent.id": agentId } : {}),
      },
      async () => {
        try {
          return stamp(await this.run(toolName, tool, args));
        } catch (error) {
          // A tool that is known but has no handler is still a protocol fault.
          if (error instanceof ProtocolError && error.code === METHOD_NOT_FOUND) {
            throw error;
          }
          ToolTelemetry.getInstance().recordCall(toolName, Date.now() - start, true);
          this.deps.logger.error(`Tool execution error (${toolName}):`, error);
          return stamp(
            ToolResultFormatter.formatError(ToolValidator.handleToolError(error, toolName))
          );
        }
      }
    );
  }

  private async run(
    toolName: string,
    tool: ToolDefinition<unknown>,
    args: unknown
  ): Promise<CallToolResult> {
    const start = Date.now();
    const validatedArgs = ToolValidator.validate(toolName, args, tool.schema);
    // Trace context lets AI middleware attribute server-side token spend to
    // the acting agent; `agentId` is present only on tools that declare one.
    const agentId = agentIdOf(validatedArgs);

    if (agentId && isAiSpendingTool(toolName)) {
      const refused = await this.budgetGate(agentId);
      if (refused) {
        ToolTelemetry.getInstance().recordCall(toolName, Date.now() - start, true);
        return refused;
      }
    }

    const usage = { tokens: 0 };
    const execute = () =>
      traceContext.run(
        {
          correlationId: randomUUID(),
          startTime: Date.now(),
          operation: toolName,
          agentId,
          usage,
        },
        () => this.deps.registry.execute(toolName, validatedArgs)
      );
    const result = isMutatingCall(tool, validatedArgs)
      ? await this.deps.audit.trackMutation(
          {
            tool: toolName,
            action: actionOf(validatedArgs),
            target: targetOf(toolName, validatedArgs),
            args: validatedArgs,
            actor: agentId ?? "token",
          },
          execute
        )
      : await execute();
    ToolTelemetry.getInstance().recordCall(toolName, Date.now() - start, false);

    // Debit once per tool call, not per AI call: AgentStore is GitHub-backed,
    // so every debit is a read plus a compare-and-swap commit. The debit is
    // retried once; one that still cannot be written never fails the tool call
    // that already ran - it is parked in the unpaid-debit ledger, logged and
    // reported in `_meta`.
    let budgetWarningLine: string | undefined;
    let debitFailure: BudgetDebitFailure | undefined;
    if (agentId && usage.tokens > 0) {
      const outcome = await this.deps.budget().debitMeteredWithRetry(agentId, usage.tokens);
      if (outcome.ok) {
        if (outcome.status.isWarning) {
          budgetWarningLine = `⚠️ Agent budget at ${outcome.status.usagePercent.toFixed(1)}% — consider wrapping up.`;
        }
      } else {
        debitFailure = outcome.failure;
        this.deps.logger.error(
          `Failed to debit ${outcome.failure.tokens} tokens to agent ${outcome.failure.agentId} after a retry; held as an unpaid debit: ${outcome.failure.error}`
        );
      }
    }

    const formatted = ToolResultFormatter.formatSuccess(toolName, result, {
      contentType: MCPContentType.JSON,
    });

    // structuredContent is only meaningful against a declared outputSchema —
    // emitting it without one gives clients data they cannot validate.
    const structuredContent =
      tool.outputSchema && result !== null && typeof result === "object" && !Array.isArray(result)
        ? (JSON.parse(JSON.stringify(result)) as Record<string, unknown>)
        : undefined;

    const content: Array<{ type: "text"; text: string }> = [
      { type: "text", text: formatted.output.content ?? JSON.stringify(result) },
    ];
    if (budgetWarningLine) {
      content.push({ type: "text", text: budgetWarningLine });
    }

    const response: CallToolResult = {
      content,
      ...(structuredContent ? { structuredContent } : {}),
    };
    return debitFailure ? withBudgetDebitFailure(response, debitFailure) : response;
  }

  /**
   * Refuse an AI call from an agent whose hard-stop budget is used up. Returns
   * the error result to send, or undefined to proceed. A registry that cannot
   * be read does not block the call: the post-call debit still meters it.
   */
  private async budgetGate(agentId: string): Promise<CallToolResult | undefined> {
    try {
      await this.deps.budget().assertCanSpend(agentId);
      return undefined;
    } catch (error) {
      if (!(error instanceof BudgetExhaustedError)) {
        this.deps.logger.warn(
          `Budget check failed for agent ${agentId}; proceeding: ${error instanceof Error ? error.message : String(error)}`
        );
        return undefined;
      }
      const { status } = error;
      return {
        content: [
          {
            type: "text",
            text: `${error.message} The call was rejected before any AI request was made. Raise the budget with agent_manage set_budget or wait for the budget period to reset.`,
          },
        ],
        isError: true,
        _meta: {
          error: {
            code: BUDGET_EXHAUSTED_CODE,
            agentId,
            budgetOwnerId: status.agentId,
            limit: status.totalTokens,
            used: status.usedTokens,
            remaining: status.remainingTokens,
          },
        },
      };
    }
  }
}
