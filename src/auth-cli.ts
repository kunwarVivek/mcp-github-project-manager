import { join, resolve } from "node:path";
import { Command, CommanderError } from "commander";
import * as dotenv from "dotenv";
import {
  type DeviceFlowClock,
  type FetchLike,
  loginWithDeviceFlow,
  systemClock,
} from "./infrastructure/github/auth/oauth/deviceFlow";
import { OAuthTokenStore } from "./infrastructure/github/auth/oauth/OAuthTokenStore";
import { readOAuthConfig } from "./infrastructure/github/auth/oauth/oauthConfig";
import { manualRevocationUrl, revokeAccessToken } from "./infrastructure/github/auth/oauth/revoke";
import {
  describeUnusableState,
  inspectOAuthStore,
} from "./infrastructure/github/auth/oauth/StoredOAuthAuth";
import { PACKAGE_VERSION } from "./version";

const COMMAND_NAME = "mcp-github-project-manager auth";

export interface AuthCliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface AuthCliDeps {
  readonly io?: AuthCliIo;
  readonly fetch?: FetchLike;
  readonly clock?: DeviceFlowClock;
  readonly env?: NodeJS.ProcessEnv;
  /** Load `.env` (or `--env-file`) before reading config. Off in tests. */
  readonly loadDotenv?: boolean;
  readonly now?: () => number;
}

const processIo: AuthCliIo = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
};

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

function formatMode(mode: number): string {
  return mode.toString(8).padStart(4, "0");
}

function describeExpiry(iso: string | undefined, nowMs: number): string {
  if (iso === undefined) return "never (non-expiring token)";
  const remainingMs = Date.parse(iso) - nowMs;
  if (remainingMs <= 0) return `${iso} (expired)`;
  const minutes = Math.round(remainingMs / 60_000);
  const human = minutes >= 120 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
  return `${iso} (in ${human})`;
}

/**
 * `mcp-github-project-manager auth <login|status|logout>`.
 *
 * This module must not import `src/env.ts` (directly or transitively): that
 * module validates the MCP server's required configuration at import time and
 * would make these commands unusable without GITHUB_TOKEN/OWNER/REPO. Returns
 * the process exit code. All human output goes to stderr except `status`, so a
 * login can never corrupt a stdout stream.
 */
export async function runAuthCli(argv: string[], deps: AuthCliDeps = {}): Promise<number> {
  const io = deps.io ?? processIo;
  const env = deps.env ?? process.env;
  const fetchImpl: FetchLike = deps.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const clock = deps.clock ?? systemClock;
  const now = deps.now ?? Date.now;
  let exitCode = EXIT_OK;

  const program = new Command();
  program
    .name(COMMAND_NAME)
    .description("Manage the GitHub OAuth user login used by the MCP server")
    .version(PACKAGE_VERSION)
    .option("-e, --env-file <path>", "Path to .env file (default: .env in the working directory)")
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .hook("preAction", (command) => {
      if (deps.loadDotenv === false) return;
      const envFile: string | undefined = command.opts().envFile;
      const path = envFile ? resolve(process.cwd(), envFile) : join(process.cwd(), ".env");
      dotenv.config({ path, quiet: true });
    });

  program
    .command("login")
    .description("Sign in with GitHub's device flow and store the token")
    .option(
      "--client-id <id>",
      "OAuth App / GitHub App client id (default: GITHUB_OAUTH_CLIENT_ID)"
    )
    .option("--scopes <scopes>", "Space- or comma-separated scopes (default: GITHUB_OAUTH_SCOPES)")
    .action(async (options: { clientId?: string; scopes?: string }) => {
      const config = readOAuthConfig(options, env);
      if (!config.clientId) {
        io.stderr(
          "No client id. Set GITHUB_OAUTH_CLIENT_ID or pass --client-id.\n" +
            'Create an OAuth App with "Enable Device Flow" checked at ' +
            "https://github.com/settings/developers and use its client id.\n"
        );
        exitCode = EXIT_FAILURE;
        return;
      }
      try {
        const stored = await loginWithDeviceFlow({
          clientId: config.clientId,
          scopes: config.scopes,
          fetch: fetchImpl,
          clock,
          onVerification: (device) => {
            io.stderr(
              `\nOpen ${device.verificationUri} and enter the code:\n\n    ${device.userCode}\n\n` +
                `Waiting for authorization (expires in ${Math.round(device.expiresInSeconds / 60)} min)...\n`
            );
          },
        });
        new OAuthTokenStore(config.tokenFile).save(stored);
        io.stderr(
          `Logged in as ${stored.login}. Token saved to ${config.tokenFile} (mode 0600).\n` +
            `Token: ${stored.refreshToken ? "expiring, refreshed automatically" : "non-expiring"}.\n`
        );
      } catch (error) {
        io.stderr(`Login failed: ${error instanceof Error ? error.message : String(error)}\n`);
        exitCode = EXIT_FAILURE;
      }
    });

  program
    .command("status")
    .description("Show the stored login (never prints the token)")
    .action(() => {
      const config = readOAuthConfig({}, env);
      const store = new OAuthTokenStore(config.tokenFile);
      const state = inspectOAuthStore(store, config);
      const lines = [`Store: ${store.path}`];

      if (state.state === "ready") {
        const { stored } = state;
        const nowMs = now();
        const refreshExpired =
          stored.refreshTokenExpiresAt !== undefined &&
          Date.parse(stored.refreshTokenExpiresAt) <= nowMs;
        const accessExpired =
          stored.expiresAt !== undefined && Date.parse(stored.expiresAt) <= nowMs;
        const usable = !accessExpired || (stored.refreshToken !== undefined && !refreshExpired);
        lines.push(
          `Mode: oauth-user (oauth-store)`,
          `Status: ${usable ? "logged in" : "expired - run `mcp-github-project-manager auth login`"}`,
          `Login: ${stored.login}`,
          `Client id: ${stored.clientId}`,
          `Scopes: ${stored.scopes.length > 0 ? stored.scopes.join(" ") : "(none reported)"}`,
          `Token kind: ${stored.refreshToken ? "expiring (refreshable)" : "non-expiring"}`,
          `Access token expires: ${describeExpiry(stored.expiresAt, nowMs)}`
        );
        if (stored.refreshToken) {
          lines.push(
            `Refresh token expires: ${describeExpiry(stored.refreshTokenExpiresAt, nowMs)}`
          );
        }
        lines.push("Permissions: ok (owner-only)");
        if (!usable) exitCode = EXIT_FAILURE;
      } else if (state.state === "absent") {
        lines.push("Status: not logged in - run `mcp-github-project-manager auth login`");
        exitCode = EXIT_FAILURE;
      } else if (state.state === "no-client-id") {
        lines.push(
          "Status: a token is stored but GITHUB_OAUTH_CLIENT_ID is not set; it will not be used"
        );
        exitCode = EXIT_FAILURE;
      } else {
        lines.push(`Status: unusable - ${describeUnusableState(state, store.path)}`);
        if (state.state === "insecure-permissions") {
          lines.push(`Permissions: INSECURE (mode ${formatMode(state.mode)}, expected 0600)`);
        }
        exitCode = EXIT_FAILURE;
      }
      io.stdout(`${lines.join("\n")}\n`);
    });

  program
    .command("logout")
    .description("Revoke the token (when a client secret is configured) and delete the local file")
    .action(async () => {
      const config = readOAuthConfig({}, env);
      const store = new OAuthTokenStore(config.tokenFile);
      const result = store.read();
      const storedToken = result.status === "ok" ? result.token : undefined;
      const clientId = storedToken?.clientId ?? config.clientId;

      if (result.status === "absent") {
        io.stderr(`Not logged in (no token file at ${store.path}).\n`);
        return;
      }

      if (storedToken && config.clientSecret) {
        const revoked = await revokeAccessToken(
          fetchImpl,
          { clientId: storedToken.clientId, clientSecret: config.clientSecret },
          storedToken.token
        );
        io.stderr(
          revoked.outcome === "revoked"
            ? "Token revoked on GitHub.\n"
            : `Could not revoke the token on GitHub (${revoked.reason}).${
                clientId ? ` Revoke it manually: ${manualRevocationUrl(clientId)}\n` : "\n"
              }`
        );
      } else if (clientId) {
        io.stderr(
          "GITHUB_OAUTH_CLIENT_SECRET is not set, so the token cannot be revoked from here.\n" +
            `Revoke it manually: ${manualRevocationUrl(clientId)}\n`
        );
      }

      try {
        store.clear();
        io.stderr(`Deleted ${store.path}.\n`);
      } catch (error) {
        io.stderr(
          `Could not delete ${store.path}: ${error instanceof Error ? error.message : String(error)}\n`
        );
        exitCode = EXIT_FAILURE;
      }
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help / --version exit 0; a usage mistake is not a login failure.
      return error.exitCode === 0 ? EXIT_OK : EXIT_USAGE;
    }
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
  return exitCode;
}
