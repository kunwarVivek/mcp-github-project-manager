import type { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { FieldType } from "../../../../domain/types";
import { GitHubConfig } from "../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectRepository } from "../../../../infrastructure/github/repositories/GitHubProjectRepository";

vi.mock("@octokit/rest");

/** The GraphQL call the repository makes. */
type GraphqlMock = Mock<(query: string, variables?: Record<string, unknown>) => Promise<unknown>>;

/**
 * The field types the API can create, and what it does with the ones it
 * cannot.
 *
 * `createProjectV2Field` takes a `ProjectV2CustomFieldType` — TEXT, NUMBER,
 * DATE, SINGLE_SELECT, MULTI_SELECT, ITERATION. The option set of a select
 * field is replaced by the list sent with the mutation, so an option that
 * carries an id keeps its identity (and the item values pointing at it).
 */
describe("creatable project field types", () => {
  const PROJECT_ID = "PVT_kwDOLhQ7gc4AOEbH";
  const MULTI_SELECT_FIELD_ID = "PVTMSF_1";

  let repository: GitHubProjectRepository;
  let graphql: GraphqlMock;

  beforeEach(() => {
    vi.clearAllMocks();

    graphql = vi.fn();
    // The Octokit instance is a partial stand-in: only `graphql` is used here.
    const octokit = { graphql } as unknown as Octokit;
    repository = new GitHubProjectRepository(octokit, new GitHubConfig("owner", "repo", "token"));
  });

  /** The variables of the last GraphQL call that carried a `dataType`. */
  function lastCreateVariables(): Record<string, unknown> {
    const calls = graphql.mock.calls as Array<[string, Record<string, unknown>]>;
    for (const [query, variables] of calls.reverse()) {
      if (query.includes("createProjectV2Field")) {
        return variables;
      }
    }
    throw new Error("no createProjectV2Field call was made");
  }

  /** The variables of the last GraphQL call that carried field options. */
  function lastUpdateVariables(): Record<string, unknown> {
    const calls = graphql.mock.calls as Array<[string, Record<string, unknown>]>;
    for (const [query, variables] of calls.reverse()) {
      if (query.includes("updateProjectV2Field")) {
        return variables;
      }
    }
    throw new Error("no updateProjectV2Field call was made");
  }

  it("creates a multi-select field with its options", async () => {
    graphql.mockImplementation((query: string) => {
      if (query.includes("createProjectV2Field")) {
        return Promise.resolve({
          createProjectV2Field: {
            projectV2Field: { id: MULTI_SELECT_FIELD_ID, name: "Tags" },
          },
        });
      }
      if (query.includes("fields(first: 100)")) {
        return Promise.resolve({
          node: { fields: { nodes: [{ id: MULTI_SELECT_FIELD_ID, name: "Tags" }] } },
        });
      }
      return Promise.resolve({
        node: {
          field: {
            id: MULTI_SELECT_FIELD_ID,
            name: "Tags",
            dataType: "MULTI_SELECT",
            multiSelectOptions: [
              { id: "opt-1", name: "backend", description: "", color: "GRAY" },
              { id: "opt-2", name: "frontend", description: "", color: "BLUE" },
            ],
          },
        },
      });
    });

    const created = await repository.createField(PROJECT_ID, {
      name: "Tags",
      type: "multi_select",
      options: [
        { id: "", name: "backend", color: "gray" },
        { id: "", name: "frontend", color: "blue" },
      ],
    });

    const variables = lastCreateVariables();
    expect(variables.input).toMatchObject({
      projectId: PROJECT_ID,
      dataType: "MULTI_SELECT",
      name: "Tags",
    });
    expect(variables.input.multiSelectOptions).toEqual([
      { name: "backend", description: "", color: "GRAY" },
      { name: "frontend", description: "", color: "BLUE" },
    ]);
    expect(variables.input.singleSelectOptions).toBeUndefined();
    expect(created.type).toBe("multi_select");
  });

  it("creates a single-select field with its options", async () => {
    graphql.mockImplementation((query: string) => {
      if (query.includes("createProjectV2Field")) {
        return Promise.resolve({
          createProjectV2Field: {
            projectV2Field: { id: "PVTSSF_1", name: "Status" },
          },
        });
      }
      if (query.includes("fields(first: 100)")) {
        return Promise.resolve({
          node: { fields: { nodes: [{ id: "PVTSSF_1", name: "Status" }] } },
        });
      }
      return Promise.resolve({
        node: {
          field: {
            id: "PVTSSF_1",
            name: "Status",
            dataType: "SINGLE_SELECT",
            options: [{ id: "opt-1", name: "Todo", description: "", color: "GRAY" }],
          },
        },
      });
    });

    await repository.createField(PROJECT_ID, {
      name: "Status",
      type: "single_select",
      options: [{ id: "", name: "Todo", color: "gray" }],
    });

    const variables = lastCreateVariables();
    expect(variables.input).toMatchObject({ dataType: "SINGLE_SELECT" });
    expect(variables.input.singleSelectOptions).toEqual([
      { name: "Todo", description: "", color: "GRAY" },
    ]);
    expect(variables.input.multiSelectOptions).toBeUndefined();
  });

  it("refuses a field type GitHub cannot create", async () => {
    // A stored or hand-built argument — the public schema did not vet it.
    const notCreatable = "milestone" as unknown as FieldType;

    await expect(
      repository.createField(PROJECT_ID, { name: "Release", type: notCreatable })
    ).rejects.toThrow(/cannot create a "milestone" field/);
  });

  it("keeps the existing options when a multi-select field is updated", async () => {
    graphql.mockImplementation((query: string) => {
      if (query.includes("updateProjectV2Field")) {
        return Promise.resolve({
          updateProjectV2Field: {
            projectV2Field: { id: MULTI_SELECT_FIELD_ID, name: "Tags" },
          },
        });
      }
      if (query.includes("fields(first: 100)")) {
        return Promise.resolve({
          node: { fields: { nodes: [{ id: MULTI_SELECT_FIELD_ID, name: "Tags" }] } },
        });
      }
      return Promise.resolve({
        node: {
          field: {
            id: MULTI_SELECT_FIELD_ID,
            name: "Tags",
            dataType: "MULTI_SELECT",
            multiSelectOptions: [
              { id: "opt-1", name: "backend", description: "", color: "GRAY" },
              { id: "opt-2", name: "frontend", description: "", color: "BLUE" },
            ],
          },
        },
      });
    });

    await repository.updateField(PROJECT_ID, MULTI_SELECT_FIELD_ID, {
      options: [
        { id: "", name: "backend" },
        { id: "", name: "docs" },
      ],
    });

    const variables = lastUpdateVariables();
    // The option set is replaced by the list sent with the mutation, so the
    // existing options have to travel with it — with their ids, or the item
    // values pointing at them are lost.
    expect(variables.input.multiSelectOptions).toEqual([
      { id: "opt-1", name: "backend", description: "", color: "GRAY" },
      { name: "docs", description: "", color: "GRAY" },
    ]);
    expect(variables.input.singleSelectOptions).toBeUndefined();
  });

  it("refuses to read a built-in project field as a custom field", async () => {
    graphql.mockImplementation((query: string) => {
      if (query.includes("updateProjectV2Field")) {
        return Promise.resolve({
          updateProjectV2Field: {
            projectV2Field: { id: "PVTF_1", name: "Assignees" },
          },
        });
      }
      if (query.includes("fields(first: 100)")) {
        return Promise.resolve({
          node: { fields: { nodes: [{ id: "PVTF_1", name: "Assignees" }] } },
        });
      }
      return Promise.resolve({
        node: { field: { id: "PVTF_1", name: "Assignees", dataType: "ASSIGNEES" } },
      });
    });

    await expect(repository.updateField(PROJECT_ID, "PVTF_1", { name: "Owners" })).rejects.toThrow(
      /built-in GitHub project field/
    );
  });
});
