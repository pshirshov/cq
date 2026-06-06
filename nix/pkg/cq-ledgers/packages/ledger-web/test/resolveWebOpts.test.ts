/**
 * ledger-web per-field host/port resolution (Q106) + bounded port scan (Q107).
 *
 * Pure logic — no happy-dom. `resolveWebOpts` resolves host and port
 * INDEPENDENTLY with precedence: explicit CLI flag > cq.toml [webui] > default.
 * `scanForPort` retries port+1 on EADDRINUSE up to MAX_PORT_SCAN, never
 * touching the host, and throws a precise cap error when exhausted.
 */

import { describe, it, expect } from "bun:test";
import type { WebuiConfig } from "@cq/config";
import { parseArgs, resolveWebOpts, scanForPort } from "../src/serve.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5180;

/** Build the resolver's `args` shape directly (independent of process.argv). */
function args(
  over: Partial<{ host: string; port: number; hostExplicit: boolean; portExplicit: boolean }>,
): { host: string; port: number; hostExplicit: boolean; portExplicit: boolean } {
  return {
    host: over.host ?? DEFAULT_HOST,
    port: over.port ?? DEFAULT_PORT,
    hostExplicit: over.hostExplicit ?? false,
    portExplicit: over.portExplicit ?? false,
  };
}

const cfg = (host: string | null, port: number | null): WebuiConfig => ({ host, port });

describe("parseArgs explicit-vs-default tracking", () => {
  it("flags host/port as NOT explicit when omitted (fall through to default)", () => {
    const r = parseArgs([]);
    expect(r.host).toBe(DEFAULT_HOST);
    expect(r.port).toBe(DEFAULT_PORT);
    expect(r.hostExplicit).toBe(false);
    expect(r.portExplicit).toBe(false);
  });

  it("flags --host / --port as explicit (space + = forms)", () => {
    const space = parseArgs(["--host", "0.0.0.0", "--port", "8080"]);
    expect(space.hostExplicit).toBe(true);
    expect(space.portExplicit).toBe(true);
    const eq = parseArgs(["--host=0.0.0.0", "--port=8080"]);
    expect(eq.hostExplicit).toBe(true);
    expect(eq.portExplicit).toBe(true);
  });

  it("flags only the field actually passed", () => {
    const onlyPort = parseArgs(["--port", "8080"]);
    expect(onlyPort.portExplicit).toBe(true);
    expect(onlyPort.hostExplicit).toBe(false);
  });
});

describe("resolveWebOpts precedence matrix (Q106)", () => {
  it("default-only: no CLI flag, no config => built-in defaults", () => {
    expect(resolveWebOpts(args({}), null)).toEqual({ host: DEFAULT_HOST, port: DEFAULT_PORT });
  });

  it("CLI-only: explicit flags win when config is null", () => {
    const r = resolveWebOpts(
      args({ host: "0.0.0.0", port: 9000, hostExplicit: true, portExplicit: true }),
      null,
    );
    expect(r).toEqual({ host: "0.0.0.0", port: 9000 });
  });

  it("config-only: [webui] values fill in when no CLI flag passed", () => {
    const r = resolveWebOpts(args({}), cfg("10.0.0.5", 6000));
    expect(r).toEqual({ host: "10.0.0.5", port: 6000 });
  });

  it("CLI-overrides-config: explicit flag beats [webui] for both fields", () => {
    const r = resolveWebOpts(
      args({ host: "0.0.0.0", port: 9000, hostExplicit: true, portExplicit: true }),
      cfg("10.0.0.5", 6000),
    );
    expect(r).toEqual({ host: "0.0.0.0", port: 9000 });
  });

  it("per-field mix: config port + default host (host unset everywhere)", () => {
    const r = resolveWebOpts(args({}), cfg(null, 6000));
    expect(r).toEqual({ host: DEFAULT_HOST, port: 6000 });
  });

  it("per-field mix: explicit CLI host + config port", () => {
    const r = resolveWebOpts(
      args({ host: "0.0.0.0", hostExplicit: true }),
      cfg("10.0.0.5", 6000),
    );
    expect(r).toEqual({ host: "0.0.0.0", port: 6000 });
  });

  it("per-field mix: config host + explicit CLI port", () => {
    const r = resolveWebOpts(
      args({ port: 9000, portExplicit: true }),
      cfg("10.0.0.5", 6000),
    );
    expect(r).toEqual({ host: "10.0.0.5", port: 9000 });
  });

  it("a null field inside a present [webui] table is treated as unset", () => {
    const r = resolveWebOpts(args({}), cfg("10.0.0.5", null));
    expect(r).toEqual({ host: "10.0.0.5", port: DEFAULT_PORT });
  });
});

describe("scanForPort bounded auto-increment (Q107)", () => {
  it("returns the start port immediately when it binds", () => {
    const bound: number[] = [];
    const got = scanForPort(7000, (p) => {
      bound.push(p);
      return p;
    });
    expect(got).toBe(7000);
    expect(bound).toEqual([7000]);
  });

  it("skips an occupied real port: bind P with Bun.serve, scan from P returns P+1", () => {
    // Occupy a throwaway port with a real Bun.serve (acceptance (b)).
    const occupied = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("ok") });
    const P = occupied.port;
    if (P === undefined) throw new Error("Bun.serve did not report a bound port");
    try {
      const tried: number[] = [];
      // Real bind: throws EADDRINUSE synchronously on the occupied P, succeeds
      // on the first free port at-or-above P — exactly the retry the scan adds.
      const bind = (p: number): ReturnType<typeof Bun.serve> => {
        tried.push(p);
        return Bun.serve({ hostname: "127.0.0.1", port: p, fetch: () => new Response("ok") });
      };
      const server = scanForPort(P, bind);
      const boundPort = server.port;
      if (boundPort === undefined) throw new Error("scanned server has no port");
      try {
        expect(tried[0]).toBe(P); // first attempt is the occupied start port
        expect(boundPort).toBeGreaterThan(P); // landed on a higher free port
      } finally {
        server.stop(true);
      }
    } finally {
      occupied.stop(true);
    }
  });

  it("throws the precise cap error when MAX_PORT_SCAN consecutive ports are occupied", () => {
    const start = 8000;
    // Simulate every port as occupied so the scan exhausts its 64-attempt cap.
    const eaddrinuse = (): never => {
      const err = new Error("Failed to start server. Is port in use?") as Error & { code: string };
      err.code = "EADDRINUSE";
      throw err;
    };
    let attempts = 0;
    expect(() =>
      scanForPort(start, (_p) => {
        attempts++;
        return eaddrinuse();
      }),
    ).toThrow(/no free port in 8000\.\.8063 \(64 attempts/);
    expect(attempts).toBe(64); // exactly MAX_PORT_SCAN tries
  });

  it("rethrows a non-EADDRINUSE error immediately (does not scan)", () => {
    let attempts = 0;
    expect(() =>
      scanForPort(9000, (_p) => {
        attempts++;
        const err = new Error("permission denied") as Error & { code: string };
        err.code = "EACCES";
        throw err;
      }),
    ).toThrow(/permission denied/);
    expect(attempts).toBe(1); // bailed after the first, non-addr-in-use failure
  });

  it("never mutates the host: the scan only varies the port argument", () => {
    const start = 5500;
    const seen: Array<{ host: string; port: number }> = [];
    const host = "0.0.0.0";
    // bind throws EADDRINUSE for the first two ports, succeeds on the third.
    const got = scanForPort(start, (p) => {
      seen.push({ host, port: p });
      if (p < start + 2) {
        const err = new Error("in use") as Error & { code: string };
        err.code = "EADDRINUSE";
        throw err;
      }
      return { host, port: p };
    });
    expect(got).toEqual({ host, port: start + 2 });
    // host is identical on every attempt; only the port advanced.
    expect(seen.map((s) => s.host)).toEqual([host, host, host]);
    expect(seen.map((s) => s.port)).toEqual([start, start + 1, start + 2]);
  });
});
