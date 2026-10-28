import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from "vitest";
import { ProjectFieldSetup } from "../../../infrastructure/agent/ProjectFieldSetup";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";

vi.mock("../../../infrastructure/github/GitHubRepositoryFactory", () => {
  const mockFactory = vi.fn().mockImplementation(function () {
    return {
      createIssueRepository: vi.fn(),
      createMilestoneRepository: vi.fn(),
      createProjectRepository: vi.fn(),
      createSprintRepository: vi.fn(),
      createProjectWorkflowRepository: vi.fn(),
      createSubIssueRepository: vi.fn(),
      createStatusUpdateRepository: vi.fn(),
    };
  });
  return { GitHubRepositoryFactory: mockFactory };
});

/** The field shape the GraphQL inspection returns. */
interface InspectedField {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ name: string }>;
}

interface InspectedFieldsResponse {
  node: { fields: { nodes: InspectedField[] } } | null;
}

interface CreateFieldArgs {
  name?: string;
  options?: Array<{ name: string }>;
}

type CreateFieldMock = Mock<(projectId: string, field: CreateFieldArgs) => Promise<{ id: string }>>;

type GraphqlMock = Mock<(query: string, variables?: Record<string, unknown>) => Promise<unknown>>;

const ALL_FIELDS_RESPONSE: InspectedFieldsResponse = {
  node: {
    fields: {
      nodes: [
        { id: "f-a", name: "agent_claimed_by", dataType: "TEXT" },
        { id: "f-b", name: "agent_claimed_at", dataType: "TEXT" },
        { id: "f-c", name: "agent_status", dataType: "SINGLE_SELECT" },
        { id: "f-d", name: "agent_work_branch", dataType: "TEXT" },
        { id: "f-e", name: "agent_pr_number", dataType: "NUMBER" },
      ],
    },
  },
};

describe("ProjectFieldSetup", () => {
  let setup: ProjectFieldSetup;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let createField: CreateFieldMock;
  let graphqlMock: GraphqlMock;
  /** Option names sent WITHOUT an id — i.e. the options that are new. */
  let addedOptionNames: string[];
  /** Option ids sent back — i.e. the options that already existed. */
  let preservedOptionIds: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    addedOptionNames = [];
    preservedOptionIds = [];
    createField = vi.fn(async () => ({ id: "new-field" }));
    graphqlMock = vi.fn(async () => ALL_FIELDS_RESPONSE);

    mockFactory = {
      graphql: graphqlMock,
      createProjectRepository: vi.fn(() => ({ createField })),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    setup = new ProjectFieldSetup(mockFactory);
  });

  it("creates only missing fields (idempotent)", async () => {
    const result = await setup.ensureFields("project-1");

    expect(result.existing).toEqual([
      "agent_claimed_by",
      "agent_claimed_at",
      "agent_status",
      "agent_work_branch",
      "agent_pr_number",
    ]);
    expect(result.created).toEqual([]);
    expect(result.optionsAdded).toEqual([]);
    expect(createField).not.toHaveBeenCalled();
  });

  it("creates fields that are absent", async () => {
    graphqlMock.mockResolvedValue({
      node: { fields: { nodes: [{ id: "f-a", name: "agent_status", dataType: "SINGLE_SELECT" }] } },
    });

    const result = await setup.ensureFields("project-1");

    expect(result.created).toContain("agent_claimed_by");
    expect(result.created).toContain("agent_claimed_at");
    expect(result.created).toContain("agent_work_branch");
    expect(result.created).toContain("agent_pr_number");
    expect(createField).toHaveBeenCalledTimes(4);
  });

  it("creates agent_status with the full option set", async () => {
    graphqlMock.mockResolvedValue({
      node: { fields: { nodes: [] } },
    });

    await setup.ensureFields("project-1");

    const statusCall = createField.mock.calls.find((call) => call[1]?.name === "agent_status");
    expect(statusCall).toBeDefined();
    const data = statusCall?.[1];
    expect(data?.options?.map((option) => option.name)).toEqual([
      "unclaimed",
      "in_progress",
      "review",
      "blocked",
      "completed",
    ]);
  });

  it("adds status options a legacy project field is missing", async () => {
    graphqlMock.mockImplementation(async (query: string, variables?: Record<string, unknown>) => {
      if (query.includes("updateProjectV2Field")) {
        // GitHub has no "add option" mutation: the option set is replaced by
        // the list sent with updateProjectV2Field. An option sent WITH its id
        // keeps its identity, one sent WITHOUT an id is new.
        const input = variables?.input as
          | { fieldId?: string; singleSelectOptions?: Array<{ id?: string; name: string }> }
          | undefined;
        for (const option of input?.singleSelectOptions ?? []) {
          if (!option.id) addedOptionNames.push(option.name);
          else preservedOptionIds.push(option.id);
        }
        return { updateProjectV2Field: { projectV2Field: { id: "f-c" } } };
      }
      return {
        node: {
          fields: {
            nodes: [
              { id: "f-a", name: "agent_claimed_by", dataType: "TEXT" },
              { id: "f-b", name: "agent_claimed_at", dataType: "TEXT" },
              {
                id: "f-c",
                name: "agent_status",
                dataType: "SINGLE_SELECT",
                options: [{ id: "opt-1", name: "unclaimed" }],
              },
              { id: "f-d", name: "agent_work_branch", dataType: "TEXT" },
              { id: "f-e", name: "agent_pr_number", dataType: "NUMBER" },
            ],
          },
        },
      };
    });

    const result = await setup.ensureFields("project-1");

    expect(result.created).toEqual([]);
    expect(result.existing).toContain("agent_status");
    expect(result.optionsAdded).toEqual([
      "agent_status:in_progress",
      "agent_status:review",
      "agent_status:blocked",
      "agent_status:completed",
    ]);
    expect(createField).not.toHaveBeenCalled();
    expect(addedOptionNames).toEqual(["in_progress", "review", "blocked", "completed"]);
    // The option that already existed is sent back with its id, so the item
    // values pointing at it survive the update.
    expect(preservedOptionIds).toEqual(["opt-1"]);
  });

  it("refuses a field whose data type cannot carry the agent state", async () => {
    graphqlMock.mockResolvedValue({
      node: {
        fields: {
          nodes: [
            { id: "f-a", name: "agent_claimed_by", dataType: "SINGLE_SELECT" },
            { id: "f-b", name: "agent_claimed_at", dataType: "TEXT" },
            { id: "f-c", name: "agent_status", dataType: "SINGLE_SELECT" },
            { id: "f-d", name: "agent_work_branch", dataType: "TEXT" },
            { id: "f-e", name: "agent_pr_number", dataType: "NUMBER" },
          ],
        },
      },
    });

    await expect(setup.ensureFields("project-1")).rejects.toThrow(/incompatible data type/i);
  });
});
