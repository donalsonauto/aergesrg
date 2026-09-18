// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Revenue Recovery report + rule checks over the real DB (scenario v2).
// Prints the group headline, the biggest-recovery rooftop, which planted sources
// were found, the feed-loss finding, and asserts the class rules.
// Run: npx tsx scripts/recovery-report.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../lib/db";
import { getRecovery } from "../lib/recovery";
import { formatCompactMoney } from "../lib/format";
import { DEMO } from "../lib/demo-path";

const exp = JSON.parse(readFileSync(join(DEMO, "expected-results.json"), "utf8"));
const db = getDb();
const GROUP = "summit-auto-group";
const rooftops = db.prepare(`SELECT id, name FROM dealership WHERE group_id = ? ORDER BY name`).all(GROUP) as {
  id: string; name: string;
}[];

const money = (v: number) => formatCompactMoney(v);

function printScope(title: string, r: ReturnType<typeof getRecovery>) {
  console.log(`\n=== ${title} ===`);
  console.log(`window ${r.from}..${r.to}  |  HEADLINE ${money(r.estMonthlyRevenue)}/mo, ${r.estMonthlySales.toFixed(1)} units/mo  |  dormant ${r.dormantCount}  declining ${r.decliningCount}  feed-lost ${r.feedLostCount}`);
  for (const fl of r.feedLoss)
    console.log(`  FEED LOSS: ${fl.leadType} feed, ${fl.sourceCount} sources, first missing ${fl.firstMissingMonth}, store kept selling=${fl.storeKeptSelling} (sales ${fl.salesBefore}->${fl.salesAfter}/mo)`);
  for (const s of r.sources) {
    const est = s.status === "feed_lost" ? "FEED LOST"
      : s.status === "steady" ? "(steady)"
      : s.insufficientData ? "insufficient (<5 sales)"
      : money(s.estimatedMonthlyRevenue ?? 0);
    console.log("  " + s.source.padEnd(22) + s.status.padEnd(11) + String(s.totalSales).padStart(6) + " sales" + est.padStart(24));
  }
}

const group = getRecovery({ years: 3 });
printScope(`GROUP: ${group.scopeLabel}`, group);

const perRoof = rooftops
  .map((rf) => ({ rf, r: getRecovery({ store: rf.id, years: 3 }) }))
  .sort((a, b) => b.r.estMonthlyRevenue - a.r.estMonthlyRevenue);
printScope(`TOP ROOFTOP: ${perRoof[0].rf.name}`, perRoof[0].r);

const hy = perRoof.find((p) => p.rf.id === "smt-hyu-oakhurst")!;
printScope(`FEED-LOSS ROOFTOP: ${hy.rf.name}`, hy.r);

console.log("\n--- rooftop recovery ranking (est $/mo, feed loss excluded) ---");
for (const { rf, r } of perRoof)
  console.log("  " + rf.name.padEnd(30) + money(r.estMonthlyRevenue).padStart(9) +
    `   (dormant ${r.dormantCount}, declining ${r.decliningCount}, feed-lost ${r.feedLostCount})`);

// planted vs found (group level)
const gd = new Set(group.sources.filter((s) => s.status === "dormant").map((s) => s.source));
const gc = new Set(group.sources.filter((s) => s.status === "declining").map((s) => s.source));
console.log("\n--- planted vs found (group) ---");
console.log("  planted dormant:   ", exp.planted.dormant_group_level.join(", "));
console.log("  found dormant:     ", [...gd].sort().join(", "));
console.log("  planted declining: ", exp.planted.declining_group_level.join(", "));
console.log("  found declining:   ", [...gc].sort().join(", "));

// ---- rule checks ----
console.log("\n--- rule checks ---");
let fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}\n         ${detail}`);
  if (!ok) fail++;
};
const eqSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((x) => a.has(x));

check("group dormant set matches planted", eqSet(gd, exp.planted.dormant_group_level), `found {${[...gd].sort()}}`);
check("group declining set matches planted", eqSet(gc, exp.planted.declining_group_level), `found {${[...gc].sort()}}`);

const allScopes = [group, ...perRoof.map((p) => p.r)];
let statusExclusive = true;
for (const r of allScopes) {
  const seen = new Set<string>();
  for (const s of r.sources) { if (seen.has(s.source)) statusExclusive = false; seen.add(s.source); }
  // one status each, feed_lost never also counted as dormant/declining
  const d = r.sources.filter((s) => s.status === "dormant").length;
  const c = r.sources.filter((s) => s.status === "declining").length;
  const fl = r.sources.filter((s) => s.status === "feed_lost").length;
  const st = r.sources.filter((s) => s.status === "steady").length;
  if (d + c + fl + st !== r.sources.length) statusExclusive = false;
}
check("dormant / declining / feed_lost / steady partition every source (no double-count)", statusExclusive,
  `checked ${allScopes.length} scopes`);

for (const r of [group, hy.r]) {
  const rev = r.sources.filter((s) => s.inHeadline).reduce((a, s) => a + (s.estimatedMonthlyRevenue ?? 0), 0);
  check(`headline = sum of per-source estimates (${r.scopeLabel})`, Math.abs(rev - r.estMonthlyRevenue) < 1,
    `${money(rev)} vs ${money(r.estMonthlyRevenue)}`);
}

// feed loss: Hyundai internet, 6 sources, first missing 2025-08, none in headline
const hyFeed = hy.r.feedLoss.find((f) => f.leadType === exp.planted.feed_loss.lead_type);
check("Hyundai internet flagged as feed loss with correct first-missing month",
  !!hyFeed && hyFeed.firstMissingMonth === exp.planted.feed_loss.first_missing_month,
  `${hyFeed?.leadType} first missing ${hyFeed?.firstMissingMonth} (expected ${exp.planted.feed_loss.first_missing_month})`);
const hyFeedSrc = hy.r.sources.filter((s) => s.status === "feed_lost");
check("feed-lost sources excluded from headline and from dormant/declining counts",
  hyFeedSrc.every((s) => !s.inHeadline && s.estimatedMonthlyRevenue == null),
  `${hyFeedSrc.length} feed-lost internet sources at Hyundai, all excluded`);
check("feed loss confirming signal: store kept selling", !!hyFeed?.storeKeptSelling,
  `Walk-In-era store sales ${hyFeed?.salesBefore}->${hyFeed?.salesAfter}/mo`);

// thin source Radio Spot: per-rooftop insufficient (<5), pooled group gets an estimate
const gRadio = group.sources.find((s) => s.source === "Radio Spot")!;
const hyRadio = hy.r.sources.find((s) => s.source === "Radio Spot");
check("thin source: Radio Spot has an estimate pooled at group (18 sales)", gRadio.inHeadline && gRadio.totalSales >= 5,
  `group Radio Spot ${gRadio.totalSales} sales, est ${money(gRadio.estimatedMonthlyRevenue ?? 0)}`);
check("thin source: Radio Spot per-rooftop is insufficient (<5), no estimate",
  !hyRadio || (hyRadio.totalSales < 5 && !hyRadio.inHeadline),
  `Hyundai Radio Spot ${hyRadio?.totalSales ?? 0} sales, inHeadline=${hyRadio?.inHeadline}`);

// non-additive: sum of rooftop headlines != group headline
const sumRoof = perRoof.reduce((a, p) => a + p.r.estMonthlyRevenue, 0);
check("per-rooftop headlines are NOT additive to the group", Math.abs(sumRoof - group.estMonthlyRevenue) > 1,
  `sum of 12 rooftops ${money(sumRoof)} vs group ${money(group.estMonthlyRevenue)}`);

console.log(`\n${fail === 0 ? "ALL RULES HOLD" : fail + " rule(s) FAILED"}`);
process.exit(fail === 0 ? 0 : 1);
