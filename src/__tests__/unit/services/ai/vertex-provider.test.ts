import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createVertex = vi.hoisted(() => vi.fn());
const createGoogle = vi.hoisted(() => vi.fn());

vi.mock("@ai-sdk/google-vertex", () => ({ createVertex }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: createGoogle }));

interface Scenario {
  googleApiKey?: string;
  anthropicApiKey?: string;
  vertexProject?: string;
  vertexLocation?: string;
  mainProvider?: string;
  researchProvider?: string;
  models?: Partial<Record<"main" | "research" | "fallback" | "prd", string>>;
}

/** Every variable the factory resolves at call time; scenarios set only what they need. */
const SCENARIO_ENV = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "PERPLEXITY_API_KEY",
  "GOOGLE_VERTEX_PROJECT",
  "GOOGLE_VERTEX_LOCATION",
  "AI_MAIN_PROVIDER",
  "AI_RESEARCH_PROVIDER",
  "AI_MAIN_MODEL",
  "AI_RESEARCH_MODEL",
  "AI_FALLBACK_MODEL",
  "AI_PRD_MODEL",
] as const;

/** Fresh module graph per scenario; the factory reads configuration from the environment at call time. */
async function load(s: Scenario) {
  vi.resetModules();
  for (const k of SCENARIO_ENV) delete process.env[k];
  const set = (key: (typeof SCENARIO_ENV)[number], value: string | undefined) => {
    if (value) process.env[key] = value;
  };
  set("ANTHROPIC_API_KEY", s.anthropicApiKey);
  set("GOOGLE_API_KEY", s.googleApiKey);
  set("GOOGLE_VERTEX_PROJECT", s.vertexProject);
  set("GOOGLE_VERTEX_LOCATION", s.vertexLocation);
  set("AI_MAIN_PROVIDER", s.mainProvider);
  set("AI_RESEARCH_PROVIDER", s.researchProvider);
  set("AI_MAIN_MODEL", s.models?.main);
  set("AI_RESEARCH_MODEL", s.models?.research);
  set("AI_FALLBACK_MODEL", s.models?.fallback);
  set("AI_PRD_MODEL", s.models?.prd);

  const factoryModule = await import("../../../../services/ai/AIServiceFactory");
  const { traceContext } = await import(
    "../../../../infrastructure/observability/CorrelationContext"
  );
  const warn = vi.fn();
  const logger = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };
  const factory = factoryModule.AIServiceFactory.getInstance(
    logger as unknown as Parameters<typeof factoryModule.AIServiceFactory.getInstance>[0]
  );
  return { ...factoryModule, factory, traceContext, warn };
}

function fakeModel(modelId: string, reported = { input: 0, output: 0 }) {
  return {
    specificationVersion: "v4",
    provider: "fake",
    modelId,
    supportedUrls: {},
    doGenerate: vi.fn(async () => ({
      content: [],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: reported.input },
        outputTokens: { total: reported.output },
      },
      warnings: [],
    })),
  };
}

describe("Gemini via Vertex AI (Application Default Credentials)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createVertex.mockImplementation(() => (id: string) => fakeModel(`vertex:${id}`));
    createGoogle.mockImplementation(() => (id: string) => fakeModel(`google:${id}`));
  });

  afterEach(() => {
    for (const k of SCENARIO_ENV) delete process.env[k];
  });

  describe("provider selection for a Gemini model", () => {
    it("uses the google API-key provider when only GOOGLE_API_KEY is set", async () => {
      const { resolveProvider } = await load({ googleApiKey: "g-key" });
      expect(resolveProvider("gemini-2.5-flash", "main")).toBe("google");
    });

    it("uses Vertex when only GOOGLE_VERTEX_PROJECT is set", async () => {
      const { resolveProvider } = await load({ vertexProject: "my-project" });
      expect(resolveProvider("gemini-2.5-flash", "main")).toBe("google-vertex");
    });

    it("prefers Vertex when both Vertex and an API key are configured", async () => {
      const { resolveProvider } = await load({
        googleApiKey: "g-key",
        vertexProject: "my-project",
      });
      expect(resolveProvider("gemini-2.5-flash", "main")).toBe("google-vertex");
    });

    it("lets an explicit AI_<ROLE>_PROVIDER=google override a configured Vertex project", async () => {
      const { resolveProvider } = await load({
        googleApiKey: "g-key",
        vertexProject: "my-project",
        mainProvider: "google",
      });
      expect(resolveProvider("gemini-2.5-flash", "main")).toBe("google");
    });

    it("applies the override per role, leaving other roles on Vertex", async () => {
      const { resolveProvider } = await load({
        googleApiKey: "g-key",
        vertexProject: "my-project",
        researchProvider: "google",
      });
      expect(resolveProvider("gemini-2.5-pro", "research")).toBe("google");
      expect(resolveProvider("gemini-2.5-flash", "main")).toBe("google-vertex");
    });

    it("accepts google-vertex as an explicit provider for any model name", async () => {
      const { resolveProvider, SUPPORTED_PROVIDERS } = await load({
        vertexProject: "my-project",
        mainProvider: "GOOGLE-VERTEX",
      });
      expect(SUPPORTED_PROVIDERS).toContain("google-vertex");
      expect(resolveProvider("some-tuned-endpoint", "main")).toBe("google-vertex");
    });

    it("does not route non-Gemini models to Vertex", async () => {
      const { resolveProvider } = await load({ vertexProject: "my-project" });
      expect(resolveProvider("claude-opus-5", "main")).toBe("anthropic");
      expect(resolveProvider("gpt-4o", "main")).toBe("openai");
    });
  });

  describe("model construction", () => {
    it("with only GOOGLE_VERTEX_PROJECT, builds a Vertex model and never the API-key client", async () => {
      const { factory } = await load({
        vertexProject: "my-project",
        models: { main: "gemini-2.5-flash" },
      });
      expect(factory.isAIAvailable()).toBe(true);
      // The per-role model cache means isAIAvailable() and getModel() share one build.
      createVertex.mockClear();

      const model = factory.getModel("main");
      expect(model).not.toBeNull();
      expect(createVertex).not.toHaveBeenCalled();
      expect(createGoogle).not.toHaveBeenCalled();
      expect((model as unknown as { modelId: string }).modelId).toBe("vertex:gemini-2.5-flash");
    });

    it("passes project and the default location, and no key material", async () => {
      const { factory } = await load({
        vertexProject: "my-project",
        models: { main: "gemini-2.5-flash" },
      });
      factory.getModel("main");
      expect(createVertex).toHaveBeenCalledWith({
        project: "my-project",
        location: "us-central1",
      });
    });

    it("honours GOOGLE_VERTEX_LOCATION", async () => {
      const { factory } = await load({
        vertexProject: "my-project",
        vertexLocation: "europe-west4",
        models: { main: "gemini-2.5-flash" },
      });
      factory.getModel("main");
      expect(createVertex).toHaveBeenCalledWith({
        project: "my-project",
        location: "europe-west4",
      });
    });

    it("builds the API-key client when only GOOGLE_API_KEY is configured", async () => {
      const { factory } = await load({
        googleApiKey: "g-key",
        models: { main: "gemini-2.5-flash" },
      });
      factory.getModel("main");
      expect(createGoogle).toHaveBeenCalledWith({ apiKey: "g-key" });
      expect(createVertex).not.toHaveBeenCalled();
    });

    it("honours the explicit google override when both backends are configured", async () => {
      const { factory } = await load({
        googleApiKey: "g-key",
        vertexProject: "my-project",
        mainProvider: "google",
        models: { main: "gemini-2.5-flash" },
      });
      factory.getModel("main");
      expect(createGoogle).toHaveBeenCalledTimes(1);
      expect(createVertex).not.toHaveBeenCalled();
    });

    it("does not build any client (no ADC lookup) just by configuring the factory", async () => {
      await load({ vertexProject: "my-project", models: { main: "gemini-2.5-flash" } });
      expect(createVertex).not.toHaveBeenCalled();
    });

    it("never exposes credentials through getConfiguration", async () => {
      const { factory } = await load({
        vertexProject: "my-project",
        models: { main: "gemini-2.5-flash" },
      });
      const cfg = factory.getConfiguration();
      expect(cfg.main?.provider).toBe("google-vertex");
      expect(cfg.main?.apiKey).toBe("");
    });
  });

  describe("availability", () => {
    it("reports google-vertex available when GOOGLE_VERTEX_PROJECT is set", async () => {
      const { factory } = await load({ vertexProject: "my-project" });
      const v = factory.validateConfiguration();
      expect(v.hasAnyProvider).toBe(true);
      expect(v.available).toContain("google-vertex");
      expect(v.missing).not.toContain("GOOGLE_VERTEX_PROJECT");
    });

    it("is the only available provider when nothing else is configured", async () => {
      const { factory } = await load({ vertexProject: "my-project" });
      expect(factory.validateConfiguration().available).toEqual(["google-vertex"]);
    });

    it("lists GOOGLE_VERTEX_PROJECT as missing and no provider available when unset", async () => {
      const { factory } = await load({});
      const v = factory.validateConfiguration();
      expect(v.hasAnyProvider).toBe(false);
      expect(v.available).not.toContain("google-vertex");
      expect(v.missing).toContain("GOOGLE_VERTEX_PROJECT");
    });

    it("treats a blank project as unset", async () => {
      const { factory } = await load({ vertexProject: "   " });
      expect(factory.validateConfiguration().available).not.toContain("google-vertex");
    });
  });

  describe("forced google-vertex without a project", () => {
    it("yields no model and names GOOGLE_VERTEX_PROJECT in the warning", async () => {
      const { factory, warn } = await load({
        mainProvider: "google-vertex",
        models: { main: "gemini-2.5-flash" },
      });
      expect(factory.getModel("main")).toBeNull();
      expect(createVertex).not.toHaveBeenCalled();
      const message = warn.mock.calls.map((c) => String(c[0])).join("\n");
      expect(message).toContain("GOOGLE_VERTEX_PROJECT");
      expect(message).toContain("Application Default Credentials");
    });

    it("does not fall back to the API-key provider behind the user's back", async () => {
      const { factory } = await load({
        googleApiKey: "g-key",
        mainProvider: "google-vertex",
        models: { main: "gemini-2.5-flash" },
      });
      expect(factory.getModel("main")).toBeNull();
      expect(createGoogle).not.toHaveBeenCalled();
    });
  });

  describe("usage metering", () => {
    it("reports tokens spent through a Vertex model into the trace context", async () => {
      const underlying = fakeModel("vertex:gemini-2.5-flash", { input: 120, output: 30 });
      createVertex.mockImplementation(() => () => underlying);
      const { factory, traceContext } = await load({
        vertexProject: "my-project",
        models: { main: "gemini-2.5-flash" },
      });

      const model = factory.getModel("main") as unknown as {
        doGenerate: (opts: unknown) => Promise<unknown>;
      };
      const usage = { tokens: 0 };
      await traceContext.run(
        { correlationId: "c", startTime: Date.now(), operation: "t", agentId: "a", usage },
        () => model.doGenerate({ prompt: [] })
      );

      expect(underlying.doGenerate).toHaveBeenCalledTimes(1);
      expect(usage.tokens).toBe(150);
    });
  });
});
