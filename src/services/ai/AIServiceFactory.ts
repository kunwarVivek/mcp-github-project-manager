import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { createPerplexity } from "@ai-sdk/perplexity";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import {
  type EmbeddingModel,
  generateText,
  type LanguageModel,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from "ai";
import { getGoogleVertexLocation, getGoogleVertexProject, getOptionalConfigValue } from "../../env";
import { type ILogger, Logger } from "../../infrastructure/logger";
import { getTraceContext } from "../../infrastructure/observability/CorrelationContext";
import {
  AIResiliencePolicy,
  type DegradedResult,
} from "../../infrastructure/resilience/AIResiliencePolicy";
import type { SamplingRequestFn } from "./SamplingLanguageModel";
import { SamplingLanguageModel } from "./SamplingLanguageModel";

/**
 * Sum provider-reported usage. `inputTokens`/`outputTokens` are objects with a
 * `total`, not numbers — reading them as numbers yields NaN and silently
 * poisons the budget.
 */
function totalTokens(
  usage: { inputTokens?: { total?: number }; outputTokens?: { total?: number } } | undefined
): number {
  return (usage?.inputTokens?.total ?? 0) + (usage?.outputTokens?.total ?? 0);
}

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
      if (sink) sink.tokens += totalTokens(result.usage);
      return result;
    };

    // If resilience is enabled, wrap with retry + circuit breaker + timeout.
    // Failures throw (no fallback here) — each service's existing try/catch
    // provides the fallback. This is transparent: all 31 generateObject/
    // generateText call sites get resilience without code changes.
    const policy = AIServiceFactory.getInstance().getResiliencePolicy();
    if (policy) {
      return policy.executeRaw(doGenerateWithMetering);
    }

    return doGenerateWithMetering();
  },

  wrapStream: async ({ doStream }) => {
    const doStreamWithMetering = async () => {
      const result = await doStream();
      // Capture the sink now: the transform callback runs wherever the
      // consumer pulls the stream, which need not be inside this trace's
      // AsyncLocalStorage scope.
      const sink = getTraceContext()?.usage;
      if (!sink) return result;
      // Usage is only reported on the terminal `finish` part.
      const metered = result.stream.pipeThrough(
        new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === "finish") sink.tokens += totalTokens(chunk.usage);
            controller.enqueue(chunk);
          },
        })
      );
      return { ...result, stream: metered };
    };

    const policy = AIServiceFactory.getInstance().getResiliencePolicy();
    if (policy) {
      return policy.executeRaw(doStreamWithMetering);
    }

    return doStreamWithMetering();
  },
};

/**
 * AI Provider Types
 */
export type AIProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "google-vertex"
  | "perplexity"
  | "openai-compatible";

/** The four model roles the server configures independently. */
export type AIModelRole = "main" | "research" | "fallback" | "prd";

export const SUPPORTED_PROVIDERS: readonly AIProvider[] = [
  "anthropic",
  "openai",
  "google",
  "google-vertex",
  "perplexity",
  "openai-compatible",
] as const;

/**
 * API key accessors, read at call time so a rotated secret is picked up.
 */
const PROVIDER_API_KEYS: Record<AIProvider, () => string> = {
  anthropic: () => getOptionalConfigValue("ANTHROPIC_API_KEY", ""),
  openai: () => getOptionalConfigValue("OPENAI_API_KEY", ""),
  google: () => getOptionalConfigValue("GOOGLE_API_KEY", ""),
  // Vertex authenticates with Application Default Credentials, not a key —
  // never invoked (see usesApiKey).
  "google-vertex": () => "",
  perplexity: () => getOptionalConfigValue("PERPLEXITY_API_KEY", ""),
  // No single global key for generic OpenAI-compatible endpoints — always
  // resolved per-role (AI_<ROLE>_API_KEY); this entry is never invoked.
  "openai-compatible": () => "",
};

/** Global key variable per provider, for the "missing" report. */
const PROVIDER_KEY_NAMES: Record<Exclude<AIProvider, "openai-compatible">, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  "google-vertex": "GOOGLE_VERTEX_PROJECT",
  perplexity: "PERPLEXITY_API_KEY",
};

/** Providers that authenticate with a key (not ADC, not per-role-only). */
const usesApiKey = (provider: AIProvider): boolean =>
  provider !== "openai-compatible" && provider !== "google-vertex";

/** Whether a provider is configured globally (key set, or Vertex project set). */
const isGloballyConfigured = (provider: AIProvider): boolean => {
  if (provider === "google-vertex") return getGoogleVertexProject() !== "";
  if (provider === "openai-compatible") return false;
  return PROVIDER_API_KEYS[provider]() !== "";
};

const MODEL_ROLES: readonly AIModelRole[] = ["main", "research", "fallback", "prd"];

/** Env var naming the model for each role — read at call time. */
const ROLE_MODEL_ENV: Record<AIModelRole, string> = {
  main: "AI_MAIN_MODEL",
  research: "AI_RESEARCH_MODEL",
  fallback: "AI_FALLBACK_MODEL",
  prd: "AI_PRD_MODEL",
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Which backend serves a `gemini-*` model when no provider is set explicitly:
 * Vertex AI when `GOOGLE_VERTEX_PROJECT` is configured, otherwise the
 * `google` API-key provider. Vertex wins when both are configured because ADC
 * credentials are the stronger identity (no long-lived key to leak).
 */
const geminiProvider = (): AIProvider => (getGoogleVertexProject() ? "google-vertex" : "google");

/** Model-name prefixes used only as a fallback hint when no provider is set. */
const PROVIDER_HINTS: ReadonlyArray<[() => AIProvider, (m: string) => boolean]> = [
  [() => "anthropic", (m) => m.startsWith("claude-")],
  [() => "openai", (m) => m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3")],
  [geminiProvider, (m) => m.startsWith("gemini-")],
  [
    () => "perplexity",
    (m) => m.includes("perplexity") || m.includes("sonar") || m.includes("llama"),
  ],
];

/** Per-role configuration accessors — read at call time so tests and rotation work. */
const PER_ROLE_CONFIG: Record<
  AIModelRole,
  {
    provider: () => string;
    apiKey: () => string;
    baseURL: () => string;
  }
> = {
  main: {
    provider: () => getOptionalConfigValue("AI_MAIN_PROVIDER", ""),
    apiKey: () => getOptionalConfigValue("AI_MAIN_API_KEY", ""),
    baseURL: () => getOptionalConfigValue("AI_MAIN_BASE_URL", ""),
  },
  research: {
    provider: () => getOptionalConfigValue("AI_RESEARCH_PROVIDER", ""),
    apiKey: () => getOptionalConfigValue("AI_RESEARCH_API_KEY", ""),
    baseURL: () => getOptionalConfigValue("AI_RESEARCH_BASE_URL", ""),
  },
  fallback: {
    provider: () => getOptionalConfigValue("AI_FALLBACK_PROVIDER", ""),
    apiKey: () => getOptionalConfigValue("AI_FALLBACK_API_KEY", ""),
    baseURL: () => getOptionalConfigValue("AI_FALLBACK_BASE_URL", ""),
  },
  prd: {
    provider: () => getOptionalConfigValue("AI_PRD_PROVIDER", ""),
    apiKey: () => getOptionalConfigValue("AI_PRD_API_KEY", ""),
    baseURL: () => getOptionalConfigValue("AI_PRD_BASE_URL", ""),
  },
};

/**
 * Resolve which provider serves a model.
 *
 * An explicit `AI_<ROLE>_PROVIDER` wins. Otherwise the model name is matched
 * against known prefixes. An unrecognised name returns `undefined` — previously
 * it silently fell back to Anthropic *and substituted a different model*, so a
 * typo'd or newly-released model ID quietly ran somewhere else entirely.
 */
export function resolveProvider(modelString: string, role?: AIModelRole): AIProvider | undefined {
  // 1. Explicit per-role provider (AI_MAIN_PROVIDER, etc.)
  if (role) {
    const explicit = PER_ROLE_CONFIG[role].provider();
    if (explicit) {
      const normalized = explicit.trim().toLowerCase() as AIProvider;
      if (SUPPORTED_PROVIDERS.includes(normalized)) return normalized;
      // Unrecognized name ("together", "groq", etc.) with a base URL → openai-compatible
      return "openai-compatible";
    }
  }
  // 2. Legacy: AI_<ROLE>_PROVIDER via getOptionalConfigValue (already checked above)
  // 3. Model-name prefix detection
  if (!modelString) return undefined;
  return PROVIDER_HINTS.find(([, matches]) => matches(modelString))?.[0]();
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

// Typed off wrapLanguageModel's own parameter: `LanguageModel` also admits the
// plain model-id string, which is not a wrappable model instance.
type WrappableModel = Parameters<typeof wrapLanguageModel>[0]["model"];

/**
 * Factory for creating AI service instances with Vercel AI SDK
 */
export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private resiliencePolicy?: AIResiliencePolicy;
  private samplingModel: LanguageModel | null = null;
  /** Built models keyed by role; rebuilt when the resolved config changes. */
  private readonly modelCache = new Map<AIModelRole, { signature: string; model: LanguageModel }>();
  private readonly logger: ILogger;

  private constructor(logger?: ILogger) {
    this.logger = logger ?? Logger.getInstance();
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
   * Resolve the effective configuration for a role from the live secret chain.
   * Nothing is snapshotted: a rotated key or changed model is seen on the next
   * call. On failure the result carries the actual cause.
   */
  private resolveRole(
    role: AIModelRole
  ): { config: AIModelConfig } | { reason: string; configured: boolean } {
    const modelString = getOptionalConfigValue(ROLE_MODEL_ENV[role], "");
    if (!modelString) {
      return { reason: `no model configured (set ${ROLE_MODEL_ENV[role]})`, configured: false };
    }

    const provider = resolveProvider(modelString, role);
    if (!provider) {
      return {
        reason:
          `cannot determine a provider for model "${modelString}"; set ` +
          `AI_${role.toUpperCase()}_PROVIDER to one of ${SUPPORTED_PROVIDERS.join(", ")}`,
        configured: true,
      };
    }

    // Per-role key overrides the global provider key.
    const roleConfig = PER_ROLE_CONFIG[role];
    let apiKey = roleConfig.apiKey();
    const baseURL = roleConfig.baseURL() || undefined;

    // Vertex is keyless: it needs a project, and credentials come from ADC at
    // request time (never at construction, so no network I/O here).
    if (provider === "google-vertex") {
      if (!getGoogleVertexProject()) {
        return {
          reason:
            "provider google-vertex requires GOOGLE_VERTEX_PROJECT (optionally " +
            "GOOGLE_VERTEX_LOCATION) and Application Default Credentials " +
            "(GOOGLE_APPLICATION_CREDENTIALS, `gcloud auth application-default login`, " +
            "or workload identity)",
          configured: true,
        };
      }
      return { config: { provider, model: modelString, apiKey: "", baseURL } };
    }

    if (!apiKey && usesApiKey(provider)) {
      apiKey = PROVIDER_API_KEYS[provider]();
    }

    if (!apiKey) {
      return {
        reason:
          `no API key for provider ${provider}; set AI_${role.toUpperCase()}_API_KEY ` +
          `or the global provider key`,
        configured: true,
      };
    }

    return { config: { provider, model: modelString, apiKey, baseURL } };
  }

  /** Resolved config for every role (null where unavailable). */
  private resolveAllRoles(): Record<AIModelRole, AIModelConfig | null> {
    const out = {} as Record<AIModelRole, AIModelConfig | null>;
    for (const role of MODEL_ROLES) {
      const r = this.resolveRole(role);
      out[role] = "config" in r ? r.config : null;
    }
    return out;
  }

  /** Provider client bound to the resolved key, without metering. */
  private createProviderModel(config: AIModelConfig): WrappableModel {
    // The default `anthropic(...)` / `openai(...)` singletons read process.env
    // themselves, which would silently ignore a key supplied via CLI flag or
    // SECRETS_DIR — so every client is built from the resolved key.
    const options = {
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    };
    switch (config.provider) {
      case "anthropic":
        return createAnthropic(options)(config.model);
      case "openai":
      case "openai-compatible":
        // openai-compatible: any OpenAI-protocol endpoint (OpenRouter, Together,
        // Groq, Ollama, Azure, ...).
        return createOpenAI(options)(config.model);
      case "google":
        return createGoogleGenerativeAI(options)(config.model);
      case "google-vertex":
        // Credentials come from google-auth-library ADC at request time.
        // Project/location are passed explicitly so the SDK's own
        // GOOGLE_VERTEX_* env fallbacks cannot disagree with our config.
        return createVertex({
          project: getGoogleVertexProject(),
          location: getGoogleVertexLocation(),
          ...(config.baseURL && { baseURL: config.baseURL }),
        })(config.model);
      case "perplexity":
        return createPerplexity(options)(config.model);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * Get AI model instance for specific use case.
   *
   * Config is resolved on every call; the built model is cached per role and
   * rebuilt when the resolved provider/model/key/base URL changes.
   */
  public getModel(type: AIModelRole): LanguageModel | null {
    const resolved = this.resolveRole(type);

    if (!("config" in resolved)) {
      const message = `AI Model Warning: ${type} model is not available: ${resolved.reason}.`;
      if (resolved.configured) this.logger.warn(message);
      else this.logger.debug(message);
      this.modelCache.delete(type);
      return null;
    }

    const { config } = resolved;
    const signature = JSON.stringify([
      config.provider,
      config.model,
      config.apiKey,
      config.baseURL ?? "",
      // Vertex project/location are read live, so a change must rebuild the model.
      config.provider === "google-vertex"
        ? [getGoogleVertexProject(), getGoogleVertexLocation()]
        : null,
    ]);
    const cached = this.modelCache.get(type);
    if (cached && cached.signature === signature) return cached.model;

    const model = wrapLanguageModel({
      model: this.createProviderModel(config),
      middleware: usageMeteringMiddleware,
    });
    this.modelCache.set(type, { signature, model });
    return model;
  }

  /**
   * Embedding model for the duplicate-detection / related-issue services.
   *
   * Resolved at call time. Key: `AI_EMBEDDING_API_KEY`, else `OPENAI_API_KEY`.
   * Optional `AI_EMBEDDING_BASE_URL` targets an OpenAI-compatible endpoint;
   * model from `AI_EMBEDDING_MODEL`, default `text-embedding-3-small`.
   * Returns null when no key is configured.
   */
  public getEmbeddingModel(): EmbeddingModel | null {
    const apiKey = getOptionalConfigValue("AI_EMBEDDING_API_KEY", "") || PROVIDER_API_KEYS.openai();
    if (!apiKey) return null;
    const baseURL = getOptionalConfigValue("AI_EMBEDDING_BASE_URL", "");
    const modelId = getOptionalConfigValue("AI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL);
    return createOpenAI({ apiKey, ...(baseURL && { baseURL }) }).embedding(modelId);
  }

  /**
   * Get main AI model (for general task generation)
   */
  public getMainModel(): LanguageModel | null {
    return this.getModel("main");
  }

  /**
   * Get research AI model (for enhanced analysis)
   */
  public getResearchModel(): LanguageModel | null {
    return this.getModel("research");
  }

  /**
   * Get fallback AI model (when main model fails)
   */
  public getFallbackModel(): LanguageModel | null {
    return this.getModel("fallback");
  }

  /**
   * Get PRD AI model (for PRD generation)
   */
  public getPRDModel(): LanguageModel | null {
    return this.getModel("prd");
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
    // Metered like every other model so sampling spend reaches the agent budget.
    this.samplingModel = wrapLanguageModel({
      model: new SamplingLanguageModel(samplingFn),
      middleware: usageMeteringMiddleware,
    });
    this.logger.info("🔗 MCP sampling registered as zero-config AI fallback (client LLM)");
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
      c ? { ...c, apiKey: c.apiKey ? "[REDACTED]" : "" } : null;
    const roles = this.resolveAllRoles();
    return {
      main: strip(roles.main),
      research: strip(roles.research),
      fallback: strip(roles.fallback),
      prd: strip(roles.prd),
    };
  }

  /**
   * Providers with a usable key: the global key, or a per-role config that
   * resolved to that provider with its own key (AI_<ROLE>_API_KEY).
   */
  private configuredProviders(roles: Record<AIModelRole, AIModelConfig | null>): Set<AIProvider> {
    const out = new Set<AIProvider>();
    for (const provider of SUPPORTED_PROVIDERS) {
      if (isGloballyConfigured(provider)) out.add(provider);
    }
    for (const role of MODEL_ROLES) {
      const c = roles[role];
      if (c) out.add(c.provider);
    }
    return out;
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
    const roles = this.resolveAllRoles();
    const configured = this.configuredProviders(roles);
    const available: string[] = SUPPORTED_PROVIDERS.filter((p) => configured.has(p));
    const missing = (Object.keys(PROVIDER_KEY_NAMES) as Array<keyof typeof PROVIDER_KEY_NAMES>)
      .filter((p) => !configured.has(p))
      .map((p) => PROVIDER_KEY_NAMES[p]);
    const availableModels: string[] = MODEL_ROLES.filter((r) => roles[r]);
    const unavailableModels: string[] = MODEL_ROLES.filter((r) => !roles[r]);

    return {
      hasAnyProvider: available.length > 0,
      available,
      missing,
      availableModels,
      unavailableModels,
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
    this.logger.info("[AIServiceFactory] Resilience enabled");
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
  public getCircuitState(): "closed" | "open" | "half-open" | "disabled" {
    if (!this.resiliencePolicy) {
      return "disabled";
    }
    return this.resiliencePolicy.getCircuitState();
  }

  /**
   * Get structured availability status for all providers.
   * Used by discover_tools to surface AI degradation indicators to MCP clients.
   */
  public getAvailabilityStatus(): {
    available: boolean;
    providers: Array<{ name: string; configured: boolean; healthy: boolean }>;
  } {
    const circuitState = this.getCircuitState();
    const circuitHealthy = circuitState === "closed" || circuitState === "disabled";

    const configuredSet = this.configuredProviders(this.resolveAllRoles());
    const providers: Array<{ name: string; configured: boolean; healthy: boolean }> =
      SUPPORTED_PROVIDERS.map((name) => {
        const configured = configuredSet.has(name);
        return { name, configured, healthy: configured && circuitHealthy };
      });

    return {
      available: this.isAIAvailable(),
      providers,
    };
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
   * Probe every configured provider with a minimal request.
   *
   * A provider is probed through the first role whose effective config resolves
   * to it (so per-role keys and base URLs are exercised). Providers no role
   * uses report `false`. Probes use the unmetered client — a health check must
   * not debit an agent budget — and run concurrently.
   */
  public async testConnections(): Promise<Record<AIProvider, boolean>> {
    const roles = this.resolveAllRoles();
    const results = Object.fromEntries(SUPPORTED_PROVIDERS.map((p) => [p, false])) as Record<
      AIProvider,
      boolean
    >;

    await Promise.all(
      SUPPORTED_PROVIDERS.map(async (provider) => {
        const config = MODEL_ROLES.map((r) => roles[r]).find((c) => c?.provider === provider);
        if (!config) return;
        try {
          await generateText({
            model: this.createProviderModel(config),
            prompt: "Reply with OK.",
            maxOutputTokens: 16,
          });
          results[provider] = true;
        } catch (error) {
          this.logger.error(`${provider} connection test failed`, error);
        }
      })
    );

    return results;
  }
}
