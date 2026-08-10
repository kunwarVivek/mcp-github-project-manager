import { describe, expect, it } from 'vitest';
import { resolveProvider, SUPPORTED_PROVIDERS } from '../../../../services/ai/AIServiceFactory';

describe('resolveProvider', () => {
  it.each([
    ['claude-opus-5', 'anthropic'],
    ['claude-sonnet-5', 'anthropic'],
    ['gpt-4o', 'openai'],
    ['o1-preview', 'openai'],
    ['o3-mini', 'openai'],
    ['gemini-2.0-flash', 'google'],
    ['sonar-pro', 'perplexity'],
  ])('maps %s -> %s', (model, expected) => {
    expect(resolveProvider(model)).toBe(expected);
  });

  // Regression: an unrecognised model silently fell through to Anthropic AND
  // substituted a *different* model string, so a typo or a newly-released model
  // ID quietly ran somewhere else entirely.
  it('returns undefined for an unrecognised model instead of defaulting', () => {
    expect(resolveProvider('mistral-large-latest')).toBeUndefined();
    expect(resolveProvider('typo-cluade-opus')).toBeUndefined();
  });

  it('exposes the five supported providers', () => {
    expect([...SUPPORTED_PROVIDERS]).toEqual(['anthropic', 'openai', 'google', 'perplexity', 'openai-compatible']);
  });

  describe('AI_<ROLE>_PROVIDER override', () => {
    it('an explicit provider wins over the model-name hint', () => {
      process.env.AI_MAIN_PROVIDER = 'openai';
      try {
        expect(resolveProvider('claude-opus-5', 'main')).toBe('openai');
      } finally {
        delete process.env.AI_MAIN_PROVIDER;
      }
    });

    it('lets an unrecognised model be routed explicitly', () => {
      process.env.AI_RESEARCH_PROVIDER = 'perplexity';
      try {
        expect(resolveProvider('some-new-model', 'research')).toBe('perplexity');
      } finally {
        delete process.env.AI_RESEARCH_PROVIDER;
      }
    });

    it('routes an unknown provider name to openai-compatible', () => {
      process.env.AI_MAIN_PROVIDER = 'cohere';
      try {
        expect(resolveProvider('claude-opus-5', 'main')).toBe('openai-compatible');
      } finally {
        delete process.env.AI_MAIN_PROVIDER;
      }
    });

    it('is case-insensitive', () => {
      process.env.AI_PRD_PROVIDER = 'GOOGLE';
      try {
        expect(resolveProvider('anything', 'prd')).toBe('google');
      } finally {
        delete process.env.AI_PRD_PROVIDER;
      }
    });
  });
});
