/**
 * Client address resolution for rate limiting and audit logging.
 *
 * `X-Forwarded-For` is caller-controlled: unless a reverse proxy that we trust
 * overwrites or appends to it, any client can rotate it to dodge per-IP limits.
 * The socket peer address is therefore the default, and forwarded headers are
 * honoured only when the operator opts in with `TRUST_PROXY=<hops>`.
 */

/** Matches Express's numeric `trust proxy` setting: a positive hop count. */
const HOP_COUNT = /^[1-9]\d*$/;

/**
 * Parse the `TRUST_PROXY` setting into a number of trusted proxy hops.
 *
 * - unset / empty / `false` / `0` -> 0 (ignore forwarded headers)
 * - positive integer N -> N
 * - anything else (notably `true`, which would trust every hop and so lets a
 *   client spoof any address) -> throws
 */
export function parseTrustProxy(raw: string | undefined): number {
  const value = (raw ?? "").trim();
  if (value === "" || value === "0" || value.toLowerCase() === "false") {
    return 0;
  }
  if (HOP_COUNT.test(value)) {
    const hops = Number(value);
    if (Number.isSafeInteger(hops)) {
      return hops;
    }
  }
  throw new Error(
    `Invalid TRUST_PROXY value "${value}": expected unset/false or a positive integer ` +
      `number of trusted proxy hops (e.g. 1 behind a single load balancer). ` +
      `"true" is rejected because trusting every hop lets clients spoof their address.`
  );
}

/** Lower-case and unwrap IPv4-mapped IPv6 (`::ffff:1.2.3.4` -> `1.2.3.4`). */
export function normalizeIp(address: string): string {
  const lower = address.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  return mapped ? (mapped[1] as string) : lower;
}

/**
 * Resolve the client address.
 *
 * With `trustedHops` N > 0 the chain is `[socket peer, ...X-Forwarded-For
 * right-to-left]` and the Nth entry is returned, i.e. the address as seen by
 * the outermost proxy we trust (Express `trust proxy` hop semantics). A chain
 * shorter than N yields its last entry.
 */
export function resolveClientAddress(
  socketAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number
): string {
  const peer = socketAddress ? normalizeIp(socketAddress) : "unknown";
  if (trustedHops <= 0 || forwardedFor === undefined) {
    return peer;
  }
  const forwarded = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeIp)
    .reverse();
  const chain = [peer, ...forwarded];
  return chain[Math.min(trustedHops, chain.length - 1)] as string;
}
