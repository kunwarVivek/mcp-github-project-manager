import { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, type Mocked, type MockedClass, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectWorkflowRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectWorkflowRepository";

// Mock Octokit and GraphQL response
vi.mock("@octokit/rest");

const PROJECT_ID = "PVT_kwDOLhQ7gc4AOEbH";
const WORKFLOW_ID = "PVW_kwDOLhQ7gc4AOEbH";

/** A `ProjectV2Workflow` node exactly as the live GraphQL API returns it. */
const workflowNode = {
  id: WORKFLOW_ID,
  name: "Auto-add issues",
  number: 3,
  enabled: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-02-01T00:00:00Z",
  project: { id: PROJECT_ID },
};

describe("GitHubProjectWorkflowRepository", () => {
  let repository: GitHubProjectWorkflowRepository;
  let mockOctokit: Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit = {
      graphql: vi.fn(),
    } as unknown as Mocked<Octokit>;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit);

    config = new GitHubConfig("test-owner", "test-repo", "test-token");
    repository = new GitHubProjectWorkflowRepository(mockOctokit, config);
  });

  describe("findByProject", () => {
    it("returns the workflows of a project with their name, number and enabled state", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({
        node: { workflows: { totalCount: 1, nodes: [workflowNode] } },
      });

      const workflows = await repository.findByProject(PROJECT_ID);

      expect(workflows).toEqual([
        {
          id: WORKFLOW_ID,
          name: "Auto-add issues",
          number: 3,
          enabled: true,
          projectId: PROJECT_ID,
          createdAt: new Date("2025-01-01T00:00:00Z"),
          updatedAt: new Date("2025-02-01T00:00:00Z"),
        },
      ]);
    });

    it("queries the project workflow connection", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({
        node: { workflows: { totalCount: 0, nodes: [] } },
      });

      await repository.findByProject(PROJECT_ID);

      const [query, variables] = mockOctokit.graphql.mock.calls[0];
      expect(query).toContain("... on ProjectV2");
      expect(query).toContain("workflows(first: $first)");
      expect(variables).toMatchObject({ projectId: PROJECT_ID, first: 100 });
    });

    it("returns an empty list when the project has no workflows", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({
        node: { workflows: { totalCount: 0, nodes: [] } },
      });

      await expect(repository.findByProject(PROJECT_ID)).resolves.toEqual([]);
    });

    it("surfaces API errors", async () => {
      mockOctokit.graphql.mockRejectedValueOnce(new Error("Could not resolve to a ProjectV2"));

      await expect(repository.findByProject(PROJECT_ID)).rejects.toThrow(
        "Could not resolve to a ProjectV2"
      );
    });
  });

  describe("findById", () => {
    it("returns the workflow addressed by its node id", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({ node: workflowNode });

      const workflow = await repository.findById(WORKFLOW_ID);

      expect(workflow).toEqual({
        id: WORKFLOW_ID,
        name: "Auto-add issues",
        number: 3,
        enabled: true,
        projectId: PROJECT_ID,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-02-01T00:00:00Z"),
      });
    });

    it("looks the workflow up through the node query", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({ node: workflowNode });

      await repository.findById(WORKFLOW_ID);

      const [query, variables] = mockOctokit.graphql.mock.calls[0];
      expect(query).toContain("... on ProjectV2Workflow");
      expect(variables).toMatchObject({ id: WORKFLOW_ID });
    });

    it("returns null when the node resolves to nothing", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({ node: null });

      await expect(repository.findById(WORKFLOW_ID)).resolves.toBeNull();
    });

    it("surfaces the error for an unknown workflow id", async () => {
      mockOctokit.graphql.mockRejectedValueOnce(
        new Error(`Could not resolve to a node with the global id of ${WORKFLOW_ID}`)
      );

      await expect(repository.findById(WORKFLOW_ID)).rejects.toThrow(
        "Could not resolve to a node with the global id of"
      );
    });
  });

  describe("delete", () => {
    it("deletes the workflow through the deleteProjectV2Workflow mutation", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({
        deleteProjectV2Workflow: { deletedWorkflowId: WORKFLOW_ID, projectV2: { id: PROJECT_ID } },
      });

      await expect(repository.delete(WORKFLOW_ID)).resolves.toBeUndefined();

      const [query, variables] = mockOctokit.graphql.mock.calls[0];
      expect(query).toContain("deleteProjectV2Workflow");
      expect(query).toContain("DeleteProjectV2WorkflowInput");
      expect(variables).toMatchObject({ input: { workflowId: WORKFLOW_ID } });
    });

    it("fails when the mutation reports no deleted workflow", async () => {
      mockOctokit.graphql.mockResolvedValueOnce({
        deleteProjectV2Workflow: { deletedWorkflowId: null, projectV2: { id: PROJECT_ID } },
      });

      await expect(repository.delete(WORKFLOW_ID)).rejects.toThrow(
        `Project workflow ${WORKFLOW_ID} was not deleted`
      );
    });

    it("surfaces the error for an unknown workflow id", async () => {
      mockOctokit.graphql.mockRejectedValueOnce(
        new Error(`Could not resolve to a node with the global id of ${WORKFLOW_ID}`)
      );

      await expect(repository.delete(WORKFLOW_ID)).rejects.toThrow(
        "Could not resolve to a node with the global id of"
      );
    });
  });
});
