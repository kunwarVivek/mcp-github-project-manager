import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createPerplexity } from '@ai-sdk/perplexity';
import type { SamplingRequestFn } from './SamplingLanguageModel';
import { SamplingLanguageModel } from './SamplingLanguageModel';
import { type LanguageModel, wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import {
  ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, PERPLEXITY_API_KEY,
  AI_MAIN_MODEL, AI_RESEARCH_MODEL, AI_FALLBACK_MODEL, AI_PRD_MODEL,
  AI_MAIN_PROVIDER, AI_MAIN_API_KEY, AI_MAIN_BASE_URL,
  AI_RESEARCH_PROVIDER, AI_RESEARCH_API_KEY, AI_RESEARCH_BASE_URL,
  AI_FALLBACK_PROVIDER, AI_FALLBACK_API_KEY, AI_FALLBACK_BASE_URL,
  AI_PRD_PROVIDER, AI_PRD_API_KEY, AI_PRD_BASE_URL,
  getOptionalConfigValue,
} from '../../env';
import { type ILogger, Logger } from '../../infrastructure/logger';
import { getTraceContext } from '../../infrastructure/observability/CorrelationContext';
import {
  AIResiliencePolicy,
  type DegradedResult,
} from '../../infrastructure/resilience/AIResiliencePolicy.js';

/**
 * Middleware that meters token spend and applies resilience protection.
 *
 * Wrapping the model is what makes BOTH metering and resilience INVOLUNTARY:
 * every `generateText`/`generateObject` call site receives its model from
 * `AIServiceFactory.getModel`, so instrumenting here covers all of them
 * without touching one.
 *
 * Metering: accumulates tokens in the trace context's usage sink. The actual
 * budget debit happens once per tool call in the dispatcher.
 *
 * Resilience (when enabled via `enableResilience()`): wraps each call with
 * retry + circuit breaker + timeout via cockatiel. Failures throw — each
 * service's existing try/catch provides the domain-specific fallback.
 *
 * SCOPE: this meters tokens *this server* spends. Agent-side spend reaches
 * this process only via `record_usage`.
 */
export const usageMeteringMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const doGenerateWithMetering = async () => {
      const result = await doGenerate();
      const sink = getTraceContext()?.usage;
      if (sink) {
        // `inputTokens`/`outputTokens` are objects with a `total`, not numbers —
        // reading them as numbers yields NaN and silently poisons the budget.
        const input = result.usage?.inputTokens?.total ?? 0;
        const output = result.usage?.outputTokens?.total ?? 0;
        sink.tokens += input + output;
      }
      return result;
    };

    // If resilience is enabled, wrap with retry + circuit breaker + timeout.
    // Failures throw (no fallback here) — each service's existing try/catch
    // provides the fallback. This is transparent: all 31 generateObject/
    // generateText call sites get resilience without code changes.
    const factory = AIServiceFactory.getInstance();
    const policy = factory.getResiliencePolicy();
    if (policy) {
      return policy.executeRaw(doGenerateWithMetering);
    }

    return doGenerateWithMetering();
  },
};

/**
 * AI Provider Types
 */
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'perplexity' | 'openai-compatible';

/** The four model roles the server configures independently. */
export type AIModelRole = 'main' | 'research' | 'fallback' | 'prd';

export const SUPPORTED_PROVIDERS: readonly AIProvider[] = [
  'anthropic', 'openai', 'google', 'perplexity', 'openai-compatible',
] as const;

/**
 * API key accessors, read at call time so a rotated secret is picked up.
 */
const PROVIDER_API_KEYS: Record<AIProvider, () => string> = {
  anthropic: () => ANTHROPIC_API_KEY,
  openai: () => OPENAI_API_KEY,
  google: () => GOOGLE_API_KEY,
  perplexity: () => PERPLEXITY_API_KEY,
  // No single global key for generic OpenAI-compatible endpoints — always
  // resolved per-role (AI_<ROLE>_API_KEY); this entry is never invoked.
  'openai-compatible': () => '',
};

/** Model-name prefixes used only as a fallback hint when no provider is set. */
const PROVIDER_HINTS: ReadonlyArray<[AIProvider, (m: string) => boolean]> = [
  ['anthropic', (m) => m.startsWith('claude-')],
  ['openai', (m) => m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')],
  ['google', (m) => m.startsWith('gemini-')],
  ['perplexity', (m) => m.includes('perplexity') || m.includes('sonar') || m.includes('llama')],
];

/** Per-role configuration accessors — read at call time so tests and rotation work. */
const PER_ROLE_CONFIG: Record<AIModelRole, {
  provider: () => string;
  apiKey: () => string;
  baseURL: () => string;
}> = {
  main:     { provider: () => getOptionalConfigValue('AI_MAIN_PROVIDER', ''),     apiKey: () => getOptionalConfigValue('AI_MAIN_API_KEY', ''),     baseURL: () => getOptionalConfigValue('AI_MAIN_BASE_URL', '') },
  research: { provider: () => getOptionalConfigValue('AI_RESEARCH_PROVIDER', ''), apiKey: () => getOptionalConfigValue('AI_RESEARCH_API_KEY', ''), baseURL: () => getOptionalConfigValue('AI_RESEARCH_BASE_URL', '') },
  fallback: { provider: () => getOptionalConfigValue('AI_FALLBACK_PROVIDER', ''), apiKey: () => getOptionalConfigValue('AI_FALLBACK_API_KEY', ''), baseURL: () => getOptionalConfigValue('AI_FALLBACK_BASE_URL', '') },
  prd:      { provider: () => getOptionalConfigValue('AI_PRD_PROVIDER', ''),      apiKey: () => getOptionalConfigValue('AI_PRD_API_KEY', ''),      baseURL: () => getOptionalConfigValue('AI_PRD_BASE_URL', '') },
};

/**
 * Resolve which provider serves a model.
 *
 * An explicit `AI_<ROLE>_PROVIDER` wins. Otherwise the model name is matched
 * against known prefixes. An unrecognised name returns `undefined` — previously
 * it silently fell back to Anthropic *and substituted a different model*, so a
 * typo'd or newly-released model ID quietly ran somewhere else entirely.
 */
export function resolveProvider(
  modelString: string,
  role?: AIModelRole,
): AIProvider | undefined {
  // 1. Explicit per-role provider (AI_MAIN_PROVIDER, etc.)
  if (role) {
    const explicit = PER_ROLE_CONFIG[role].provider();
    if (explicit) {
      const normalized = explicit.trim().toLowerCase() as AIProvider;
      if (SUPPORTED_PROVIDERS.includes(normalized)) return normalized;
      // Unrecognized name ("together", "groq", etc.) with a base URL → openai-compatible
      return 'openai-compatible';
    }
  }
  // 2. Legacy: AI_<ROLE>_PROVIDER via getOptionalConfigValue (already checked above)
  // 3. Model-name prefix detection
  if (!modelString) return undefined;
  return PROVIDER_HINTS.find(([, matches]) => matches(modelString))?.[0];
}

/**
 * AI Model Configuration
 */
export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
}

/**
 * AI Service Configuration
 */
export interface AIServiceConfig {
  main: AIModelConfig | null;
  research: AIModelConfig | null;
  fallback: AIModelConfig | null;
  prd: AIModelConfig | null;
}

/**
 * Factory for creating AI service instances with Vercel AI SDK
 */
export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private config: AIServiceConfig;
  private resiliencePolicy?: AIResiliencePolicy;
  private samplingModel: LanguageModel | null = null;
  private readonly logger: ILogger;

  private constructor(logger?: ILogger) {
    this.logger = logger ?? Logger.getInstance();
    this.config = this.buildConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(logger?: ILogger): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory(logger);
    }
    return AIServiceFactory.instance;
  }

  /**
   * Build AI service configuration from environment variables
   */
  private buildConfiguration(): AIServiceConfig {
    return {
      main: this.parseModelConfig(AI_MAIN_MODEL, 'main'),
      research: this.parseModelConfig(AI_RESEARCH_MODEL, 'research'),
      fallback: this.parseModelConfig(AI_FALLBACK_MODEL, 'fallback'),
      prd: this.parseModelConfig(AI_PRD_MODEL, 'prd')
    };
  }

  /**
   * Parse model configuration from model string
   */
  private parseModelConfig(modelString: string, role?: AIModelRole): AIModelConfig | null {
    if (!modelString) {
      // No model configured for this role — skip silently
      return null;
    }

    const provider = resolveProvider(modelString, role);

    if (!provider) {
      this.logger.warn(
        `AI Model Warning: cannot determine a provider for model "${modelString}". ` +
          `Set AI_${(role ?? 'MAIN').toUpperCase()}_PROVIDER to one of ` +
          `${SUPPORTED_PROVIDERS.join(', ')}.`,
      );
      return null;
    }

    // Resolve API key: per-role key overrides global provider key
    let apiKey = '';
    let baseURL: string | undefined;
    if (role) {
      const roleConfig = PER_ROLE_CONFIG[role];
      apiKey = roleConfig.apiKey();
      const url = roleConfig.baseURL();
      if (url) baseURL = url;
    }
    // Fall back to global provider key
    if (!apiKey && provider !== 'openai-compatible') {
      apiKey = PROVIDER_API_KEYS[provider]();
    }

    if (!apiKey) {
      this.logger.warn(
        `AI Provider Warning: No API key for ${provider} (role: ${role ?? 'unknown'}). ` +
          `Set AI_${(role ?? 'MAIN').toUpperCase()}_API_KEY or the global provider key.`,
      );
      return null;
    }

    return { provider, model: modelString, apiKey, baseURL };
  }

  /**
   * Get AI model instance for specific use case
   */
  public getModel(type: 'main' | 'research' | 'fallback' | 'prd'): LanguageModel | null {
    // Typed off wrapLanguageModel's own parameter: `LanguageModel` also admits
    // the plain model-id string, which is not a wrappable model instance.
    type WrappableModel = Parameters<typeof wrapLanguageModel>[0]['model'];
    const meter = (model: WrappableModel): LanguageModel =>
      wrapLanguageModel({ model, middleware: usageMeteringMiddleware });

    const config = this.config[type];

    if (!config) {
      this.logger.warn(`AI Model Warning: ${type} model is not available due to missing API key.`);
      return null;
    }

    // Build a provider client bound to the resolved key. The default
    // `anthropic(...)` / `openai(...)` singletons read process.env themselves,
    // which meant a key supplied via CLI flag or SECRETS_DIR was resolved,
    // stored, used as a truthiness gate — and then silently ignored.
    switch (config.provider) {
      case 'anthropic':
        return meter(createAnthropic({ apiKey: config.apiKey, ...(config.baseURL && { baseURL: config.baseURL }) })(config.model));

      case 'openai':
        return meter(createOpenAI({ apiKey: config.apiKey, ...(config.baseURL && { baseURL: config.baseURL }) })(config.model));

      case 'google':
        return meter(createGoogleGenerativeAI({ apiKey: config.apiKey, ...(config.baseURL && { baseURL: config.baseURL }) })(config.model));

      case 'perplexity':
        return meter(createPerplexity({ apiKey: config.apiKey, ...(config.baseURL && { baseURL: config.baseURL }) })(config.model));

      case 'openai-compatible':
        // Any OpenAI-protocol endpoint: OpenRouter, Together, Groq, Ollama, Azure, etc.
        return meter(createOpenAI({
          apiKey: config.apiKey,
          ...(config.baseURL && { baseURL: config.baseURL }),
        })(config.model));

      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * Get main AI model (for general task generation)
   */
  public getMainModel(): LanguageModel | null {
    return this.getModel('main');
  }

  /**
   * Get research AI model (for enhanced analysis)
   */
  public getResearchModel(): LanguageModel | null {
    return this.getModel('research');
  }

  /**
   * Get fallback AI model (when main model fails)
   */
  public getFallbackModel(): LanguageModel | null {
    return this.getModel('fallback');
  }

  /**
   * Get PRD AI model (for PRD generation)
   */
  public getPRDModel(): LanguageModel | null {
    return this.getModel('prd');
  }

  /**
   * Get the best available model with fallback logic
   * Tries models in order of preference: main -> fallback -> any available
   */
  public getBestAvailableModel(): LanguageModel | null {
    const mainModel = this.getMainModel();
    if (mainModel) return mainModel;

    const fallbackModel = this.getFallbackModel();
    if (fallbackModel) return fallbackModel;

    const prdModel = this.getPRDModel();
    if (prdModel) return prdModel;

    const researchModel = this.getResearchModel();
    if (researchModel) return researchModel;

    // Last resort: MCP sampling (the calling agent does the completion)
    if (this.samplingModel) return this.samplingModel;

    return null;
  }

  /**
   * Register the MCP client's own LLM as a zero-config fallback.
   * Called after MCP handshake when the client declares sampling capability.
   * This lets all AI tools work without any API keys — the calling agent
   * (Claude, Codex, Pi) IS the model.
   */
  public setSamplingProvider(samplingFn: SamplingRequestFn): void {
    this.samplingModel = new SamplingLanguageModel(samplingFn) as unknown as LanguageModel;
    this.logger.info('🔗 MCP sampling registered as zero-config AI fallback (client LLM)');
  }

  /**
   * Check if any AI functionality is available
   */
  public isAIAvailable(): boolean {
    return this.getBestAvailableModel() !== null;
  }

  /**
   * Get configuration for debugging
   */
  public getConfiguration(): AIServiceConfig {
    // Never hand out API keys — this is a debugging accessor and one
    // `logger.debug(factory.getConfiguration())` away from printing every key.
    const strip = (c: AIModelConfig | null): AIModelConfig | null =>
      c ? { ...c, apiKey: c.apiKey ? '[REDACTED]' : '' } : null;
    return {
      main: strip(this.config.main),
      research: strip(this.config.research),
      fallback: strip(this.config.fallback),
      prd: strip(this.config.prd),
    };
  }

  /**
   * Check AI provider availability and configuration status
   */
  public validateConfiguration(): {
    hasAnyProvider: boolean;
    available: string[];
    missing: string[];
    availableModels: string[];
    unavailableModels: string[];
  } {
    const missing: string[] = [];
    const available: string[] = [];
    const availableModels: string[] = [];
    const unavailableModels: string[] = [];

    // Check each provider
    if (!ANTHROPIC_API_KEY) {
      missing.push('ANTHROPIC_API_KEY');
    } else {
      available.push('anthropic');
    }

    if (!OPENAI_API_KEY) {
      missing.push('OPENAI_API_KEY');
    } else {
      available.push('openai');
    }

    if (!GOOGLE_API_KEY) {
      missing.push('GOOGLE_API_KEY');
    } else {
      available.push('google');
    }

    if (!PERPLEXITY_API_KEY) {
      missing.push('PERPLEXITY_API_KEY');
    } else {
      available.push('perplexity');
    }

    // Check which models are available
    if (this.config.main) availableModels.push('main'); else unavailableModels.push('main');
    if (this.config.research) availableModels.push('research'); else unavailableModels.push('research');
    if (this.config.fallback) availableModels.push('fallback'); else unavailableModels.push('fallback');
    if (this.config.prd) availableModels.push('prd'); else unavailableModels.push('prd');

    return {
      hasAnyProvider: available.length > 0,
      available,
      missing,
      availableModels,
      unavailableModels
    };
  }

  // ==========================================
  // Resilience Methods
  // ==========================================

  /**
   * Enable resilience for AI operations.
   *
   * This is OPT-IN - existing behavior is unchanged until this is called.
   * Services that want resilience can use executeWithResilience() after enabling.
   *
   * @param policy - Optional custom resilience policy. If not provided, creates default.
   */
  public enableResilience(policy?: AIResiliencePolicy): void {
    this.resiliencePolicy = policy ?? new AIResiliencePolicy();
    this.logger.info('[AIServiceFactory] Resilience enabled');
  }

  /**
   * Get the current resilience policy, if enabled.
   *
   * @returns The resilience policy or undefined if not enabled
   */
  public getResiliencePolicy(): AIResiliencePolicy | undefined {
    return this.resiliencePolicy;
  }

  /**
   * Check if resilience is currently enabled.
   *
   * @returns true if resilience is enabled
   */
  public isResilienceEnabled(): boolean {
    return this.resiliencePolicy !== undefined;
  }

  /**
   * Get the current circuit breaker state.
   *
   * @returns Circuit state: 'closed', 'open', 'half-open', or 'disabled' if resilience not enabled
   */
  public getCircuitState(): 'closed' | 'open' | 'half-open' | 'disabled' {
    if (!this.resiliencePolicy) {
      return 'disabled';
    }
    return this.resiliencePolicy.getCircuitState();
  }

  /**
   * Execute an AI operation with resilience protection.
   *
   * Wraps the operation with:
   * - Timeout protection
   * - Circuit breaker (prevents cascading failures)
   * - Retry with exponential backoff
   * - Fallback for graceful degradation
   *
   * If resilience is not enabled, executes the operation directly.
   *
   * @example
   * ```typescript
   * const factory = AIServiceFactory.getInstance();
   * factory.enableResilience();
   *
   * const result = await factory.executeWithResilience(
   *   () => generateText({ model, prompt: 'Hello' }),
   *   () => ({ degraded: true, message: 'Using cached response' })
   * );
   *
   * if ('degraded' in result) {
   *   console.log('AI unavailable:', result.message);
   * }
   * ```
   *
   * @param operation - The async AI operation to execute
   * @param fallback - Optional fallback function for graceful degradation
   * @returns The operation result, or a DegradedResult if fallback is used
   */
  public async executeWithResilience<T>(
    operation: () => Promise<T>,
    fallback?: () => T | DegradedResult
  ): Promise<T | DegradedResult> {
    if (!this.resiliencePolicy) {
      // No resilience enabled, execute directly
      return operation();
    }
    return this.resiliencePolicy.execute(operation, fallback);
  }

  /**
   * Test connection to AI providers
   */
  public async testConnections(): Promise<{ [key in AIProvider]: boolean }> {
    const results: { [key in AIProvider]: boolean } = {
      anthropic: false,
      openai: false,
      google: false,
      perplexity: false,
      'openai-compatible': false
    };

    // Test each provider if API key is available
    if (ANTHROPIC_API_KEY) {
      try {
        const model = this.getModel('main');
        if (model) {
          // Simple test generation using generateText from ai package
          const { generateText } = await import('ai');
          await generateText({
            model,
            prompt: 'Test connection',
            maxOutputTokens: 10
          });
          results.anthropic = true;
        }
      } catch (error) {
        this.logger.error('Anthropic connection test failed', error);
      }
    }

    // Add similar tests for other providers as needed

    return results;
  }
}
