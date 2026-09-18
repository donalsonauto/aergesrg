// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Screen audit: recompute each on-screen number straight from the DB with an
// independent SQL query and assert the EXACT rendered string matches. Covers the
// home KPI cards (group + a rooftop) and the Revenue Recovery totals + a sample
// source. Run: npx tsx scripts/audit-screen.ts
import { getDb } from "../lib/db";
import { getDashboardData } from "../lib/kpis";
import { getRecovery } from "../lib/recovery";
import { formatCompactMoney, formatUnits, formatPercent } from "../lib/format";

const db = getDb();
let fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}\n         ${detail}`);
  if (!ok) fail++;
};

function currentMonthTotals(scope: { store?: string }) {
  const cond = ["d.group_id = ?"];
  const args: any[] = ["summit-auto-group"];
  if (scope.store) { cond.push("d.id = ?"); args.push(scope.store); }
  const where = cond.join(" AND ");
  const m = (db.prepare(`SELECT MAX(f.period) p FROM fact_leads f JOIN dealership d ON d.id=f.dealership_id WHERE ${where}`).get(...args) as any).p;
  const row = db.prepare(
    `SELECT SUM(sales) sales, SUM(leads) leads, SUM(gross) gross FROM fact_leads f
     JOIN dealership d ON d.id=f.dealership_id WHERE ${where} AND f.period=?`
  ).get(...args, m) as any;
  return { m, ...row, closing: (row.sales / row.leads) * 100 };
}

console.log("HOME KPI CARDS (on-screen string == DB)\n");
for (const scope of [{ label: "All Stores", store: undefined }, { label: "Summit Hyundai Oakhurst", store: "smt-hyu-oakhurst" }]) {
  const data = getDashboardData({ store: scope.store ?? null, years: 1 });
  const t = currentMonthTotals(scope);
  const card = (k: string) => data.cards.find((c) => c.key === k)!;
  check(`${scope.label}: month`, data.month === t.m, `screen ${data.month} vs db ${t.m}`);
  check(`${scope.label}: Gross card`, card("gross").value === formatCompactMoney(t.gross), `screen ${card("gross").value} vs db ${formatCompactMoney(t.gross)}`);
  check(`${scope.label}: Sales card`, card("sales").value === formatUnits(t.sales), `screen ${card("sales").value} vs db ${formatUnits(t.sales)}`);
  check(`${scope.label}: Leads card`, card("leads").value === formatUnits(t.leads), `screen ${card("leads").value} vs db ${formatUnits(t.leads)}`);
  check(`${scope.label}: Closing card`, card("closing").value === formatPercent(t.closing), `screen ${card("closing").value} vs db ${formatPercent(t.closing)}`);
}

console.log("\nREVENUE RECOVERY (on-screen string == DB)\n");
for (const scope of [{ label: "Group", store: null as string | null }, { label: "Hyundai", store: "smt-hyu-oakhurst" }]) {
  const r = getRecovery({ store: scope.store, years: 3 });
  // headline == sum of in-headline rows
  const sumRev = r.sources.filter((s) => s.inHeadline).reduce((a, s) => a + (s.estimatedMonthlyRevenue ?? 0), 0);
  check(`${scope.label}: headline card == sum of rows (formatted)`,
    formatCompactMoney(r.estMonthlyRevenue) === formatCompactMoney(sumRev),
    `card ${formatCompactMoney(r.estMonthlyRevenue)} vs rows ${formatCompactMoney(sumRev)}`);
  // dormant/declining counts == status tallies
  check(`${scope.label}: dormant/declining counts`,
    r.dormantCount === r.sources.filter((s) => s.status === "dormant").length &&
    r.decliningCount === r.sources.filter((s) => s.status === "declining").length,
    `dormant ${r.dormantCount}, declining ${r.decliningCount}`);
  // spot-check one source's totals against a direct DB sum over the same window
  const s0 = r.sources[0];
  const cond = ["d.group_id = ?", "s.canonical_name = ?", "f.period >= ?", "f.period <= ?"];
  const args: any[] = ["summit-auto-group", s0.source, r.from, r.to];
  if (scope.store) { cond.push("d.id = ?"); args.push(scope.store); }
  const dbRow = db.prepare(
    `SELECT SUM(f.sales) sales, SUM(f.gross) gross, SUM(f.leads) leads FROM fact_leads f
     JOIN dealership d ON d.id=f.dealership_id JOIN source s ON s.id=f.source_id WHERE ${cond.join(" AND ")}`
  ).get(...args) as any;
  check(`${scope.label}: "${s0.source}" totals (screen == DB)`,
    s0.totalSales === dbRow.sales && s0.totalGross === dbRow.gross && s0.totalLeads === dbRow.leads,
    `sales ${s0.totalSales}/${dbRow.sales}, gross ${s0.totalGross}/${dbRow.gross}, leads ${s0.totalLeads}/${dbRow.leads}`);
  const agps = dbRow.sales > 0 ? dbRow.gross / dbRow.sales : null;
  check(`${scope.label}: "${s0.source}" avg gross/sale`,
    (s0.avgGrossPerSale == null && agps == null) || Math.abs((s0.avgGrossPerSale ?? 0) - (agps ?? 0)) < 1e-6,
    `screen ${s0.avgGrossPerSale?.toFixed(2)} vs db ${agps?.toFixed(2)}`);
}

console.log(`\n${fail === 0 ? "SCREEN AUDIT PASSED: every checked number matches the DB." : fail + " MISMATCH(ES)"}`);
process.exit(fail === 0 ? 0 : 1);
