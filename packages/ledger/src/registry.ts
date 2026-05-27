/**
 * Registry — read/write of `./docs/ledgers.yaml`.
 *
 * v1 schema:
 *   version: 1
 *   ledgers:
 *     - name: <string>
 *       schema:
 *         statusValues: [...]
 *         terminalStatuses: [...]
 *         fields:
 *           <name>:
 *             type: <FieldType>
 *             required: <bool>
 */

import YAML from "yaml";
import type {
  FieldSpec,
  FieldType,
  LedgerRegistry,
  LedgerRegistryEntry,
  LedgerSchema,
} from "./types.js";
import { SchemaValidationError } from "./types.js";

const FIELD_TYPES: ReadonlyArray<FieldType> = [
  "string",
  "string[]",
  "id",
  "id[]",
  "timestamp",
];

export function parseRegistry(yamlText: string): LedgerRegistry {
  let raw: unknown;
  try {
    raw = YAML.parse(yamlText);
  } catch (e) {
    throw new SchemaValidationError(`ledgers.yaml is not valid YAML: ${(e as Error).message}`);
  }
  if (raw === null || typeof raw !== "object") {
    // Tolerate an empty file by treating it as a fresh registry.
    if (raw === null || raw === undefined) {
      return { version: 1, ledgers: [] };
    }
    throw new SchemaValidationError("ledgers.yaml is not a map");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["version"] !== 1) {
    throw new SchemaValidationError(`unsupported ledgers.yaml version: ${String(obj["version"])}`);
  }
  const ledgersRaw = obj["ledgers"];
  const ledgers: LedgerRegistryEntry[] = [];
  if (Array.isArray(ledgersRaw)) {
    for (const entry of ledgersRaw) {
      ledgers.push(parseEntry(entry));
    }
  } else if (ledgersRaw !== undefined && ledgersRaw !== null) {
    throw new SchemaValidationError("ledgers.yaml: ledgers must be an array");
  }
  return { version: 1, ledgers };
}

function parseEntry(raw: unknown): LedgerRegistryEntry {
  if (raw === null || typeof raw !== "object") {
    throw new SchemaValidationError("ledger entry must be a map");
  }
  const e = raw as Record<string, unknown>;
  const name = e["name"];
  if (typeof name !== "string" || name.length === 0) {
    throw new SchemaValidationError("ledger entry.name must be a non-empty string");
  }
  return { name, schema: parseSchema(e["schema"]) };
}

export function parseSchema(raw: unknown): LedgerSchema {
  if (raw === null || typeof raw !== "object") {
    throw new SchemaValidationError("schema must be a map");
  }
  const s = raw as Record<string, unknown>;
  const statusValues = s["statusValues"];
  if (!Array.isArray(statusValues) || statusValues.some((v) => typeof v !== "string")) {
    throw new SchemaValidationError("schema.statusValues must be string[]");
  }
  const terminalStatuses = s["terminalStatuses"];
  if (
    !Array.isArray(terminalStatuses) ||
    terminalStatuses.some((v) => typeof v !== "string")
  ) {
    throw new SchemaValidationError("schema.terminalStatuses must be string[]");
  }
  const sv = statusValues as string[];
  const ts = terminalStatuses as string[];
  for (const t of ts) {
    if (!sv.includes(t)) {
      throw new SchemaValidationError(
        `schema.terminalStatuses entry "${t}" is not in statusValues`,
      );
    }
  }
  const fieldsRaw = s["fields"];
  const fields: Record<string, FieldSpec> = {};
  if (fieldsRaw !== undefined && fieldsRaw !== null) {
    if (typeof fieldsRaw !== "object") {
      throw new SchemaValidationError("schema.fields must be a map");
    }
    for (const [key, val] of Object.entries(fieldsRaw as Record<string, unknown>)) {
      fields[key] = parseFieldSpec(key, val);
    }
  }
  return { statusValues: sv, terminalStatuses: ts, fields };
}

function parseFieldSpec(name: string, raw: unknown): FieldSpec {
  if (raw === null || typeof raw !== "object") {
    throw new SchemaValidationError(`field "${name}" must be a map`);
  }
  const r = raw as Record<string, unknown>;
  const type = r["type"];
  if (typeof type !== "string" || !(FIELD_TYPES as readonly string[]).includes(type)) {
    throw new SchemaValidationError(
      `field "${name}".type must be one of ${FIELD_TYPES.join("|")}`,
    );
  }
  const required = r["required"];
  if (typeof required !== "boolean") {
    throw new SchemaValidationError(`field "${name}".required must be boolean`);
  }
  return { type: type as FieldType, required };
}

export function serializeRegistry(registry: LedgerRegistry): string {
  const obj: Record<string, unknown> = {
    version: registry.version,
    ledgers: registry.ledgers.map((e) => ({
      name: e.name,
      schema: {
        statusValues: e.schema.statusValues,
        terminalStatuses: e.schema.terminalStatuses,
        fields: Object.fromEntries(
          Object.entries(e.schema.fields).map(([k, v]) => [
            k,
            { type: v.type, required: v.required },
          ]),
        ),
      },
    })),
  };
  return YAML.stringify(obj, { lineWidth: 0 });
}

export const EMPTY_REGISTRY: LedgerRegistry = { version: 1, ledgers: [] };
