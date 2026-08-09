import { execFileSync } from 'node:child_process';
import type { SecretProvider } from './SecretProvider';

/** Secrets this provider can supply. The `gh` CLI only vends a GitHub token. */
const SUPPORTED_SECRETS = new Set(['GITHUB_TOKEN']);

/** Hard cap on how long we will wait for the `gh` binary. */
const GH_TIMEOUT_MS = 5_000;

/**
 * Last-resort provider that borrows the token from an authenticated GitHub CLI
 * (`gh auth token`).
 *
 * This exists so a developer with a working `gh` login can run the server with
 * no explicit configuration at all. It sits at the **end** of the resolver
 * chain, so an explicit CLI flag, a mounted secret, or an environment variable
 * always wins.
 *
 * Safety properties:
 * - `execFileSync` with an argument array — never a shell string, so nothing
 *   here is injectable.
 * - Bounded by a timeout, and `stderr` is discarded so a `gh` error message can
 *   never reach stdout and corrupt the MCP protocol stream.
 * - Any failure (binary absent, not logged in, non-zero exit) resolves to
 *   `undefined` rather than throwing — this is a fallback, not a requirement.
 * - Invoked at most once per process; the result (including failure) is cached.
 */
export class GhCliSecretProvider implements SecretProvider {
  /** `undefined` = not attempted yet, `null` = attempted and unavailable. */
  private cached: string | null | undefined;

  get(name: string): string | undefined {
    if (!SUPPORTED_SECRETS.has(name)) {
      return undefined;
    }
    if (this.cached === undefined) {
      this.cached = readGhToken();
    }
    return this.cached ?? undefined;
  }
}

function readGhToken(): string | null {
  try {
    const output = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: GH_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const token = output.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
