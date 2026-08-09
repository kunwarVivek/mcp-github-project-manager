import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../../domain/config-schema';

const requiredGithub = {
  GITHUB_TOKEN: 'ghp_test',
  GITHUB_OWNER: 'owner',
  GITHUB_REPO: 'repo',
};

describe('config-schema boolean flags', () => {
  // Regression: z.coerce.boolean() applies JS truthiness, so the string "false"
  // parsed to `true` — a fail-open default for WEBHOOK_ALLOW_UNSIGNED.
  it.each([
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['no', false],
    ['', false],
    ['true', true],
    ['TRUE', true],
    ['1', true],
  ])('WEBHOOK_ALLOW_UNSIGNED=%s -> %s', (raw, expected) => {
    const cfg = validateConfig({ ...requiredGithub, WEBHOOK_ALLOW_UNSIGNED: raw });
    expect(cfg.webhook?.WEBHOOK_ALLOW_UNSIGNED).toBe(expected);
  });

  it('WEBHOOK_ALLOW_UNSIGNED defaults to false when unset', () => {
    const cfg = validateConfig({ ...requiredGithub });
    expect(cfg.webhook?.WEBHOOK_ALLOW_UNSIGNED).toBe(false);
  });

  it('SYNC_ENABLED=false disables sync', () => {
    const cfg = validateConfig({ ...requiredGithub, SYNC_ENABLED: 'false' });
    expect(cfg.sync?.SYNC_ENABLED).toBe(false);
  });

  it('SYNC_ENABLED defaults to true when unset', () => {
    const cfg = validateConfig({ ...requiredGithub });
    expect(cfg.sync?.SYNC_ENABLED).toBe(true);
  });

  it('still rejects a missing GitHub token', () => {
    expect(() => validateConfig({ GITHUB_OWNER: 'o', GITHUB_REPO: 'r' })).toThrow(
      /GITHUB_TOKEN/
    );
  });
});
