import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubAuthUnavailableError } from "../../../../infrastructure/github/auth/GitHubAuth";
import { resolveGitHubAuth } from "../../../../infrastructure/github/auth/resolveGitHubAuth";
import { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import { createGitHubFactory } from "../../../../infrastructure/tools/tool-factory";
import { partialFake } from "../../../helpers/aiFakes";
import { tokenAuth } from "../../../helpers/githubAuth";

vi.mock("../../../../infrastructure/github/auth/resolveGitHubAuth", () => ({
  resolveGitHubAuth: vi.fn(),
}));
vi.mock("../../../../infrastructure/github/GitHubRepositoryFactory", () => ({
  GitHubRepositoryFactory: { fromAuth: vi.fn() },
}));

const resolve = vi.mocked(resolveGitHubAuth);
const fromAuth = vi.mocked(GitHubRepositoryFactory.fromAuth);

describe("createGitHubFactory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    fromAuth.mockReturnValue(partialFake<GitHubRepositoryFactory>({}));
  });

  it("builds the factory from the resolved auth object, never a raw token", () => {
    const auth = tokenAuth("ghp_x");
    resolve.mockReturnValue(auth);

    createGitHubFactory("octo", "hello");

    expect(fromAuth).toHaveBeenCalledWith(auth, "octo", "hello");
  });

  it("re-resolves the credential on every call, so a rotated token or later `auth login` is honoured", () => {
    const first = tokenAuth("old");
    const second = tokenAuth("rotated");
    resolve.mockReturnValueOnce(first).mockReturnValueOnce(second);

    createGitHubFactory("o", "r");
    createGitHubFactory("o", "r");

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fromAuth.mock.calls[0][0]).toBe(first);
    expect(fromAuth.mock.calls[1][0]).toBe(second);
  });

  it("propagates GitHubAuthUnavailableError when no credential exists", () => {
    resolve.mockImplementation(() => {
      throw new GitHubAuthUnavailableError();
    });

    expect(() => createGitHubFactory()).toThrow(GitHubAuthUnavailableError);
    expect(fromAuth).not.toHaveBeenCalled();
  });

  it("falls back to the sentinel owner/repo for project-ID-scoped calls when none is configured", () => {
    vi.stubEnv("GITHUB_OWNER", "");
    vi.stubEnv("GITHUB_REPO", "");
    resolve.mockReturnValue(tokenAuth());

    createGitHubFactory();

    expect(fromAuth.mock.calls[0].slice(1)).toEqual(["placeholder", "placeholder"]);
  });

  it("uses the configured owner/repo when no explicit target is given, and explicit ones win", () => {
    vi.stubEnv("GITHUB_OWNER", "cfg-owner");
    vi.stubEnv("GITHUB_REPO", "cfg-repo");
    resolve.mockReturnValue(tokenAuth());

    createGitHubFactory();
    createGitHubFactory("explicit-owner", "explicit-repo");

    expect(fromAuth.mock.calls[0].slice(1)).toEqual(["cfg-owner", "cfg-repo"]);
    expect(fromAuth.mock.calls[1].slice(1)).toEqual(["explicit-owner", "explicit-repo"]);
  });
});
