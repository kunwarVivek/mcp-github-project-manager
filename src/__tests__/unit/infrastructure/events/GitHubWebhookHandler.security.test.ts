import { describe, expect, it } from '@jest/globals';
import * as crypto from 'crypto';
import { GitHubWebhookHandler } from '../../../../infrastructure/events/GitHubWebhookHandler';

/**
 * Security regression tests for webhook signature validation.
 *
 * Guards against the fail-open bypass where an unconfigured WEBHOOK_SECRET
 * caused validateSignature to accept any (forged) webhook. The handler must
 * fail closed by default and only accept unsigned webhooks when the operator
 * explicitly opts in.
 */
describe('GitHubWebhookHandler signature validation (security)', () => {
  const payload = JSON.stringify({ action: 'opened', number: 1 });

  const sign = (secret: string, body: string): string =>
    `sha256=${crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

  describe('no secret configured', () => {
    it('fails closed: rejects when no secret and unsigned not allowed', async () => {
      const handler = new GitHubWebhookHandler('', false);
      await expect(handler.validateSignature(payload, 'sha256=anything')).resolves.toBe(false);
    });

    it('accepts unsigned only when explicitly opted in', async () => {
      const handler = new GitHubWebhookHandler('', true);
      await expect(handler.validateSignature(payload, '')).resolves.toBe(true);
    });
  });

  describe('secret configured', () => {
    const secret = 'test-webhook-secret';

    it('accepts a correctly signed payload', async () => {
      const handler = new GitHubWebhookHandler(secret, false);
      await expect(
        handler.validateSignature(payload, sign(secret, payload)),
      ).resolves.toBe(true);
    });

    it('rejects a payload signed with the wrong secret', async () => {
      const handler = new GitHubWebhookHandler(secret, false);
      await expect(
        handler.validateSignature(payload, sign('wrong-secret', payload)),
      ).resolves.toBe(false);
    });

    it('rejects when signature is missing', async () => {
      const handler = new GitHubWebhookHandler(secret, false);
      await expect(handler.validateSignature(payload, '')).resolves.toBe(false);
    });

    it('rejects a tampered payload', async () => {
      const handler = new GitHubWebhookHandler(secret, false);
      const signature = sign(secret, payload);
      await expect(
        handler.validateSignature(payload + 'tampered', signature),
      ).resolves.toBe(false);
    });
  });
});
