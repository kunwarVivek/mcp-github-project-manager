/**
 * Zod schema for the manage_releases compound tool.
 *
 * Consolidates GitHub Releases operations — create, list, get, update, delete,
 * and get_latest — behind a single action-discriminated tool. Parameters from
 * every operation are merged and marked `.optional()` since they are
 * action-dependent; the compound executor validates action-specific
 * requirements (e.g. `tag_name` on create, `releaseId` on get/update/delete)
 * at dispatch time.
 */

import { z } from "zod";

export const manageReleasesSchema = z
  .object({
    action: z
      .enum(["create", "list", "get", "update", "delete", "get_latest"])
      .describe("The release operation to perform"),
    // Repository scope — falls back to the configured GITHUB_OWNER/GITHUB_REPO
    // env vars when omitted.
    owner: z.string().optional().describe("Repository owner (org or user login)"),
    repo: z.string().optional().describe("Repository name"),
    // Common — get / update / delete target an existing release by its numeric ID
    releaseId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("The release ID (required for get, update, delete)"),
    // Create / Update
    tag_name: z
      .string()
      .optional()
      .describe("The git tag the release is based on (required for create)"),
    target_commitish: z
      .string()
      .optional()
      .describe(
        "The branch name or commit SHA the git tag is created from (create only; defaults to the repository's default branch when the tag doesn't already exist)"
      ),
    name: z.string().optional().describe("The release title"),
    body: z.string().optional().describe("Text describing the release (release notes)"),
    draft: z.boolean().optional().describe("Whether to save the release as a draft (unpublished)"),
    prerelease: z.boolean().optional().describe("Whether to identify the release as a prerelease"),
    generate_release_notes: z
      .boolean()
      .optional()
      .describe(
        "Whether GitHub should automatically generate release notes for this release (create only)"
      ),
  })
  .describe(
    "Manage GitHub Releases — create, list, get, update, delete, and get the latest release"
  );

export type ManageReleasesArgs = z.infer<typeof manageReleasesSchema>;
