import { describe, expect, it } from "vitest";
import {
  blockerLabelName,
  IssueEntity,
  IssueType,
  parseBlockerLabelNumbers,
  parseIssueTypeLabel,
} from "../../../../domain/entities/IssueEntity";
import { ResourceStatus } from "../../../../domain/resource-types";
import type { Issue } from "../../../../domain/types";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    number: 7,
    title: "Blocked issue",
    description: "body",
    status: ResourceStatus.ACTIVE,
    assignees: [],
    labels: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    url: "https://github.com/o/r/issues/7",
    ...overrides,
  };
}

describe("IssueEntity — native issue capabilities", () => {
  it("prefers the native issue type over the type label", () => {
    const issue = IssueEntity.fromData(
      makeIssue({ issueTypeName: "Bug", issueTypeId: "IT_1", labels: ["type:task"] })
    );

    expect(issue.nativeIssueType).toBe("Bug");
    expect(issue.issueType).toBe(IssueType.BUG);
  });

  it("falls back to the type label when there is no native issue type", () => {
    const issue = IssueEntity.fromData(makeIssue({ labels: ["type:bug"] }));

    expect(issue.nativeIssueType).toBeNull();
    expect(issue.issueType).toBe(IssueType.BUG);
  });

  it("reports the native blocked-by edges", () => {
    const issue = IssueEntity.fromData(makeIssue({ blockedBy: [3, 5] }));

    expect(issue.blockedBy).toEqual([3, 5]);
    expect(issue.isBlocked).toBe(true);
  });

  it("keeps the label emulation visible next to the native edges", () => {
    const issue = IssueEntity.fromData(
      makeIssue({ blockedBy: [3], labels: ["blocked-by:#3", "blocked-by:#5"] })
    );

    expect(issue.blockedBy).toEqual([3, 5]);
  });

  it("reads the blockers from the label emulation when there are no native edges", () => {
    const issue = IssueEntity.fromData(makeIssue({ labels: ["blocked-by:#5"] }));

    expect(issue.blockedBy).toEqual([5]);
    expect(issue.isBlocked).toBe(true);
  });

  it("reports the issues it blocks", () => {
    const issue = IssueEntity.fromData(makeIssue({ blocking: [9] }));

    expect(issue.blocking).toEqual([9]);
  });

  it("round-trips the native fields", () => {
    const issue = IssueEntity.fromData(
      makeIssue({
        issueTypeName: "Bug",
        issueTypeId: "IT_1",
        blockedBy: [3],
        blocking: [9],
        projectIds: ["PVT_1"],
      })
    );

    const data = issue.toData();

    expect(data.issueTypeName).toBe("Bug");
    expect(data.issueTypeId).toBe("IT_1");
    expect(data.blockedBy).toEqual([3]);
    expect(data.blocking).toEqual([9]);
    expect(data.projectIds).toEqual(["PVT_1"]);
  });
});

describe("issue label emulation helpers", () => {
  it("builds the blocker label of an issue number", () => {
    expect(blockerLabelName(12)).toBe("blocked-by:#12");
  });

  it("parses the blocker numbers of a label set", () => {
    expect(parseBlockerLabelNumbers(["blocked-by:#3", "blocked-by:5", "bug"])).toEqual([3, 5]);
    expect(parseBlockerLabelNumbers(["bug"])).toEqual([]);
  });

  it("parses the issue type of a label set", () => {
    expect(parseIssueTypeLabel(["type:bug", "other"])).toBe("bug");
    expect(parseIssueTypeLabel(["other"])).toBeNull();
  });
});
