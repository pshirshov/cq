import type { Database } from "bun:sqlite";

// ---------------------------------------------------------------------------
// UiSettings — the shape stored and returned
// ---------------------------------------------------------------------------

export interface UiSettings {
  model: string | null;
  permissionMode: string | null;
  hideSdkEvents: boolean;
}

// ---------------------------------------------------------------------------
// SettingsStore — reads/writes the single ui_settings row (id=1)
// ---------------------------------------------------------------------------

type DbRow = {
  model: string | null;
  permission_mode: string | null;
  hide_sdk_events: number;
};

export class SettingsStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  get(): UiSettings {
    const row = this.db
      .query<DbRow, []>(
        "SELECT model, permission_mode, hide_sdk_events FROM ui_settings WHERE id = 1",
      )
      .get();

    if (row === null) {
      // Row should always exist (seeded by migration), but be defensive.
      return { model: null, permissionMode: null, hideSdkEvents: false };
    }

    return {
      model: row.model,
      permissionMode: row.permission_mode,
      hideSdkEvents: row.hide_sdk_events !== 0,
    };
  }

  set(patch: Partial<UiSettings>): void {
    if ("model" in patch) {
      this.db.run("UPDATE ui_settings SET model = ? WHERE id = 1", [
        patch.model ?? null,
      ]);
    }
    if ("permissionMode" in patch) {
      this.db.run("UPDATE ui_settings SET permission_mode = ? WHERE id = 1", [
        patch.permissionMode ?? null,
      ]);
    }
    if ("hideSdkEvents" in patch) {
      this.db.run("UPDATE ui_settings SET hide_sdk_events = ? WHERE id = 1", [
        patch.hideSdkEvents ? 1 : 0,
      ]);
    }
  }
}
