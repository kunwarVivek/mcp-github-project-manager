import { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, type Mocked, type MockedClass, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectRepository";

vi.mock("@octokit/rest");

/**
 * The collaborators of a project.
 *
 * GitHub's `updateProjectV2Collaborators` takes the collaborators to
 * update - each with a `userId` or a `teamId` and one of the four
 * `ProjectV2Roles` roles - and answers with the project's collaborators.
 * The payload reports the actors that have access but NOT their roles:
 * `ProjectV2` has no `collaborators` field (verified against the live
 * schema on 2026-10-21) and `ProjectV2Actor` carries no role.
 */
describe("GitHubProjectRepository - project collaborators", () => {
  const USER_NODE_ID = "U_kgDOcollaborator";
  const TEAM_NODE_ID = "T_kgDOteam";
  const PROJECT_ID = "PVT_kwDOLhQ7gc4AOEbH";

  let repository: GitHubProjectRepository;
  let mockOctokit: Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit = {
      graphql: vi.fn(),
    } as unknown as Mocked<Octokit>;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit);

    config = new GitHubConfig("test-owner", "test-repo", "test-token");
    repository = new GitHubProjectRepository(mockOctokit, config);
  });

  it("sends the live collaborator input and answers with the granted roles", async () => {
    mockOctokit.graphql
      // The login is resolved to the node id the API wants.
      .mockResolvedValueOnce({ user: { id: USER_NODE_ID } })
      // The mutation.
      .mockResolvedValueOnce({
        updateProjectV2Collaborators: {
          collaborators: {
            totalCount: 1,
            nodes: [{ __typename: "User", id: USER_NODE_ID, login: "octocat" }],
          },
        },
      });

    const result = await repository.updateCollaborators(PROJECT_ID, [
      { userLogin: "octocat", role: "WRITER" },
    ]);

    expect(result).toEqual([{ id: USER_NODE_ID, login: "octocat", type: "user", role: "WRITER" }]);

    // The login is resolved first, then the mutation carries the node id.
    expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("query GetCollaboratorUserNodeId"),
      expect.objectContaining({ login: "octocat" })
    );
    expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("mutation($input: UpdateProjectV2CollaboratorsInput!)"),
      expect.objectContaining({
        input: {
          projectId: PROJECT_ID,
          collaborators: [{ userId: USER_NODE_ID, role: "WRITER" }],
        },
      })
    );
  });

  it("resolves a team slug to the team node id", async () => {
    mockOctokit.graphql
      .mockResolvedValueOnce({ organization: { team: { id: TEAM_NODE_ID } } })
      .mockResolvedValueOnce({
        updateProjectV2Collaborators: {
          collaborators: {
            totalCount: 1,
            nodes: [{ __typename: "Team", id: TEAM_NODE_ID, slug: "platform", name: "Platform" }],
          },
        },
      });

    const result = await repository.updateCollaborators(
      PROJECT_ID,
      [{ teamSlug: "platform", role: "ADMIN" }],
      "acme"
    );

    expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("query GetCollaboratorTeamNodeId"),
      expect.objectContaining({ org: "acme", slug: "platform" })
    );
    expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("mutation($input: UpdateProjectV2CollaboratorsInput!)"),
      expect.objectContaining({
        input: {
          projectId: PROJECT_ID,
          collaborators: [{ teamId: TEAM_NODE_ID, role: "ADMIN" }],
        },
      })
    );
    // A team is reported by its slug.
    expect(result).toEqual([{ id: TEAM_NODE_ID, login: "platform", type: "team", role: "ADMIN" }]);
  });

  it("never claims a role GitHub did not report - the API has no role read", async () => {
    // The payload holds every collaborator of the project, including the
    // ones this call did not grant a role to, and it carries no roles.
    mockOctokit.graphql
      .mockResolvedValueOnce({ user: { id: USER_NODE_ID } })
      .mockResolvedValueOnce({
        updateProjectV2Collaborators: {
          collaborators: {
            totalCount: 2,
            nodes: [
              { __typename: "User", id: USER_NODE_ID, login: "octocat" },
              { __typename: "User", id: "U_kgDOowner", login: "project-owner" },
            ],
          },
        },
      });

    const result = await repository.updateCollaborators(PROJECT_ID, [
      { userLogin: "octocat", role: "READER" },
    ]);

    // The role of the collaborator this call granted is known; the role of
    // the one it did not touch stays unknown, because GitHub cannot report
    // it.
    expect(result).toEqual([
      { id: USER_NODE_ID, login: "octocat", type: "user", role: "READER" },
      { id: "U_kgDOowner", login: "project-owner", type: "user", role: undefined },
    ]);

    // The payload selection asks for no role: `ProjectV2Actor` has none,
    // and `ProjectV2` has no `collaborators` field to read them from.
    const mutation = mockOctokit.graphql.mock.calls[1][0] as string;
    expect(mutation).toContain("updateProjectV2Collaborators");
    expect(mutation).not.toContain("role");
  });

  it("rejects a grant that names neither a user nor a team", async () => {
    await expect(repository.updateCollaborators(PROJECT_ID, [{ role: "READER" }])).rejects.toThrow(
      /userLogin or a teamSlug/
    );
    expect(mockOctokit.graphql).not.toHaveBeenCalled();
  });

  it("reports a user that does not exist", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({ user: null });

    await expect(
      repository.updateCollaborators(PROJECT_ID, [{ userLogin: "ghost", role: "READER" }])
    ).rejects.toThrow(/ghost/);
  });
});
