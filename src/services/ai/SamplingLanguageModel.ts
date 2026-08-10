/**
 * MCP Sampling Language Model Adapter
 *
 * Wraps MCP's `sampling/createMessage` as a Vercel AI SDK LanguageModelV4 so
 * the calling agent (Claude, Codex, Pi, etc.) does the actual LLM work.
 * Zero API keys needed — the MCP client IS the model.
 *
 * This is the zero-config default: when no explicit AI provider is configured
 * and the client supports sampling, the server routes AI requests back to it.
 */
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';

/**
 * Function that sends a sampling request to the MCP client.
 * Matches the shape of `server.createMessage()`.
 */
export interface SamplingRequestFn {
  (params: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string };
    }>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    modelPreferences?: {
      hints?: Array<{ name?: string }>;
      costPriority?: number;
      speedPriority?: number;
      intelligencePriority?: number;
    };
  }): Promise<{
    role: string;
    content: { type: string; text?: string } | string;
    model?: string;
  }>;
}

/**
 * Adapts MCP sampling/createMessage into a Vercel AI SDK LanguageModelV4.
 * The calling MCP client handles the actual LLM call.
 */
export class SamplingLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'mcp-sampling';
  readonly modelId: string;
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  constructor(
    private readonly samplingFn: SamplingRequestFn,
    modelId = 'client-model',
  ) {
    this.modelId = modelId;
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string };
    }> = [];
    let systemPrompt: string | undefined;

    if (options.prompt) {
      for (const msg of options.prompt) {
        if (msg.role === 'system') {
          systemPrompt = msg.content;
        } else if (msg.role === 'user') {
          const text = msg.content
            .map((p) => (p.type === 'text' ? (p as { text: string }).text : '[non-text]'))
            .join('\n');
          messages.push({ role: 'user', content: { type: 'text', text } });
        } else if (msg.role === 'assistant') {
          const text = msg.content
            .map((p) => (p.type === 'text' ? (p as { text: string }).text : ''))
            .join('');
          if (text) {
            messages.push({ role: 'assistant', content: { type: 'text', text } });
          }
        }
      }
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: { type: 'text', text: 'Hello' } });
    }
    // When responseFormat requests JSON, reinforce in the system prompt.
    // The AI SDK injects the schema into the user prompt; we add a system-level
    // instruction to return raw JSON without markdown fences.
    if (options.responseFormat?.type === 'json') {
      const jsonInstruction = 'IMPORTANT: Respond with valid JSON only. No markdown fences, no explanation, no text before or after the JSON object.';
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${jsonInstruction}`
        : jsonInstruction;
    }

    const result = await this.samplingFn({
      messages,
      systemPrompt,
      maxTokens: options.maxOutputTokens ?? 4096,
      temperature: options.temperature ?? undefined,
      modelPreferences: {
        intelligencePriority: 0.7,
        speedPriority: 0.5,
        costPriority: 0.3,
      },
    });

    let text =
      typeof result.content === 'string'
        ? result.content
        : (result.content?.text ?? '');

    // Strip markdown JSON fences that clients commonly wrap around JSON responses
    if (options.responseFormat?.type === 'json') {
      text = text.trim();
      // Strip ```json ... ``` or ``` ... ```
      const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        text = fenceMatch[1].trim();
      }
    }

    return {
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 0, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 0, text: undefined, reasoning: undefined },
      },
      warnings: [],
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    // MCP sampling doesn't support streaming — emit full result as one chunk
    const result = await this.doGenerate(options);
    const textContent = result.content.find((c) => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    const stream = new ReadableStream({
      start(controller) {
        const id = `sampling-${Date.now()}`;
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id });
        controller.enqueue({ type: 'text-delta', id, textDelta: text });
        controller.enqueue({ type: 'text-end', id });
        controller.enqueue({
          type: 'finish',
          usage: result.usage,
          finishReason: result.finishReason,
        });
        controller.close();
      },
    });

    return { stream };
  }
}
