import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createDefaultSecretResolver } from "../../../secrets/SecretProvider";

/**
 * OAuth login configuration.
 *
 * Deliberately NOT part of `src/env.ts`: that module parses the process argv
 * and validates the server's required config (token, owner, repo) at import
 * time, and `mcp-github-project-manager auth ...` must work on a machine that
 * has none of those. The values still resolve through the same secret chain
 * (`SECRETS_DIR` file → environment variable), so a mounted secret works here
 * exactly as it does for the server.
 *
 *   GITHUB_OAUTH_CLIENT_ID      public client id of the OAuth App / GitHub App
 *   GITHUB_OAUTH_CLIENT_SECRET  optional; only needed to revoke on logout
 *   GITHUB_OAUTH_SCOPES         OAuth App scopes (ignored by GitHub Apps)
 *   GITHUB_OAUTH_TOKEN_FILE     override for the token store path
 */
export const DEFAULT_OAUTH_SCOPES = "repo project read:org";

export const OAUTH_CONFIG_DIR_NAME = "mcp-github-project-manager";
export const OAUTH_TOKEN_FILE_NAME = "github-oauth.json";

export interface OAuthConfig {
  /** Undefined when no client id is configured: login and refresh are impossible. */
  readonly clientId: string | undefined;
  /** Undefined when not configured. GitHub does not require it for device-flow tokens. */
  readonly clientSecret: string | undefined;
  readonly scopes: readonly string[];
  readonly tokenFile: string;
}

export interface OAuthConfigOverrides {
  readonly clientId?: string;
  /** Comma- and/or space-separated scope list, as typed on the command line. */
  readonly scopes?: string;
}

/** Splits `repo,project read:org` style input into a de-duplicated scope list. */
export function parseScopes(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).filter((scope) => scope.length > 0))];
}

/**
 * Default token file location: `$XDG_CONFIG_HOME/mcp-github-project-manager/github-oauth.json`,
 * falling back to `~/.config/...`. A relative `XDG_CONFIG_HOME` is ignored, as
 * the XDG Base Directory spec requires.
 */
export function defaultTokenFilePath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  const xdg = env.XDG_CONFIG_HOME;
  const configHome = xdg && isAbsolute(xdg) ? xdg : join(home, ".config");
  return join(configHome, OAUTH_CONFIG_DIR_NAME, OAUTH_TOKEN_FILE_NAME);
}

export function readOAuthConfig(
  overrides: OAuthConfigOverrides = {},
  env: NodeJS.ProcessEnv = process.env
): OAuthConfig {
  const resolver = createDefaultSecretResolver(env);
  return {
    clientId: overrides.clientId || resolver.resolve("GITHUB_OAUTH_CLIENT_ID"),
    clientSecret: resolver.resolve("GITHUB_OAUTH_CLIENT_SECRET"),
    scopes: parseScopes(
      overrides.scopes || resolver.resolve("GITHUB_OAUTH_SCOPES") || DEFAULT_OAUTH_SCOPES
    ),
    tokenFile: resolver.resolve("GITHUB_OAUTH_TOKEN_FILE") ?? defaultTokenFilePath(env),
  };
}
