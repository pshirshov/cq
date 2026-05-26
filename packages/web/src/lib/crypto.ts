/**
 * crypto.ts — CryptoProvider interface + default browser implementation.
 *
 * Why this exists:
 *   `crypto.randomUUID()` is only available in *secure contexts* (HTTPS or
 *   localhost). cq is deployed behind a VPN at non-localhost IPs per the
 *   brief, so the browser disables `randomUUID()` and any module calling it
 *   crashes with `TypeError: crypto.randomUUID is not a function`.
 *
 * Design:
 *   - Consumers receive a `CryptoProvider` instance via dependency
 *     injection (Manager opts → manager.crypto → consumers).
 *   - `defaultCryptoProvider()` probes the environment ONCE at
 *     construction and binds the strongest available source of randomness:
 *       1. crypto.randomUUID — secure contexts (HTTPS/localhost).
 *       2. crypto.getRandomValues + RFC 4122 v4 — insecure contexts.
 *       3. throw — both are absent (very old browsers / Node without polyfill).
 *     The probe runs once; the resolved strategy is cached.
 *   - Tests inject their own implementation (deterministic counters etc.).
 *
 * Fail-fast (per CLAUDE.md): if neither randomUUID nor getRandomValues is
 * present, construction throws rather than silently degrading to Math.random.
 * The expected runtimes (any browser supporting WebSocket + modern React)
 * have getRandomValues, so the throw is reached only on misconfiguration.
 */

export interface CryptoProvider {
  /** Generate a unique identifier suitable for protocol IDs and DOM keys. */
  randomUUID(): string;
}

/**
 * Construct the default browser provider, binding the strongest available
 * randomness source at construction time.
 *
 * @throws if neither `crypto.randomUUID` nor `crypto.getRandomValues` is
 *   available — see fail-fast rationale in the module header.
 */
export function defaultCryptoProvider(): CryptoProvider {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    // Secure context. Capture the bound primitive once so subsequent calls
    // don't keep re-reading `c.randomUUID` (which would re-fire any property
    // accessor on the object).
    const fn = c.randomUUID.bind(c);
    return { randomUUID: () => fn() };
  }
  if (c && typeof c.getRandomValues === "function") {
    // Insecure context. Hand-roll RFC 4122 v4 on top of the still-available
    // getRandomValues. Cache the bound function so we don't keep probing.
    const getRandomValues = c.getRandomValues.bind(c);
    return { randomUUID: () => uuidV4(getRandomValues) };
  }
  throw new Error(
    "CryptoProvider: neither crypto.randomUUID nor crypto.getRandomValues is available; " +
      "cq requires a Web Crypto-capable runtime.",
  );
}

/**
 * RFC 4122 v4 UUID built from 16 random bytes.
 * Bits set per the spec: top nibble of byte 6 = 0100 (version 4); top two bits
 * of byte 8 = 10 (variant 10).
 */
function uuidV4(getRandomValues: (a: Uint8Array) => Uint8Array): string {
  const b = new Uint8Array(16);
  getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h: string[] = [];
  for (let i = 0; i < 16; i++) h.push((b[i] ?? 0).toString(16).padStart(2, "0"));
  return (
    h.slice(0, 4).join("") +
    "-" +
    h.slice(4, 6).join("") +
    "-" +
    h.slice(6, 8).join("") +
    "-" +
    h.slice(8, 10).join("") +
    "-" +
    h.slice(10, 16).join("")
  );
}
