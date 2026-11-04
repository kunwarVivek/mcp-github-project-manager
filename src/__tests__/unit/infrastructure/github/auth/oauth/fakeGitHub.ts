/** A recorded outbound request, with the body already parsed. */
export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown> | undefined;
}

export interface FakeReply {
  readonly status?: number;
  readonly json?: unknown;
}

export interface FakeFetch {
  readonly fetch: typeof fetch;
  readonly requests: RecordedRequest[];
}

export interface FakeClock {
  readonly sleeps: number[];
  now(): number;
  sleep(ms: number): Promise<void>;
}

/**
 * A `fetch` stand-in that answers from a handler and records every request.
 * Responses carry a real `date` header because `@octokit/auth-oauth-user`
 * computes token expiry from it.
 */
export function createFakeFetch(respond: (request: RecordedRequest) => FakeReply): FakeFetch {
  const requests: RecordedRequest[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    const request: RecordedRequest = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : undefined,
    };
    requests.push(request);
    const reply = respond(request);
    return new Response(reply.json === undefined ? null : JSON.stringify(reply.json), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json", date: new Date().toUTCString() },
    });
  };
  return { fetch: fakeFetch, requests };
}

/** A clock whose `sleep` advances time instead of waiting. */
export function createFakeClock(start = Date.parse("2026-01-01T00:00:00.000Z")): FakeClock {
  let current = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => current,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      current += ms;
    },
  };
}
