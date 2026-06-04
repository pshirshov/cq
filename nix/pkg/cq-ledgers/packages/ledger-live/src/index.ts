/**
 * Resilient live-change WebSocket client (shared by ledger-tui and ledger-web).
 *
 * Connects to a `ledger-mcp --http` server's `/ws` endpoint, keeps the channel
 * healthy with an application-level nonce heartbeat (NOT transport liveness),
 * and invokes `onChanged` when the server pushes a `changed` frame so the UI
 * can refetch. Exposes derived health stats for a connection indicator.
 *
 * Implements the resilient-ws-ui core: per-ping nonce + timeout (R3), a
 * NEW/ALIVE/STALE/DEAD state machine with a STALE grace period (R2), connect
 * timeout (R4), exponential backoff with full jitter + cap + max attempts +
 * terminal (R5/R13), close-code classification (R7), a time-jump detector for
 * suspend/resume (R8), and a destroyed re-entry guard (R12). Uses the global
 * `WebSocket` (works under browsers and Bun); the ctor + clock are injectable
 * for tests.
 *
 * Scoped out for a localhost dev tool (documented gaps, per the skill):
 *  - R6 overlapping-connection failover: a single connection with fast
 *    reconnect is sufficient on loopback; the zero-gap-failover win is for
 *    flaky mobile networks.
 *  - Session replay: `onChanged` triggers a full refetch, which is idempotent,
 *    so no sequence numbers / at-least-once delivery are needed.
 *  - Page Lifecycle / Web Worker heartbeat: left to the consumer (the web app
 *    wires visibility/online; the TUI is a long-lived process).
 */

export type LiveState = "connecting" | "alive" | "stale" | "dead" | "terminal";

export interface LiveStats {
  state: LiveState;
  /** Last measured round-trip time (ms), or null. */
  rttMs: number | null;
  /** Reconnect attempt count since the last ALIVE. */
  attempt: number;
  maxAttempts: number;
  /** Epoch ms of the next scheduled reconnect, or null. */
  nextRetryAt: number | null;
  /** True once retries are exhausted or a non-retriable close happened. */
  isTerminal: boolean;
  lastCloseCode: number | null;
  lastCloseReason: string;
}

export interface LiveManagerOpts {
  url: string;
  /** Called when the server reports a change; `ledger` is null if unspecified. */
  onChanged: (ledger: string | null) => void;
  /** Called on every health-state change (drive a connection indicator). */
  onUpdate?: (stats: LiveStats) => void;
  /** Injectable WebSocket constructor (defaults to global). */
  WebSocketCtor?: { new (url: string): WebSocket };
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
  connectTimeoutMs?: number;
  staleGraceMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxAttempts?: number;
}

// RFC 6455 close codes that mean "don't bother reconnecting" (R7).
const NON_RETRIABLE = new Set([1002, 1003, 1007, 1008, 1009, 1010, 1015]);
const TICK_MS = 1000;
const JUMP_THRESHOLD_MS = 2000;

interface Resolved {
  pingIntervalMs: number;
  pongTimeoutMs: number;
  connectTimeoutMs: number;
  staleGraceMs: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  maxAttempts: number;
}

function randomNonce(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID !== undefined) return c.randomUUID();
  return `n${Math.floor(Math.random() * 1e9).toString(36)}${Date.now().toString(36)}`;
}

export class LiveManager {
  private readonly o: Resolved;
  private readonly url: string;
  private readonly WS: { new (url: string): WebSocket };
  private readonly now: () => number;
  private readonly onChanged: (ledger: string | null) => void;
  private readonly onUpdate: ((s: LiveStats) => void) | undefined;

  private ws: WebSocket | null = null;
  private state: LiveState = "connecting";
  private destroyed = false;

  private rttMs: number | null = null;
  private attempt = 0;
  private nextRetryAt: number | null = null;
  private isTerminal = false;
  private lastCloseCode: number | null = null;
  private lastCloseReason = "";

  private pendingPing: { nonce: string; sentAt: number } | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;

  constructor(opts: LiveManagerOpts) {
    this.url = opts.url;
    this.onChanged = opts.onChanged;
    this.onUpdate = opts.onUpdate;
    this.WS = opts.WebSocketCtor ?? (globalThis as unknown as { WebSocket: { new (u: string): WebSocket } }).WebSocket;
    this.now = opts.now ?? ((): number => Date.now());
    this.o = {
      pingIntervalMs: opts.pingIntervalMs ?? 5000,
      pongTimeoutMs: opts.pongTimeoutMs ?? 4000,
      connectTimeoutMs: opts.connectTimeoutMs ?? 6000,
      staleGraceMs: opts.staleGraceMs ?? 4000,
      baseBackoffMs: opts.baseBackoffMs ?? 1000,
      maxBackoffMs: opts.maxBackoffMs ?? 30000,
      maxAttempts: opts.maxAttempts ?? 15,
    };
  }

  start(): void {
    if (this.destroyed) return;
    this.lastTickAt = this.now();
    this.tickTimer = setInterval(() => this.onTick(), TICK_MS);
    this.connect();
  }

  destroy(): void {
    this.destroyed = true; // guard first — close() drives state handlers
    this.clearConn();
    if (this.tickTimer !== null) clearInterval(this.tickTimer);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.tickTimer = null;
    this.reconnectTimer = null;
  }

  getStats(): LiveStats {
    return {
      state: this.state,
      rttMs: this.rttMs,
      attempt: this.attempt,
      maxAttempts: this.o.maxAttempts,
      nextRetryAt: this.nextRetryAt,
      isTerminal: this.isTerminal,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason,
    };
  }

  // ---- connection lifecycle ---------------------------------------------

  private setState(s: LiveState): void {
    if (this.state === s) return;
    this.state = s;
    this.onUpdate?.(this.getStats());
  }

  private connect(): void {
    if (this.destroyed) return;
    this.clearConn();
    this.setState("connecting");
    let ws: WebSocket;
    try {
      ws = new this.WS(this.url);
    } catch {
      this.handleClose(1006, "construct failed");
      return;
    }
    this.ws = ws;
    // Connect timeout (R4): abort a handshake that never opens.
    this.connectTimer = setTimeout(() => {
      if (this.ws === ws && this.state === "connecting") this.forceReconnect(1006, "connect timeout");
    }, this.o.connectTimeoutMs);
    ws.onopen = (): void => {
      if (this.destroyed || this.ws !== ws) return;
      if (this.connectTimer !== null) clearTimeout(this.connectTimer);
      this.connectTimer = null;
      this.attempt = 0;
      this.nextRetryAt = null;
      this.setState("alive");
      this.startHeartbeat();
    };
    ws.onmessage = (ev: MessageEvent): void => this.onMessage(ev);
    ws.onclose = (ev: CloseEvent): void => {
      if (this.ws !== ws) return;
      this.handleClose(ev.code, ev.reason);
    };
    ws.onerror = (): void => {
      /* close follows; nothing to do */
    };
  }

  private startHeartbeat(): void {
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), this.o.pingIntervalMs);
  }

  private sendPing(): void {
    if (this.ws === null || this.ws.readyState !== 1 /* OPEN */) return;
    const nonce = randomNonce();
    this.pendingPing = { nonce, sentAt: this.now() };
    try {
      this.ws.send(JSON.stringify({ type: "ping", nonce, ts: this.pendingPing.sentAt }));
    } catch {
      this.forceReconnect(1006, "send failed");
      return;
    }
    if (this.pongTimer !== null) clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => this.onPongTimeout(), this.o.pongTimeoutMs);
  }

  private onMessage(ev: MessageEvent): void {
    let msg: { type?: string; nonce?: string; ledger?: string } | undefined;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)) as typeof msg;
    } catch {
      return;
    }
    if (msg === undefined) return;
    if (msg.type === "pong") {
      if (this.pendingPing !== null && msg.nonce === this.pendingPing.nonce) {
        this.rttMs = this.now() - this.pendingPing.sentAt;
        this.pendingPing = null;
        if (this.pongTimer !== null) clearTimeout(this.pongTimer);
        this.pongTimer = null;
        if (this.graceTimer !== null) {
          clearTimeout(this.graceTimer); // recovered from STALE
          this.graceTimer = null;
        }
        this.setState("alive");
      }
      return;
    }
    if (msg.type === "changed") {
      this.onChanged(msg.ledger ?? null);
    }
  }

  private onPongTimeout(): void {
    if (this.destroyed || this.state !== "alive") return;
    // Heartbeat missed → STALE, with a grace window to recover (R2/R6-lite).
    this.setState("stale");
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.forceReconnect(1006, "heartbeat timeout");
    }, this.o.staleGraceMs);
  }

  /** Tear the socket down and reconnect with backoff. */
  private forceReconnect(code: number, reason: string): void {
    this.handleClose(code, reason);
  }

  private handleClose(code: number, reason: string): void {
    this.clearConn();
    this.lastCloseCode = code;
    this.lastCloseReason = reason;
    if (this.destroyed) return;
    if (NON_RETRIABLE.has(code)) {
      this.isTerminal = true;
      this.setState("terminal");
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.attempt >= this.o.maxAttempts) {
      this.isTerminal = true;
      this.nextRetryAt = null;
      this.setState("terminal"); // R13 — stop and surface, don't retry forever
      return;
    }
    this.setState("dead");
    const exp = Math.min(this.o.maxBackoffMs, this.o.baseBackoffMs * 2 ** this.attempt);
    const delay = exp * (0.5 + Math.random() * 0.5); // full jitter (R5)
    this.attempt += 1;
    this.nextRetryAt = this.now() + delay;
    this.onUpdate?.(this.getStats());
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // ---- time-jump detector (R8) ------------------------------------------

  private onTick(): void {
    if (this.destroyed) return;
    const t = this.now();
    const elapsed = t - this.lastTickAt;
    this.lastTickAt = t;
    if (elapsed > TICK_MS + JUMP_THRESHOLD_MS) {
      // Suspended/resumed (sleep, freeze, debugger). NAT/TCP state is likely
      // gone and no close will fire — reconnect proactively rather than wait
      // out the pong timeout.
      if (this.state === "alive" || this.state === "stale") this.forceReconnect(1006, "resume after pause");
      else if (this.state === "dead" && this.reconnectTimer !== null) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.connect();
      }
    }
  }

  /** Public hook: ask the manager to re-check liveness now (e.g. tab visible). */
  poke(): void {
    if (this.destroyed) return;
    if (this.state === "alive") this.sendPing();
    else if (this.state === "dead" && this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.connect();
    }
  }

  private clearConn(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    if (this.pongTimer !== null) clearTimeout(this.pongTimer);
    if (this.graceTimer !== null) clearTimeout(this.graceTimer);
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    this.pingTimer = null;
    this.pongTimer = null;
    this.graceTimer = null;
    this.connectTimer = null;
    this.pendingPing = null;
    if (this.ws !== null) {
      const ws = this.ws;
      this.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }
}
