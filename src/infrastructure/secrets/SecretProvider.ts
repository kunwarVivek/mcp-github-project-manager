import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  if (name.length === 0 || name === "." || name === "..") return false;
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
      return readFileSync(path, "utf8").replace(/\r?\n$/, "");
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
      if (value !== undefined && value !== "") {
        return value;
      }
    }
    return undefined;
  }
}

/** Which tier of the default secret chain supplied a value. */
export type SecretTierSource = "secrets-dir" | "env";

interface SecretTier {
  source: SecretTierSource;
  provider: SecretProvider;
}

/**
 * The ordered tiers of the default chain: `SECRETS_DIR` files (when configured)
 * ahead of environment variables. Single definition shared by the resolver and
 * by callers that must know *which* tier answered.
 */
function defaultSecretTiers(env?: NodeJS.ProcessEnv): SecretTier[] {
  // Read config off the live env when no explicit one is supplied, for the same
  // reason EnvSecretProvider does (see its constructor docs).
  const config = env ?? process.env;
  const tiers: SecretTier[] = [];
  const secretsDir = config.SECRETS_DIR;
  if (secretsDir) {
    tiers.push({ source: "secrets-dir", provider: new FileSecretProvider(secretsDir) });
  }
  tiers.push({ source: "env", provider: new EnvSecretProvider(env) }); // undefined -> live process.env
  return tiers;
}

/**
 * Build the default resolver from environment configuration.
 * - `SECRETS_DIR` (e.g. `/run/secrets`): enables the file provider, checked
 *   before env vars.
 * - Environment variables are the standard fallback provider.
 *
 * The `gh` CLI is deliberately NOT part of this chain: it is a credential
 * source in its own right that ranks below a stored OAuth token, so GitHub
 * credential resolution consults it separately (see `isGhCliFallbackAllowed`).
 */
export function createDefaultSecretResolver(env?: NodeJS.ProcessEnv): SecretResolver {
  return new SecretResolver(defaultSecretTiers(env).map((tier) => tier.provider));
}

/**
 * Resolve a secret and report which tier of the default chain supplied it, or
 * undefined when neither tier has a non-empty value. The value is never part of
 * the source label.
 */
export function resolveSecretWithSource(
  name: string,
  env?: NodeJS.ProcessEnv
): { value: string; source: SecretTierSource } | undefined {
  for (const { source, provider } of defaultSecretTiers(env)) {
    const value = provider.get(name);
    if (value !== undefined && value !== "") {
      return { value, source };
    }
  }
  return undefined;
}

/**
 * Read a secret from one specific tier of the default chain, ignoring the
 * others. Lets a credential stay bound to the tier that supplied it: if that
 * tier loses the value the caller sees `undefined` rather than silently
 * switching to a different source.
 */
export function readSecretFromTier(
  name: string,
  source: SecretTierSource,
  env?: NodeJS.ProcessEnv
): string | undefined {
  const tier = defaultSecretTiers(env).find((candidate) => candidate.source === source);
  const value = tier?.provider.get(name);
  return value === "" ? undefined : value;
}

/**
 * Whether borrowing a token from an authenticated `gh` CLI is permitted.
 * Opt out with GH_CLI_TOKEN_FALLBACK=false where shelling out is unwanted; it is
 * always off under NODE_ENV=test.
 */
export function isGhCliFallbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "test" && (env.GH_CLI_TOKEN_FALLBACK ?? "true").toLowerCase() !== "false";
}
