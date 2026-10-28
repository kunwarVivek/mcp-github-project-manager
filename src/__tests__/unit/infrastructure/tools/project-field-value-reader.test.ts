import { beforeEach, describe, expect, it, type Mock, type MockedClass, vi } from "vitest";
import { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import { executeFilterProjectItems } from "../../../../infrastructure/tools/project-advanced-tools";

/**
 * The project item reader must see every field value a project item can carry.
 *
 * `ProjectV2ItemFieldValue` is a union of thirteen members. Selecting only the
 * single-select and the text one made every other value kind - numbers, dates,
 * labels, milestones, repositories, reviewers, users, linked pull requests,
 * iterations, multi selects and issue fields - invisible to a client.
 */

vi.mock("../../../../infrastructure/github/GitHubRepositoryFactory.js", () => ({
  GitHubRepositoryFactory: vi.fn().mockImplementation(function () {
    return {
      graphql: vi.fn(),
      getConfig: vi.fn(),
    };
  }),
}));

const MockedFactory = GitHubRepositoryFactory as MockedClass<typeof GitHubRepositoryFactory>;

/** The members of the `ProjectV2ItemFieldValue` union. */
const FIELD_VALUE_MEMBERS = [
  "ProjectV2ItemFieldDateValue",
  "ProjectV2ItemFieldIterationValue",
  "ProjectV2ItemFieldLabelValue",
  "ProjectV2ItemFieldMilestoneValue",
  "ProjectV2ItemFieldMultiSelectValue",
  "ProjectV2ItemFieldNumberValue",
  "ProjectV2ItemFieldPullRequestValue",
  "ProjectV2ItemFieldRepositoryValue",
  "ProjectV2ItemFieldReviewerValue",
  "ProjectV2ItemFieldSingleSelectValue",
  "ProjectV2ItemFieldTextValue",
  "ProjectV2ItemFieldUserValue",
  "ProjectV2ItemIssueFieldValue",
];

/** The members of the `ProjectV2FieldConfiguration` union. */
const FIELD_CONFIGURATION_MEMBERS = [
  "ProjectV2Field",
  "ProjectV2SingleSelectField",
  "ProjectV2MultiSelectField",
  "ProjectV2IterationField",
];

describe("project item field value reader", () => {
  let graphql: Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    graphql = vi.fn().mockResolvedValue({
      node: {
        items: {
          totalCount: 1,
          nodes: [
            {
              id: "PVTI_1",
              content: {
                __typename: "Issue",
                id: "I_1",
                title: "An issue",
                state: "OPEN",
                labels: { nodes: [] },
                assignees: { nodes: [] },
              },
              fieldValues: {
                nodes: [
                  {
                    __typename: "ProjectV2ItemFieldTextValue",
                    text: "Some notes",
                    field: { name: "Notes" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldNumberValue",
                    number: 42,
                    field: { name: "Estimate" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldDateValue",
                    date: "2024-01-01",
                    field: { name: "Due" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldSingleSelectValue",
                    name: "Done",
                    optionId: "option-1",
                    field: { name: "Status" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldMultiSelectValue",
                    options: [{ name: "Urgent" }, { name: "Blocked" }],
                    value: "Urgent, Blocked",
                    field: { name: "Tags" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldIterationValue",
                    title: "Sprint 1",
                    iterationId: "iteration-1",
                    field: { name: "Sprint" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldLabelValue",
                    labels: { nodes: [{ name: "bug" }, { name: "urgent" }] },
                    field: { name: "Labels" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldMilestoneValue",
                    milestone: { title: "v1.0" },
                    field: { name: "Milestone" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldRepositoryValue",
                    repository: { nameWithOwner: "owner/repo" },
                    field: { name: "Repository" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldReviewerValue",
                    reviewers: { nodes: [{ login: "octocat" }, { name: "core-team" }] },
                    field: { name: "Reviewers" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldUserValue",
                    users: { nodes: [{ login: "dev1" }, { login: "dev2" }] },
                    field: { name: "Assignees" },
                  },
                  {
                    __typename: "ProjectV2ItemFieldPullRequestValue",
                    pullRequests: { nodes: [{ number: 12 }, { number: 13 }] },
                    field: { name: "Linked pull requests" },
                  },
                  {
                    __typename: "ProjectV2ItemIssueFieldValue",
                    issueFieldValue: {
                      __typename: "IssueFieldTextValue",
                      value: "PARENT-1",
                    },
                    field: { name: "Parent issue" },
                  },
                ],
              },
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });

    MockedFactory.mockImplementation(function () {
      return {
        graphql,
        getConfig: vi.fn().mockReturnValue({ owner: "octocat", repo: "hello-world" }),
      } as unknown as GitHubRepositoryFactory;
    });
  });

  it("selects every member of the field value union", async () => {
    await executeFilterProjectItems({ projectId: "PVT_test", filter: {} });

    const query = graphql.mock.calls[0][0] as string;
    for (const member of FIELD_VALUE_MEMBERS) {
      expect(query).toContain(`... on ${member} {`);
    }
    expect(query).toContain("__typename");
  });

  it("selects the whole field configuration union for every field value", async () => {
    await executeFilterProjectItems({ projectId: "PVT_test", filter: {} });

    const query = graphql.mock.calls[0][0] as string;
    for (const member of FIELD_CONFIGURATION_MEMBERS) {
      expect(query).toContain(`... on ${member} {`);
    }
  });

  it("renders every field value kind as a string", async () => {
    const result = await executeFilterProjectItems({ projectId: "PVT_test", filter: {} });

    expect(result.structuredContent.items[0].fieldValues).toEqual({
      Notes: "Some notes",
      Estimate: "42",
      Due: "2024-01-01",
      Status: "Done",
      Tags: "Urgent, Blocked",
      Sprint: "Sprint 1",
      Labels: "bug, urgent",
      Milestone: "v1.0",
      Repository: "owner/repo",
      Reviewers: "octocat, core-team",
      Assignees: "dev1, dev2",
      "Linked pull requests": "#12, #13",
      "Parent issue": "PARENT-1",
    });
  });

  it("keeps filtering by the value of the status field", async () => {
    const result = await executeFilterProjectItems({
      projectId: "PVT_test",
      filter: { status: "Done" },
    });

    expect(result.structuredContent.filteredCount).toBe(1);
  });
});
