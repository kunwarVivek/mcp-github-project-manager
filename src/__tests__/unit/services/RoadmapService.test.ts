import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ResourceStatus, ResourceType } from "../../../domain/resource-types";
import type { ILogger } from "../../../infrastructure/logger";
import { RoadmapService } from "../../../services/RoadmapService";
import { partialFake } from "../../helpers/aiFakes";
import { asFactory } from "../../helpers/mockTypes";

describe("RoadmapService.createRoadmap", () => {
  let projectCreate: Mock;
  let milestoneCreate: Mock;
  let issueCreate: Mock;
  let service: RoadmapService;

  const roadmap = {
    project: { title: "Platform", owner: "acme", visibility: "public" as const },
    milestones: [
      {
        milestone: { title: "M1", description: "First", dueDate: "2030-01-01T00:00:00.000Z" },
        issues: [
          { title: "Issue A", description: "a" },
          { title: "Issue B", description: "b", labels: ["bug"] },
        ],
      },
      {
        milestone: { title: "M2", description: "" },
        issues: [{ title: "Issue C", description: "c" }],
      },
    ],
  };

  beforeEach(() => {
    let milestoneSeq = 0;
    let issueSeq = 0;
    projectCreate = vi.fn(async (data: object) => ({ id: "project-1", ...data }));
    milestoneCreate = vi.fn(async (data: object) => ({ id: `m${++milestoneSeq}`, ...data }));
    issueCreate = vi.fn(async (data: object) => ({ id: `i${++issueSeq}`, ...data }));

    service = new RoadmapService(
      asFactory({
        createProjectRepository: () => ({ create: projectCreate }),
        createMilestoneRepository: () => ({ create: milestoneCreate }),
        createIssueRepository: () => ({ create: issueCreate }),
      }),
      partialFake<ILogger>({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
    );
  });

  it("creates the project as an active resource with the requested visibility", async () => {
    await service.createRoadmap(roadmap);

    expect(projectCreate).toHaveBeenCalledOnce();
    expect(projectCreate.mock.calls[0][0]).toMatchObject({
      title: "Platform",
      owner: "acme",
      visibility: "public",
      type: ResourceType.PROJECT,
      status: ResourceStatus.ACTIVE,
    });
  });

  it("defaults the project visibility to private", async () => {
    await service.createRoadmap({ ...roadmap, project: { title: "Platform", owner: "acme" } });

    expect(projectCreate.mock.calls[0][0]).toMatchObject({ visibility: "private" });
  });

  it("creates each milestone with its issues attached to that milestone", async () => {
    const result = await service.createRoadmap(roadmap);

    expect(result.project).toMatchObject({ id: "project-1", title: "Platform" });
    expect(result.milestones.map((m) => m.title)).toEqual(["M1", "M2"]);
    expect(result.milestones[0].issues.map((i) => i.title)).toEqual(["Issue A", "Issue B"]);
    expect(result.milestones[1].issues.map((i) => i.title)).toEqual(["Issue C"]);

    expect(issueCreate.mock.calls.map(([arg]) => arg.milestoneId)).toEqual(["m1", "m1", "m2"]);
    expect(issueCreate.mock.calls[1][0]).toMatchObject({ title: "Issue B", labels: ["bug"] });
  });

  it("fills in an empty description when a milestone has none", async () => {
    await service.createRoadmap({
      project: roadmap.project,
      milestones: [{ milestone: { title: "No description" }, issues: [] }],
    } as never);

    expect(milestoneCreate.mock.calls[0][0]).toMatchObject({
      title: "No description",
      description: "",
    });
  });

  it("keeps the milestone and the remaining issues when one issue fails to create", async () => {
    issueCreate.mockImplementationOnce(async () => {
      throw new Error("issue API down");
    });

    const result = await service.createRoadmap(roadmap);

    expect(result.milestones[0].issues.map((i) => i.title)).toEqual(["Issue B"]);
    expect(result.milestones[1].issues.map((i) => i.title)).toEqual(["Issue C"]);
  });

  it("rejects invalid input before touching GitHub", async () => {
    await expect(
      service.createRoadmap({ ...roadmap, project: { title: "", owner: "acme" } })
    ).rejects.toThrow(/Project title is required/);

    expect(projectCreate).not.toHaveBeenCalled();
    expect(milestoneCreate).not.toHaveBeenCalled();
  });

  it("surfaces a milestone creation failure as an MCP error and stops", async () => {
    milestoneCreate.mockRejectedValueOnce(new Error("milestone API down"));

    await expect(service.createRoadmap(roadmap)).rejects.toThrow(/milestone API down/);
    expect(issueCreate).not.toHaveBeenCalled();
  });
});
