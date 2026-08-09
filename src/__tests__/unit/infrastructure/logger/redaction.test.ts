import { describe, expect, it, vi, afterEach } from 'vitest';
import { ConsoleLogger, redactSecrets } from '../../../../infrastructure/logger/index';

describe('redactSecrets', () => {
  it('redacts credential-shaped keys regardless of casing or separators', () => {
    const redacted = redactSecrets({
      GITHUB_TOKEN: 'ghp_realtoken',
      githubToken: 'ghp_realtoken',
      'github-token': 'ghp_realtoken',
      apiKey: 'sk-real',
      API_KEY: 'sk-real',
      clientSecret: 'shh',
      authorization: 'Bearer real',
      password: 'hunter2',
    }) as Record<string, unknown>;

    for (const value of Object.values(redacted)) {
      expect(value).toBe('[REDACTED]');
    }
  });

  it('leaves non-secret keys alone, including ones merely containing "key"', () => {
    expect(
      redactSecrets({ owner: 'me', repo: 'proj', keywords: ['a'], monkey: 'ok' })
    ).toEqual({ owner: 'me', repo: 'proj', keywords: ['a'], monkey: 'ok' });
  });

  it('redacts nested and array-nested secrets', () => {
    expect(
      redactSecrets({ github: { config: { token: 'ghp_x' } }, agents: [{ apiKey: 'sk' }] })
    ).toEqual({ github: { config: { token: '[REDACTED]' } }, agents: [{ apiKey: '[REDACTED]' }] });
  });

  it('does not hang on circular references', () => {
    const cyclic: Record<string, unknown> = { token: 'ghp_x' };
    cyclic.self = cyclic;
    expect(redactSecrets(cyclic)).toEqual({ token: '[REDACTED]', self: '[Circular]' });
  });

  it('flattens Errors instead of dropping them', () => {
    const result = redactSecrets(new Error('boom')) as Record<string, unknown>;
    expect(result.name).toBe('Error');
    expect(result.message).toBe('boom');
  });

  it('passes primitives through untouched', () => {
    expect(redactSecrets('plain')).toBe('plain');
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBeNull();
  });
});

describe('ConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never writes a token to stderr', () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    new ConsoleLogger('TEST').debug('booting', {
      github: { owner: 'me', token: 'ghp_SUPERSECRET' },
    });

    const output = written.join('');
    expect(output).not.toContain('ghp_SUPERSECRET');
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('me');
  });

  it('writes to stderr, never stdout (stdout carries the MCP protocol)', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    new ConsoleLogger('TEST').info('hello', { a: 1 });
    expect(stdout).not.toHaveBeenCalled();
  });
});
