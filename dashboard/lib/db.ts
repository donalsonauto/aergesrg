// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Opens (or creates) the one database that lives beside the app, data/dealer.db,
// runs the schema, and hands back a single shared connection. Every query in the
// app and the AI analyst chat goes through getDb(). See recipes/data-model.md.
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// Resolve from the project root (process.cwd()) so the same path works whether
// this runs under tsx (scripts) or bundled inside Next (server components/routes).
export const DB_PATH = join(process.cwd(), "data", "dealer.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const writable = new Database(DB_PATH);
    writable.pragma("journal_mode = WAL");
    writable.pragma("foreign_keys = ON");
    applySchema(writable);
    db = writable;
  } catch (err) {
    // A deployed serverless filesystem is read-only, so opening read-write throws.
    // The database was built by the prebuild step and is only ever read at runtime,
    // so fall back to a read-only handle rather than taking the whole app down.
    // If there is genuinely no database to read, the original error is the useful one.
    if (!existsSync(DB_PATH)) throw err;
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function applySchema(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS dealer_group (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dealership (
      id       TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES dealer_group(id),
      name     TEXT NOT NULL,
      brand    TEXT,
      region   TEXT
    );

    -- one row per canonical lead source
    CREATE TABLE IF NOT EXISTS source (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL UNIQUE,
      lead_type      TEXT
    );

    -- the normalization map: every raw spelling -> its canonical source
    CREATE TABLE IF NOT EXISTS source_alias (
      raw_name  TEXT PRIMARY KEY,
      source_id INTEGER NOT NULL REFERENCES source(id)
    );

    CREATE TABLE IF NOT EXISTS fact_leads (
      period        TEXT NOT NULL,
      dealership_id TEXT NOT NULL REFERENCES dealership(id),
      source_id     INTEGER NOT NULL REFERENCES source(id),
      lead_type     TEXT NOT NULL,
      leads         INTEGER,
      sales         INTEGER,
      new_sales     INTEGER,
      used_sales    INTEGER,
      gross         INTEGER,
      budget        INTEGER,
      PRIMARY KEY (period, dealership_id, source_id, lead_type)
    );

    CREATE TABLE IF NOT EXISTS fact_inventory (
      period              TEXT NOT NULL,
      dealership_id       TEXT NOT NULL REFERENCES dealership(id),
      new_units           INTEGER,
      used_units          INTEGER,
      avg_days_on_lot     REAL,
      avg_price_to_market REAL,
      PRIMARY KEY (period, dealership_id)
    );

    CREATE TABLE IF NOT EXISTS fact_spend (
      period        TEXT NOT NULL,
      dealership_id TEXT NOT NULL REFERENCES dealership(id),
      channel       TEXT NOT NULL,
      spend         INTEGER,
      PRIMARY KEY (period, dealership_id, channel)
    );

    CREATE TABLE IF NOT EXISTS fact_ga4 (
      period        TEXT NOT NULL,
      dealership_id TEXT NOT NULL REFERENCES dealership(id),
      channel       TEXT NOT NULL,
      sessions      INTEGER,
      users         INTEGER,
      vdp_views     INTEGER,
      conversions   INTEGER,
      PRIMARY KEY (period, dealership_id, channel)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_period_store ON fact_leads(period, dealership_id);
    CREATE INDEX IF NOT EXISTS idx_leads_source       ON fact_leads(source_id);
    CREATE INDEX IF NOT EXISTS idx_inv_period_store   ON fact_inventory(period, dealership_id);
    CREATE INDEX IF NOT EXISTS idx_spend_period_store ON fact_spend(period, dealership_id);
    CREATE INDEX IF NOT EXISTS idx_ga4_period_store   ON fact_ga4(period, dealership_id);
  `);
}
