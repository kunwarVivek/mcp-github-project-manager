import { describe, expect, it } from "vitest";
import { manageProjectSchema } from "../../../../infrastructure/tools/compound/compound-schemas";
import {
  projectCollaboratorSchema,
  projectRoleSchema,
  setProjectCollaboratorsInputSchema,
} from "../../../../infrastructure/tools/schemas/project-role-schemas";

/**
 * The input of the `set_collaborators` action.
 *
 * The role values are GitHub's `ProjectV2Roles` enum, verified against the
 * live schema on 2026-10-21: NONE, READER, WRITER and ADMIN - and no
 * others.
 */
describe("project role schemas", () => {
  it("accepts exactly the roles GitHub's ProjectV2Roles enum defines", () => {
    expect(projectRoleSchema.options).toEqual(["ADMIN", "WRITER", "READER", "NONE"]);

    for (const role of ["ADMIN", "WRITER", "READER", "NONE"]) {
      expect(projectRoleSchema.safeParse(role).success).toBe(true);
    }
    expect(projectRoleSchema.safeParse("MEMBER").success).toBe(false);
    expect(projectRoleSchema.safeParse("admin").success).toBe(false);
  });

  it("accepts a collaborator that names a user", () => {
    const parsed = projectCollaboratorSchema.safeParse({ userLogin: "octocat", role: "READER" });
    expect(parsed.success).toBe(true);
  });

  it("accepts a collaborator that names a team", () => {
    const parsed = projectCollaboratorSchema.safeParse({ teamSlug: "platform", role: "ADMIN" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a collaborator that names both a user and a team", () => {
    const parsed = projectCollaboratorSchema.safeParse({
      userLogin: "octocat",
      teamSlug: "platform",
      role: "READER",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a collaborator that names neither a user nor a team", () => {
    const parsed = projectCollaboratorSchema.safeParse({ role: "READER" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a collaborator without a role", () => {
    const parsed = projectCollaboratorSchema.safeParse({ userLogin: "octocat" });
    expect(parsed.success).toBe(false);
  });

  it("requires a project and at least one collaborator", () => {
    expect(
      setProjectCollaboratorsInputSchema.safeParse({
        projectId: "PVT_1",
        collaborators: [{ userLogin: "octocat", role: "READER" }],
      }).success
    ).toBe(true);
    expect(
      setProjectCollaboratorsInputSchema.safeParse({ projectId: "PVT_1", collaborators: [] })
        .success
    ).toBe(false);
    expect(
      setProjectCollaboratorsInputSchema.safeParse({
        collaborators: [{ userLogin: "octocat", role: "READER" }],
      }).success
    ).toBe(false);
  });
});

/**
 * The compound surface the action is reachable from.
 */
describe("manage_project - set_collaborators", () => {
  it("exposes the action", () => {
    const parsed = manageProjectSchema.safeParse({
      action: "set_collaborators",
      projectId: "PVT_1",
      collaborators: [{ userLogin: "octocat", role: "WRITER" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a role GitHub does not define", () => {
    const parsed = manageProjectSchema.safeParse({
      action: "set_collaborators",
      projectId: "PVT_1",
      collaborators: [{ userLogin: "octocat", role: "OWNER" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps the view read on the existing list_views action", () => {
    const parsed = manageProjectSchema.safeParse({
      action: "list_views",
      projectId: "PVT_1",
      name: "Claiming pool",
    });
    expect(parsed.success).toBe(true);
  });
});
