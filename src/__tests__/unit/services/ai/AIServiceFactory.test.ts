import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `import` is hoisted above plain statements, and env.ts snapshots its config
// into module-level constants at import time — so the environment has to be set
// in a hoisted block, before any import runs.
vi.hoisted(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-anthropic-key-12345";
  process.env.OPENAI_API_KEY = "sk-test-openai-key-12345";
  process.env.GOOGLE_API_KEY = "test-google-key-12345";
  process.env.PERPLEXITY_API_KEY = "pplx-test-perplexity-key-12345";
  process.env.AI_MAIN_MODEL = "claude-opus-5";
  process.env.AI_RESEARCH_MODEL = "sonar-pro";
  process.env.AI_FALLBACK_MODEL = "gpt-5";
  process.env.AI_PRD_MODEL = "gemini-2.5-pro";
});

import {
  AI_FALLBACK_MODEL,
  AI_MAIN_MODEL,
  AI_PRD_MODEL,
  AI_RESEARCH_MODEL,
  ANTHROPIC_API_KEY,
  GOOGLE_API_KEY,
  OPENAI_API_KEY,
  PERPLEXITY_API_KEY,
} from "../../../../env";
import {
  AIServiceFactory,
  resolveProvider,
  SUPPORTED_PROVIDERS,
} from "../../../../services/ai/AIServiceFactory";

// The singleton slot is private; reset it between tests for isolation.
function resetFactorySingleton(): void {
  Reflect.set(AIServiceFactory, "instance", undefined);
}

describe("AIServiceFactory", () => {
  let factory: AIServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    resetFactorySingleton();
    factory = AIServiceFactory.getInstance();
  });

  afterEach(() => {
    resetFactorySingleton();
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const factory1 = AIServiceFactory.getInstance();
      const factory2 = AIServiceFactory.getInstance();

      expect(factory1).toBe(factory2);
    });
  });

  describe("resolveProvider", () => {
    it("should map known model prefixes to their provider", () => {
      expect(resolveProvider("claude-opus-5")).toBe("anthropic");
      expect(resolveProvider("gpt-5")).toBe("openai");
      expect(resolveProvider("o3-mini")).toBe("openai");
      expect(resolveProvider("gemini-2.5-pro")).toBe("google");
      expect(resolveProvider("sonar-pro")).toBe("perplexity");
    });

    it("should return undefined for an unrecognised model instead of defaulting", () => {
      expect(resolveProvider("totally-made-up-model")).toBeUndefined();
    });

    it("should honour an AI_<ROLE>_PROVIDER override", () => {
      process.env.AI_MAIN_PROVIDER = "openai";
      try {
        expect(resolveProvider("claude-opus-5", "main")).toBe("openai");
      } finally {
        delete process.env.AI_MAIN_PROVIDER;
      }
    });

    it("should route an unknown provider name to openai-compatible", () => {
      process.env.AI_MAIN_PROVIDER = "not-a-provider";
      try {
        expect(resolveProvider("claude-opus-5", "main")).toBe("openai-compatible");
      } finally {
        delete process.env.AI_MAIN_PROVIDER;
      }
    });

    it("should expose the supported providers", () => {
      expect([...SUPPORTED_PROVIDERS]).toEqual([
        "anthropic",
        "openai",
        "google",
        "google-vertex",
        "perplexity",
        "openai-compatible",
      ]);
    });
  });

  describe("model configuration", () => {
    it("should parse anthropic model correctly", () => {
      const config = factory.getConfiguration();

      expect(config.main).toBeDefined();
      expect(config.main?.provider).toBe("anthropic");
      expect(config.main?.model).toBe(AI_MAIN_MODEL);
    });

    it("should parse openai model correctly", () => {
      const config = factory.getConfiguration();

      expect(config.fallback).toBeDefined();
      expect(config.fallback?.provider).toBe("openai");
      expect(config.fallback?.model).toBe(AI_FALLBACK_MODEL);
    });

    it("should parse perplexity model correctly", () => {
      const config = factory.getConfiguration();

      expect(config.research).toBeDefined();
      expect(config.research?.provider).toBe("perplexity");
      expect(config.research?.model).toBe(AI_RESEARCH_MODEL);
    });

    it("should parse google model correctly", () => {
      const config = factory.getConfiguration();

      expect(config.prd).toBeDefined();
      expect(config.prd?.provider).toBe("google");
      expect(config.prd?.model).toBe(AI_PRD_MODEL);
    });

    it("should redact API keys from the debugging accessor", () => {
      const config = factory.getConfiguration();

      expect(config.main?.apiKey).toBe("[REDACTED]");
      expect(config.fallback?.apiKey).toBe("[REDACTED]");
      expect(config.research?.apiKey).toBe("[REDACTED]");
      expect(config.prd?.apiKey).toBe("[REDACTED]");
    });

    it("should resolve each provider key from the environment", () => {
      // The redacted accessor hides the value, so assert the resolved keys that
      // feed it — this is what the provider clients are constructed with.
      expect(ANTHROPIC_API_KEY).toBe("sk-ant-test-anthropic-key-12345");
      expect(OPENAI_API_KEY).toBe("sk-test-openai-key-12345");
      expect(GOOGLE_API_KEY).toBe("test-google-key-12345");
      expect(PERPLEXITY_API_KEY).toBe("pplx-test-perplexity-key-12345");
    });
  });

  describe("model instances", () => {
    it("should return main model instance", () => {
      const model = factory.getMainModel();
      expect(model).toBeDefined();
      expect((model as { modelId?: string })?.modelId).toBe(AI_MAIN_MODEL);
    });

    it("should return research model instance", () => {
      const model = factory.getResearchModel();
      expect(model).toBeDefined();
      expect((model as { modelId?: string })?.modelId).toBe(AI_RESEARCH_MODEL);
    });

    it("should return fallback model instance", () => {
      const model = factory.getFallbackModel();
      expect(model).toBeDefined();
      expect((model as { modelId?: string })?.modelId).toBe(AI_FALLBACK_MODEL);
    });

    it("should return PRD model instance", () => {
      const model = factory.getPRDModel();
      expect(model).toBeDefined();
      expect((model as { modelId?: string })?.modelId).toBe(AI_PRD_MODEL);
    });
  });

  describe("configuration validation", () => {
    it("should validate complete configuration", () => {
      const validation = factory.validateConfiguration();

      expect(validation.hasAnyProvider).toBe(true);
      // Every API-key provider is configured; Vertex (ADC, GOOGLE_VERTEX_PROJECT) is not.
      expect(validation.missing).toEqual(["GOOGLE_VERTEX_PROJECT"]);
      expect(validation.available.length).toBeGreaterThan(0);
      expect(validation.availableModels).toContain("main");
    });

    it("should have all providers available in test environment", () => {
      // In test environment, all API keys are set, so all providers should be available
      const validation = factory.validateConfiguration();

      expect(validation.hasAnyProvider).toBe(true);
      expect(validation.available).toContain("anthropic");
      expect(validation.available).toContain("openai");
      expect(validation.available).toContain("google");
      expect(validation.available).toContain("perplexity");
      expect(validation.available).not.toContain("google-vertex");
      expect(validation.missing).toEqual(["GOOGLE_VERTEX_PROJECT"]);
      expect(validation.availableModels).toContain("main");
      expect(validation.availableModels).toContain("fallback");
      expect(validation.availableModels).toContain("research");
      expect(validation.availableModels).toContain("prd");
    });
  });

  describe("call-time resolution", () => {
    function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
      const saved: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(vars)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      try {
        fn();
      } finally {
        for (const [k, v] of Object.entries(saved)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    }

    it("reuses the cached model while the key is unchanged", () => {
      expect(factory.getMainModel()).toBe(factory.getMainModel());
    });

    it("rebuilds the model when the provider key is rotated", () => {
      const before = factory.getMainModel();
      withEnv({ ANTHROPIC_API_KEY: "sk-ant-rotated-key" }, () => {
        const after = factory.getMainModel();
        expect(after).not.toBe(before);
        expect(after).toBe(factory.getMainModel());
      });
    });

    it("returns null for a role whose key is removed after construction", () => {
      withEnv({ ANTHROPIC_API_KEY: undefined }, () => {
        expect(factory.getMainModel()).toBeNull();
      });
    });

    it("counts a per-role key as availability when the global key is missing", () => {
      withEnv(
        {
          ANTHROPIC_API_KEY: undefined,
          AI_MAIN_PROVIDER: "openai-compatible",
          AI_MAIN_API_KEY: "role-key",
          AI_MAIN_BASE_URL: "https://example.test/v1",
        },
        () => {
          const validation = factory.validateConfiguration();
          expect(validation.availableModels).toContain("main");
          expect(validation.available).toContain("openai-compatible");
          expect(validation.available).not.toContain("anthropic");
          expect(validation.missing).toContain("ANTHROPIC_API_KEY");

          const status = factory.getAvailabilityStatus();
          const byName = Object.fromEntries(status.providers.map((p) => [p.name, p.configured]));
          expect(byName["openai-compatible"]).toBe(true);
          expect(byName.anthropic).toBe(false);
        }
      );
    });

    it("reports an unavailable role when its provider has no key", () => {
      withEnv({ ANTHROPIC_API_KEY: undefined }, () => {
        const validation = factory.validateConfiguration();
        expect(validation.unavailableModels).toContain("main");
        expect(validation.available).not.toContain("anthropic");
      });
    });
  });

  describe("getEmbeddingModel", () => {
    it("defaults to text-embedding-3-small using the OpenAI key", () => {
      expect((factory.getEmbeddingModel() as { modelId?: string } | null)?.modelId).toBe(
        "text-embedding-3-small"
      );
    });

    it("honours AI_EMBEDDING_MODEL", () => {
      process.env.AI_EMBEDDING_MODEL = "text-embedding-3-large";
      try {
        expect((factory.getEmbeddingModel() as { modelId?: string } | null)?.modelId).toBe(
          "text-embedding-3-large"
        );
      } finally {
        delete process.env.AI_EMBEDDING_MODEL;
      }
    });

    it("returns null when no embedding or OpenAI key is configured", () => {
      const saved = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        expect(factory.getEmbeddingModel()).toBeNull();
      } finally {
        process.env.OPENAI_API_KEY = saved;
      }
    });
  });
});
