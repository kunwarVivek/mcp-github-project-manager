import { existsSync, readFileSync } from 'node:fs';
import { GhCliSecretProvider } from './GhCliSecretProvider';
import { join } from 'node:path';

/**
 * A source of secret/config values. Implementations must be synchronous so the
 * server can resolve secrets during its (synchronous) startup config phase.
 */
export interface SecretProvider {
  /** Return the secret's current value, or undefined if this provider has none. */
  get(name: string): string | undefined;
}

/**
 * Secret names map 1:1 onto file names inside `SECRETS_DIR`. Anything carrying a
 * path separator, a NUL, or a relative-path segment is rejected rather than
 * joined, so a caller can never read outside the mounted directory.
 */
function isSafeSecretName(name: string): boolean {
  if (name.length === 0 || name === '.' || name === '..') return false;
  return !/[/\\\0]/.test(name);
}

/** Reads secrets from environment variables (the default). */
export class EnvSecretProvider implements SecretProvider {
  /**
   * Pass an explicit env to read from a fixed object; omit it to read the live
   * `process.env` at call time.
   *
   * Capturing `process.env` by reference at construction is subtly wrong here:
   * the default resolver is built once when `src/env.ts` is imported, so a
   * later `process.env = { ...process.env }` (a very common test idiom, and
   * anything else that *rebinds* rather than mutates) leaves this provider
   * reading a detached object forever. It also contradicts this module's
   * documented read-fresh/rotation-aware contract.
   */
  constructor(private readonly env?: NodeJS.ProcessEnv) {}

  get(name: string): string | undefined {
    return (this.env ?? process.env)[name];
  }
}

/**
 * Reads secrets from a directory of files named after each secret — the
 * convention used by Docker secrets (`/run/secrets/<NAME>`) and Kubernetes
 * mounted secret volumes. Each read hits disk, so rotating the mounted file is
 * picked up by the next `resolveSecret()` call (see rotation note below).
 */
export class FileSecretProvider implements SecretProvider {
  constructor(private readonly dir: string) {}

  get(name: string): string | undefined {
    // A secret name is a file name, never a path. Reject anything that could
    // escape the mounted directory before it reaches `join`.
    if (!isSafeSecretName(name)) {
      return undefined;
    }
    const path = join(this.dir, name);
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      // Trim trailing newline that secret managers commonly append.
      return readFileSync(path, 'utf8').replace(/\r?\n$/, '');
    } catch {
      return undefined;
    }
  }
}

/**
 * Layered secret resolution. Providers are consulted in order; the first
 * non-undefined value wins. Default order puts file-mounted secrets ahead of
 * environment variables so a secret manager can override baked-in env config.
 *
 * Extension point: to add HashiCorp Vault or AWS Secrets Manager, implement
 * `SecretProvider` (their SDKs are async, so cache values synchronously at
 * startup or move config bootstrap to async) and unshift it onto the chain.
 */
export class SecretResolver {
  private readonly providers: SecretProvider[];

  constructor(providers: SecretProvider[]) {
    this.providers = providers;
  }

  /**
   * Resolve a secret by name, reading fresh from each provider (no caching), so
   * callers that re-resolve at use-time observe rotated values.
   */
  resolve(name: string): string | undefined {
    for (const provider of this.providers) {
      const value = provider.get(name);
      if (value !== undefined && value !== '') {
        return value;
      }
    }
    return undefined;
  }
}

/**
 * Build the default resolver from environment configuration.
 * - `SECRETS_DIR` (e.g. `/run/secrets`): enables the file provider, checked
 *   before env vars.
 * - Environment variables are the standard fallback provider.
 * - `gh auth token` is consulted last (GITHUB_TOKEN only), unless
 *   GH_CLI_TOKEN_FALLBACK=false.
 */
export function createDefaultSecretResolver(
  env?: NodeJS.ProcessEnv,
): SecretResolver {
  // Read config off the live env when no explicit one is supplied, for the same
  // reason EnvSecretProvider does (see its constructor docs).
  const config = env ?? process.env;
  const providers: SecretProvider[] = [];
  const secretsDir = config.SECRETS_DIR;
  if (secretsDir) {
    providers.push(new FileSecretProvider(secretsDir));
  }
  providers.push(new EnvSecretProvider(env));  // undefined -> live process.env

  // Last resort: borrow the token from an authenticated `gh` CLI so local
  // development needs no explicit configuration. Everything above wins over it.
  // Opt out with GH_CLI_TOKEN_FALLBACK=false where shelling out is unwanted.
  const ghFallbackAllowed =
    config.NODE_ENV !== 'test' &&
    (config.GH_CLI_TOKEN_FALLBACK ?? 'true').toLowerCase() !== 'false';
  if (ghFallbackAllowed) {
    providers.push(new GhCliSecretProvider());
  }

  return new SecretResolver(providers);
}
