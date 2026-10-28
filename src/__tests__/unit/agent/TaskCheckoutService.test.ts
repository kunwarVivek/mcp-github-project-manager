import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import type { AgentStore } from "../../../infrastructure/agent/AgentStore";
import { clearItemHeartbeatTargets } from "../../../infrastructure/agent/ItemHeartbeatStore";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type { AgentContextService } from "../../../services/agent/AgentContextService";
import { clearProvisionedAgentProjects } from "../../../services/agent/AgentFieldProvisioner";
import { TaskCheckoutService } from "../../../services/agent/TaskCheckoutService";
import { InMemoryAgentStore } from "../../helpers/InMemoryAgentStore";

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

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

interface ProjectItemFixture {
  id?: string;
  projectId: string;
  claimedBy?: string;
  status?: string;
  /** Extra field values (e.g. the field a view sorts by). */
  fields?: Array<{ name: string; value: string }>;
}

interface IssueFixture {
  id?: string;
  number: number;
  title?: string;
  body?: string;
  createdAt?: string;
  labels?: string[];
  milestone?: { title: string; dueOn?: string | null } | null;
  claimedBy?: string;
  status?: string;
  projectItems?: ProjectItemFixture[];
  /** Native "blocked by" edges (issue numbers). */
  blockedBy?: number[];
}
interface ProjectFieldValueFixture {
  field: { name: string };
  text?: string;
  name?: string;
  number?: number;
}

interface ProjectItemNodeFixture {
  id: string;
  project: { id: string };
  fieldValues: { nodes: ProjectFieldValueFixture[] };
}

interface IssueNodeFixture {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "OPEN";
  createdAt: string;
  labels: { nodes: Array<{ name: string }> };
  milestone: { title: string; dueOn?: string | null } | null;
  blockedBy?: { nodes: Array<{ number: number }> };
  projectItems: { nodes: ProjectItemNodeFixture[] };
}
type GraphqlVars = Record<string, string | number | undefined>;

function projectItemFieldValues(claimedBy?: string, status?: string): ProjectFieldValueFixture[] {
  return [
    ...(claimedBy ? [{ field: { name: "agent_claimed_by" }, text: claimedBy }] : []),
    ...(status ? [{ field: { name: "agent_status" }, name: status }] : []),
  ];
}

function makeIssue(overrides: IssueFixture): IssueNodeFixture {
  const {
    id = `issue-${overrides.number}`,
    number,
    title = `Task ${number}`,
    body = "",
    createdAt = "2026-01-01T00:00:00Z",
    labels = [],
    milestone = null,
    claimedBy,
    status,
    projectItems,
    blockedBy,
  } = overrides;

  const nodes = (projectItems ?? [{ projectId: "project-1", claimedBy, status }]).map((item) => ({
    id: item.id ?? `item-${number}`,
    project: { id: item.projectId },
    fieldValues: {
      nodes: [
        ...projectItemFieldValues(item.claimedBy, item.status),
        ...(item.fields ?? []).map((f) => ({ field: { name: f.name }, text: f.value })),
      ],
    },
  }));

  return {
    id,
    number,
    title,
    body,
    state: "OPEN",
    createdAt,
    labels: { nodes: labels.map((name) => ({ name })) },
    milestone,
    ...(blockedBy ? { blockedBy: { nodes: blockedBy.map((number) => ({ number })) } } : {}),
    projectItems: { nodes },
  };
}

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: "engineer",
    runtime: "claude-code",
    capabilities: ["typescript"],
    status: "idle",
    registeredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Ids the stateful hot-field mutation mock recognises for fields created on demand. */
const CREATED_FIELD_IDS: Record<string, string> = {
  agent_heartbeat_at: "f-heartbeat-at",
  agent_progress: "f-progress",
};

const LIST_FIELDS_RESPONSE = {
  node: {
    fields: {
      nodes: [
        { id: "f-claimed-by", name: "agent_claimed_by", dataType: "TEXT" },
        { id: "f-claimed-at", name: "agent_claimed_at", dataType: "TEXT" },
        {
          id: "f-status",
          name: "agent_status",
          dataType: "SINGLE_SELECT",
          options: [
            { id: "opt-unclaimed", name: "unclaimed" },
            { id: "opt-in-progress", name: "in_progress" },
            { id: "opt-review", name: "review" },
            { id: "opt-completed", name: "completed" },
            { id: "opt-blocked", name: "blocked" },
          ],
        },
        { id: "f-heartbeat-at", name: "agent_heartbeat_at", dataType: "TEXT" },
        { id: "f-progress", name: "agent_progress", dataType: "NUMBER" },
        { id: "f-work-branch", name: "agent_work_branch", dataType: "TEXT" },
        { id: "f-pr-number", name: "agent_pr_number", dataType: "NUMBER" },
      ],
    },
  },
};

describe("TaskCheckoutService", () => {
  let service: TaskCheckoutService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let mockAgentStore: InMemoryAgentStore;
  let mockContextService: { getTaskContext: Mock };
  let octokit: {
    rest: {
      issues: { createComment: Mock; update: Mock };
      pulls: { get: Mock; listReviews: Mock };
    };
  };
  let issuesFixture: IssueNodeFixture[];
  let graphqlMock: Mock;
  // Simulated project field persistence written by mutations.
  let persistedClaims: Map<string, string>;
  let clearedClaims: Set<string>;
  let persistedStatuses: Map<string, string>;
  let persistedHeartbeats: Map<string, { at?: string; progress?: number; branch?: string }>;
  let fieldsResponse: typeof LIST_FIELDS_RESPONSE;
  let createFieldMock: Mock<(projectId: string, data: { name: string }) => Promise<{ id: string }>>;

  function removeFields(...names: string[]): void {
    fieldsResponse = {
      node: {
        fields: {
          nodes: fieldsResponse.node.fields.nodes.filter((field) => !names.includes(field.name)),
        },
      },
    };
  }

  function createdFieldNames(): string[] {
    return createFieldMock.mock.calls.map(([, data]) => data.name);
  }

  function applyPersistedFields(issue: IssueNodeFixture): IssueNodeFixture {
    return {
      ...issue,
      projectItems: {
        nodes: issue.projectItems.nodes.map((item) => {
          const fieldValues = item.fieldValues.nodes.filter((fv) => {
            if (fv.field?.name === "agent_claimed_by" && clearedClaims.has(item.id)) return false;
            if (fv.field?.name === "agent_status" && persistedStatuses.has(item.id)) return false;
            return true;
          });

          const persisted = persistedClaims.get(item.id);
          if (persisted) {
            const existing = fieldValues.findIndex((fv) => fv.field?.name === "agent_claimed_by");
            const claimed = { field: { name: "agent_claimed_by" }, text: persisted };
            if (existing >= 0) fieldValues[existing] = claimed;
            else fieldValues.push(claimed);
          }

          const status = persistedStatuses.get(item.id);
          if (status) {
            fieldValues.push({ field: { name: "agent_status" }, name: status });
          }

          const hot = persistedHeartbeats.get(item.id);
          if (hot?.at) fieldValues.push({ field: { name: "agent_heartbeat_at" }, text: hot.at });
          if (hot?.progress !== undefined) {
            fieldValues.push({ field: { name: "agent_progress" }, number: hot.progress });
          }
          if (hot?.branch)
            fieldValues.push({ field: { name: "agent_work_branch" }, text: hot.branch });

          return { ...item, fieldValues: { nodes: fieldValues } };
        }),
      },
    };
  }

  function statusNameForOption(optionId: string): string | undefined {
    const statusByOptionId: Record<string, string> = {
      "opt-unclaimed": "unclaimed",
      "opt-in-progress": "in_progress",
      "opt-review": "review",
      "opt-completed": "completed",
    };
    return statusByOptionId[optionId];
  }

  function configureGraphqlMock() {
    graphqlMock.mockImplementation(async (query: string, vars: GraphqlVars) => {
      if (
        query.includes("updateProjectV2ItemFieldValue") &&
        vars.fieldId === "f-claimed-by" &&
        typeof vars.itemId === "string" &&
        typeof vars.value === "string"
      ) {
        persistedClaims.set(vars.itemId, vars.value);
        clearedClaims.delete(vars.itemId);
      }

      if (query.includes("updateProjectV2ItemFieldValue") && vars.fieldId === "f-status") {
        const status = typeof vars.value === "string" ? statusNameForOption(vars.value) : undefined;
        if (typeof vars.itemId === "string" && status) persistedStatuses.set(vars.itemId, status);
      }

      // Hot state: the claim writes agent_heartbeat_at with a single-field
      // mutation, a heartbeat batches f0/v0, f1/v1, ... into one document.
      if (query.includes("updateProjectV2ItemFieldValue") && typeof vars.itemId === "string") {
        const hotWrites: Array<[unknown, unknown]> = [];
        if (vars.fieldId !== undefined) hotWrites.push([vars.fieldId, vars.value]);
        for (let i = 0; vars[`f${i}`] !== undefined; i++) {
          hotWrites.push([vars[`f${i}`], vars[`v${i}`]]);
        }
        for (const [fieldId, value] of hotWrites) {
          const current = persistedHeartbeats.get(vars.itemId) ?? {};
          if (fieldId === "f-heartbeat-at") current.at = String(value);
          else if (fieldId === "f-progress") current.progress = Number(value);
          else if (fieldId === "f-work-branch") current.branch = String(value);
          else continue;
          persistedHeartbeats.set(vars.itemId, current);
        }
      }

      if (
        query.includes("clearProjectV2ItemFieldValue") &&
        typeof vars.itemId === "string" &&
        vars.fieldId === "f-heartbeat-at"
      ) {
        persistedHeartbeats.delete(vars.itemId);
      }

      if (
        query.includes("clearProjectV2ItemFieldValue") &&
        vars.fieldId === "f-claimed-by" &&
        typeof vars.itemId === "string"
      ) {
        persistedClaims.delete(vars.itemId);
        clearedClaims.add(vars.itemId);
      }

      // Batched heartbeat read (reclaim, metrics)
      if (query.includes("i0: issue(")) {
        const repository: Record<string, unknown> = {};
        for (const match of query.matchAll(/(i\d+): issue\(number: (\d+)\)/g)) {
          const issue = issuesFixture.find((candidate) => candidate.number === Number(match[2]));
          repository[match[1]] = issue
            ? { projectItems: applyPersistedFields(issue).projectItems }
            : null;
        }
        return { repository };
      }

      // Project fields lookup
      if (vars.projectId && vars.itemId === undefined && vars.number === undefined) {
        return fieldsResponse;
      }
      // Open issues list
      if (
        vars.owner &&
        vars.repo &&
        vars.cursor === undefined &&
        vars.itemId === undefined &&
        vars.number === undefined
      ) {
        return {
          repository: {
            issues: {
              nodes: issuesFixture.map(applyPersistedFields),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        };
      }
      // Fresh item read (atomic claim verification)
      if (typeof vars.itemId === "string") {
        const issue = issuesFixture
          .map(applyPersistedFields)
          .find((candidateIssue) =>
            candidateIssue.projectItems.nodes.some((item) => item.id === vars.itemId)
          );
        const item = issue?.projectItems.nodes.find(
          (candidateItem) => candidateItem.id === vars.itemId
        );
        return {
          node: item
            ? {
                project: { id: item.project.id },
                fieldValues: { nodes: item.fieldValues.nodes },
              }
            : null,
        };
      }
      // Issue project items lookup (heartbeat target resolution, clearClaimFields)
      if (vars.number != null) {
        const issue = issuesFixture.find((candidateIssue) => candidateIssue.number === vars.number);
        return {
          repository: {
            issue: issue ? { projectItems: applyPersistedFields(issue).projectItems } : null,
          },
        };
      }
      return { node: { fields: { nodes: [] } } };
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    issuesFixture = [];
    persistedClaims = new Map();
    clearedClaims = new Set();
    persistedStatuses = new Map();
    persistedHeartbeats = new Map();
    fieldsResponse = structuredClone(LIST_FIELDS_RESPONSE);
    clearItemHeartbeatTargets();
    clearProvisionedAgentProjects();
    createFieldMock = vi.fn(async (_projectId: string, data: { name: string }) => {
      await Promise.resolve();
      const id = CREATED_FIELD_IDS[data.name] ?? `f-${data.name}`;
      fieldsResponse.node.fields.nodes.push({
        id,
        name: data.name,
        dataType: data.name === "agent_progress" ? "NUMBER" : "TEXT",
      });
      return { id };
    });

    octokit = {
      rest: {
        issues: {
          createComment: vi.fn(async () => ({ data: {} })),
          update: vi.fn(async () => ({ data: {} })),
        },
        pulls: {
          get: vi.fn(),
          listReviews: vi.fn(),
        },
      },
    };

    graphqlMock = vi.fn();

    mockFactory = {
      getConfig: vi.fn(() => ({ owner: "test-owner", repo: "test-repo" })),
      getOctokit: vi.fn(() => octokit),
      graphql: graphqlMock,
      createProjectRepository: vi.fn(() => ({
        listViews: vi.fn(async () => [] as unknown[]),
        createField: createFieldMock,
      })),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    mockAgentStore = new InMemoryAgentStore();

    mockContextService = {
      getTaskContext: vi.fn(async () => ({
        issue: {
          id: "x",
          number: 1,
          title: "T",
          body: "",
          labels: [],
          assignees: [],
          state: "OPEN",
          createdAt: "2026-01-01T00:00:00Z",
        },
        relatedIssues: [],
        branchSuggestion: "agent/1-task",
        acceptanceCriteria: [],
      })),
    };

    service = new TaskCheckoutService(
      mockFactory as unknown as GitHubRepositoryFactory,
      mockAgentStore as unknown as AgentStore,
      mockContextService as unknown as AgentContextService
    );

    configureGraphqlMock();
  });

  describe("checkoutTask — strategy selection", () => {
    it("claims the highest-priority task by default", async () => {
      issuesFixture = [
        makeIssue({ number: 1, title: "Low", labels: ["priority:low"] }),
        makeIssue({ number: 2, title: "High", labels: ["priority:high"] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
      expect(result.selectionRationale).toContain("priority");
    });

    it("honors oldest_first strategy", async () => {
      issuesFixture = [
        makeIssue({ number: 1, createdAt: "2026-03-01T00:00:00Z" }),
        makeIssue({ number: 2, createdAt: "2026-01-01T00:00:00Z" }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { strategy: "oldest_first" });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("honors skills_match strategy", async () => {
      issuesFixture = [
        makeIssue({ number: 1, labels: ["ruby"] }),
        makeIssue({ number: 2, labels: ["typescript"] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent("agent-1", { capabilities: ["typescript"] })
      );

      const result = await service.checkoutTask("agent-1", { strategy: "skills_match" });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("honors milestone_deadline strategy (earliest due date first)", async () => {
      issuesFixture = [
        makeIssue({ number: 1, milestone: { title: "M1", dueOn: "2026-06-01T00:00:00Z" } }),
        makeIssue({ number: 2, milestone: { title: "M2", dueOn: "2026-04-01T00:00:00Z" } }),
        makeIssue({ number: 3, milestone: null }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { strategy: "milestone_deadline" });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("skips claimed and non-unclaimed issues", async () => {
      issuesFixture = [
        makeIssue({ number: 1, claimedBy: "agent-other" }),
        makeIssue({ number: 2, status: "in_progress" }),
        makeIssue({ number: 3 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(3);
    });

    it("filters by label and projectId", async () => {
      issuesFixture = [
        makeIssue({ number: 1, labels: ["backend"] }),
        makeIssue({ number: 2, labels: ["frontend"] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", {
        strategy: "highest_priority",
        labels: ["frontend"],
      });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("uses the matching project item when projectId is provided", async () => {
      issuesFixture = [
        makeIssue({
          number: 1,
          projectItems: [
            { id: "item-1-alpha", projectId: "project-alpha" },
            { id: "item-1-beta", projectId: "project-beta" },
          ],
        }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { projectId: "project-beta" });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(1);
      expect(persistedClaims.get("item-1-beta")).toBe("agent-1");
      expect(persistedClaims.has("item-1-alpha")).toBe(false);
    });

    it("claims the first task in the order of the named view", async () => {
      // The view sorts its pool by "Priority" (descending), so the task with
      // the higher value is handed out first — even though the other one is
      // older.
      (mockFactory.createProjectRepository as unknown as Mock).mockReturnValue({
        listViews: vi.fn(async () => [
          {
            id: "view-1",
            name: "Sprint",
            layout: "board",
            sortBy: [{ field: "Priority", direction: "DESC" }],
          },
        ]),
      });
      issuesFixture = [
        makeIssue({
          number: 1,
          projectItems: [
            { id: "item-1", projectId: "project-1", fields: [{ name: "Priority", value: "1" }] },
          ],
        }),
        makeIssue({
          number: 2,
          projectItems: [
            { id: "item-2", projectId: "project-1", fields: [{ name: "Priority", value: "9" }] },
          ],
        }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", {
        projectId: "project-1",
        view: "Sprint",
      });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("skips a task that is already claimed on another board", async () => {
      // The same issue is tracked on two boards. It is being worked on one of
      // them, so it must not be handed out on the other.
      issuesFixture = [
        makeIssue({
          number: 1,
          projectItems: [
            { id: "item-1-alpha", projectId: "project-alpha", claimedBy: "agent-other" },
            { id: "item-1-beta", projectId: "project-beta" },
          ],
        }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { projectId: "project-beta" });

      expect(result.success).toBe(false);
      expect(persistedClaims.has("item-1-beta")).toBe(false);
      expect(persistedClaims.has("item-1-alpha")).toBe(false);
    });

    it("fails direct assignment when issue is not in the requested project", async () => {
      issuesFixture = [makeIssue({ number: 7 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", {
        issueNumber: 7,
        projectId: "project-other",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not in project project-other");
      expect(mockAgentStore.writes).toHaveLength(0);
      expect(persistedClaims.size).toBe(0);
    });

    it("returns failure when no tasks are available", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));
      const result = await service.checkoutTask("agent-1");
      expect(result.success).toBe(false);
      expect(result.message).toContain("No unclaimed tasks");
    });

    it("rejects agents that already hold a task", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1", { currentTaskId: "99" }));
      const result = await service.checkoutTask("agent-1");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already has a task");
    });
  });

  describe("checkoutTask — dependency awareness", () => {
    it("skips issues blocked by an open issue when skipBlocked is set", async () => {
      issuesFixture = [makeIssue({ number: 1, body: "Blocked by #2" }), makeIssue({ number: 2 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("skips issues with a blocked label when skipBlocked is set", async () => {
      issuesFixture = [makeIssue({ number: 1, labels: ["blocked"] }), makeIssue({ number: 2 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("does not filter blocked issues when skipBlocked is unset", async () => {
      issuesFixture = [makeIssue({ number: 1, body: "Blocked by #2" }), makeIssue({ number: 2 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { strategy: "oldest_first" });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(1);
    });

    it("skips issues whose native blocker edge points at an open issue", async () => {
      // The native "blocked by" edge is authoritative — no label, no body
      // reference.
      issuesFixture = [makeIssue({ number: 1, blockedBy: [2] }), makeIssue({ number: 2 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("honors every blocker reference in supported phrases", async () => {
      issuesFixture = [
        makeIssue({ number: 1, body: "Depends on #99 and #2" }),
        makeIssue({ number: 2 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1", { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });
  });

  describe("checkoutTask — atomic claim guard", () => {
    it("aborts when another agent claims the item between read and write", async () => {
      issuesFixture = [makeIssue({ number: 1 })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1"));

      // Simulate a claim that landed between the candidate list fetch and
      // the claim write: the fresh claim-time item read shows the issue has
      // been claimed by another agent (TOCTOU window).
      graphqlMock.mockImplementation(async (query: string, vars: GraphqlVars) => {
        // The pre-write check sees another agent's claim → abort.
        if (vars.itemId && query.includes("node(")) {
          return {
            node: {
              project: { id: "project-1" },
              fieldValues: {
                nodes: [{ field: { name: "agent_claimed_by" }, text: "agent-other" }],
              },
            },
          };
        }
        if (vars.owner && vars.repo) {
          return {
            repository: {
              issues: {
                nodes: issuesFixture,
                pageInfo: { hasNextPage: false },
              },
            },
          };
        }
        if (vars.projectId && !vars.itemId) return LIST_FIELDS_RESPONSE;
        if (vars.number != null) {
          return {
            repository: {
              issue: { projectItems: { nodes: [{ id: "item-1", project: { id: "project-1" } }] } },
            },
          };
        }
        return { node: { fields: { nodes: [] } } };
      });

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("concurrently");
      expect(mockAgentStore.writes).toHaveLength(0);
    });
  });

  describe("releaseTask", () => {
    it("returns project release failures without clearing the agent registry claim", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1", { currentTaskId: "42" }));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];
      graphqlMock.mockImplementation(async (query: string, vars: GraphqlVars) => {
        if (query.includes("clearProjectV2ItemFieldValue"))
          throw new Error("project update failed");
        if (vars.projectId && vars.itemId === undefined && vars.number === undefined) {
          return LIST_FIELDS_RESPONSE;
        }
        if (vars.number != null) {
          return {
            repository: {
              issue: { projectItems: { nodes: [{ id: "item-42", project: { id: "project-1" } }] } },
            },
          };
        }
        return { node: { fields: { nodes: [] } } };
      });

      const result = await service.releaseTask("agent-1", "42");

      expect(result.success).toBe(false);
      expect(result.message).toContain("project update failed");
      expect(mockAgentStore.writes).toHaveLength(0);
    });
  });

  describe("review workflow", () => {
    it("submits a task for review and updates agent status", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("agent-1", { currentTaskId: "42" }));
      issuesFixture = [makeIssue({ number: 42, status: "in_progress" })];

      const result = await service.submitForReview("agent-1", "42", "Done");

      expect(result.success).toBe(true);
      expect(octokit.rest.issues.createComment).toHaveBeenCalled();
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ status: "needs_review" })
      );
    });

    it("approves a task and closes the issue", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("reviewer-1", { currentTaskId: "42" }));
      issuesFixture = [makeIssue({ number: 42, status: "review" })];

      const result = await service.approveTask("reviewer-1", "42", "LGTM");

      expect(result.success).toBe(true);
      expect(octokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ state: "closed" })
      );
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ status: "idle", currentTaskId: undefined })
      );
    });

    it("rejects a task and returns it to the pool", async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("reviewer-1", { currentTaskId: "42" }));
      issuesFixture = [makeIssue({ number: 42, status: "review" })];

      const result = await service.rejectTask("reviewer-1", "42", "Add tests");

      expect(result.success).toBe(true);
      expect(result.message).toContain("returned to pool");
      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining("Add tests") })
      );
    });

    it("approve releases the original submitting agent (not just the reviewer)", async () => {
      mockAgentStore.agents.set(
        "agent-1",
        makeAgent("agent-1", { currentTaskId: "42", status: "needs_review" })
      );
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("reviewer-1", { currentTaskId: "77" }));
      mockAgentStore.listAgents.mockResolvedValue([
        makeAgent("agent-1", { currentTaskId: "42", status: "needs_review" }),
        makeAgent("reviewer-1", { currentTaskId: "77" }),
      ]);
      issuesFixture = [makeIssue({ number: 42, status: "review" })];

      const result = await service.approveTask("reviewer-1", "42", "LGTM");

      expect(result.success).toBe(true);
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ id: "agent-1", status: "idle", currentTaskId: undefined })
      );
    });

    it("reject releases the original submitting agent", async () => {
      mockAgentStore.agents.set(
        "agent-1",
        makeAgent("agent-1", { currentTaskId: "42", status: "needs_review" })
      );
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("reviewer-1", { currentTaskId: "77" }));
      mockAgentStore.listAgents.mockResolvedValue([
        makeAgent("agent-1", { currentTaskId: "42", status: "needs_review" }),
        makeAgent("reviewer-1", { currentTaskId: "77" }),
      ]);
      issuesFixture = [makeIssue({ number: 42, status: "review" })];

      const result = await service.rejectTask("reviewer-1", "42", "Fix tests");

      expect(result.success).toBe(true);
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ id: "agent-1", status: "idle", currentTaskId: undefined })
      );
    });

    it("review queue checkout returns a task in review state", async () => {
      issuesFixture = [makeIssue({ number: 1 }), makeIssue({ number: 2, status: "review" })];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent("reviewer-1", { role: "reviewer" }));

      const result = await service.checkoutTask("agent-r", { reviewQueue: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it("reviewer checkout succeeds after submit_for_review clears submitter project claim", async () => {
      mockAgentStore.agents.set(
        "agent-1",
        makeAgent("agent-1", { currentTaskId: "42", status: "working" })
      );
      mockAgentStore.agents.set("reviewer-1", makeAgent("reviewer-1", { role: "reviewer" }));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];

      const submitted = await service.submitForReview("agent-1", "42", "Ready");
      const checkedOut = await service.checkoutTask("reviewer-1", { reviewQueue: true });

      expect(submitted.success).toBe(true);
      expect(checkedOut.success).toBe(true);
      expect(checkedOut.issueNumber).toBe(42);
      expect(persistedClaims.get("item-42")).toBe("reviewer-1");

      const approved = await service.approveTask("reviewer-1", "42", "LGTM");
      expect(approved.success).toBe(true);
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ id: "agent-1", status: "idle", currentTaskId: undefined })
      );
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ id: "reviewer-1", status: "idle", currentTaskId: undefined })
      );
    });
  });

  describe("reclaimStaleTasks", () => {
    it("does nothing and never bootstraps the registry when none exists", async () => {
      mockAgentStore.registryExists.mockResolvedValue(false);

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(0);
      expect(mockAgentStore.listAgents).not.toHaveBeenCalled();
    });

    const minutesAgo = (minutes: number): string =>
      new Date(Date.now() - minutes * 60_000).toISOString();
    const batchReads = (): unknown[][] =>
      graphqlMock.mock.calls.filter(([query]) => String(query).includes("i0: issue("));
    const clearMutations = (): unknown[][] =>
      graphqlMock.mock.calls.filter(([query]) => String(query).includes("clearProjectV2Item"));
    const holding = (id: string, task: string, heartbeat: string): Agent =>
      makeAgent(id, { currentTaskId: task, status: "working", lastHeartbeat: heartbeat });

    it("reclaims tasks from stale agents, posts an audit comment, marks offline", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(60)));
      mockAgentStore.agents.set("agent-2", holding("agent-2", "43", minutesAgo(0)));
      issuesFixture = [
        makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" }),
        makeIssue({ number: 43, claimedBy: "agent-2", status: "in_progress" }),
      ];

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(1);
      expect(result.details).toEqual([{ agentId: "agent-1", taskId: "42" }]);
      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining("Agent Task Auto-Reclaimed") })
      );
      expect(mockAgentStore.writes).toContainEqual(
        expect.objectContaining({ id: "agent-1", status: "offline", currentTaskId: undefined })
      );
      expect(mockAgentStore.agents.get("agent-2")?.currentTaskId).toBe("43");
    });

    it("does NOT reclaim an agent whose item heartbeat is recent although its registry beat is old", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(120)));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];
      persistedHeartbeats.set("item-42", { at: minutesAgo(2) });

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(0);
      expect(mockAgentStore.writes).toHaveLength(0);
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(clearMutations()).toHaveLength(0);
      expect(mockAgentStore.agents.get("agent-1")?.currentTaskId).toBe("42");
    });

    it("reclaims when the item heartbeat is stale too", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(120)));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];
      persistedHeartbeats.set("item-42", { at: minutesAgo(90) });

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(1);
      expect(clearMutations().length).toBeGreaterThan(0);
    });

    it("falls back to the registry beat when the item has no heartbeat value yet", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(120)));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(1);
    });

    it("ignores a heartbeat on an item that another agent now claims", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(120)));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-other", status: "in_progress" })];
      persistedHeartbeats.set("item-42", { at: minutesAgo(1) });

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(1);
    });

    it("reads no board state at all while every registry beat is fresh", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(1)));

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(0);
      expect(graphqlMock).not.toHaveBeenCalled();
    });

    it("looks up all stale candidates in ONE batched GraphQL request", async () => {
      for (const [id, task] of [
        ["agent-1", "42"],
        ["agent-2", "43"],
        ["agent-3", "44"],
      ]) {
        mockAgentStore.agents.set(id, holding(id, task, minutesAgo(90)));
      }
      issuesFixture = [
        makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" }),
        makeIssue({ number: 43, claimedBy: "agent-2", status: "in_progress" }),
        makeIssue({ number: 44, claimedBy: "agent-3", status: "in_progress" }),
      ];

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(3);
      expect(batchReads()).toHaveLength(1);
      expect(String(batchReads()[0][0])).toContain("issue(number: 44)");
    });

    it("reclaims nothing when the board cannot be read: staleness is unproven", async () => {
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(120)));
      graphqlMock.mockRejectedValue(new Error("graphql down"));

      await expect(service.reclaimStaleTasks(30)).rejects.toThrow();

      expect(mockAgentStore.writes).toHaveLength(0);
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(mockAgentStore.agents.get("agent-1")?.currentTaskId).toBe("42");
    });

    it("does not release an agent that moved on after it was judged stale", async () => {
      const judged = holding("agent-1", "42", minutesAgo(120));
      mockAgentStore.listAgents.mockResolvedValue([judged]);
      mockAgentStore.agents.set("agent-1", holding("agent-1", "42", minutesAgo(1)));
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(0);
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(mockAgentStore.agents.get("agent-1")?.currentTaskId).toBe("42");
    });
  });

  describe("processHeartbeat — hot state on the claimed item", () => {
    const minutesAgo = (minutes: number): string =>
      new Date(Date.now() - minutes * 60_000).toISOString();
    const mutationCalls = (): unknown[][] =>
      graphqlMock.mock.calls.filter(([query]) => String(query).includes("u0: updateProjectV2Item"));
    const targetLookups = (): unknown[][] =>
      graphqlMock.mock.calls.filter(
        ([query, vars]) =>
          String(query).includes("issue(number: $number)") && (vars as GraphqlVars).number === 42
      );

    beforeEach(() => {
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-1", status: "in_progress" })];
      mockAgentStore.agents.set(
        "agent-1",
        makeAgent("agent-1", {
          currentTaskId: "42",
          currentTaskTitle: "Task 42",
          status: "working",
          lastHeartbeat: minutesAgo(1),
        })
      );
    });

    it("writes heartbeat, progress and branch onto the item and nothing to the registry", async () => {
      const result = await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        progress: 50,
        progressSummary: "Halfway",
        currentBranch: "feat/x",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(true);
      expect(persistedHeartbeats.get("item-42")).toEqual({
        at: "2026-10-28T10:00:00.000Z",
        progress: 50,
        branch: "feat/x",
      });
      expect(mockAgentStore.writes).toHaveLength(0);
    });

    it("writes only the timestamp when no progress or branch is supplied", async () => {
      await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(persistedHeartbeats.get("item-42")).toEqual({ at: "2026-10-28T10:00:00.000Z" });
    });

    it("twenty beats cost one GraphQL mutation each, resolve the item once and commit nothing to the registry", async () => {
      for (let beat = 0; beat < 20; beat++) {
        const result = await service.processHeartbeat({
          agentId: "agent-1",
          status: "working",
          progress: beat,
          timestamp: new Date(Date.now() + beat * 1000).toISOString(),
        });
        expect(result.success).toBe(true);
      }

      expect(mutationCalls()).toHaveLength(20);
      expect(targetLookups()).toHaveLength(1);
      expect(mockAgentStore.writes).toHaveLength(0);
    });

    it("writes the registry when a cold field (status) changes, and keeps no heartbeat history", async () => {
      await service.processHeartbeat({
        agentId: "agent-1",
        status: "blocked",
        progress: 10,
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(mockAgentStore.writes).toHaveLength(1);
      const saved = mockAgentStore.writes[0];
      expect(saved.status).toBe("blocked");
      expect(saved.lastHeartbeat).toBe("2026-10-28T10:00:00.000Z");
      expect(saved.metadata?.heartbeatHistory).toBeUndefined();
      expect(saved.metadata?.progress).toBeUndefined();
    });

    it("refreshes the registry beat of an idle agent only once it is older than the stale threshold", async () => {
      mockAgentStore.agents.set("idle-1", makeAgent("idle-1", { lastHeartbeat: minutesAgo(5) }));

      await service.processHeartbeat({
        agentId: "idle-1",
        status: "idle",
        timestamp: new Date().toISOString(),
      });
      expect(mockAgentStore.writes).toHaveLength(0);

      mockAgentStore.agents.set("idle-1", makeAgent("idle-1", { lastHeartbeat: minutesAgo(45) }));
      const fresh = new Date().toISOString();
      await service.processHeartbeat({ agentId: "idle-1", status: "idle", timestamp: fresh });

      expect(mockAgentStore.writes).toHaveLength(1);
      expect(mockAgentStore.writes[0].lastHeartbeat).toBe(fresh);
      expect(graphqlMock).not.toHaveBeenCalled();
    });

    it("stores the first beat of an idle agent that never had one", async () => {
      mockAgentStore.agents.set("idle-2", makeAgent("idle-2"));

      await service.processHeartbeat({
        agentId: "idle-2",
        status: "idle",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(mockAgentStore.writes[0]?.lastHeartbeat).toBe("2026-10-28T10:00:00.000Z");
    });

    it("a subagent's beat lands on the item its parent claimed", async () => {
      mockAgentStore.agents.set(
        "child-1",
        makeAgent("child-1", { parentAgentId: "agent-1", currentTaskId: "42", status: "working" })
      );

      const result = await service.processHeartbeat({
        agentId: "child-1",
        status: "working",
        progress: 30,
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(true);
      expect(persistedHeartbeats.get("item-42")?.at).toBe("2026-10-28T10:00:00.000Z");
      expect(mockAgentStore.writes).toHaveLength(0);
    });

    it("creates a missing agent_heartbeat_at field on a legacy project and records the beat", async () => {
      removeFields("agent_heartbeat_at", "agent_progress");

      const result = await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        progress: 25,
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(true);
      expect(createdFieldNames()).toEqual(["agent_heartbeat_at", "agent_progress"]);
      expect(persistedHeartbeats.get("item-42")).toMatchObject({
        at: "2026-10-28T10:00:00.000Z",
        progress: 25,
      });
      expect(mockAgentStore.writes).toHaveLength(0);
    });

    it("creates a missing agent_progress field and stores the progress", async () => {
      removeFields("agent_progress");

      const result = await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        progress: 40,
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(true);
      expect(createdFieldNames()).toEqual(["agent_progress"]);
      expect(persistedHeartbeats.get("item-42")?.progress).toBe(40);
    });

    it("returns the actionable setup_fields / admin error when a heartbeat cannot create the field", async () => {
      removeFields("agent_heartbeat_at");
      createFieldMock.mockRejectedValue(
        new Error("Resource not accessible by personal access token")
      );

      const result = await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/setup_fields/);
      expect(result.message).toMatch(/admin/i);
      expect(persistedHeartbeats.size).toBe(0);
      expect(mockAgentStore.writes).toHaveLength(0);
    });

    it("tells an agent whose claim was lost that its task is no longer claimed by it", async () => {
      issuesFixture = [makeIssue({ number: 42, claimedBy: "agent-other", status: "in_progress" })];

      const result = await service.processHeartbeat({
        agentId: "agent-1",
        status: "working",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Task #42 is not claimed by agent-1/);
      expect(persistedHeartbeats.size).toBe(0);
    });

    it("reports an unknown agent", async () => {
      const result = await service.processHeartbeat({
        agentId: "ghost",
        status: "idle",
        timestamp: "2026-10-28T10:00:00.000Z",
      });

      expect(result).toEqual({ success: false, message: "Agent not found: ghost" });
    });
  });

  describe("checkoutTask — hot state", () => {
    it("stamps agent_heartbeat_at on the claimed item and the same time in the registry", async () => {
      issuesFixture = [makeIssue({ number: 1 })];
      mockAgentStore.agents.set("agent-1", makeAgent("agent-1"));

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(true);
      const stored = mockAgentStore.agents.get("agent-1");
      expect(stored?.lastHeartbeat).toBeDefined();
      expect(persistedHeartbeats.get("item-1")?.at).toBe(stored?.lastHeartbeat);
    });

    describe("legacy project without the hot fields", () => {
      const reads = (): number =>
        (mockFactory.createProjectRepository as unknown as Mock).mock.calls.length;

      beforeEach(() => {
        removeFields("agent_heartbeat_at", "agent_progress");
        mockAgentStore.agents.set("agent-1", makeAgent("agent-1"));
        mockAgentStore.agents.set("agent-2", makeAgent("agent-2"));
      });

      it("provisions the missing fields on the first checkout and then succeeds", async () => {
        issuesFixture = [makeIssue({ number: 1 })];

        const result = await service.checkoutTask("agent-1");

        expect(result.success).toBe(true);
        expect(createdFieldNames()).toEqual(["agent_heartbeat_at", "agent_progress"]);
        expect(persistedClaims.get("item-1")).toBe("agent-1");
        expect(persistedHeartbeats.get("item-1")?.at).toBe(
          mockAgentStore.agents.get("agent-1")?.lastHeartbeat
        );
      });

      it("does not provision again on later calls for the same project", async () => {
        issuesFixture = [makeIssue({ number: 1 }), makeIssue({ number: 2 })];

        expect((await service.checkoutTask("agent-1")).success).toBe(true);
        const afterFirst = reads();
        expect((await service.checkoutTask("agent-2")).success).toBe(true);

        expect(afterFirst).toBeGreaterThan(0);
        expect(reads()).toBe(afterFirst);
        expect(createdFieldNames()).toEqual(["agent_heartbeat_at", "agent_progress"]);
      });

      it("shares one in-flight provisioning between concurrent first calls", async () => {
        issuesFixture = [
          makeIssue({ number: 1, labels: ["lane-a"] }),
          makeIssue({ number: 2, labels: ["lane-b"] }),
        ];

        const [first, second] = await Promise.all([
          service.checkoutTask("agent-1", { labels: ["lane-a"] }),
          service.checkoutTask("agent-2", { labels: ["lane-b"] }),
        ]);

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(createdFieldNames()).toEqual(["agent_heartbeat_at", "agent_progress"]);
      });

      it("fails hard, claiming nothing, when an existing field has an incompatible type", async () => {
        issuesFixture = [makeIssue({ number: 1 })];
        fieldsResponse = {
          node: {
            fields: {
              nodes: fieldsResponse.node.fields.nodes.map((field) =>
                field.name === "agent_claimed_by" ? { ...field, dataType: "NUMBER" } : field
              ),
            },
          },
        };

        await expect(service.checkoutTask("agent-1")).rejects.toThrow(/incompatible data type/i);
        expect(createdFieldNames()).toEqual([]);
        expect(persistedClaims.size).toBe(0);
        expect(mockAgentStore.writes).toHaveLength(0);
      });

      it("returns the actionable setup_fields / admin error when the token may not create fields", async () => {
        issuesFixture = [makeIssue({ number: 1 })];
        createFieldMock.mockRejectedValue(
          new Error("Resource not accessible by personal access token")
        );

        const result = await service.checkoutTask("agent-1");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/setup_fields/);
        expect(result.message).toMatch(/admin/i);
        expect(persistedClaims.size).toBe(0);
        expect(mockAgentStore.writes).toHaveLength(0);
      });

      it("retries provisioning on the next call after a permission failure", async () => {
        issuesFixture = [makeIssue({ number: 1 })];
        createFieldMock.mockRejectedValueOnce(
          new Error("Resource not accessible by personal access token")
        );

        expect((await service.checkoutTask("agent-1")).success).toBe(false);
        expect((await service.checkoutTask("agent-1")).success).toBe(true);
      });
    });
  });
});
