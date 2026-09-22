/**
 * Zod schema for the `manage_branches` compound tool.
 *
 * Consolidates GitHub branch-protection operations (get/update/delete a
 * branch's protection rules, list a repository's branches) behind a single
 * action-based compound tool, matching the pattern used by
 * `manage_labels`/`manage_milestones` in ../compound/compound-schemas.ts.
 */

import { z } from "zod";

/** Actor allow-list for `dismissal_restrictions` / `bypass_pull_request_allowances` — all fields optional. */
const optionalActorListSchema = z.object({
  users: z.array(z.string()).optional(),
  teams: z.array(z.string()).optional(),
  apps: z.array(z.string()).optional(),
});

/**
 * Push-access allow-list for `restrictions`. Octokit's request-body type
 * requires `users`/`teams` (possibly empty arrays); only `apps` is optional.
 */
const pushRestrictionsSchema = z.object({
  users: z.array(z.string()),
  teams: z.array(z.string()),
  apps: z.array(z.string()).optional(),
});

export const manageBranchesSchema = z
  .object({
    action: z
      .enum(["get_protection", "update_protection", "delete_protection", "list_branches"])
      .describe("The branch protection operation to perform"),

    // Common
    owner: z
      .string()
      .optional()
      .describe("Repository owner (defaults to the configured GITHUB_OWNER)"),
    repo: z
      .string()
      .optional()
      .describe("Repository name (defaults to the configured GITHUB_REPO)"),
    branch: z
      .string()
      .optional()
      .describe(
        "Branch name — required for get_protection, update_protection, and delete_protection"
      ),

    // list_branches
    protected: z.boolean().optional().describe("Filter to only protected branches (list_branches)"),
    perPage: z.number().int().positive().optional().describe("Results per page (list_branches)"),
    page: z.number().int().positive().optional().describe("Page number (list_branches)"),

    // update_protection — `strict`/`contexts` are required by the Octokit
    // request-body type whenever `required_status_checks` is non-null.
    required_status_checks: z
      .object({
        strict: z.boolean(),
        contexts: z.array(z.string()),
        checks: z
          .array(z.object({ context: z.string(), app_id: z.number().optional() }))
          .optional(),
      })
      .nullable()
      .optional()
      .describe(
        "Required status checks — pass null to disable the requirement (update_protection)"
      ),
    enforce_admins: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether the restrictions also apply to repository admins (update_protection)"),
    required_pull_request_reviews: z
      .object({
        dismissal_restrictions: optionalActorListSchema.optional(),
        dismiss_stale_reviews: z.boolean().optional(),
        require_code_owner_reviews: z.boolean().optional(),
        required_approving_review_count: z.number().int().min(0).max(6).optional(),
        require_last_push_approval: z.boolean().optional(),
        bypass_pull_request_allowances: optionalActorListSchema.optional(),
      })
      .nullable()
      .optional()
      .describe(
        "Required pull request review rules — pass null to disable the requirement (update_protection)"
      ),
    restrictions: pushRestrictionsSchema
      .nullable()
      .optional()
      .describe(
        "Restrict who can push to the branch — pass null to disable restrictions (update_protection)"
      ),
    required_linear_history: z.boolean().optional(),
    allow_force_pushes: z.boolean().nullable().optional(),
    allow_deletions: z.boolean().optional(),
    block_creations: z.boolean().optional(),
    required_conversation_resolution: z.boolean().optional(),
    lock_branch: z.boolean().optional(),
    allow_fork_syncing: z.boolean().optional(),
  })
  .describe(
    "Manage GitHub Branch Protection — get, update, and delete protection rules; list repository branches"
  );

export type ManageBranchesArgs = z.infer<typeof manageBranchesSchema>;
