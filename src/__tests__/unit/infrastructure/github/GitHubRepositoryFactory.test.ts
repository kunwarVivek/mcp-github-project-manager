import { describe, expect, it } from "vitest";
import { createAppInstallationAuth } from "../../../../infrastructure/github/auth/credentials";
import { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import { tokenAuth } from "../../../helpers/githubAuth";

describe("GitHubRepositoryFactory.fromAuth", () => {
  it("builds from GitHub App credentials without any PAT", () => {
    const factory = GitHubRepositoryFactory.fromAuth(
      createAppInstallationAuth({ appId: "1", privateKey: "key", installationId: "2" }),
      "owner",
      "repo"
    );

    expect(factory.getConfig().owner).toBe("owner");
    expect("token" in factory.getConfig()).toBe(false);
    expect(factory.createIssueRepository()).toBeDefined();
  });

  it("builds from a static token credential", () => {
    const factory = GitHubRepositoryFactory.fromAuth(tokenAuth("pat"), "owner", "repo");

    expect(factory.getConfig().repo).toBe("repo");
    expect("token" in factory.getConfig()).toBe(false);
    expect(factory.createIssueRepository()).toBeDefined();
  });

  it("shares one rate-limit manager across the factory and its repositories", () => {
    const factory = GitHubRepositoryFactory.fromAuth(tokenAuth("pat"), "o", "r");
    const issues = factory.createIssueRepository();

    expect(factory.getRateLimitManager()).toBe(
      (issues as unknown as { executor: { rateLimiter: unknown } }).executor.rateLimiter
    );
  });
});
