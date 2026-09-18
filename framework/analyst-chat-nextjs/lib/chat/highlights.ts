// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type { Row } from "@/lib/data";
import { money, units, percent } from "@/lib/format";

// A plain rule engine, not a model: cheap, instant, never hallucinates.
// for each tracked metric: compare this month to last month, keep moves over
// 5%, sort by size, take five, phrase each as a question.

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

type TrackedMetric = { key: string; label: string; format: (n: number | null) => string; higherIsBetter: boolean };

const TRACKED: TrackedMetric[] = [
 { key: "leads", label: "Leads", format: units, higherIsBetter: true },
 { key: "sales", label: "Sales", format: units, higherIsBetter: true },
 { key: "gross", label: "Total gross", format: money, higherIsBetter: true },
 { key: "closing_ratio", label: "Closing ratio", format: percent, higherIsBetter: true },
 { key: "avg_gross_per_sale", label: "Avg gross per sale", format: money, higherIsBetter: true },
];

function monthAggregate(rows: Row[], period: string) {
 const at = rows.filter(r => r.period === period);
 const leads = sum(at.map(r => r.leads ?? 0));
 const sales = sum(at.map(r => r.sales ?? 0));
 const gross = sum(at.map(r => r.gross ?? 0));
 return {
 leads, sales, gross,
 closing_ratio: ratio(sales, leads) === null ? null : ratio(sales, leads)! * 100,
 avg_gross_per_sale: ratio(gross, sales),
 } as Record<string, number | null>;
}

export type Highlight = { metric: string; label: string; question: string; changePct: number };

export function computeHighlights(rows: Row[], store = "All"): Highlight[] {
 const scoped = store === "All" ? rows : rows.filter(r => r.store === store);
 const periods = [...new Set(scoped.map(r => r.period))].sort();
 if (periods.length < 2) return [];
 const current = periods.at(-1)!;
 const prior = periods.at(-2)!;
 const curVals = monthAggregate(scoped, current);
 const priorVals = monthAggregate(scoped, prior);

 const highlights: Highlight[] = [];
 for (const m of TRACKED) {
 const cur = curVals[m.key];
 const prev = priorVals[m.key];
 if (cur === null || prev === null || prev === 0) continue;
 const changePct = ((cur - prev) / Math.abs(prev)) * 100;
 if (Math.abs(changePct) <= 5) continue;
 const direction = changePct < 0 ? "dropped" : "grew";
 const verb = changePct < 0 ? "down" : "up";
 const question = `${m.label} ${direction} to ${m.format(cur)} (${verb} ${Math.abs(changePct).toFixed(0)}% from ${m.format(prev)}) - what's driving this?`;
 highlights.push({ metric: m.key, label: m.label, question, changePct });
 }
 highlights.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
 return highlights.slice(0, 5);
}

// Fallback starters when nothing moved more than 5% - the panel should never be empty.
export const GENERIC_STARTERS = [
 "Which lead source should I stop paying for?",
 "Which of our stores has the best closing ratio right now?",
 "Where is the most recoverable revenue sitting?",
];
