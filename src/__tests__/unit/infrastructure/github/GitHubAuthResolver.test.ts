import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  getGitHubAppCredentials: vi.fn(),
  getSecret: vi.fn(),
}));

vi.mock("../../../../env", () => ({ ...env, RATE_LIMIT_FLOOR: 100 }));

import { resolveGitHubAuth } from "../../../../infrastructure/github/GitHubAuthResolver";

describe("resolveGitHubAuth", () => {
  beforeEach(() => {
    env.getGitHubAppCredentials.mockReset();
    env.getSecret.mockReset();
  });

  const app = { appId: "1", privateKey: "key", installationId: "2" };

  it("prefers a fully configured GitHub App over the PAT", () => {
    env.getGitHubAppCredentials.mockReturnValue(app);
    env.getSecret.mockReturnValue("pat");

    expect(resolveGitHubAuth()).toEqual({ kind: "app", ...app });
  });

  it("works with App credentials and no PAT at all", () => {
    env.getGitHubAppCredentials.mockReturnValue(app);
    env.getSecret.mockReturnValue(undefined);

    expect(resolveGitHubAuth().kind).toBe("app");
  });

  it("falls back to the PAT when the App config is partial", () => {
    env.getGitHubAppCredentials.mockReturnValue(undefined);
    env.getSecret.mockImplementation((name: string) =>
      name === "GITHUB_TOKEN" ? "pat" : undefined
    );

    expect(resolveGitHubAuth()).toEqual({ kind: "pat", token: "pat" });
  });

  it("throws a clear error when no credentials exist", () => {
    env.getGitHubAppCredentials.mockReturnValue(undefined);
    env.getSecret.mockReturnValue(undefined);

    expect(() => resolveGitHubAuth()).toThrow(/No GitHub credentials available/);
  });
});
