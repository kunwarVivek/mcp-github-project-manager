import { describe, expect, it } from "vitest";
import { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";

describe("GitHubRepositoryFactory.fromAuth", () => {
  it("builds from GitHub App credentials without any PAT", () => {
    const factory = GitHubRepositoryFactory.fromAuth(
      { kind: "app", appId: "1", privateKey: "key", installationId: "2" },
      "owner",
      "repo"
    );

    expect(factory.getConfig().auth.kind).toBe("app");
    expect(factory.getConfig().token).toBeUndefined();
    expect(factory.createIssueRepository()).toBeDefined();
  });

  it("builds from a PAT", () => {
    const factory = GitHubRepositoryFactory.fromAuth(
      { kind: "pat", token: "pat" },
      "owner",
      "repo"
    );

    expect(factory.getConfig().token).toBe("pat");
  });

  it("rejects an empty PAT", () => {
    expect(() =>
      GitHubRepositoryFactory.fromAuth({ kind: "pat", token: "" }, "owner", "repo")
    ).toThrow("Token is required");
  });

  it("shares one rate-limit manager across the factory and its repositories", () => {
    const factory = GitHubRepositoryFactory.fromAuth({ kind: "pat", token: "pat" }, "o", "r");
    const issues = factory.createIssueRepository();

    expect(factory.getRateLimitManager()).toBe(
      (issues as unknown as { executor: { rateLimiter: unknown } }).executor.rateLimiter
    );
  });
});
