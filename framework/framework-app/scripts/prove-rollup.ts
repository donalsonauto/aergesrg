// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Proof that "All Stores" is built by SUMMING the rooftops and recomputing the
// ratio, never by averaging their ratios. For one month it prints the group
// closing ratio and all twelve rooftop ratios, then asserts the group number
// equals SUM(sales)/SUM(leads) and does NOT equal the mean of the store ratios.
//
// It checks the ACTUAL production paths the UI uses: the KPI-card path
// (getDashboardData with the rooftop filter) and the drill path (drillTimeline).
// Run: npx tsx scripts/prove-rollup.ts [YYYY-MM]
import { getDb } from "../lib/db";
import { drillTimeline } from "../lib/queries";
import { getDashboardData } from "../lib/kpis";
import { formatPercent } from "../lib/format";

const db = getDb();
const GROUP = "summit-auto-group";

// Month to prove on: CLI arg, else the latest month where all rooftops report.
const rooftops = db
  .prepare(`SELECT id, name FROM dealership WHERE group_id = ? ORDER BY name`)
  .all(GROUP) as { id: string; name: string }[];
const M =
  process.argv[2] ??
  (
    db
      .prepare(
        `SELECT period FROM (
           SELECT f.period, COUNT(DISTINCT f.dealership_id) n FROM fact_leads f
           JOIN dealership d ON d.id = f.dealership_id WHERE d.group_id = ?
           GROUP BY f.period) WHERE n = ? ORDER BY period DESC LIMIT 1`
      )
      .get(GROUP, rooftops.length) as { period: string }
  ).period;

// Ground truth straight from the summed rows.
const g = db
  .prepare(`SELECT SUM(sales) s, SUM(leads) l FROM fact_leads f
            JOIN dealership d ON d.id=f.dealership_id WHERE d.group_id=? AND f.period=?`)
  .get(GROUP, M) as { s: number; l: number };
const groupCR_sum = (g.s / g.l) * 100;

const perStore = rooftops.map((r) => {
  const row = db
    .prepare(`SELECT SUM(sales) s, SUM(leads) l FROM fact_leads f
              JOIN dealership d ON d.id=f.dealership_id WHERE d.id=? AND f.period=?`)
    .get(r.id, M) as { s: number; l: number };
  const cr = row.l > 0 ? (row.s / row.l) * 100 : null;
  // production drill path for this rooftop/month:
  const prod = (drillTimeline("closing_ratio", { store: r.id, from: M, to: M })[0] as any)?.value ?? null;
  return { name: r.name, sales: row.s, leads: row.l, cr, prod };
});
const groupCR_avg =
  perStore.reduce((a, s) => a + (s.cr ?? 0), 0) / perStore.filter((s) => s.cr != null).length;

// Production paths at the group level.
const groupCR_drill = (drillTimeline("closing_ratio", { from: M, to: M })[0] as any).value;
const cardValue = getDashboardData({ years: 1 }).cards.find((c) => c.key === "closing")!.value;
// Note: the card headlines the latest month; this proof is meaningful when M is
// that latest month (the default). We still assert the card equals SUM/SUM below.

// ---- table ----
console.log(`\nClosing ratio for ${M}  (sales / leads)\n`);
const pad = (s: string, n: number) => s.padEnd(n);
const padL = (s: string, n: number) => s.padStart(n);
console.log("  " + pad("rooftop", 30) + padL("sales", 7) + padL("leads", 8) + padL("ratio", 9) + padL("via drill", 11));
console.log("  " + "-".repeat(65));
for (const s of perStore) {
  console.log(
    "  " + pad(s.name, 30) + padL(String(s.sales), 7) + padL(String(s.leads), 8) +
      padL(s.cr == null ? "-" : s.cr.toFixed(1) + "%", 9) +
      padL(s.prod == null ? "-" : s.prod.toFixed(1) + "%", 11)
  );
}
console.log("  " + "-".repeat(65));
console.log("  " + pad("GROUP  (sum then divide)", 30) + padL(String(g.s), 7) + padL(String(g.l), 8) + padL(groupCR_sum.toFixed(1) + "%", 9));
console.log("  " + pad("if we averaged the ratios", 30) + padL("", 7) + padL("", 8) + padL(groupCR_avg.toFixed(1) + "%", 9) + "   <- WRONG");

// ---- assertions ----
const near = (a: number, b: number, e = 1e-4) => Math.abs(a - b) <= e;
const salesAdd = perStore.reduce((a, s) => a + s.sales, 0);
const leadsAdd = perStore.reduce((a, s) => a + s.leads, 0);

const checks: [string, boolean, string][] = [
  ["group is additive: sum of rooftop sales/leads = group total",
    salesAdd === g.s && leadsAdd === g.l, `stores sum=${salesAdd}/${leadsAdd}, group=${g.s}/${g.l}`],
  ["group ratio == SUM(sales)/SUM(leads)", near(groupCR_drill, groupCR_sum),
    `drill=${groupCR_drill.toFixed(3)}% vs SUM/SUM=${groupCR_sum.toFixed(3)}%`],
  ["group ratio != average of the 12 rooftop ratios", !near(groupCR_sum, groupCR_avg, 0.05),
    `SUM/SUM=${groupCR_sum.toFixed(2)}% vs avg=${groupCR_avg.toFixed(2)}% (gap ${(groupCR_sum - groupCR_avg).toFixed(2)}pp)`],
  ["on-screen All-Stores closing card == formatted SUM/SUM", cardValue === formatPercent(groupCR_sum),
    `card="${cardValue}", SUM/SUM="${formatPercent(groupCR_sum)}"`],
];

console.log("\nAssertions");
let fail = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}\n         ${detail}`);
  if (!ok) fail++;
}
console.log(`\n${fail === 0 ? "PROVEN: All Stores is sum-based, not averaged." : fail + " assertion(s) failed"}`);
process.exit(fail === 0 ? 0 : 1);
