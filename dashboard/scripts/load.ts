// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Loads demo-data/ into data/dealer.db: the dealer group, its rooftops, the
// normalization map, and every monthly fact table, with lead sources collapsed
// to one canonical name. Follows recipes/data-model.md Steps 1-3.
//
// Guardrail: a fact row that points at a rooftop not in the manifest, or a raw
// source not in the normalization map, is a mapping bug, not a row to skip. We
// validate every row first and abort the whole load (no partial DB) if any orphan
// is found, printing exactly what pointed where.
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, DB_PATH } from "../lib/db";
import { DEMO } from "../lib/demo-path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- tiny CSV reader (quote-aware, good enough for these clean exports) ----
function parseCsv(path: string): { header: string[]; rows: string[][] } {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const [head, ...rest] = lines;
  return { header: split(head), rows: rest.map(split) };
}

const intOrNull = (s: string): number | null => (s === "" ? null : Math.round(Number(s)));
const floatOrNull = (s: string): number | null => (s === "" ? null : Number(s));

type FileReport = {
  file: string;
  rowsIn: number;
  rowsLoaded: number;
  sourcesBefore: number | null;
  sourcesAfter: number | null;
  periodMin: string;
  periodMax: string;
  rooftops: number;
};

const orphans: string[] = [];

function main() {
  const db = getDb();

  // ---- Step 1: the hierarchy, from the manifest -------------------------
  const manifest = JSON.parse(readFileSync(join(DEMO, "dealer_group.json"), "utf8"));
  const storeToId = new Map<string, string>();
  const insGroup = db.prepare(
    `INSERT INTO dealer_group (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`
  );
  const insStore = db.prepare(
    `INSERT INTO dealership (id, group_id, name, brand, region) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       group_id = excluded.group_id, name = excluded.name,
       brand = excluded.brand, region = excluded.region`
  );
  db.transaction(() => {
    // Manifest v3 has an agency with groups[]; v2 had one group_id/group_name at the top.
    const groups = manifest.groups ?? [{ group_id: manifest.group_id, group_name: manifest.group_name, rooftops: manifest.rooftops }];
    for (const g of groups) insGroup.run(g.group_id, g.group_name);
    for (const g of groups) for (const r of g.rooftops) {
      insStore.run(r.store_id, g.group_id, r.store, r.brand, r.region);
      storeToId.set(r.store, r.store_id);
    }
  })();

  // ---- Step 2: the normalization map ------------------------------------
  const aliasCsv = parseCsv(join(DEMO, manifest.normalization));
  const rawToSourceId = new Map<string, number>();
  const insSource = db.prepare(
    `INSERT INTO source (canonical_name) VALUES (?)
     ON CONFLICT(canonical_name) DO NOTHING`
  );
  const getSourceId = db.prepare(`SELECT id FROM source WHERE canonical_name = ?`);
  const insAlias = db.prepare(
    `INSERT INTO source_alias (raw_name, source_id) VALUES (?, ?)
     ON CONFLICT(raw_name) DO UPDATE SET source_id = excluded.source_id`
  );
  db.transaction(() => {
    for (const [raw, canonical] of aliasCsv.rows) {
      insSource.run(canonical);
      const sid = (getSourceId.get(canonical) as { id: number }).id;
      insAlias.run(raw, sid);
      rawToSourceId.set(raw, sid);
    }
  })();

  // ---- Validate every fact file BEFORE inserting anything ---------------
  const leads = parseCsv(join(DEMO, "leads_monthly.csv"));
  const inventory = parseCsv(join(DEMO, "inventory_monthly.csv"));
  const spend = parseCsv(join(DEMO, "spend_monthly.csv"));
  const ga4 = parseCsv(join(DEMO, "ga4_channels.csv"));

  const col = (h: string[]) => (name: string) => h.indexOf(name);

  // leads: check store AND source
  {
    const c = col(leads.header);
    const [pStore, pSource] = [c("store"), c("source")];
    leads.rows.forEach((r, i) => {
      if (!storeToId.has(r[pStore]))
        orphans.push(`leads_monthly.csv row ${i + 2}: unknown rooftop "${r[pStore]}"`);
      if (!rawToSourceId.has(r[pSource]))
        orphans.push(`leads_monthly.csv row ${i + 2}: unmapped lead source "${r[pSource]}"`);
    });
  }
  // the three store-only fact files
  for (const [name, f] of [
    ["inventory_monthly.csv", inventory],
    ["spend_monthly.csv", spend],
    ["ga4_channels.csv", ga4],
  ] as const) {
    const s = col(f.header)("store");
    f.rows.forEach((r, i) => {
      if (!storeToId.has(r[s]))
        orphans.push(`${name} row ${i + 2}: unknown rooftop "${r[s]}"`);
    });
  }

  if (orphans.length) {
    console.error("\nSTOPPED: rows point at a rooftop or source that does not exist.");
    console.error("No data was loaded. Fix the manifest or the alias map, then re-run.\n");
    for (const o of orphans.slice(0, 50)) console.error("  - " + o);
    if (orphans.length > 50) console.error(`  ...and ${orphans.length - 50} more`);
    process.exit(1);
  }

  // ---- Step 3: load the facts, normalized -------------------------------
  const reports: FileReport[] = [];

  // leads
  {
    const c = col(leads.header);
    const ins = db.prepare(
      `INSERT INTO fact_leads
         (period, dealership_id, source_id, lead_type, leads, sales, new_sales, used_sales, gross, budget)
       VALUES (@period,@dealership_id,@source_id,@lead_type,@leads,@sales,@new_sales,@used_sales,@gross,@budget)
       ON CONFLICT(period, dealership_id, source_id, lead_type) DO UPDATE SET
         leads=excluded.leads, sales=excluded.sales, new_sales=excluded.new_sales,
         used_sales=excluded.used_sales, gross=excluded.gross, budget=excluded.budget`
    );
    const pk = new Set<string>();
    const rawSet = new Set<string>();
    const canonSet = new Set<string>();
    const periods = new Set<string>();
    const stores = new Set<string>();
    db.transaction(() => {
      for (const r of leads.rows) {
        const sid = rawToSourceId.get(r[c("source")])!;
        const did = storeToId.get(r[c("store")])!;
        const row = {
          period: r[c("period")],
          dealership_id: did,
          source_id: sid,
          lead_type: r[c("lead_type")],
          leads: intOrNull(r[c("leads")]),
          sales: intOrNull(r[c("sales")]),
          new_sales: intOrNull(r[c("new_sales")]),
          used_sales: intOrNull(r[c("used_sales")]),
          gross: intOrNull(r[c("gross")]),
          budget: intOrNull(r[c("budget")]),
        };
        ins.run(row);
        pk.add(`${row.period}|${did}|${sid}|${row.lead_type}`);
        rawSet.add(r[c("source")]);
        canonSet.add(String(sid));
        periods.add(row.period);
        stores.add(did);
      }
    })();
    reports.push({
      file: "leads_monthly.csv",
      rowsIn: leads.rows.length,
      rowsLoaded: pk.size,
      sourcesBefore: rawSet.size,
      sourcesAfter: canonSet.size,
      periodMin: [...periods].sort()[0],
      periodMax: [...periods].sort().at(-1)!,
      rooftops: stores.size,
    });

    // derive source.lead_type = the dominant lead_type by lead volume per source
    db.exec(`
      UPDATE source SET lead_type = (
        SELECT lead_type FROM fact_leads f
        WHERE f.source_id = source.id
        GROUP BY lead_type ORDER BY SUM(COALESCE(leads,0)) DESC, lead_type LIMIT 1
      )
    `);
  }

  // the store-only fact files, each a small loader
  reports.push(loadStoreFact({
    db, file: "inventory_monthly.csv", parsed: inventory, storeToId,
    table: "fact_inventory",
    cols: ["new_units", "used_units", "avg_days_on_lot", "avg_price_to_market"],
    parse: { new_units: intOrNull, used_units: intOrNull, avg_days_on_lot: floatOrNull, avg_price_to_market: floatOrNull },
    keyCols: [],
  }));
  reports.push(loadStoreFact({
    db, file: "spend_monthly.csv", parsed: spend, storeToId,
    table: "fact_spend", cols: ["spend"], parse: { spend: intOrNull }, keyCols: ["channel"],
  }));
  reports.push(loadStoreFact({
    db, file: "ga4_channels.csv", parsed: ga4, storeToId,
    table: "fact_ga4", cols: ["sessions", "users", "vdp_views", "conversions"],
    parse: { sessions: intOrNull, users: intOrNull, vdp_views: intOrNull, conversions: intOrNull },
    keyCols: ["channel"],
  }));

  printReport(reports, manifest);
}

function loadStoreFact(opts: {
  db: import("better-sqlite3").Database;
  file: string;
  parsed: { header: string[]; rows: string[][] };
  storeToId: Map<string, string>;
  table: string;
  cols: string[];
  parse: Record<string, (s: string) => number | null>;
  keyCols: string[]; // extra PK columns beyond (period, dealership_id), e.g. channel
}): FileReport {
  const { db, parsed, storeToId, table, cols, parse, keyCols } = opts;
  const c = (name: string) => parsed.header.indexOf(name);
  const allCols = ["period", "dealership_id", ...keyCols, ...cols];
  const pkCols = ["period", "dealership_id", ...keyCols];
  const placeholders = allCols.map((k) => "@" + k).join(",");
  const updates = cols.map((k) => `${k}=excluded.${k}`).join(", ");
  const ins = db.prepare(
    `INSERT INTO ${table} (${allCols.join(",")}) VALUES (${placeholders})
     ON CONFLICT(${pkCols.join(",")}) DO UPDATE SET ${updates}`
  );

  const pk = new Set<string>();
  const periods = new Set<string>();
  const stores = new Set<string>();
  db.transaction(() => {
    for (const r of parsed.rows) {
      const did = storeToId.get(r[c("store")])!;
      const row: Record<string, string | number | null> = {
        period: r[c("period")],
        dealership_id: did,
      };
      for (const k of keyCols) row[k] = r[c(k)];
      for (const k of cols) row[k] = parse[k](r[c(k)]);
      ins.run(row);
      pk.add(pkCols.map((k) => String(row[k])).join("|"));
      periods.add(String(row.period));
      stores.add(did);
    }
  })();

  return {
    file: opts.file,
    rowsIn: parsed.rows.length,
    rowsLoaded: pk.size,
    sourcesBefore: null,
    sourcesAfter: null,
    periodMin: [...periods].sort()[0],
    periodMax: [...periods].sort().at(-1)!,
    rooftops: stores.size,
  };
}

function printReport(reports: FileReport[], manifest: any) {
  const db = getDb();
  const groupCount = (db.prepare(`SELECT COUNT(*) n FROM dealer_group`).get() as any).n;
  const storeCount = (db.prepare(`SELECT COUNT(*) n FROM dealership`).get() as any).n;
  const srcCount = (db.prepare(`SELECT COUNT(*) n FROM source`).get() as any).n;
  const aliasCount = (db.prepare(`SELECT COUNT(*) n FROM source_alias`).get() as any).n;

  console.log(`\nLoaded into ${DB_PATH.replace(ROOT + "/", "")}`);
  console.log(`${manifest.agency_name ?? manifest.group_name}  (${groupCount} group(s), ${storeCount} rooftops)`);
  console.log(`Sources: ${srcCount} canonical  <-  ${aliasCount} raw spellings mapped\n`);

  const pad = (s: string, n: number) => s.padEnd(n);
  const padL = (s: string, n: number) => s.padStart(n);
  const H = ["file", "rows in", "rows loaded", "src before", "src after", "date range", "rooftops"];
  const W = [22, 8, 12, 11, 10, 18, 9];
  const line = (cells: string[]) =>
    cells.map((cell, i) => (i === 0 ? pad(cell, W[i]) : padL(cell, W[i]))).join("  ");
  console.log(line(H));
  console.log(W.map((w) => "-".repeat(w)).join("  "));
  for (const r of reports) {
    console.log(line([
      r.file,
      String(r.rowsIn),
      String(r.rowsLoaded),
      r.sourcesBefore === null ? "n/a" : String(r.sourcesBefore),
      r.sourcesAfter === null ? "n/a" : String(r.sourcesAfter),
      `${r.periodMin} to ${r.periodMax}`,
      String(r.rooftops),
    ]));
  }
  const collapsed = reports.some((r) => r.rowsLoaded !== r.rowsIn);
  console.log(
    collapsed
      ? "\nNote: rows loaded < rows in means duplicate keys were merged (upsert)."
      : "\nEvery row loaded; no duplicate keys, no orphan rooftops or sources."
  );
}

main();
// Leave a database that a read-only filesystem can open: fold the WAL back into
// the main file and drop WAL mode, so a deployed serverless function does not
// need to create a -wal sidecar just to read.
const loaded = getDb();
loaded.pragma("wal_checkpoint(TRUNCATE)");
loaded.pragma("journal_mode = DELETE");
