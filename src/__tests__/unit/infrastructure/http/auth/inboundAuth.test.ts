import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import nock from "nock";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventStore } from "../../../../../infrastructure/events/EventStore";
import type { EventSubscriptionManager } from "../../../../../infrastructure/events/EventSubscriptionManager";
import type { GitHubWebhookHandler } from "../../../../../infrastructure/events/GitHubWebhookHandler";
import {
  createInboundAuthenticator,
  type InboundAuthConfig,
} from "../../../../../infrastructure/http/auth/createInboundAuthenticator";
import type { InboundAuthenticator } from "../../../../../infrastructure/http/auth/InboundAuthenticator";
import { OAuthResourceServerAuthenticator } from "../../../../../infrastructure/http/auth/OAuthResourceServerAuthenticator";
import { WebhookServer } from "../../../../../infrastructure/http/WebhookServer";
import type { ILogger } from "../../../../../infrastructure/logger/index";

const KID = "test-key-1";
const SHARED_TOKEN = "shared-events-token-0123456789";
const AUDIENCE = "https://pm.example.com/mcp";

/** A local authorization server: serves a JWKS and (optionally) discovery metadata. */
interface FakeAuthorizationServer {
  issuer: string;
  jwksHits: () => number;
  discoveryDoc: { current: Record<string, unknown> | undefined };
  close: () => Promise<void>;
}

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

async function startAuthorizationServer(jwks: { keys: JWK[] }): Promise<FakeAuthorizationServer> {
  let hits = 0;
  const discoveryDoc: FakeAuthorizationServer["discoveryDoc"] = { current: undefined };
  const server = http.createServer((req, res) => {
    if (req.url === "/jwks.json") {
      hits++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(jwks));
    } else if (req.url === "/.well-known/oauth-authorization-server" && discoveryDoc.current) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(discoveryDoc.current));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const port = await listen(server);
  const issuer = `http://127.0.0.1:${port}`;
  discoveryDoc.current = { issuer, jwks_uri: `${issuer}/jwks.json` };
  return {
    issuer,
    jwksHits: () => hits,
    discoveryDoc,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("inbound HTTP authentication", () => {
  let signingKey: CryptoKey;
  let authServer: FakeAuthorizationServer;
  let logger: ILogger;
  let started: WebhookServer[];

  // The global setup file blocks all real network I/O via nock. These tests
  // drive real loopback servers (port 0), so allow loopback only; external
  // hosts stay blocked.
  beforeAll(() => {
    nock.enableNetConnect((host) => host.startsWith("127.0.0.1:") || host.startsWith("localhost:"));
  });

  afterAll(() => {
    nock.disableNetConnect();
  });

  beforeEach(async () => {
    const pair = await generateKeyPair("RS256");
    signingKey = pair.privateKey;
    const jwk = await exportJWK(pair.publicKey);
    authServer = await startAuthorizationServer({
      keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }],
    });
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    started = [];
  });

  afterEach(async () => {
    for (const server of started) await server.stop();
    await authServer.close();
  });

  interface Claims {
    issuer?: string;
    audience?: string;
    scope?: string;
    scp?: string[];
    expiresAt?: number | string;
    key?: typeof signingKey;
  }

  async function mintToken(claims: Claims = {}): Promise<string> {
    const jwt = new SignJWT({
      ...(claims.scope !== undefined ? { scope: claims.scope } : {}),
      ...(claims.scp ? { scp: claims.scp } : {}),
    })
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(claims.issuer ?? authServer.issuer)
      .setAudience(claims.audience ?? AUDIENCE)
      .setSubject("user-42")
      .setIssuedAt()
      .setExpirationTime(claims.expiresAt ?? "5m");
    return jwt.sign(claims.key ?? signingKey);
  }

  function oauthConfig(overrides: Partial<InboundAuthConfig["oauth"]> = {}): InboundAuthConfig {
    return {
      allowUnauthenticated: false,
      oauth: {
        issuer: authServer.issuer,
        audience: AUDIENCE,
        jwksUri: `${authServer.issuer}/jwks.json`,
        requiredScopes: [],
        ...overrides,
      },
    };
  }

  async function startServer(
    authenticator?: InboundAuthenticator,
    options: { enableSSE?: boolean; webhookValid?: boolean } = {}
  ): Promise<{ url: string; webhookHandler: { validateSignature: ReturnType<typeof vi.fn> } }> {
    const webhookHandler = {
      validateSignature: vi.fn(async () => options.webhookValid ?? true),
      validateWebhookPayload: vi.fn(() => true),
      createWebhookEvent: vi.fn(() => ({})),
      processWebhookEvent: vi.fn(async () => ({ success: true, events: [], skipped: false })),
    };
    const subscriptionManager = {
      on: vi.fn(),
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(() => true),
      notifySubscribers: vi.fn(async () => {}),
      getStats: vi.fn(() => ({ totalSubscriptions: 3 })),
    };
    const eventStore = {
      storeEvents: vi.fn(async () => {}),
      getEventsFromTimestamp: vi.fn(async () => []),
      getRecentEvents: vi.fn(async () => [{ id: "evt-1" }]),
      getStats: vi.fn(async () => ({ totalEvents: 7 })),
    };
    const server = new WebhookServer(
      webhookHandler as unknown as GitHubWebhookHandler,
      subscriptionManager as unknown as EventSubscriptionManager,
      eventStore as unknown as EventStore,
      { port: 0, enableSSE: options.enableSSE ?? false },
      logger,
      undefined,
      authenticator
    );
    await server.start();
    started.push(server);
    return { url: `http://127.0.0.1:${server.getStatus().port}`, webhookHandler };
  }

  const bearer = (token: string): RequestInit => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  describe("fail-closed default", () => {
    it("rejects every /events/* route with a 401 and a Bearer challenge", async () => {
      const { url } = await startServer();
      const routes: Array<[string, string]> = [
        ["GET", "/events/stream"],
        ["POST", "/events/subscribe"],
        ["DELETE", "/events/subscribe/sub-1"],
        ["GET", "/events/replay/2026-01-01T00:00:00Z"],
        ["GET", "/events/recent"],
      ];

      for (const [method, path] of routes) {
        const res = await fetch(`${url}${path}`, { method });
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(res.headers.get("www-authenticate")).toBe(
          'Bearer realm="github-project-manager-events"'
        );
      }
    });

    it("adds error=invalid_token when a token was presented but nothing is configured", async () => {
      const { url } = await startServer();
      const res = await fetch(`${url}/events/recent`, bearer("whatever"));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
    });

    it("rejects when createInboundAuthenticator has no credentials and no opt-out", async () => {
      const authenticator = createInboundAuthenticator({ allowUnauthenticated: false }, logger);
      const { url } = await startServer(authenticator);
      expect((await fetch(`${url}/events/recent`)).status).toBe(401);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("will reject all requests"));
    });

    it("serves /events/* when EVENTS_ALLOW_UNAUTHENTICATED is set, with a startup warning", async () => {
      const authenticator = createInboundAuthenticator({ allowUnauthenticated: true }, logger);
      const { url } = await startServer(authenticator);

      const res = await fetch(`${url}/events/recent`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ events: [{ id: "evt-1" }] });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("EVENTS_ALLOW_UNAUTHENTICATED is enabled")
      );
    });

    it("still requires credentials when auth is configured even if the opt-out is set", async () => {
      const authenticator = createInboundAuthenticator(
        { sharedToken: SHARED_TOKEN, allowUnauthenticated: true },
        logger
      );
      const { url } = await startServer(authenticator);
      expect((await fetch(`${url}/events/recent`)).status).toBe(401);
      expect((await fetch(`${url}/events/recent`, bearer(SHARED_TOKEN))).status).toBe(200);
    });
  });

  describe("routes outside the bearer gate", () => {
    it("lets POST /webhooks/github through on its HMAC check alone", async () => {
      const { url, webhookHandler } = await startServer();

      const res = await fetch(`${url}/webhooks/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping" },
        body: "{}",
      });

      expect(res.status).toBe(200);
      expect(webhookHandler.validateSignature).toHaveBeenCalledTimes(1);
    });

    it("still rejects a webhook with a bad signature (401 from the HMAC check, not the bearer gate)", async () => {
      const { url } = await startServer(undefined, { webhookValid: false });
      const res = await fetch(`${url}/webhooks/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping" },
        body: "{}",
      });
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBeNull();
    });

    it("answers CORS preflight without credentials", async () => {
      const { url } = await startServer();
      const res = await fetch(`${url}/events/recent`, {
        method: "OPTIONS",
        headers: { Origin: "https://app.example.com" },
      });
      expect(res.status).toBe(200);
    });

    it("exposes only liveness on /health to anonymous callers and full stats to authenticated ones", async () => {
      const authenticator = createInboundAuthenticator(
        { sharedToken: SHARED_TOKEN, allowUnauthenticated: false },
        logger
      );
      const { url } = await startServer(authenticator);

      const anonymous = await fetch(`${url}/health`);
      expect(anonymous.status).toBe(200);
      expect(await anonymous.json()).toEqual({ status: "healthy" });

      const authed = await fetch(`${url}/health`, bearer(SHARED_TOKEN));
      expect(await authed.json()).toMatchObject({
        status: "healthy",
        events: { totalEvents: 7 },
        subscriptions: { totalSubscriptions: 3 },
      });

      const wrong = await fetch(`${url}/health`, bearer("not-the-token-at-all"));
      expect(await wrong.json()).toEqual({ status: "healthy" });
    });
  });

  describe("shared bearer (EVENTS_AUTH_TOKEN)", () => {
    let url: string;

    beforeEach(async () => {
      const authenticator = createInboundAuthenticator(
        { sharedToken: SHARED_TOKEN, allowUnauthenticated: false },
        logger
      );
      ({ url } = await startServer(authenticator));
    });

    it("accepts the exact token", async () => {
      const res = await fetch(`${url}/events/recent`, bearer(SHARED_TOKEN));
      expect(res.status).toBe(200);
    });

    it("rejects a same-length wrong token, a prefix, and an extension of the token", async () => {
      const sameLength = `${SHARED_TOKEN.slice(0, -1)}X`;
      for (const wrong of [sameLength, SHARED_TOKEN.slice(0, -1), `${SHARED_TOKEN}x`]) {
        const res = await fetch(`${url}/events/recent`, bearer(wrong));
        expect(res.status, wrong).toBe(401);
        expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
      }
    });

    it("401s without error code when no Authorization header is sent", async () => {
      const res = await fetch(`${url}/events/recent`);
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).not.toContain("error=");
    });

    it("never reads the token from the query string", async () => {
      const res = await fetch(`${url}/events/recent?access_token=${SHARED_TOKEN}`);
      expect(res.status).toBe(401);
    });

    it("answers a malformed Bearer credential with 400 invalid_request", async () => {
      const res = await fetch(`${url}/events/recent`, {
        headers: { Authorization: "Bearer not valid!!" },
      });
      expect(res.status).toBe(400);
      expect(res.headers.get("www-authenticate")).toContain('error="invalid_request"');
    });

    it("does not advertise resource metadata when no OAuth issuer is configured", async () => {
      const res = await fetch(`${url}/events/recent`);
      expect(res.headers.get("www-authenticate")).not.toContain("resource_metadata");
      expect((await fetch(`${url}/.well-known/oauth-protected-resource`)).status).toBe(404);
    });

    it("never logs the presented token", async () => {
      await fetch(`${url}/events/recent`, bearer("super-secret-wrong-token"));
      const logged = JSON.stringify([
        (logger.info as ReturnType<typeof vi.fn>).mock.calls,
        (logger.warn as ReturnType<typeof vi.fn>).mock.calls,
        (logger.error as ReturnType<typeof vi.fn>).mock.calls,
      ]);
      expect(logged).not.toContain("super-secret-wrong-token");
      expect(logged).not.toContain(SHARED_TOKEN);
    });
  });

  describe("OAuth 2.1 resource server", () => {
    it("accepts a valid token and lets the request through", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const res = await fetch(`${url}/events/recent`, bearer(await mintToken()));
      expect(res.status).toBe(200);
    });

    it("rejects a token from a different issuer", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const token = await mintToken({ issuer: "https://evil.example.com" });
      const res = await fetch(`${url}/events/recent`, bearer(token));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
    });

    it("rejects a token minted for another audience (RFC 8707)", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const token = await mintToken({ audience: "https://other-service.example.com" });
      expect((await fetch(`${url}/events/recent`, bearer(token))).status).toBe(401);
    });

    it("rejects an expired token but tolerates small clock skew", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const now = Math.floor(Date.now() / 1000);

      const expired = await mintToken({ expiresAt: now - 3600 });
      expect((await fetch(`${url}/events/recent`, bearer(expired))).status).toBe(401);

      const withinSkew = await mintToken({ expiresAt: now - 5 });
      expect((await fetch(`${url}/events/recent`, bearer(withinSkew))).status).toBe(200);
    });

    it("rejects a token signed by a key the JWKS does not publish", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const attacker = await generateKeyPair("RS256");
      const token = await mintToken({ key: attacker.privateKey });
      expect((await fetch(`${url}/events/recent`, bearer(token))).status).toBe(401);
    });

    it("rejects HS256 tokens even when signed with a key the server could 'know'", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const hs256 = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256", kid: KID })
        .setIssuer(authServer.issuer)
        .setAudience(AUDIENCE)
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("a-shared-secret-of-sufficient-length!!"));
      const res = await fetch(`${url}/events/recent`, bearer(hs256));
      expect(res.status).toBe(401);
    });

    it("rejects unsigned alg=none tokens", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
        iss: authServer.issuer,
        aud: AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 300,
      })}.`;
      const res = await fetch(`${url}/events/recent`, bearer(unsigned));
      expect(res.status).toBe(401);
    });

    it("rejects a token with no exp claim", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const noExp = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: KID })
        .setIssuer(authServer.issuer)
        .setAudience(AUDIENCE)
        .sign(signingKey);
      expect((await fetch(`${url}/events/recent`, bearer(noExp))).status).toBe(401);
    });

    it("rejects a token that is not a JWT at all", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      expect((await fetch(`${url}/events/recent`, bearer("ghp_notajwt"))).status).toBe(401);
    });

    it("returns 403 insufficient_scope naming the required scopes when a scope is missing", async () => {
      const config = oauthConfig({ requiredScopes: ["events:read", "events:subscribe"] });
      const { url } = await startServer(createInboundAuthenticator(config, logger));

      const token = await mintToken({ scope: "events:read other" });
      const res = await fetch(`${url}/events/recent`, bearer(token));

      expect(res.status).toBe(403);
      const challenge = res.headers.get("www-authenticate");
      expect(challenge).toContain('error="insufficient_scope"');
      expect(challenge).toContain('scope="events:read events:subscribe"');
    });

    it("accepts the required scopes from either a `scope` string or an `scp` array", async () => {
      const config = oauthConfig({ requiredScopes: ["events:read", "events:subscribe"] });
      const { url } = await startServer(createInboundAuthenticator(config, logger));

      const viaScope = await mintToken({ scope: "events:subscribe events:read" });
      expect((await fetch(`${url}/events/recent`, bearer(viaScope))).status).toBe(200);

      const viaScp = await mintToken({ scp: ["events:read", "events:subscribe"] });
      expect((await fetch(`${url}/events/recent`, bearer(viaScp))).status).toBe(200);

      const noScope = await mintToken();
      expect((await fetch(`${url}/events/recent`, bearer(noScope))).status).toBe(403);
    });

    it("publishes RFC 9728 metadata and points 401 challenges at it", async () => {
      const config = oauthConfig({
        resourceUrl: "http://127.0.0.1:9999",
        requiredScopes: ["events:read"],
      });
      const { url } = await startServer(createInboundAuthenticator(config, logger));

      const metadata = await fetch(`${url}/.well-known/oauth-protected-resource`);
      expect(metadata.status).toBe(200);
      expect(metadata.headers.get("content-type")).toContain("application/json");
      expect(await metadata.json()).toEqual({
        resource: "http://127.0.0.1:9999",
        authorization_servers: [authServer.issuer],
        scopes_supported: ["events:read"],
        bearer_methods_supported: ["header"],
      });

      const rejected = await fetch(`${url}/events/recent`);
      expect(rejected.status).toBe(401);
      expect(rejected.headers.get("www-authenticate")).toBe(
        'Bearer realm="github-project-manager-events", resource_metadata="http://127.0.0.1:9999/.well-known/oauth-protected-resource"'
      );

      const badToken = await fetch(`${url}/events/recent`, bearer("junk"));
      expect(badToken.headers.get("www-authenticate")).toBe(
        'Bearer realm="github-project-manager-events", error="invalid_token", resource_metadata="http://127.0.0.1:9999/.well-known/oauth-protected-resource"'
      );
    });

    it("places the metadata well-known path before the resource path (RFC 9728 §3)", async () => {
      const authenticator = createInboundAuthenticator(
        oauthConfig({ resourceUrl: "http://127.0.0.1:9999/mcp" }),
        logger
      );
      expect(authenticator.protectedResource?.path).toBe(
        "/.well-known/oauth-protected-resource/mcp"
      );
      const { url } = await startServer(authenticator);
      expect((await fetch(`${url}/.well-known/oauth-protected-resource/mcp`)).status).toBe(200);
    });

    it("defaults the published resource to OAUTH_AUDIENCE when it is a URL", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      const doc = (await (
        await fetch(`${url}/.well-known/oauth-protected-resource/mcp`)
      ).json()) as {
        resource: string;
      };
      expect(doc.resource).toBe(AUDIENCE);
    });

    it("accepts either method when both are configured", async () => {
      const config: InboundAuthConfig = { ...oauthConfig(), sharedToken: SHARED_TOKEN };
      const { url } = await startServer(createInboundAuthenticator(config, logger));

      expect((await fetch(`${url}/events/recent`, bearer(SHARED_TOKEN))).status).toBe(200);
      expect((await fetch(`${url}/events/recent`, bearer(await mintToken()))).status).toBe(200);
      expect((await fetch(`${url}/events/recent`, bearer("neither"))).status).toBe(401);
    });

    it("ends an SSE stream with an auth_expired event when the token's exp passes", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger), {
        enableSSE: true,
      });
      const token = await mintToken({ expiresAt: Math.floor(Date.now() / 1000) + 2 });

      const res = await fetch(`${url}/events/stream`, bearer(token));
      expect(res.status).toBe(200);
      const startedAt = Date.now();

      // text() only resolves once the server ends the response.
      const body = await res.text();

      expect(body).toContain("event: connected");
      expect(body).toContain('event: auth_expired\ndata: {"reason":"token_expired"}');
      // auth_expired is the final frame: nothing follows it.
      expect(body.trimEnd().split("\n\n").pop()).toContain("event: auth_expired");
      expect(Date.now() - startedAt).toBeLessThan(4000);
    }, 10_000);

    it("keeps an SSE stream open for credentials that never expire (shared bearer)", async () => {
      const authenticator = createInboundAuthenticator(
        { sharedToken: SHARED_TOKEN, allowUnauthenticated: false },
        logger
      );
      const { url } = await startServer(authenticator, { enableSSE: true });
      const controller = new AbortController();
      const res = await fetch(`${url}/events/stream`, {
        headers: { Authorization: `Bearer ${SHARED_TOKEN}` },
        signal: controller.signal,
      });
      const reader = res.body?.getReader();
      const first = await reader?.read();
      expect(new TextDecoder().decode(first?.value)).toContain("event: connected");

      const outcome = await Promise.race([
        reader?.read().then(() => "ended"),
        // Real socket behaviour: a short real wait is the only way to observe "still open".
        new Promise<string>((resolve) => setTimeout(() => resolve("open"), 300)),
      ]);
      expect(outcome).toBe("open");
      controller.abort();
    });

    it("reuses fetched keys across requests", async () => {
      const { url } = await startServer(createInboundAuthenticator(oauthConfig(), logger));
      await fetch(`${url}/events/recent`, bearer(await mintToken()));
      await fetch(`${url}/events/recent`, bearer(await mintToken()));
      expect(authServer.jwksHits()).toBe(1);
    });

    describe("JWKS discovery", () => {
      it("discovers jwks_uri from the issuer's authorization-server metadata", async () => {
        const config = oauthConfig({ jwksUri: undefined });
        const { url } = await startServer(createInboundAuthenticator(config, logger));
        const res = await fetch(`${url}/events/recent`, bearer(await mintToken()));
        expect(res.status).toBe(200);
      });

      it("fails with 503 (not 401) when metadata advertises a different issuer", async () => {
        authServer.discoveryDoc.current = {
          issuer: "https://attacker.example.com",
          jwks_uri: `${authServer.issuer}/jwks.json`,
        };
        const config = oauthConfig({ jwksUri: undefined });
        const { url } = await startServer(createInboundAuthenticator(config, logger));
        const res = await fetch(`${url}/events/recent`, bearer(await mintToken()));
        expect(res.status).toBe(503);
      });

      it("recovers once discovery starts working after an initial failure", async () => {
        const good = authServer.discoveryDoc.current;
        authServer.discoveryDoc.current = undefined;
        const config = oauthConfig({ jwksUri: undefined });
        const { url } = await startServer(createInboundAuthenticator(config, logger));
        const token = await mintToken();
        expect((await fetch(`${url}/events/recent`, bearer(token))).status).toBe(503);

        authServer.discoveryDoc.current = good;
        expect((await fetch(`${url}/events/recent`, bearer(token))).status).toBe(200);
      });
    });
  });

  describe("startup validation", () => {
    it("fails fast when OAUTH_ISSUER is set without OAUTH_AUDIENCE", () => {
      expect(() =>
        createInboundAuthenticator(
          {
            allowUnauthenticated: false,
            oauth: { issuer: authServer.issuer, audience: "", requiredScopes: [] },
          },
          logger
        )
      ).toThrow(/OAUTH_AUDIENCE is required/);
    });

    it("rejects a non-https issuer unless it is loopback", () => {
      expect(() =>
        OAuthResourceServerAuthenticator.validateConfig({
          issuer: "http://auth.example.com",
          audience: AUDIENCE,
          requiredScopes: [],
        })
      ).toThrow(/OAUTH_ISSUER must use https/);
    });

    it("rejects a non-URL issuer, JWKS URI and a resource URL with a fragment", () => {
      const base = { issuer: "https://auth.example.com", audience: AUDIENCE, requiredScopes: [] };
      expect(() =>
        OAuthResourceServerAuthenticator.validateConfig({ ...base, issuer: "nope" })
      ).toThrow(/OAUTH_ISSUER must be an absolute URL/);
      expect(() =>
        OAuthResourceServerAuthenticator.validateConfig({
          ...base,
          jwksUri: "http://keys.example.com/jwks",
        })
      ).toThrow(/OAUTH_JWKS_URI must use https/);
      expect(() =>
        OAuthResourceServerAuthenticator.validateConfig({
          ...base,
          resourceUrl: "https://pm.example.com/#frag",
        })
      ).toThrow(/must not contain a fragment/);
    });
  });
});
