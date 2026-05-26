/**
 * crypto.test.ts — CryptoProvider interface + defaultCryptoProvider() probe.
 *
 * Validates the layered fallback at construction time:
 *   1. crypto.randomUUID — used when present.
 *   2. crypto.getRandomValues — RFC 4122 v4 polyfill when randomUUID is absent
 *      (i.e. the VPN / insecure-context case the original bug hit).
 *   3. throw — when both are absent.
 *
 * Bun's built-in `crypto` has both methods, so we save/restore globalThis.crypto
 * around each case.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { defaultCryptoProvider } from "../src/lib/crypto";

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
});

function installCrypto(c: unknown): void {
  Object.defineProperty(globalThis, "crypto", {
    value: c,
    configurable: true,
    writable: true,
  });
}

describe("defaultCryptoProvider", () => {
  test("uses crypto.randomUUID when present (secure context)", () => {
    let calls = 0;
    installCrypto({
      randomUUID: () => {
        calls += 1;
        return "from-randomUUID";
      },
      getRandomValues: () => {
        throw new Error("should not be called when randomUUID is present");
      },
    });

    const p = defaultCryptoProvider();
    expect(p.randomUUID()).toBe("from-randomUUID");
    expect(p.randomUUID()).toBe("from-randomUUID");
    expect(calls).toBe(2);
  });

  test("falls back to getRandomValues when randomUUID is absent (insecure context)", () => {
    // Deterministic bytes — gives a known v4 string after spec bit-fixups.
    installCrypto({
      // randomUUID intentionally absent
      getRandomValues: (a: Uint8Array) => {
        for (let i = 0; i < a.length; i++) a[i] = i;
        return a;
      },
    });

    const p = defaultCryptoProvider();
    const id = p.randomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    // RFC 4122 §4.4: top nibble of byte 6 (= position 14 of the hyphenless hex
    // string, which is "0-...-XX..." form: char index 14 in "xxxxxxxxxxxxxxx...")
    // The 13th hyphenless char is the version nibble; must be 4.
    expect(id.charAt(14)).toBe("4");
    // Variant nibble (17th hyphenless char) ∈ {8,9,a,b}.
    expect("89ab").toContain(id.charAt(19));
  });

  test("returns distinct UUIDs across calls under the polyfill path", () => {
    let counter = 0;
    installCrypto({
      getRandomValues: (a: Uint8Array) => {
        // Distinct seed per call: first byte = counter.
        a[0] = counter++ & 0xff;
        for (let i = 1; i < a.length; i++) a[i] = i;
        return a;
      },
    });
    const p = defaultCryptoProvider();
    const a = p.randomUUID();
    const b = p.randomUUID();
    expect(a).not.toBe(b);
  });

  test("throws when neither randomUUID nor getRandomValues is available", () => {
    installCrypto({});
    expect(() => defaultCryptoProvider()).toThrow(
      /neither crypto\.randomUUID nor crypto\.getRandomValues/,
    );
  });

  test("throws when crypto itself is undefined", () => {
    installCrypto(undefined);
    expect(() => defaultCryptoProvider()).toThrow(/Web Crypto-capable/);
  });

  test("probe runs only at construction; the bound strategy is cached", () => {
    let probeCount = 0;
    const ud = {
      get randomUUID() {
        probeCount += 1;
        return () => "cached";
      },
    };
    installCrypto(ud);
    const p = defaultCryptoProvider();
    const beforeCalls = probeCount;
    p.randomUUID();
    p.randomUUID();
    p.randomUUID();
    // The getter on randomUUID fires once at construction (the typeof probe)
    // and never again. Constructed-once-cached is the invariant.
    expect(probeCount).toBe(beforeCalls);
  });
});
