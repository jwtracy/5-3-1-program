import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

let instance: DB | null = null;

/**
 * Open the SQLite connection lazily — only on first query, never at import time.
 * This keeps `next build` (which imports route modules) from touching the
 * runtime database. In production the systemd unit sets DATABASE_PATH
 * (e.g. /var/lib/program-tracker/app.db); in dev it falls back to ./data/app.db.
 */
function init(): DB {
  const dbPath =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

function getDb(): DB {
  return (instance ??= init());
}

// A thin proxy so callers can keep using `db.select()...` while the underlying
// connection stays lazy. Methods are bound to the real instance so Drizzle's
// internal `this` works correctly.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
