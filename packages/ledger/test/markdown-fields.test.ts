/**
 * Markdown field values must round-trip losslessly through
 * serialize → parse. Before the raw-source field parser, remark flattening
 * stripped inline markup and dropped multi-line block structure/blank lines;
 * these cases lock that in as fixed.
 */

import { describe, it, expect } from "bun:test";
import { serializeLedger, parseLedger } from "../src/index.js";
import type { Ledger, LedgerSchema } from "../src/index.js";

const TS = "2026-01-01T00:00:00.000Z";
const schema: LedgerSchema = {
  statusValues: ["open"],
  terminalStatuses: [],
  fields: { body: { type: "string", required: false } },
};

function roundTrip(body: string): string {
  const ledger: Ledger = {
    id: "notes",
    schema,
    counters: { milestone: 1, item: 1 },
    milestones: [
      {
        id: "M1",
        title: "",
        description: "",
        items: [{ id: "N1", milestoneId: "M1", status: "open", fields: { body }, createdAt: TS, updatedAt: TS }],
      },
    ],
    archivePointers: [],
  };
  const text = serializeLedger(ledger);
  const back = parseLedger(text, { schema });
  return back.milestones[0]!.items[0]!.fields["body"] as string;
}

describe("markdown field values round-trip", () => {
  const cases: Record<string, string> = {
    "inline emphasis mid-sentence": "fix *the* parser and **ship** it",
    "value with a colon + inline code": "Note: see **bold** and `code`",
    "markdown link": "see the [docs](https://x.test/p) page",
    "plain multi-line": "line one\nline two\nline three",
    "multi-line markdown (heading + list + fenced code)":
      "## Heading\n\n- item a\n- item b\n\n```js\nconst x = 1;\n```\n\ntail para",
    "blank lines preserved": "para one\n\npara two",
    "leading hash (atx heading char)": "# not a heading here",
    "yaml-ish reserved word": "true",
  };
  for (const [name, body] of Object.entries(cases)) {
    it(name, () => {
      expect(roundTrip(body)).toBe(body);
    });
  }
});
