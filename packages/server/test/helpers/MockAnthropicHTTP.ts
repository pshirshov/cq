/**
 * MockAnthropicHTTP.ts — A local Bun.serve HTTP stub that emulates the Anthropic
 * messages API (`POST /v1/messages`) returning a canonical SSE stream.
 *
 * Purpose: allows tests to point `ANTHROPIC_BASE_URL` at this stub so that any
 * code path that makes HTTP requests to the Anthropic API receives scripted,
 * deterministic responses without network access.
 *
 * The default SSE response sequence conforms to Anthropic's documented streaming
 * protocol: message_start → content_block_start → content_block_delta (×N) →
 * content_block_stop → message_delta (stop_reason=end_turn) → message_stop.
 *
 * Usage:
 *   const mock = await startMockAnthropic();
 *   process.env.ANTHROPIC_BASE_URL = mock.url;
 *   process.env.ANTHROPIC_API_KEY = 'sk-test-fake';
 *   // ... run test ...
 *   await mock.stop();
 */

import net from "node:net";

// ---------------------------------------------------------------------------
// SSE event shapes (Anthropic streaming protocol)
// ---------------------------------------------------------------------------

/** A single SSE event: event name + JSON-serialisable data payload. */
export type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
};

/** Canonical default SSE script returned by the stub. */
export const DEFAULT_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: "msg_stub_test",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-stub",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    },
  },
  {
    event: "content_block_start",
    data: {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
  },
  {
    event: "content_block_delta",
    data: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "hello" },
    },
  },
  {
    event: "content_block_stop",
    data: { type: "content_block_stop", index: 0 },
  },
  {
    event: "message_delta",
    data: {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 1 },
    },
  },
  {
    event: "message_stop",
    data: { type: "message_stop" },
  },
];

/** A 500-error response body — used by error-path tests. */
export const ERROR_RESPONSE_BODY = JSON.stringify({
  type: "error",
  error: { type: "api_error", message: "internal server error (stub)" },
});

// ---------------------------------------------------------------------------
// MockAnthropicHTTP result
// ---------------------------------------------------------------------------

export type MockAnthropicHTTP = {
  /** Base URL, e.g. `http://127.0.0.1:12345`. Point ANTHROPIC_BASE_URL here. */
  url: string;
  /** Bound port. */
  port: number;
  /** Total number of requests received since boot. */
  requestCount: () => number;
  /** Stop the stub server. */
  stop: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Start options
// ---------------------------------------------------------------------------

export type MockAnthropicHTTPOpts = {
  /**
   * Custom SSE event sequence to return for POST /v1/messages.
   * Defaults to `DEFAULT_SSE_EVENTS`.
   */
  scriptedResponse?: SSEEvent[];
  /**
   * When true, POST /v1/messages returns HTTP 500 with a JSON error body
   * instead of a streaming SSE response. Use for error-path tests.
   */
  returnError?: boolean;
  /**
   * HTTP status code for the error response. Defaults to 500. Only used when
   * `returnError` is true.
   */
  errorStatus?: number;
};

// ---------------------------------------------------------------------------
// Free-port helper (reuse pattern from serverFixture.ts)
// ---------------------------------------------------------------------------

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("unexpected address type"));
        return;
      }
      const p = addr.port;
      srv.close((err) => {
        if (err !== undefined) reject(err);
        else resolve(p);
      });
    });
    srv.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// SSE encoding
// ---------------------------------------------------------------------------

function encodeSSEEvents(events: SSEEvent[]): string {
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
}

// ---------------------------------------------------------------------------
// startMockAnthropic
// ---------------------------------------------------------------------------

/**
 * Boot a Bun.serve HTTP stub on a free port that handles:
 *   - `POST /v1/messages` → canonical Anthropic SSE stream (or error)
 *   - Everything else → 404
 *
 * Returns the base URL and a `stop()` function.
 */
export async function startMockAnthropic(
  opts: MockAnthropicHTTPOpts = {},
): Promise<MockAnthropicHTTP> {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const events = opts.scriptedResponse ?? DEFAULT_SSE_EVENTS;
  const returnError = opts.returnError ?? false;
  const errorStatus = opts.errorStatus ?? 500;

  let reqCount = 0;

  const server = Bun.serve({
    hostname: host,
    port,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname === "/v1/messages") {
        reqCount += 1;

        if (returnError) {
          return new Response(ERROR_RESPONSE_BODY, {
            status: errorStatus,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Return SSE stream.
        const body = encodeSSEEvents(events);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      }

      // Catch-all: log the path for debugging and return 404.
      // This is intentional: if the SDK hits an unexpected endpoint, the test
      // should see an error rather than hanging silently.
      return new Response(
        JSON.stringify({ error: `stub: no handler for ${req.method} ${url.pathname}` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });

  return {
    url: `http://${host}:${port}`,
    port,
    requestCount: () => reqCount,
    stop: async () => {
      server.stop(true);
      // Give Bun.serve a moment to release the port.
      await Bun.sleep(10);
    },
  };
}
