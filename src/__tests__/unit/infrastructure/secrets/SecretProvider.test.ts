import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EnvSecretProvider,
  FileSecretProvider,
  SecretResolver,
  createDefaultSecretResolver,
} from '../../../../infrastructure/secrets/SecretProvider';

describe('SecretProvider', () => {
  describe('EnvSecretProvider', () => {
    const provider = new EnvSecretProvider();

    it('returns the env var value', () => {
      process.env.__TEST_SECRET__ = 'from-env';
      expect(provider.get('__TEST_SECRET__')).toBe('from-env');
      delete process.env.__TEST_SECRET__;
    });

    it('returns undefined when unset', () => {
      expect(provider.get('__DEFINITELY_UNSET__')).toBeUndefined();
    });
  });

  describe('FileSecretProvider', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'secrets-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('reads a secret file and trims the trailing newline', () => {
      writeFileSync(join(dir, 'API_KEY'), 'sk-123\n');
      expect(new FileSecretProvider(dir).get('API_KEY')).toBe('sk-123');
    });

    it('returns undefined for a missing file', () => {
      expect(new FileSecretProvider(dir).get('NOPE')).toBeUndefined();
    });

    it('reflects a rotated file on the next read', () => {
      const provider = new FileSecretProvider(dir);
      writeFileSync(join(dir, 'TOKEN'), 'v1');
      expect(provider.get('TOKEN')).toBe('v1');
      writeFileSync(join(dir, 'TOKEN'), 'v2');
      expect(provider.get('TOKEN')).toBe('v2');
    });
  });

  describe('SecretResolver layering', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'secrets-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
      delete process.env.__LAYER_SECRET__;
    });

    it('prefers the file provider over env', () => {
      writeFileSync(join(dir, '__LAYER_SECRET__'), 'from-file');
      process.env.__LAYER_SECRET__ = 'from-env';
      const resolver = new SecretResolver([new FileSecretProvider(dir), new EnvSecretProvider()]);
      expect(resolver.resolve('__LAYER_SECRET__')).toBe('from-file');
    });

    it('falls back to env when no file exists', () => {
      process.env.__LAYER_SECRET__ = 'from-env';
      const resolver = new SecretResolver([new FileSecretProvider(dir), new EnvSecretProvider()]);
      expect(resolver.resolve('__LAYER_SECRET__')).toBe('from-env');
    });

    it('returns undefined when no provider has the secret', () => {
      const resolver = new SecretResolver([new FileSecretProvider(dir), new EnvSecretProvider()]);
      expect(resolver.resolve('__LAYER_SECRET__')).toBeUndefined();
    });
  });

  describe('createDefaultSecretResolver', () => {
    it('uses only env when SECRETS_DIR is unset', () => {
      const resolver = createDefaultSecretResolver({ FOO: 'bar' } as NodeJS.ProcessEnv);
      expect(resolver.resolve('FOO')).toBe('bar');
    });

    it('layers a file provider when SECRETS_DIR is set', () => {
      const dir = mkdtempSync(join(tmpdir(), 'secrets-'));
      try {
        writeFileSync(join(dir, 'FOO'), 'file-value');
        const resolver = createDefaultSecretResolver({ SECRETS_DIR: dir, FOO: 'env-value' } as NodeJS.ProcessEnv);
        expect(resolver.resolve('FOO')).toBe('file-value');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
