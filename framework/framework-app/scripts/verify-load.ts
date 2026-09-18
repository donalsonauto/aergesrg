// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Check the loaded DB against demo-data/expected-results.json (scenario fixtures).
// Run: npx tsx scripts/verify-load.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../lib/db";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const exp = JSON.parse(readFileSync(join(ROOT, "demo-data", "expected-results.json"), "utf8"));
const db = getDb();
const GROUP = "summit-auto-group";
let fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fail++;
};

// row counts
const leadRows = (db.prepare(`SELECT COUNT(*) n FROM fact_leads`).get() as any).n;
check("leads rows", leadRows === exp.rows.leads_monthly, `${leadRows} vs ${exp.rows.leads_monthly}`);
const invRows = (db.prepare(`SELECT COUNT(*) n FROM fact_inventory`).get() as any).n;
check("inventory rows", invRows === exp.rows.inventory_monthly, `${invRows} vs ${exp.rows.inventory_monthly}`);
const spendRows = (db.prepare(`SELECT COUNT(*) n FROM fact_spend`).get() as any).n;
check("spend rows", spendRows === exp.rows.spend_monthly, `${spendRows} vs ${exp.rows.spend_monthly}`);
const ga4Rows = (db.prepare(`SELECT COUNT(*) n FROM fact_ga4`).get() as any).n;
check("ga4 rows", ga4Rows === exp.rows.ga4_channels, `${ga4Rows} vs ${exp.rows.ga4_channels}`);

// sources
const canon = (db.prepare(`SELECT COUNT(*) n FROM source`).get() as any).n;
check("canonical sources", canon === exp.canonical_sources, `${canon} vs ${exp.canonical_sources}`);
const aliases = (db.prepare(`SELECT COUNT(*) n FROM source_alias`).get() as any).n;
check("raw spellings", aliases === exp.raw_source_spellings, `${aliases} vs ${exp.raw_source_spellings}`);

const M = exp.analysis_month;
const g = db.prepare(
  `SELECT SUM(sales) s, SUM(leads) l, SUM(gross) gr FROM fact_leads f
   JOIN dealership d ON d.id=f.dealership_id WHERE d.group_id=? AND f.period=?`
).get(GROUP, M) as any;
check("group latest leads", g.l === exp.group_latest_month.leads, `${g.l} vs ${exp.group_latest_month.leads}`);
check("group latest sales", g.s === exp.group_latest_month.sales, `${g.s} vs ${exp.group_latest_month.sales}`);
check("group latest gross", g.gr === exp.group_latest_month.gross, `${g.gr} vs ${exp.group_latest_month.gross}`);
const gcr = (g.s / g.l) * 100;
check("group latest closing% (SUM/SUM)", Math.abs(gcr - exp.group_latest_month.closing_ratio_pct) < 0.001,
  `${gcr.toFixed(4)} vs ${exp.group_latest_month.closing_ratio_pct}`);

// per store
let storeFails = 0;
for (const [name, e] of Object.entries<any>(exp.stores_latest_month)) {
  const id = (db.prepare(`SELECT id FROM dealership WHERE name=?`).get(name) as any)?.id;
  const r = db.prepare(
    `SELECT SUM(sales) s, SUM(leads) l, SUM(gross) gr FROM fact_leads f WHERE f.dealership_id=? AND f.period=?`
  ).get(id, M) as any;
  const cr = (r.s / r.l) * 100;
  const ok = r.l === e.leads && r.s === e.sales && r.gr === e.gross && Math.abs(cr - e.closing_ratio_pct) < 0.001;
  if (!ok) { storeFails++; console.log(`      MISMATCH ${name}: db ${r.l}/${r.s}/${r.gr}/${cr.toFixed(4)} vs exp ${e.leads}/${e.sales}/${e.gross}/${e.closing_ratio_pct}`); }
}
check("all 12 stores latest month (leads/sales/gross/closing)", storeFails === 0, `${12 - storeFails}/12 match`);

console.log(`\n${fail === 0 ? "LOAD VERIFIED against expected-results.json" : fail + " MISMATCH(ES)"}`);
process.exit(fail === 0 ? 0 : 1);
