import { describe, expect, it } from "vitest";
import { GitHubConfig } from "../../../../infrastructure/github/GitHubConfig";

describe("GitHubConfig", () => {
  const owner = "test-owner";
  const repo = "test-repo";
  const token = "test-token";

  it("should create a config instance with all properties", () => {
    const config = new GitHubConfig(owner, repo, { kind: "pat", token: token });

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
    expect(config.token).toBe(token);
  });

  it("should not allow modification of properties", () => {
    const config = new GitHubConfig(owner, repo, { kind: "pat", token: token });

    expect(() => {
      Object.assign(config, { owner: "new-owner" });
    }).toThrow();

    expect(() => {
      Object.assign(config, { repo: "new-repo" });
    }).toThrow();

    expect(() => {
      Object.assign(config, { token: "new-token" });
    }).toThrow();

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
    expect(config.token).toBe(token);
  });

  it("should throw error if owner is empty", () => {
    expect(() => {
      new GitHubConfig("", repo, { kind: "pat", token: token });
    }).toThrow("Owner is required");
  });

  it("should throw error if repo is empty", () => {
    expect(() => {
      new GitHubConfig(owner, "", { kind: "pat", token: token });
    }).toThrow("Repository is required");
  });

  it("should throw error if token is empty", () => {
    expect(() => {
      new GitHubConfig(owner, repo, { kind: "pat", token: "" });
    }).toThrow("Token is required");
  });

  it("should not leak credentials through JSON.stringify", () => {
    const pat = new GitHubConfig(owner, repo, { kind: "pat", token });
    const app = new GitHubConfig(owner, repo, {
      kind: "app",
      appId: "1",
      privateKey: "secret-key",
      installationId: "2",
    });

    expect(JSON.stringify(pat)).not.toContain(token);
    expect(JSON.stringify(app)).not.toContain("secret-key");
  });

  it("should accept GitHub App auth without a token", () => {
    const config = new GitHubConfig(owner, repo, {
      kind: "app",
      appId: "1",
      privateKey: "key",
      installationId: "2",
    });

    expect(config.token).toBeUndefined();
    expect(config.auth.kind).toBe("app");
  });

  it("should reject incomplete GitHub App auth", () => {
    expect(() => {
      new GitHubConfig(owner, repo, {
        kind: "app",
        appId: "1",
        privateKey: "",
        installationId: "2",
      });
    }).toThrow("GitHub App private key is required");
  });
});
