/**
 * ws-resilience.test.ts — End-to-end resilience suite (PR-18).
 *
 * Boots a real Bun.serve in-process via serverFixture. Connects real
 * Bun WebSocket clients. Verifies three resilience scenarios:
 *
 *  A) Freeze recovery:
 *     Client connects and reaches ALIVE (receives first hb.sping). Then
 *     the client abruptly closes its socket (code 1006, no close handshake)
 *     — simulating a frozen client / NAT drop from the client side. A
 *     replacement client reconnects and reaches ALIVE within budget.
 *
 *  B) IP-change (server-forced socket drop):
 *     Client reaches ALIVE. Server calls dropAllSockets() — terminates
 *     all WS connections without a graceful handshake (simulates a NAT
 *     rebalance where the server is the one cutting the connection).
 *     Client sees a close event; a replacement client reconnects ALIVE.
 *
 *  C) Server restart:
 *     Client reaches ALIVE. Server is stopped (all clients receive 1001
 *     GOING_AWAY). A fresh server is started on the SAME port 200 ms later.
 *     A replacement client connects and reaches ALIVE on the new server.
 *
 * Implementation notes:
 *
 * - Manager (packages/web/src/ws/Manager.ts) is NOT imported here to avoid
 *   a cross-package TypeScript project-reference dependency: the web package
 *   is not configured as a composite project with declaration output, so the
 *   server tsconfig cannot reference it cleanly. Manager's internal state
 *   machine is exercised by its own unit tests (manager.test.ts,
 *   time-jump.test.ts). This E2E suite tests server-centric resilience:
 *   does the server cleanly handle abrupt closes and accept new connections?
 *
 * - "ALIVE" means the client has received at least one hb.sping frame from
 *   the server and replied with hb.spong — confirming the heartbeat loop is
 *   operational. That is the observable precondition for all three scenarios.
 *
 * - Heartbeat intervals in the fixture are compressed:
 *   pingIntervalMs: 150, pongTimeoutMs: 100
 *   so ALIVE is confirmed in ≤ 200 ms.
 *
 * - Each test gets a fresh server via beforeEach/afterEach.
 *
 * Total expected runtime: ≤ 5 s (well within the 60 s budget).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  startFixtureServer,
  type ServerFixture,
  startFixtureServerOnPort,
} from "../helpers/serverFixture";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Compressed heartbeat ping interval for the fixture server. */
const PING_INTERVAL_MS = 150;
/** Compressed heartbeat pong timeout for the fixture server. */
const PONG_TIMEOUT_MS = 100;
/** How long to wait for a client to confirm ALIVE status. */
const ALIVE_TIMEOUT_MS = 2_000;
/** Recovery budget for scenario B (IP-change) in ms. */
const RECOVERY_BUDGET_MS_B = 3_000;
/** Recovery budget for scenarios A and C in ms. */
const RECOVERY_BUDGET_MS_AC = 5_000;

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

/**
 * Open a WebSocket to the fixture server's /ws endpoint.
 * Passes the correct Origin header so the server's Origin check passes.
 *
 * Bun's global WebSocket accepts Bun.WebSocketOptions (with `headers`) as
 * its second argument. DOM typings shadow that overload so we cast to
 * `unknown` first, then to `ConstructorParameters<typeof WebSocket>[1]`.
 * This pattern follows PR-06's ws-origin.test.ts.
 */
function openWs(wsUrl: string, baseUrl: string): WebSocket {
  const opts = { headers: { Origin: baseUrl } };
  return new WebSocket(`${wsUrl}/ws`, opts as unknown as string);
}

/**
 * Wait for the WebSocket `open` event.
 * Rejects if the socket closes or errors before opening.
 */
function waitForOpen(ws: WebSocket, timeoutMs = ALIVE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`ws.open timeout after ${timeoutMs} ms`)),
      timeoutMs,
    );
    ws.onopen = () => { clearTimeout(t); resolve(); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error before open")); };
    ws.onclose = (ev) => {
      clearTimeout(t);
      reject(new Error(`ws closed (code ${(ev as CloseEvent).code}) before open`));
    };
  });
}

/**
 * Wait until the WebSocket receives at least one `hb.sping` frame from the
 * server, then reply with `hb.spong` (so the heartbeat loop succeeds and the
 * server keeps the connection open).
 *
 * Resolves once the first hb.sping is received and acknowledged. This is the
 * operational definition of ALIVE used by this E2E suite.
 */
function waitForAlive(ws: WebSocket, timeoutMs = ALIVE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`waitForAlive timeout after ${timeoutMs} ms`)),
      timeoutMs,
    );

    ws.onmessage = (ev) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse((ev as MessageEvent<string>).data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (frame["type"] !== "hb.sping") return;

      // Reply with hb.spong so the heartbeat succeeds.
      ws.send(
        JSON.stringify({
          type: "hb.spong",
          seq: 0,
          ts: Date.now(),
          echoNonce: frame["nonce"],
          serverTs: frame["ts"],
        }),
      );

      clearTimeout(t);
      ws.onmessage = null;
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws error while waiting for ALIVE"));
    };
    ws.onclose = (ev) => {
      clearTimeout(t);
      reject(new Error(`ws closed (code ${(ev as CloseEvent).code}) while waiting for ALIVE`));
    };
  });
}

/**
 * Wait for the WebSocket `close` event and return the close code.
 */
function waitForClose(ws: WebSocket, timeoutMs = RECOVERY_BUDGET_MS_B): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`ws.close timeout after ${timeoutMs} ms`)),
      timeoutMs,
    );
    ws.onclose = (ev) => { clearTimeout(t); resolve((ev as CloseEvent).code); };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws error while waiting for close"));
    };
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ws-resilience: E2E resilience scenarios", () => {
  let fixture: ServerFixture;

  beforeEach(async () => {
    fixture = await startFixtureServer({
      pingIntervalMs: PING_INTERVAL_MS,
      pongTimeoutMs: PONG_TIMEOUT_MS,
    });
  });

  afterEach(async () => {
    await fixture.stop();
  });

  // -------------------------------------------------------------------------
  // Scenario A: Freeze recovery
  // -------------------------------------------------------------------------
  it(
    "A: freeze — client abrupt-close → server handles it → replacement reaches ALIVE",
    async () => {
      const start = Date.now();

      // 1. Connect first client and confirm ALIVE (heartbeat exchange).
      const ws1 = openWs(fixture.wsUrl, fixture.baseUrl);
      await waitForOpen(ws1);
      await waitForAlive(ws1);

      // 2. Simulate freeze: abruptly close the socket (code 1006 = abnormal
      //    closure, no graceful handshake). This is what a frozen client
      //    looks like once the OS or network layer gives up on the connection.
      ws1.close(1006, "simulated freeze");

      // Give the server a moment to process the close event.
      await Bun.sleep(50);

      // 3. Connect a replacement client and confirm it reaches ALIVE.
      const ws2 = openWs(fixture.wsUrl, fixture.baseUrl);
      await waitForOpen(ws2);
      await waitForAlive(ws2);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(RECOVERY_BUDGET_MS_AC);

      ws2.close(1000, "test done");
    },
    RECOVERY_BUDGET_MS_AC + 2_000,
  );

  // -------------------------------------------------------------------------
  // Scenario B: IP-change (server-forced socket drop)
  // -------------------------------------------------------------------------
  it(
    "B: IP-change — server force-drops all sockets → replacement client reaches ALIVE",
    async () => {
      const start = Date.now();

      // 1. Connect client and confirm ALIVE.
      const ws1 = openWs(fixture.wsUrl, fixture.baseUrl);
      await waitForOpen(ws1);
      await waitForAlive(ws1);

      // 2. Arm the close listener BEFORE calling dropAllSockets so we don't
      //    miss the event.
      const closePromise = waitForClose(ws1, RECOVERY_BUDGET_MS_B);

      // 3. Server force-drops all sockets (simulates NAT rebalance).
      fixture.dropAllSockets();

      // 4. The first client must receive a close event within budget.
      const closeCode = await closePromise;
      // Bun sends close code 1006 on abrupt drops; accept any code ≥ 1000.
      expect(closeCode).toBeGreaterThanOrEqual(1000);

      // 5. Connect a replacement and confirm ALIVE.
      const ws2 = openWs(fixture.wsUrl, fixture.baseUrl);
      await waitForOpen(ws2);
      await waitForAlive(ws2);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(RECOVERY_BUDGET_MS_B);

      ws2.close(1000, "test done");
    },
    RECOVERY_BUDGET_MS_B + 2_000,
  );

  // -------------------------------------------------------------------------
  // Scenario C: Server restart
  // -------------------------------------------------------------------------
  it(
    "C: server restart — server stops → fresh server on same port → replacement reaches ALIVE",
    async () => {
      const start = Date.now();
      const savedPort = fixture.port;

      // 1. Connect client and confirm ALIVE.
      const ws1 = openWs(fixture.wsUrl, fixture.baseUrl);
      await waitForOpen(ws1);
      await waitForAlive(ws1);

      // 2. Arm close listener BEFORE stopping the server.
      const closePromise = waitForClose(ws1, RECOVERY_BUDGET_MS_AC);

      // 3. Stop the server. All connected clients receive 1001 GOING_AWAY.
      //    (Bun.serve does not support arbitrary custom close codes in stop();
      //    1001 is the closest standard code to 1012 SERVICE_RESTART — both
      //    signal "going away, please reconnect".)
      //    After this call, fixture.stop() in afterEach is a no-op.
      await fixture.stop();
      fixture = { ...fixture, stop: async () => {} };

      // 4. First client must receive the close event.
      const closeCode = await closePromise;
      expect(closeCode).toBeGreaterThanOrEqual(1000);

      // 5. 200 ms later, start a fresh server on the SAME port.
      await Bun.sleep(200);

      const freshFixture = await startFixtureServerOnPort(savedPort, {
        pingIntervalMs: PING_INTERVAL_MS,
        pongTimeoutMs: PONG_TIMEOUT_MS,
      });

      try {
        // 6. Connect a replacement client to the NEW server and confirm ALIVE.
        const ws2 = openWs(freshFixture.wsUrl, freshFixture.baseUrl);
        await waitForOpen(ws2);
        await waitForAlive(ws2);

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(RECOVERY_BUDGET_MS_AC);

        ws2.close(1000, "test done");
      } finally {
        await freshFixture.stop();
      }
    },
    RECOVERY_BUDGET_MS_AC + 3_000,
  );
});
