/**
 * ledger-web static server test: build the bundle, serve it, and assert the
 * served index.html carries the injected MCP URL + script, the JS bundle is
 * reachable, and unknown paths fall back to index.html (SPA).
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { serve } from "../src/serve.js";

let outdir: string;
let server: ReturnType<typeof Bun.serve>;
const MCP_URL = "http://127.0.0.1:9991/mcp";

beforeAll(async () => {
  outdir = await fs.mkdtemp(path.join(os.tmpdir(), "ledger-web-"));
  server = await serve({ host: "127.0.0.1", port: 0, mcpUrl: MCP_URL, outdir });
});

afterAll(async () => {
  server.stop(true);
  await fs.rm(outdir, { recursive: true, force: true });
});

const base = (): string => `http://127.0.0.1:${server.port}`;

describe("ledger-web static server", () => {
  it("serves index.html with the injected MCP URL and module script", async () => {
    const res = await fetch(base() + "/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("__LEDGER_MCP_URL__");
    expect(html).toContain(MCP_URL);
    expect(html).toMatch(/<script type="module" src="\/main\.js">/);
  });

  it("serves the JS bundle", async () => {
    const res = await fetch(base() + "/main.js");
    expect(res.status).toBe(200);
    const js = await res.text();
    expect(js.length).toBeGreaterThan(100);
  });

  it("falls back to index.html for unknown SPA paths", async () => {
    const res = await fetch(base() + "/some/deep/route");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
  });
});
