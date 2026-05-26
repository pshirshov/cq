/**
 * Checks whether the `Origin` header from a WebSocket upgrade request matches
 * the server's bound host and port.
 *
 * Returns true if Origin host:port === server host:port, false otherwise
 * (including when Origin is absent).
 *
 * Rejection strategy: PR-06 rejects pre-upgrade with HTTP 403 (option A from
 * the plan).  The WS handshake never completes for bad origins; `srv.upgrade`
 * is never called.  POLICY_VIOLATION (1008) is reserved for client-side
 * close-code classification; the server never emits it for Origin failures.
 */
export function isOriginAllowed(request: Request, host: string, port: number): boolean {
  const originHeader = request.headers.get("Origin");
  if (originHeader === null || originHeader === "") {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return false;
  }

  // Strip IPv6 brackets if present (URL.hostname handles this but host may not).
  const expectedHost = host.startsWith("[") ? host.slice(1, -1) : host;

  const originHost = originUrl.hostname;
  // URL.port is "" when the port matches the scheme default.
  const originPort =
    originUrl.port !== ""
      ? Number(originUrl.port)
      : originUrl.protocol === "https:"
        ? 443
        : 80;

  return originHost === expectedHost && originPort === port;
}
