import type { Octokit } from "@octokit/rest";
import type { EmbedManyResult, EmbedResult, GenerateObjectResult, generateText } from "ai";
import type { Mock } from "vitest";

/**
 * Typed fakes for the Vercel AI SDK results and for collaborator classes that
 * tests stub only partially.
 */

/**
 * Build a fake collaborator that implements only the members a test exercises.
 * Members that were not supplied are absent, so an unexpected call fails loudly
 * with "is not a function" instead of silently returning `undefined`.
 *
 * This is the single place where a structurally partial object is widened to
 * the full (possibly nominal, e.g. private-member) class type.
 */
export function partialFake<T extends object>(implemented: Partial<T>): T {
  return Object.assign(Object.create(null), implemented);
}

/** Complete `generateObject` result carrying `object`. */
export function generateObjectResult<T>(object: T): GenerateObjectResult<T> {
  return {
    object,
    reasoning: undefined,
    finishReason: "stop",
    usage: {
      inputTokens: 0,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: 0,
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      totalTokens: 0,
    },
    warnings: undefined,
    request: {},
    response: { id: "fake-response", timestamp: new Date(0), modelId: "fake-model" },
    providerMetadata: undefined,
    toJsonResponse: (init?: ResponseInit) => Response.json(object, init),
  };
}

/** Complete `embed` result carrying `embedding`. */
export function embedResult(embedding: number[], value = ""): EmbedResult {
  return { value, embedding, usage: { tokens: 0 }, warnings: [] };
}

/** Complete `embedMany` result carrying `embeddings`. */
export function embedManyResult(embeddings: number[][], values: string[] = []): EmbedManyResult {
  return { values, embeddings, usage: { tokens: 0 }, warnings: [] };
}

/** `generateText` result carrying `text`; the remaining members are absent (see `partialFake`). */
export function generateTextResult(text: string): Awaited<ReturnType<typeof generateText>> {
  return partialFake<Awaited<ReturnType<typeof generateText>>>({ text });
}

/**
 * Octokit fake exposing only `graphql`, backed by the given mock. Octokit's
 * `graphql` is a callable carrying `defaults`/`endpoint` members that a bare
 * mock cannot satisfy structurally, so the widening happens here once.
 */
export function octokitWithGraphql(graphql: Mock): Octokit {
  return Object.assign(Object.create(null), { graphql });
}
