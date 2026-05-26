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

/**
 * SSE event sequence for an assistant message that invokes the AskUserQuestion tool.
 *
 * The AskUserQuestion input schema requires:
 *   questions[].header   — string (required, displayed as the question heading)
 *   questions[].question — string (required, the question body)
 *   questions[].options  — string[] (required, list of choices)
 *   questions[].question_type — "single_select" | "multiple_select" (required)
 *
 * Used for real-SDK spike tests (PR-31-D01).
 */
export const ASK_USER_QUESTION_TOOL_USE_ID = "toolu_ask_spike_001";

export const ASK_USER_QUESTION_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: "msg_ask_spike_1",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-stub",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
  },
  {
    event: "content_block_start",
    data: {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: ASK_USER_QUESTION_TOOL_USE_ID,
        name: "AskUserQuestion",
        input: {},
      },
    },
  },
  {
    event: "content_block_delta",
    data: {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "input_json_delta",
        // questions[].header is required by the AskUserQuestion schema.
        partial_json: JSON.stringify({
          questions: [
            {
              header: "Please choose an option",
              question: "Which option do you prefer?",
              options: ["Option A", "Option B"],
              question_type: "single_select",
            },
          ],
        }),
      },
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
      delta: { stop_reason: "tool_use", stop_sequence: null },
      usage: { output_tokens: 15 },
    },
  },
  {
    event: "message_stop",
    data: { type: "message_stop" },
  },
];

/**
 * SSE event sequence confirming that the answer was received.
 * The text contains "Option B" to let tests assert the chosen option was acknowledged.
 */
export const ASK_USER_QUESTION_CONFIRM_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: "msg_ask_spike_2",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-stub",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 25, output_tokens: 0 },
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
      delta: { type: "text_delta", text: "Received: Option B was chosen." },
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
      usage: { output_tokens: 8 },
    },
  },
  {
    event: "message_stop",
    data: { type: "message_stop" },
  },
];

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
   * Ignored if `scriptedResponder` is provided.
   */
  scriptedResponse?: SSEEvent[];
  /**
   * When true, POST /v1/messages returns HTTP 500 with a JSON error body
   * instead of a streaming SSE response. Use for error-path tests.
   * Ignored if `scriptedResponder` is provided.
   */
  returnError?: boolean;
  /**
   * HTTP status code for the error response. Defaults to 500. Only used when
   * `returnError` is true.
   */
  errorStatus?: number;
  /**
   * Custom async callback invoked for each POST /v1/messages request.
   * Receives the parsed request body (as a string) and returns either:
   *   - an SSEEvent[] array (served as text/event-stream), or
   *   - a Response object (used as-is).
   *
   * When provided, takes precedence over `scriptedResponse` and `returnError`.
   * Use for multi-round flows (e.g. AskUserQuestion spike) where the response
   * must depend on the request content.
   */
  scriptedResponder?: (body: string, reqIndex: number) => Promise<SSEEvent[] | Response>;
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
  const scriptedResponder = opts.scriptedResponder;

  let reqCount = 0;

  const server = Bun.serve({
    hostname: host,
    port,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // HEAD / — the real Claude CLI subprocess sends this as a connectivity probe
      // before initiating its first API call. Return 200 to let it proceed.
      if (req.method === "HEAD" && url.pathname === "/") {
        return new Response(null, { status: 200 });
      }

      if (req.method === "POST" && url.pathname === "/v1/messages") {
        reqCount += 1;

        // Custom responder takes precedence — used for multi-round real-SDK tests.
        if (scriptedResponder !== undefined) {
          const body = await req.text();
          const result = await scriptedResponder(body, reqCount);
          if (result instanceof Response) return result;
          const sseBody = encodeSSEEvents(result);
          return new Response(sseBody, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "X-Accel-Buffering": "no",
            },
          });
        }

        if (returnError) {
          return new Response(ERROR_RESPONSE_BODY, {
            status: errorStatus,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Return SSE stream.
        const sseBody = encodeSSEEvents(events);
        return new Response(sseBody, {
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
