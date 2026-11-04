import { describe, expect, it } from "vitest";
import { GitHubConfig } from "../../../../infrastructure/github/GitHubConfig";

describe("GitHubConfig", () => {
  const owner = "test-owner";
  const repo = "test-repo";

  it("should create a config instance with all properties", () => {
    const config = new GitHubConfig(owner, repo, "PVT_project");

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
    expect(config.projectId).toBe("PVT_project");
  });

  it("should not allow modification of properties", () => {
    const config = new GitHubConfig(owner, repo);

    expect(() => {
      Object.assign(config, { owner: "new-owner" });
    }).toThrow();

    expect(() => {
      Object.assign(config, { repo: "new-repo" });
    }).toThrow();

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
  });

  it("carries no credential: nothing token-like is reachable from the config", () => {
    const config = new GitHubConfig(owner, repo);

    expect("token" in config).toBe(false);
    expect(JSON.stringify(config)).toBe(JSON.stringify({ owner, repo }));
  });

  it("should throw error if owner is empty", () => {
    expect(() => {
      new GitHubConfig("", repo);
    }).toThrow("Owner is required");
  });

  it("should throw error if repo is empty", () => {
    expect(() => {
      new GitHubConfig(owner, "");
    }).toThrow("Repository is required");
  });
});
