import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  SamplingLanguageModel,
  type SamplingRequestFn,
} from "../../../../services/ai/SamplingLanguageModel";
import { partialFake } from "../../../helpers/aiFakes";

function callOptions(options: Partial<LanguageModelV4CallOptions>): LanguageModelV4CallOptions {
  return partialFake<LanguageModelV4CallOptions>(options);
}

async function readAll(stream: ReadableStream<LanguageModelV4StreamPart>) {
  const parts: LanguageModelV4StreamPart[] = [];
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    parts.push(next.value);
  }
  return parts;
}

describe("SamplingLanguageModel", () => {
  let sample: Mock<SamplingRequestFn>;
  let model: SamplingLanguageModel;

  beforeEach(() => {
    sample = vi.fn<SamplingRequestFn>(async () => ({
      role: "assistant",
      content: { type: "text", text: "pong" },
    }));
    model = new SamplingLanguageModel(sample);
  });

  describe("doGenerate", () => {
    it("forwards the system prompt and the user/assistant turns to the client", async () => {
      await model.doGenerate(
        callOptions({
          prompt: [
            { role: "system", content: "Be brief" },
            { role: "user", content: [{ type: "text", text: "ping" }] },
            { role: "assistant", content: [{ type: "text", text: "pong" }] },
            { role: "user", content: [{ type: "text", text: "again" }] },
          ],
          maxOutputTokens: 100,
          temperature: 0.2,
        })
      );

      expect(sample).toHaveBeenCalledOnce();
      expect(sample.mock.calls[0][0]).toMatchObject({
        systemPrompt: "Be brief",
        maxTokens: 100,
        temperature: 0.2,
        messages: [
          { role: "user", content: { type: "text", text: "ping" } },
          { role: "assistant", content: { type: "text", text: "pong" } },
          { role: "user", content: { type: "text", text: "again" } },
        ],
      });
    });

    it("falls back to a default token budget and a placeholder message", async () => {
      await model.doGenerate(callOptions({ prompt: [] }));

      expect(sample.mock.calls[0][0]).toMatchObject({
        maxTokens: 4096,
        messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
      });
    });

    it("returns the client's text and a stop finish reason", async () => {
      const result = await model.doGenerate(callOptions({ prompt: [] }));

      expect(result.content).toEqual([{ type: "text", text: "pong" }]);
      expect(result.finishReason.unified).toBe("stop");
    });

    it("accepts a plain string content from the client", async () => {
      sample.mockResolvedValue({ role: "assistant", content: "plain text" });

      const result = await model.doGenerate(callOptions({ prompt: [] }));

      expect(result.content).toEqual([{ type: "text", text: "plain text" }]);
    });

    it("asks for raw JSON and strips markdown fences from a JSON response", async () => {
      sample.mockResolvedValue({
        role: "assistant",
        content: { type: "text", text: '```json\n{"ok":true}\n```' },
      });

      const result = await model.doGenerate(
        callOptions({
          prompt: [{ role: "system", content: "Extract" }],
          responseFormat: { type: "json" },
        })
      );

      expect(sample.mock.calls[0][0].systemPrompt).toMatch(
        /^Extract\n\nIMPORTANT: Respond with valid JSON only/
      );
      expect(result.content).toEqual([{ type: "text", text: '{"ok":true}' }]);
    });

    it("leaves fenced text alone when JSON was not requested", async () => {
      sample.mockResolvedValue({
        role: "assistant",
        content: { type: "text", text: "```json\n{}\n```" },
      });

      const result = await model.doGenerate(callOptions({ prompt: [] }));

      expect(result.content).toEqual([{ type: "text", text: "```json\n{}\n```" }]);
    });

    it("estimates usage at four characters per token, since sampling reports none", async () => {
      sample.mockResolvedValue({
        role: "assistant",
        content: { type: "text", text: "x".repeat(10) },
      });

      const result = await model.doGenerate(
        callOptions({
          prompt: [
            { role: "system", content: "s".repeat(4) },
            { role: "user", content: [{ type: "text", text: "u".repeat(9) }] },
          ],
        })
      );

      // (4 system + 9 user chars) / 4 -> 4 tokens in; 10 chars / 4 -> 3 tokens out.
      expect(result.usage.inputTokens.total).toBe(4);
      expect(result.usage.outputTokens.total).toBe(3);
    });

    it("propagates a sampling failure", async () => {
      sample.mockRejectedValue(new Error("client declined"));

      await expect(model.doGenerate(callOptions({ prompt: [] }))).rejects.toThrow(
        "client declined"
      );
    });
  });

  describe("doStream", () => {
    it("emits the whole answer as a single text delta bracketed by start/end parts", async () => {
      const { stream } = await model.doStream(callOptions({ prompt: [] }));

      const parts = await readAll(stream);

      expect(parts.map((p) => p.type)).toEqual([
        "stream-start",
        "text-start",
        "text-delta",
        "text-end",
        "finish",
      ]);
      const delta = parts.find((p) => p.type === "text-delta");
      expect(delta).toMatchObject({ delta: "pong" });
    });

    it("tags every text part with the same id and reports the estimated usage on finish", async () => {
      const { stream } = await model.doStream(callOptions({ prompt: [] }));

      const parts = await readAll(stream);
      const ids = parts.flatMap((p) => ("id" in p ? [p.id] : []));
      const finish = parts.find((p) => p.type === "finish");

      expect(new Set(ids).size).toBe(1);
      expect(finish).toMatchObject({
        finishReason: { unified: "stop" },
        usage: { outputTokens: { total: 1 } },
      });
    });
  });
});
