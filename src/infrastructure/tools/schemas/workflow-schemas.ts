/**
 * Zod schema for the `manage_workflows` compound tool — GitHub Actions
 * workflow operations (list workflows, trigger dispatch events, inspect
 * runs and logs, cancel runs).
 *
 * Follows the same flat z.object + `action` discriminator pattern as the
 * other compound schemas in `compound/compound-schemas.ts`: all parameters
 * are merged and marked `.optional()` since they are action-dependent, and
 * the executor validates action-specific requirements at dispatch time.
 */

import { z } from "zod";

export const manageWorkflowsSchema = z
  .object({
    action: z
      .enum([
        "list_workflows",
        "trigger_dispatch",
        "get_run",
        "list_runs",
        "get_run_logs",
        "cancel_run",
      ])
      .describe("The GitHub Actions workflow operation to perform"),

    // Common — repository context (defaults to configured GITHUB_OWNER/GITHUB_REPO)
    owner: z
      .string()
      .optional()
      .describe("Repository owner (defaults to the configured GITHUB_OWNER)"),
    repo: z
      .string()
      .optional()
      .describe("Repository name (defaults to the configured GITHUB_REPO)"),

    // list_workflows / list_runs — pagination
    limit: z
      .number()
      .optional()
      .describe("Results per page (list_workflows, list_runs) — maps to per_page"),
    page: z.number().optional().describe("Page number for pagination (list_workflows, list_runs)"),

    // trigger_dispatch / list_runs — identifies the workflow (numeric ID or filename, e.g. "ci.yml")
    workflowId: z
      .union([z.string(), z.number()])
      .optional()
      .describe(
        "Workflow ID or filename (e.g. 'ci.yml') — required for trigger_dispatch and list_runs"
      ),

    // trigger_dispatch — git ref to run the workflow on
    ref: z.string().optional().describe("Git branch or tag ref — required for trigger_dispatch"),

    // trigger_dispatch — workflow_dispatch input values declared by the workflow file
    inputs: z
      .record(z.string(), z.string())
      .optional()
      .describe("Input values for the workflow's `workflow_dispatch` trigger (trigger_dispatch)"),

    // get_run / get_run_logs / cancel_run
    runId: z
      .number()
      .optional()
      .describe("Workflow run ID — required for get_run, get_run_logs, cancel_run"),

    // list_runs — optional filters
    status: z
      .enum([
        "completed",
        "action_required",
        "cancelled",
        "failure",
        "neutral",
        "skipped",
        "stale",
        "success",
        "timed_out",
        "in_progress",
        "queued",
        "requested",
        "waiting",
        "pending",
      ])
      .optional()
      .describe("Filter runs by status (list_runs)"),
    branch: z.string().optional().describe("Filter runs by branch name (list_runs)"),
  })
  .describe(
    "Manage GitHub Actions Workflows — list workflows, trigger dispatch events, inspect run status and logs, list runs, and cancel runs"
  );

export type ManageWorkflowsArgs = z.infer<typeof manageWorkflowsSchema>;
