import { describe, expect, it, vi, beforeEach } from 'vitest';

const createAnthropic = vi.hoisted(() =>
  // Must return an object: the metering middleware wraps the model.
  vi.fn(() => vi.fn(() => ({ specificationVersion: 'v4', modelId: 'anthropic-model' }))),
);
const createOpenAI = vi.hoisted(() =>
  // Must return an object: the metering middleware wraps the model.
  vi.fn(() => vi.fn(() => ({ specificationVersion: 'v4', modelId: 'openai-model' }))),
);
const createGoogle = vi.hoisted(() =>
  // Must return an object: the metering middleware wraps the model.
  vi.fn(() => vi.fn(() => ({ specificationVersion: 'v4', modelId: 'google-model' }))),
);
const createPerplexity = vi.hoisted(() =>
  // Must return an object: the metering middleware wraps the model.
  vi.fn(() => vi.fn(() => ({ specificationVersion: 'v4', modelId: 'perplexity-model' }))),
);

vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic }));
// Pass-through so the assertions observe the unwrapped model.
vi.mock('ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('ai')),
  wrapLanguageModel: ({ model }: { model: unknown }) => model,
}));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: createGoogle }));
vi.mock('@ai-sdk/perplexity', () => ({ createPerplexity }));

vi.mock('../../../../env', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../../env');
  return {
    ...actual,
    ANTHROPIC_API_KEY: 'sk-ant-RESOLVED',
    OPENAI_API_KEY: 'sk-oai-RESOLVED',
    GOOGLE_API_KEY: '',
    PERPLEXITY_API_KEY: '',
    AI_MAIN_MODEL: 'claude-opus-5',
    AI_RESEARCH_MODEL: 'sonar-pro',
    AI_FALLBACK_MODEL: 'gpt-4o',
    AI_PRD_MODEL: 'claude-opus-5',
  };
});

const { AIServiceFactory } = await import('../../../../services/ai/AIServiceFactory');

/**
 * Regression: the factory resolved each provider key, stored it on the model
 * config, used it only as a truthiness gate, and then called the *default*
 * `anthropic(...)` / `openai(...)` singletons — which read process.env
 * themselves. A key supplied via CLI flag or SECRETS_DIR was therefore resolved
 * and then silently ignored, failing at request time instead of startup.
 */
describe('AI provider key plumbing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error resetting the module singleton between cases
    AIServiceFactory.instance = undefined;
  });

  it('passes the resolved Anthropic key to createAnthropic', () => {
    AIServiceFactory.getInstance().getModel('main');
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-RESOLVED' });
  });

  it('passes the resolved OpenAI key to createOpenAI', () => {
    AIServiceFactory.getInstance().getModel('fallback');
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-oai-RESOLVED' });
  });

  it('does not build a client for a provider with no key', () => {
    AIServiceFactory.getInstance().getModel('research');
    expect(createPerplexity).not.toHaveBeenCalled();
  });

  it('getConfiguration never returns a live API key', () => {
    const cfg = AIServiceFactory.getInstance().getConfiguration();
    const serialized = JSON.stringify(cfg);
    expect(serialized).not.toContain('sk-ant-RESOLVED');
    expect(serialized).not.toContain('sk-oai-RESOLVED');
    expect(cfg.main?.apiKey).toBe('[REDACTED]');
  });
});
