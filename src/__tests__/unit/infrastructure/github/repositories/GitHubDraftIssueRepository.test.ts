import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubDraftIssueRepository } from "../../../../../infrastructure/github/repositories/GitHubDraftIssueRepository";
import { asOctokit, type GraphqlFn } from "../../../../helpers/mockTypes";

describe("GitHubDraftIssueRepository", () => {
  let repository: GitHubDraftIssueRepository;
  let graphql: Mock<GraphqlFn>;

  beforeEach(() => {
    graphql = vi.fn<GraphqlFn>();
    repository = new GitHubDraftIssueRepository(
      asOctokit({ graphql }),
      new GitHubConfig("testOwner", "testRepo")
    );
  });

  it("creates a draft issue, defaulting body and assignees", async () => {
    graphql.mockResolvedValueOnce({
      addProjectV2DraftIssue: {
        projectV2Item: { id: "item-1", content: { id: "draft-1", title: "T", body: "" } },
      },
    });

    const result = await repository.create({ projectId: "project-1", title: "T" });

    expect(result).toEqual({ id: "draft-1", title: "T", body: "" });
    const [, variables] = graphql.mock.calls[0];
    expect(variables).toEqual(
      expect.objectContaining({
        input: { projectId: "project-1", title: "T", body: "", assigneeIds: [] },
      })
    );
  });

  it("updates only the supplied draft issue fields", async () => {
    graphql.mockResolvedValueOnce({
      updateProjectV2DraftIssue: { draftIssue: { id: "draft-1", title: "New", body: "b" } },
    });

    const result = await repository.update({ draftIssueId: "draft-1", title: "New" });

    expect(result).toEqual({ id: "draft-1", title: "New", body: "b" });
    const [, variables] = graphql.mock.calls[0];
    expect(variables).toEqual(
      expect.objectContaining({ input: { draftIssueId: "draft-1", title: "New" } })
    );
  });

  it("deletes a draft issue by id", async () => {
    graphql.mockResolvedValueOnce({});

    await repository.delete("draft-1");

    const [query, variables] = graphql.mock.calls[0];
    expect(query).toContain("deleteProjectV2DraftIssue");
    expect(variables).toEqual(expect.objectContaining({ input: { draftIssueId: "draft-1" } }));
  });
});
