// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Dumps every filter combination the screens can produce into one JSON payload, so
// a static copy of the dashboard shows the numbers the app itself computes rather
// than a second implementation of the same math.
//
// Run: npx tsx scripts/dump-static.ts out.json [--pretty]
import { writeFileSync } from "node:fs";
import { getDashboardData } from "../lib/kpis";
import { getRecovery } from "../lib/recovery";

const out = process.argv[2];
if (!out) {
  console.error("usage: npx tsx scripts/dump-static.ts <out.json> [--pretty]");
  process.exit(1);
}
const pretty = process.argv.includes("--pretty");

const base = getDashboardData({});
const stores: (string | null)[] = [null, ...base.rooftops.map((r) => r.id)];
const leadTypes: (string | null)[] = [null, ...base.leadTypes];
const years = [1, 2, 3];

// "*" stands in for "no filter" so the key is a plain string on the static side.
const kpis: Record<string, unknown> = {};
const recovery: Record<string, unknown> = {};
for (const store of stores) {
  for (const leadType of leadTypes) {
    for (const y of years) {
      const key = `${store ?? "*"}|${leadType ?? "*"}|${y}`;
      kpis[key] = getDashboardData({ store, leadType, years: y });
      recovery[key] = getRecovery({ store, leadType, years: y });
    }
  }
}

const payload = {
  rooftops: base.rooftops,
  leadTypes: base.leadTypes,
  groupName: base.groupName,
  kpis,
  recovery,
};
writeFileSync(out, JSON.stringify(payload, null, pretty ? 1 : undefined));
console.log(
  `wrote ${out}: ${Object.keys(kpis).length} combinations ` +
    `(${stores.length} stores x ${leadTypes.length} lead types x ${years.length} windows)`
);
