// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Numbers-are-right checks. Each is designed to FAIL if a specific bug were
// present. Ground truth is recomputed straight from the raw CSVs (an independent
// path), then compared against the DB and against the production read layer in
// lib/queries.ts. Run: npx tsx scripts/checks.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../lib/db";
import { kpiTimeline, sourcesForGroup } from "../lib/queries";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = join(ROOT, "demo-data");
const GROUP = "summit-auto-group";

// ---- independent raw-CSV reader (does not touch the DB) ----
function rows(file: string): Record<string, string>[] {
  const text = readFileSync(join(DEMO, file), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const head = lines[0].split(",").map((s) => s.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(",").map((s) => s.trim());
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}
const num = (s: string): number | null => (s === "" ? null : Number(s));

let failures = 0;
const log: string[] = [];
function check(name: string, pass: boolean, detail: string) {
  log.push(`  [${pass ? "PASS" : "FAIL"}] ${name}\n         ${detail}`);
  if (!pass) failures++;
}
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const db = getDb();
const leadsRaw = rows("leads_monthly.csv");

// storeName -> id, canonical name via alias map (raw, independent of load path)
const manifest = JSON.parse(readFileSync(join(DEMO, "dealer_group.json"), "utf8"));
const nameToId = new Map<string, string>(manifest.rooftops.map((r: any) => [r.store, r.store_id]));
const rawToCanon = new Map<string, string>();
for (const a of rows(join("normalization", "source_aliases.csv")))
  rawToCanon.set(a.raw_source, a.canonical_source);

// latest full month = max period where all 12 rooftops report
const perMonthStores = new Map<string, Set<string>>();
for (const r of leadsRaw) {
  if (!perMonthStores.has(r.period)) perMonthStores.set(r.period, new Set());
  perMonthStores.get(r.period)!.add(r.store);
}
const totalStores = manifest.rooftops.length;
const M = [...perMonthStores.entries()]
  .filter(([, s]) => s.size === totalStores)
  .map(([p]) => p)
  .sort()
  .at(-1)!;

console.log(`Latest full month (all ${totalStores} rooftops reporting): ${M}\n`);
console.log("CHECKS");

// =====================================================================
// CHECK 1 - group total is the SUM of stores, not the AVERAGE of stores
// =====================================================================
// Ground truth from raw CSV for month M:
let gSales = 0, gLeads = 0;
const storeSales = new Map<string, number>(), storeLeads = new Map<string, number>();
for (const r of leadsRaw) {
  if (r.period !== M) continue;
  const s = num(r.sales) ?? 0, l = num(r.leads) ?? 0;
  gSales += s; gLeads += l;
  storeSales.set(r.store, (storeSales.get(r.store) ?? 0) + s);
  storeLeads.set(r.store, (storeLeads.get(r.store) ?? 0) + l);
}
const rawGroupCR_sum = gSales / gLeads;
const perStoreCR = [...storeSales.keys()].map((s) => storeSales.get(s)! / storeLeads.get(s)!);
const rawGroupCR_avg = perStoreCR.reduce((a, b) => a + b, 0) / perStoreCR.length;

// Additivity: group SUM equals the sum of the per-store SUMs (DB), and matches raw.
const dbGSales = (db.prepare(`SELECT SUM(sales) v FROM fact_leads WHERE period=?`).get(M) as any).v;
const dbGLeads = (db.prepare(`SELECT SUM(leads) v FROM fact_leads WHERE period=?`).get(M) as any).v;
const dbStoreSum = (db.prepare(
  `SELECT SUM(s) v FROM (SELECT SUM(sales) s FROM fact_leads WHERE period=? GROUP BY dealership_id)`
).get(M) as any).v;
check(
  "group SUM(sales) == sum of per-store SUMs == raw CSV total",
  dbGSales === dbStoreSum && dbGSales === gSales,
  `db group=${dbGSales}, sum-of-stores=${dbStoreSum}, raw=${gSales}`
);

// The two methods must genuinely differ, else the check proves nothing.
check(
  "SUM/SUM and average-of-ratios are materially different numbers",
  Math.abs(rawGroupCR_sum - rawGroupCR_avg) > 0.002,
  `SUM/SUM=${(rawGroupCR_sum * 100).toFixed(2)}%  vs  avg-of-store-ratios=${(rawGroupCR_avg * 100).toFixed(2)}%`
);

// Production path (kpiTimeline) must return SUM/SUM, and NOT the average.
const prodGroupCR = (kpiTimeline("closing_ratio", { from: M, to: M })[0] as any).value;
check(
  "production group closing ratio equals SUM/SUM (not the average)",
  close(prodGroupCR, rawGroupCR_sum, 1e-4) && !close(prodGroupCR, rawGroupCR_avg, 1e-4),
  `production=${(prodGroupCR * 100).toFixed(2)}%, expected SUM/SUM=${(rawGroupCR_sum * 100).toFixed(2)}%`
);

// =====================================================================
// CHECK 2 - a missing month / empty cell is NOT treated as a zero
// =====================================================================
// 2a: empty numeric cells must be NULL in the DB, never coerced to 0.
const rawEmptyBudget = leadsRaw.filter((r) => r.budget === "").length;
const rawZeroBudget = leadsRaw.filter((r) => r.budget === "0").length;
const dbNullBudget = (db.prepare(`SELECT COUNT(*) v FROM fact_leads WHERE budget IS NULL`).get() as any).v;
const dbZeroBudget = (db.prepare(`SELECT COUNT(*) v FROM fact_leads WHERE budget = 0`).get() as any).v;
check(
  "empty budget cells preserved as NULL (not turned into 0)",
  dbNullBudget === rawEmptyBudget && dbZeroBudget === rawZeroBudget,
  `raw empties=${rawEmptyBudget} -> db NULLs=${dbNullBudget}; raw literal-0=${rawZeroBudget} -> db 0s=${dbZeroBudget}`
);

// 2b: an absent month must not appear as a fabricated data point, and a
//     no-data ratio must be NULL (not 0%). Hyundai's internet feed stops after
//     a cutover, so later months have NO rows.
const HY = "smt-hyu-oakhurst";
const rawHyPeriods = new Set(
  leadsRaw.filter((r) => r.store === "Summit Hyundai Oakhurst" && r.lead_type === "internet").map((r) => r.period)
);
const lastHyInternet = [...rawHyPeriods].sort().at(-1)!;
const hyTimeline = kpiTimeline("leads", { store: HY, leadType: "internet" }) as any[];
const fabricated = hyTimeline.filter((p) => p.period > lastHyInternet);
check(
  "absent months are not fabricated (no rows past the cutover)",
  fabricated.length === 0 && hyTimeline.every((p) => p.value > 0),
  `last internet month=${lastHyInternet}; timeline points after it=${fabricated.length}; any 0-filled=${hyTimeline.some((p) => p.value === 0)}`
);
// A month with no leads must yield a NULL closing ratio, not 0/0 -> 0%.
const gapCR = kpiTimeline("closing_ratio", { store: HY, leadType: "internet", from: "2026-01", to: "2026-01" }) as any[];
check(
  "no-data month returns NULL closing ratio, not a fabricated 0%",
  gapCR.length === 0,
  `rows returned for empty Hyundai-internet month 2026-01 = ${gapCR.length} (0 = correctly absent, not 0%)`
);

// =====================================================================
// CHECK 3 - two spellings of one source are NOT counted separately
// =====================================================================
const rawSpellings = new Set(leadsRaw.map((r) => r.source));
const dbSources = sourcesForGroup(GROUP) as any[];
check(
  "ranked list collapses to canonical sources (12), not raw spellings (33)",
  dbSources.length === new Set([...rawSpellings].map((s) => rawToCanon.get(s))).size &&
    dbSources.length < rawSpellings.size,
  `raw spellings=${rawSpellings.size}, canonical in DB list=${dbSources.length}`
);
// No canonical name may appear twice (a split source).
const dbNames = dbSources.map((r) => r.source);
check(
  "no source appears more than once in the ranked list",
  new Set(dbNames).size === dbNames.length,
  `distinct=${new Set(dbNames).size} of ${dbNames.length} rows`
);
// Autotrader: DB total must equal the sum of ALL its raw spellings from the CSV,
// scoped to this group (dbSources is group-scoped via sourcesForGroup(GROUP)).
const groupStores = new Set(
  manifest.rooftops.filter((r: any) => r.group_id === GROUP).map((r: any) => r.store)
);
const autotraderSpellings = [...rawSpellings].filter((s) => rawToCanon.get(s) === "Autotrader");
const rawAutotraderLeads = leadsRaw
  .filter((r) => rawToCanon.get(r.source) === "Autotrader" && groupStores.has(r.store))
  .reduce((a, r) => a + (num(r.leads) ?? 0), 0);
const dbAutotraderLeads = (dbSources.find((r) => r.source === "Autotrader") as any).leads;
check(
  "Autotrader = sum of ALL spellings, not just one",
  dbAutotraderLeads === rawAutotraderLeads,
  `spellings [${autotraderSpellings.join(", ")}] combined raw leads=${rawAutotraderLeads}, DB Autotrader leads=${dbAutotraderLeads}`
);

console.log(log.join("\n"));
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);

// =====================================================================
// Deliverable: group closing ratio for M, and each rooftop, side by side.
// =====================================================================
console.log(`\nClosing ratio for ${M} (sales / leads):\n`);
const perStore = db.prepare(`
  SELECT d.name, SUM(f.sales) sales, SUM(f.leads) leads,
         SUM(f.sales)*1.0/SUM(f.leads) cr
  FROM fact_leads f JOIN dealership d ON d.id=f.dealership_id
  WHERE f.period=? GROUP BY d.id ORDER BY d.name
`).all(M) as any[];
console.log("  " + "rooftop".padEnd(30) + "sales".padStart(7) + "leads".padStart(8) + "closing%".padStart(11));
console.log("  " + "-".repeat(56));
for (const r of perStore)
  console.log("  " + r.name.padEnd(30) + String(r.sales).padStart(7) + String(r.leads).padStart(8) + (r.cr * 100).toFixed(1).padStart(10) + "%");
console.log("  " + "-".repeat(56));
console.log("  " + "GROUP (sum of stores)".padEnd(30) + String(gSales).padStart(7) + String(gLeads).padStart(8) + (rawGroupCR_sum * 100).toFixed(1).padStart(10) + "%");
console.log("  " + "if averaged (WRONG)".padEnd(30) + "".padStart(7) + "".padStart(8) + (rawGroupCR_avg * 100).toFixed(1).padStart(10) + "%");

process.exit(failures === 0 ? 0 : 1);
