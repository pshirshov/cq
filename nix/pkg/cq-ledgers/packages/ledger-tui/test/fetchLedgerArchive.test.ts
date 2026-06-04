/**
 * Integration test for McpLedgerClient.fetchLedgerArchive (T29).
 *
 * Seeds an archive via the in-process FsLedgerStore (write path), then
 * exercises the read path through the MCP client's fetchLedgerArchive method.
 * Uses the TUI's McpLedgerClient.embedded so no subprocess or socket is
 * needed.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { FsLedgerStore } from "@cq/ledger";
import { McpLedgerClient } from "../src/mcpClient.js";

let tmpRoot: string;
let client: McpLedgerClient;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ledger-archive-test-"));

  // Seed via a standalone FsLedgerStore (write path outside the client).
  const seed = new FsLedgerStore({ root: tmpRoot });
  await seed.init();
  await seed.createLedger("jobs", {
    statusValues: ["planned", "done"],
    terminalStatuses: ["done"],
    fields: { headline: { type: "string", required: true } },
    idPrefix: "J",
  });
  const ms = await seed.createMilestone({ id: "M50", title: "archive-test-milestone" });
  const created = await seed.createItem("jobs", ms.id, {
    status: "planned",
    fields: { headline: "first task" },
  });
  // Transition to terminal so the milestone can be archived.
  await seed.updateItem("jobs", created.id, { status: "done" });
  await seed.updateMilestone("M50", { status: "done" });
  await seed.archiveMilestone("M50", "archived for T29 test");
  await seed.dispose();

  client = await McpLedgerClient.embedded(tmpRoot);
});

afterAll(async () => {
  await client.close();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("McpLedgerClient.fetchLedgerArchive (T29)", () => {
  it("fetchLedger returns an archivePointer for the archived milestone", async () => {
    const ledger = await client.fetchLedger("jobs");
    expect(ledger.archivePointers).toHaveLength(1);
    expect(ledger.archivePointers[0]!.id).toBe("M50");
  });

  it("fetchLedgerArchive returns a group archive for a non-milestones ledger", async () => {
    const archive = await client.fetchLedgerArchive("jobs", "M50");
    expect(archive.kind).toBe("group");
    if (archive.kind === "group") {
      expect(archive.milestone.id).toBe("M50");
      expect(archive.milestone.items).toHaveLength(1);
      expect(archive.milestone.items[0]!.fields["headline"]).toBe("first task");
    }
  });

  it("fetchLedgerArchive returns an item archive for the milestones ledger", async () => {
    const archive = await client.fetchLedgerArchive("milestones", "M50");
    expect(archive.kind).toBe("item");
    if (archive.kind === "item") {
      expect(archive.item.id).toBe("M50");
      expect(archive.item.fields["title"]).toBe("archive-test-milestone");
    }
  });
});
