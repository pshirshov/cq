/**
 * parseArgs ledger-root resolution: --cwd > $LEDGER_ROOT > process CWD, with
 * relative values resolved against the CWD. The CWD default is what lets one
 * global install serve per-repo ledgers.
 */

import { describe, it, expect, afterEach } from "bun:test";
import * as path from "node:path";
import { parseArgs } from "../src/main.js";

const savedEnv = process.env["LEDGER_ROOT"];
afterEach(() => {
  if (savedEnv === undefined) delete process.env["LEDGER_ROOT"];
  else process.env["LEDGER_ROOT"] = savedEnv;
});

describe("parseArgs ledger-root resolution", () => {
  it("defaults to the process CWD when nothing is given", () => {
    delete process.env["LEDGER_ROOT"];
    expect(parseArgs([]).cwd).toBe(process.cwd());
  });

  it("uses $LEDGER_ROOT when set and no --cwd", () => {
    process.env["LEDGER_ROOT"] = "/srv/ledgers";
    expect(parseArgs([]).cwd).toBe("/srv/ledgers");
  });

  it("--cwd takes precedence over $LEDGER_ROOT", () => {
    process.env["LEDGER_ROOT"] = "/srv/ledgers";
    expect(parseArgs(["--cwd", "/work/repo"]).cwd).toBe("/work/repo");
  });

  it("resolves a relative --cwd against the process CWD", () => {
    delete process.env["LEDGER_ROOT"];
    expect(parseArgs(["--cwd", "sub/dir"]).cwd).toBe(path.resolve("sub/dir"));
  });

  it("keeps an absolute --cwd unchanged and still parses --http", () => {
    const a = parseArgs(["--cwd", "/abs/root", "--http", "7777"]);
    expect(a.cwd).toBe("/abs/root");
    expect(a.http).toEqual({ host: "127.0.0.1", port: 7777 });
  });

  it("no longer recognises --reset / --yes (relocated to `cq reset`, T190)", () => {
    delete process.env["LEDGER_ROOT"];
    // The reset CLI surface moved to the `cq` CLI; ParsedArgs carries only
    // {cwd, http} now. parseArgs must NOT expose reset/yes, and the unknown
    // --reset/--yes/-y tokens are ignored (root still resolves normally).
    const a = parseArgs(["--cwd", "sub/dir", "--reset", "--yes"]);
    expect(a).not.toHaveProperty("reset");
    expect(a).not.toHaveProperty("yes");
    expect(a.cwd).toBe(path.resolve("sub/dir"));
    expect(parseArgs(["--reset", "-y"])).not.toHaveProperty("yes");
  });
});
