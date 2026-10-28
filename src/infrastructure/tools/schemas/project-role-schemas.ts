import { z } from "zod";

/**
 * The roles GitHub's `ProjectV2Roles` enum accepts.
 *
 * The live schema (verified 2026-10-21) defines exactly four members:
 * NONE, READER, WRITER and ADMIN. `NONE` takes the collaborator's access
 * away; the other three are the access levels a collaborator can hold.
 */
export const projectRoleSchema = z
  .enum(["ADMIN", "WRITER", "READER", "NONE"])
  .describe("The role to grant — exactly the roles GitHub's ProjectV2Roles accepts");

/**
 * A collaborator to grant a role to.
 *
 * The live `ProjectV2Collaborator` input carries a `userId` or a `teamId`
 * plus the role. The platform takes the login / slug instead and resolves
 * it to the node id the API wants, because a node id is not something a
 * caller can know.
 */
export const projectCollaboratorSchema = z
  .object({
    userLogin: z.string().optional().describe("Login of the user to grant the role to"),
    teamSlug: z.string().optional().describe("Slug of the team to grant the role to"),
    role: projectRoleSchema,
  })
  .refine((collaborator) => Boolean(collaborator.userLogin) !== Boolean(collaborator.teamSlug), {
    message: "Give either a userLogin or a teamSlug, not both",
  });

/**
 * The input of the `set_collaborators` action.
 *
 * `org` is the organization that owns the teams; it defaults to the
 * configured owner.
 */
export const setProjectCollaboratorsInputSchema = z.object({
  projectId: z.string().describe("The project to set the collaborator roles on"),
  org: z.string().optional().describe("The organization that owns the teams"),
  collaborators: z
    .array(projectCollaboratorSchema)
    .min(1)
    .describe("The collaborators to grant a role to, one entry per user or team"),
});
