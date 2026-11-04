import { createAppAuth } from "@octokit/auth-app";
import type {
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";
import { type GitHubAuth, type GitHubAuthSource, GitHubAuthUnavailableError } from "./GitHubAuth";

/** Credentials for authenticating as a GitHub App installation. */
export type GitHubAppCredentials = {
  appId: string | number;
  privateKey: string;
  installationId: string | number;
};

/**
 * Yields the token currently in force for a credential tier, or undefined when
 * that tier no longer has one (file removed, variable unset).
 */
export type TokenSupplier = () => string | undefined;

/** `authorization` header value; JWTs (three dot-separated segments) use `bearer`. */
function authorizationHeader(token: string): string {
  return token.split(".").length === 3 ? `bearer ${token}` : `token ${token}`;
}

/**
 * A bearer-token credential read through `supplier` on every use.
 *
 * Octokit gets a custom auth strategy whose `hook` stamps the *current* token
 * on each request, so a factory built once keeps working when the token it was
 * built from is rotated (e.g. a mounted secret file rewritten). When the tier
 * stops yielding a token the request fails with `GitHubAuthUnavailableError`
 * instead of being sent unauthenticated.
 */
export function createTokenAuth(
  supplier: TokenSupplier,
  source: Exclude<GitHubAuthSource, "github-app" | "oauth-store">
): GitHubAuth {
  const fresh = (): string => {
    const token = supplier();
    if (!token) {
      throw new GitHubAuthUnavailableError(`The ${source} token is no longer available.`);
    }
    return token;
  };

  const hook = async (
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters?: RequestParameters
  ): Promise<OctokitResponse<unknown>> => {
    const endpoint =
      typeof route === "string"
        ? request.endpoint.merge(route, parameters)
        : request.endpoint.merge(route);
    endpoint.headers.authorization = authorizationHeader(fresh());
    const { url } = endpoint;
    if (url === undefined) {
      throw new Error("GitHub request is missing a URL");
    }
    return request({ ...endpoint, url });
  };

  const strategy = () =>
    Object.assign(async () => ({ type: "token" as const, token: fresh() }), { hook });

  return {
    mode: "token",
    source,
    octokitAuth: () => ({ authStrategy: strategy }),
    getToken: async () => fresh(),
  };
}

/**
 * GitHub App installation auth. Octokit gets the `createAppAuth` strategy, which
 * mints and refreshes installation tokens itself; `getToken()` asks a strategy
 * instance of the same configuration for a currently valid token.
 */
export function createAppInstallationAuth(credentials: GitHubAppCredentials): GitHubAuth {
  const tokenSource = createAppAuth(credentials);
  return {
    mode: "app-installation",
    source: "github-app",
    octokitAuth: () => ({ authStrategy: createAppAuth, auth: { ...credentials } }),
    getToken: async () => (await tokenSource({ type: "installation" })).token,
  };
}
