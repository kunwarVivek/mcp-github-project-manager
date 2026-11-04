import { createTokenAuth } from "../../infrastructure/github/auth/credentials";
import type { GitHubAuth } from "../../infrastructure/github/auth/GitHubAuth";

/** A static-token `GitHubAuth` for tests that build a `GitHubRepositoryFactory`. */
export function tokenAuth(token = "test-token"): GitHubAuth {
  return createTokenAuth(() => token, "test");
}
