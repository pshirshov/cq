/**
 * T362 smoke: `cq advance-gate` emits the neutral verdict JSON + allow/block
 * exit code. The COMPREHENSIVE verdict matrix is T367; this only smoke-checks
 * the four state branches end-to-end through `dispatch`.
 */

import { describe, it, expect, afterAll, beforeEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { dispatch, type ConfirmIo, type DispatchIo } from "../src/main.js";
import { EXIT_ALLOW, EXIT_BLOCK, type AdvanceGateVerdict } from "../src/advanceGate.js";
import { FsLedgerStore, MILESTONES_AMBIENT_ID } from "@cq/ledger";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => undefined);
});

const silentConfirm: ConfirmIo = {
  isTty: false,
  out: () => {},
  err: () => {},
  prompt: async () => "",
};

function recordingIo(): DispatchIo & { outs: string[] } {
  const outs: string[] = [];
  return { outs, out: (l) => outs.push(l), err: () => {}, confirm: silentConfirm };
}

async function makeTmpDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

const SESSION_ID = "advance-gate-smoke-session";

function markerFile(runtimeDir: string): string {
  return path.join(runtimeDir, `cq-advance-active-${SESSION_ID}`);
}

let runtimeDir: string;
let prevXdg: string | undefined;
beforeEach(async () => {
  // Point the marker dir at a temp dir so the smoke test never collides with a
  // real /cq:advance run on the host.
  runtimeDir = await makeTmpDir("cq-gate-rt-");
  prevXdg = process.env["XDG_RUNTIME_DIR"];
  process.env["XDG_RUNTIME_DIR"] = runtimeDir;
});
afterAll(() => {
  if (prevXdg === undefined) delete process.env["XDG_RUNTIME_DIR"];
  else process.env["XDG_RUNTIME_DIR"] = prevXdg;
});

function parseVerdict(io: { outs: string[] }): AdvanceGateVerdict {
  expect(io.outs.length).toBe(1);
  return JSON.parse(io.outs[0]!) as AdvanceGateVerdict;
}

describe("cq advance-gate", () => {
  it("marker ABSENT → allow (exit 0), ledger not consulted", async () => {
    const root = await makeTmpDir("cq-gate-ledger-");
    const io = recordingIo();
    const outcome = await dispatch(["advance-gate", "--cwd", root, "--session", SESSION_ID], io);
    expect(outcome.exitCode).toBe(EXIT_ALLOW);
    const v = parseVerdict(io);
    expect(v.block).toBe(false);
    expect(v.predicates.pInvestigate.value).toBe(false);
  });

  it("marker PRESENT + predicate TRUE → block (non-zero)", async () => {
    const root = await makeTmpDir("cq-gate-ledger-");
    // Seed an ACTIONABLE defect → P-investigate TRUE.
    const store = new FsLedgerStore({ root });
    await store.init();
    await store.createItem("defects", MILESTONES_AMBIENT_ID, {
      status: "open",
      fields: { headline: "a real defect", severity: "high" },
    });
    await store.dispose();

    await writeFile(markerFile(runtimeDir), "started\n", "utf8");

    const io = recordingIo();
    const outcome = await dispatch(["advance-gate", "--cwd", root, "--session", SESSION_ID], io);
    expect(outcome.exitCode).toBe(EXIT_BLOCK);
    const v = parseVerdict(io);
    expect(v.block).toBe(true);
    expect(v.reason).toContain("P-investigate=TRUE");
    expect(v.predicates.pInvestigate.value).toBe(true);
  });

  it("marker PRESENT + external-signal → allow (exit 0), even with a TRUE predicate", async () => {
    const root = await makeTmpDir("cq-gate-ledger-");
    const store = new FsLedgerStore({ root });
    await store.init();
    await store.createItem("defects", MILESTONES_AMBIENT_ID, {
      status: "open",
      fields: { headline: "a real defect", severity: "high" },
    });
    await store.dispose();

    await writeFile(markerFile(runtimeDir), 'external-signal: "user-interrupt"\n', "utf8");

    const io = recordingIo();
    const outcome = await dispatch(["advance-gate", "--cwd", root, "--session", SESSION_ID], io);
    expect(outcome.exitCode).toBe(EXIT_ALLOW);
    expect(parseVerdict(io).block).toBe(false);
  });

  it("marker PRESENT + all predicates FALSE → allow (exit 0)", async () => {
    const root = await makeTmpDir("cq-gate-ledger-");
    const store = new FsLedgerStore({ root });
    await store.init();
    await store.dispose();

    await writeFile(markerFile(runtimeDir), "started\n", "utf8");

    const io = recordingIo();
    const outcome = await dispatch(["advance-gate", "--cwd", root, "--session", SESSION_ID], io);
    expect(outcome.exitCode).toBe(EXIT_ALLOW);
    expect(parseVerdict(io).block).toBe(false);
  });
});
