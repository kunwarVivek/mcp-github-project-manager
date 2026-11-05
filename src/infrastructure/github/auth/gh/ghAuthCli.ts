import {
  createDefaultSecretResolver,
  isGhCliFallbackAllowed,
} from "../../../secrets/SecretProvider";
import {
  describeEffectiveCredential,
  type EffectiveCredential,
  shadowAdvice,
} from "./effectiveCredential";
import { GhTokenSource } from "./GhTokenSource";
import { GH_HOSTNAME, type GhRunner } from "./ghRunner";
import {
  type GhScopeInspection,
  ghRefreshCommand,
  inspectTokenScopes,
  scopeGaps,
} from "./ghScopes";

const GH_INSTALL_URL = "https://cli.github.com";
const LOGIN_SCOPES = ["repo", "project", "read:org"] as const;

export interface GhAuthCliDeps {
  readonly runner: GhRunner;
  readonly fetch: typeof fetch;
  readonly env: NodeJS.ProcessEnv;
}

function pinnedUserFrom(env: NodeJS.ProcessEnv): string | undefined {
  return createDefaultSecretResolver(env).resolve("GH_CLI_USER")?.trim() || undefined;
}

function formatScopes(scopes: readonly string[]): string {
  return scopes.length > 0 ? scopes.join(", ") : "(none)";
}

function describeScopeInspection(inspection: GhScopeInspection): string {
  switch (inspection.status) {
    case "known":
      return formatScopes(inspection.scopes);
    case "unknown":
      return "unknown (fine-grained token: scopes are not reported)";
    case "rejected":
      return "unknown (GitHub rejected the token)";
    case "unreachable":
      return "unknown (could not reach api.github.com)";
  }
}

/**
 * The "GitHub CLI" and "Effective credential" lines of `auth status`. Informational:
 * they never affect the exit code. Never contains token characters.
 */
export async function describeGhStatus(
  deps: GhAuthCliDeps
): Promise<{ lines: string[]; effective: EffectiveCredential | undefined }> {
  const { runner, env } = deps;
  const user = pinnedUserFrom(env);
  const lines = ["", "GitHub CLI (gh):"];
  const enabled = isGhCliFallbackAllowed(env);
  const tokenSource = new GhTokenSource({ runner, user: () => user });

  const installed = runner.capture(["--version"]).status !== "missing";
  if (!installed) {
    lines.push(`  Installed: no (install it from ${GH_INSTALL_URL})`);
  } else {
    lines.push("  Installed: yes");
    if (!enabled) {
      lines.push(
        "  Fallback: disabled (GH_CLI_TOKEN_FALLBACK=false or NODE_ENV=test); the server never uses gh"
      );
    }
    const read = tokenSource.inspect();
    if (read.status === "invalid-user") {
      lines.push(`  Account: GH_CLI_USER is not a valid GitHub login`);
    } else if (read.status !== "ok") {
      lines.push(
        `  Account: ${user ? `${user} (pinned by GH_CLI_USER) is ` : ""}not logged in - run ` +
          "`mcp-github-project-manager auth login --gh`"
      );
    } else {
      const inspection = await inspectTokenScopes(read.token, deps.fetch);
      const login = "login" in inspection ? inspection.login : undefined;
      const origin = user ? "pinned by GH_CLI_USER" : "gh's active account";
      lines.push(
        `  Account: ${login ?? user ?? "(unknown)"} (${origin})`,
        `  Scopes: ${describeScopeInspection(inspection)}`
      );
      if (inspection.status === "known") {
        const gaps = scopeGaps(inspection.scopes);
        if (gaps.missingRequired.length > 0) {
          lines.push(
            `  Missing required scopes: ${gaps.missingRequired.join(", ")} - fix: ${ghRefreshCommand(gaps.missingRequired, user)}`
          );
        }
        if (gaps.missingRecommended.length > 0) {
          lines.push(
            `  Missing recommended scopes: ${gaps.missingRecommended.join(", ")} (needed for organization projects) - fix: ${ghRefreshCommand(gaps.missingRecommended, user)}`
          );
        }
        if (gaps.missingRequired.length === 0 && gaps.missingRecommended.length === 0) {
          lines.push("  Scope check: ok");
        }
      }
    }
  }

  const effective = describeEffectiveCredential(env, enabled ? tokenSource : undefined);
  lines.push(
    "",
    effective
      ? `Effective credential: ${effective.mode} (${effective.source})`
      : "Effective credential: none - the server would fail to start"
  );
  if (effective && effective.source !== "gh-cli" && installed && enabled) {
    const advice = shadowAdvice(effective.source);
    if (advice) lines.push(`  Note: this shadows the gh credential; to use gh instead, ${advice}.`);
  }
  return { lines, effective };
}

/**
 * `auth login --gh`: make sure the GitHub CLI holds a token with the scopes the
 * server needs, delegating the browser step to `gh` itself. Human output goes to
 * `stderr`; returns the process exit code.
 */
export async function loginWithGhCli(
  deps: GhAuthCliDeps & { stderr(text: string): void }
): Promise<number> {
  const { runner, env, stderr } = deps;

  if (runner.capture(["--version"]).status === "missing") {
    stderr(`The GitHub CLI (gh) is not installed. Install it from ${GH_INSTALL_URL} and retry.\n`);
    return 1;
  }

  const user = pinnedUserFrom(env);
  const tokenSource = new GhTokenSource({ runner, user: () => user });
  const read = tokenSource.inspect();
  if (read.status === "invalid-user") {
    stderr(`GH_CLI_USER ("${user}") is not a valid GitHub login.\n`);
    return 1;
  }

  let refreshScopes: string[] | undefined;
  if (read.status === "ok") {
    if (user) {
      const activeConflict = await pinnedAccountIsInactive(deps, user);
      if (activeConflict) {
        stderr(
          `${activeConflict}\n` +
            `\`gh auth refresh\` only acts on the active account. Run ` +
            `\`gh auth switch -h ${GH_HOSTNAME} -u ${user}\` and retry.\n`
        );
        return 1;
      }
    }
    const inspection = await inspectTokenScopes(read.token, deps.fetch);
    if (inspection.status === "known") {
      const gaps = scopeGaps(inspection.scopes);
      if (gaps.missingRequired.length > 0 || gaps.missingRecommended.length > 0) {
        refreshScopes = [
          ...new Set([...gaps.missingRequired.filter((s) => s === "repo"), "project", "read:org"]),
        ];
        stderr(
          `gh account ${inspection.login ?? user ?? "(active)"} is missing scopes: ` +
            `${[...gaps.missingRequired, ...gaps.missingRecommended].join(", ")}. Refreshing...\n`
        );
      }
    } else if (inspection.status === "unreachable") {
      stderr(
        "Could not reach api.github.com to check the gh token's scopes. Check your network and retry.\n"
      );
      return 1;
    } else if (inspection.status === "rejected") {
      stderr("GitHub rejected the gh token; signing in again.\n");
      return runGh(
        deps,
        ["auth", "login", "-h", GH_HOSTNAME, "-s", LOGIN_SCOPES.join(","), "--web"],
        tokenSource,
        user
      );
    }
  } else {
    stderr(`gh is not logged in${user ? ` as ${user}` : ""}; starting \`gh auth login\`.\n`);
    return runGh(
      deps,
      ["auth", "login", "-h", GH_HOSTNAME, "-s", LOGIN_SCOPES.join(","), "--web"],
      tokenSource,
      user
    );
  }

  if (!refreshScopes) {
    return report(deps, tokenSource, user);
  }
  return runGh(
    deps,
    ["auth", "refresh", "-h", GH_HOSTNAME, "-s", refreshScopes.join(",")],
    tokenSource,
    user
  );
}

/** A message when `user` is not gh's active account, otherwise undefined. */
async function pinnedAccountIsInactive(
  deps: GhAuthCliDeps,
  user: string
): Promise<string | undefined> {
  const active = new GhTokenSource({ runner: deps.runner }).inspect();
  if (active.status !== "ok") return undefined;
  const inspection = await inspectTokenScopes(active.token, deps.fetch);
  const login = "login" in inspection ? inspection.login : undefined;
  if (login && login.toLowerCase() !== user.toLowerCase()) {
    return `GH_CLI_USER pins ${user}, but gh's active account is ${login}.`;
  }
  return undefined;
}

async function runGh(
  deps: GhAuthCliDeps & { stderr(text: string): void },
  args: string[],
  tokenSource: GhTokenSource,
  user: string | undefined
): Promise<number> {
  const result = deps.runner.interactive(args);
  if (result.status === "missing") {
    deps.stderr(
      `The GitHub CLI (gh) is not installed. Install it from ${GH_INSTALL_URL} and retry.\n`
    );
    return 1;
  }
  if (result.code !== 0) {
    deps.stderr(`\`gh ${args.slice(0, 2).join(" ")}\` exited with code ${result.code}.\n`);
    return 1;
  }
  return report(deps, tokenSource, user);
}

/** Re-read the token after gh returned, verify scopes and print the outcome. */
async function report(
  deps: GhAuthCliDeps & { stderr(text: string): void },
  tokenSource: GhTokenSource,
  user: string | undefined
): Promise<number> {
  const { stderr } = deps;
  const read = tokenSource.inspect();
  if (read.status !== "ok") {
    stderr(
      `gh still has no usable token${user ? ` for ${user}` : ""}. Run \`gh auth status\` to investigate.\n`
    );
    return 1;
  }
  const inspection = await inspectTokenScopes(read.token, deps.fetch);
  const login = "login" in inspection ? inspection.login : undefined;
  stderr(
    `GitHub CLI account: ${login ?? user ?? "(unknown)"}\nScopes: ${describeScopeInspection(inspection)}\n`
  );

  let exitCode = 0;
  if (inspection.status === "known") {
    const gaps = scopeGaps(inspection.scopes);
    if (gaps.missingRequired.length > 0) {
      stderr(
        `Still missing required scopes: ${gaps.missingRequired.join(", ")}. Fix: ${ghRefreshCommand(gaps.missingRequired, user)}\n`
      );
      exitCode = 1;
    }
    if (gaps.missingRecommended.length > 0) {
      stderr(
        `Missing recommended scopes: ${gaps.missingRecommended.join(", ")} (organization projects).\n`
      );
    }
  } else if (inspection.status === "rejected") {
    stderr("GitHub rejected the gh token.\n");
    exitCode = 1;
  }

  const enabled = isGhCliFallbackAllowed(deps.env);
  const effective = describeEffectiveCredential(deps.env, enabled ? tokenSource : undefined);
  if (!enabled) {
    stderr(
      "Note: the gh fallback is disabled (GH_CLI_TOKEN_FALLBACK=false), so the server will not use this login.\n"
    );
  } else if (effective && effective.source !== "gh-cli") {
    const advice = shadowAdvice(effective.source);
    stderr(
      `Note: the server will NOT use this gh login: ${effective.mode} (${effective.source}) takes precedence.` +
        `${advice ? ` To use gh, ${advice}.` : ""}\n`
    );
  } else if (effective && exitCode === 0) {
    stderr("The server will use this gh login (the token is re-read from gh automatically).\n");
  }
  return exitCode;
}
