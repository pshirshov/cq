import type { Logger } from "./log/logger";
import indexHtml from "../../web/index.html" with { type: "html" };
import { WsSession, type WsSessionData } from "./ws/session";
import { isOriginAllowed } from "./ws/origin";

export type DevServerConfig = Readonly<{
  host: string;
  port: number;
  cwd: string;
  dbPath: string;
  logger: Logger;
}>;

export type RunningDevServer = {
  stop(): void | Promise<void>;
  readonly url: URL;
  readonly development: boolean;
};

/**
 * Injectable serve function type — matches the Bun.serve signature for our use.
 * The default is Bun.serve. Tests may inject a stub to capture options.
 */
export type ServeFunction = typeof Bun.serve;

export function startDevServer(
  config: DevServerConfig,
  serve: ServeFunction = Bun.serve,
): RunningDevServer {
  const { host, port, cwd, dbPath, logger } = config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = (serve as (opts: any) => ReturnType<typeof Bun.serve>)({
    hostname: host,
    port,
    development: { hmr: true, console: true },
    routes: {
      "/": indexHtml,
    },
    fetch(req: Request, srv: { upgrade(req: Request, opts: { data: WsSessionData }): boolean }) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (!isOriginAllowed(req, host, port)) {
          logger.info("ws.origin_rejected", {
            origin: req.headers.get("Origin") ?? "(none)",
            host,
            port,
          });
          return new Response(null, { status: 403 });
        }

        const sessionId = crypto.randomUUID();
        const session = new WsSession(sessionId, logger);
        const upgraded = srv.upgrade(req, { data: { sessionId, session } });
        if (!upgraded) {
          return new Response("Upgrade required", { status: 426 });
        }
        return undefined;
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: { data: WsSessionData; send(d: string): void; close(c?: number, r?: string): void }) {
        ws.data.session.open(ws);
      },
      message(ws: { data: WsSessionData; send(d: string): void; close(c?: number, r?: string): void }, raw: string | Buffer) {
        ws.data.session.message(ws, raw);
      },
      close(ws: { data: WsSessionData; send(d: string): void; close(c?: number, r?: string): void }, code: number, reason: string) {
        ws.data.session.close(ws, code, reason);
      },
    },
  });

  logger.info("cq dev listening", { host, port, cwd, dbPath, hmr: true });

  return {
    stop() {
      return server.stop();
    },
    get url() {
      return server.url;
    },
    get development() {
      return server.development;
    },
  };
}
