import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A source of secret/config values. Implementations must be synchronous so the
 * server can resolve secrets during its (synchronous) startup config phase.
 */
export interface SecretProvider {
  /** Return the secret's current value, or undefined if this provider has none. */
  get(name: string): string | undefined;
}

/** Reads secrets from environment variables (the default). */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get(name: string): string | undefined {
    return this.env[name];
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
 * - Environment variables are always the fallback provider.
 */
export function createDefaultSecretResolver(
  env: NodeJS.ProcessEnv = process.env,
): SecretResolver {
  const providers: SecretProvider[] = [];
  const secretsDir = env.SECRETS_DIR;
  if (secretsDir) {
    providers.push(new FileSecretProvider(secretsDir));
  }
  providers.push(new EnvSecretProvider(env));
  return new SecretResolver(providers);
}
