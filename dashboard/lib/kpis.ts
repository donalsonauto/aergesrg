// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Server-side KPI aggregation for the dashboard home, filter-aware.
//
// Every rollup SUMS the rooftops and recomputes the ratio (reference/METRICS.md);
// "All Stores" is SUM(sales)/SUM(leads), never the mean of per-store ratios. The
// same filter (rooftop, lead type, date range) drives the cards here and, through
// the same query layer, the drill-down charts and lists, so nothing can disagree.
import { getDb } from "./db";
import { formatCompactMoney, formatUnits, formatPercent } from "./format";
import type { SeriesPoint, KpiCard, DashboardData } from "./types";

const C = {
  accent: "#7c6cff",
  success: "#34d399",
  info: "#22d3ee",
  warning: "#fbbf24",
};

export type DashboardFilter = {
  groupId?: string;
  store?: string | null; // dealership id, or null/undefined for All Stores
  leadType?: string | null; // lead_type, or null/undefined for All lead types
  years?: number; // 1, 2 or 3
};

type MonthRow = { period: string; leads: number; sales: number; gross: number };

function relDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

// "2026-09" minus n months -> "YYYY-MM"
function subtractMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function getDashboardData(opts: DashboardFilter = {}): DashboardData {
  const db = getDb();
  const groupId = opts.groupId ?? "summit-auto-group";
  const store = opts.store ?? null;
  const leadType = opts.leadType ?? null;
  const years = opts.years ?? 1;

  const group = db.prepare(`SELECT name FROM dealer_group WHERE id = ?`).get(groupId) as
    | { name: string }
    | undefined;
  const rooftops = db
    .prepare(`SELECT id, name FROM dealership WHERE group_id = ? ORDER BY name`)
    .all(groupId) as { id: string; name: string }[];
  const leadTypes = (
    db
      .prepare(
        `SELECT DISTINCT f.lead_type AS t FROM fact_leads f
         JOIN dealership d ON d.id = f.dealership_id
         WHERE d.group_id = ? ORDER BY t`
      )
      .all(groupId) as { t: string }[]
  ).map((r) => r.t);

  // Scope WHERE clause shared by the "current month" and window queries.
  const cond = ["d.group_id = ?"];
  const args: (string | number)[] = [groupId];
  if (store) { cond.push("d.id = ?"); args.push(store); }
  if (leadType) { cond.push("f.lead_type = ?"); args.push(leadType); }
  const scope = cond.join(" AND ");

  const base: DashboardData = {
    groupName: group?.name ?? groupId,
    month: "-",
    priorMonth: null,
    rooftops,
    leadTypes,
    store,
    leadType,
    years,
    from: "-",
    to: "-",
    cards: [],
  };

  // Current month = the latest month with data in the current scope.
  const current = (
    db
      .prepare(
        `SELECT MAX(f.period) AS p FROM fact_leads f
         JOIN dealership d ON d.id = f.dealership_id WHERE ${scope}`
      )
      .get(...args) as { p: string | null }
  ).p;
  if (!current) return base;

  const from = subtractMonths(current, years * 12 - 1);
  const to = current;

  const window = db
    .prepare(
      `SELECT f.period AS period,
              SUM(f.leads) AS leads, SUM(f.sales) AS sales, SUM(f.gross) AS gross
       FROM fact_leads f JOIN dealership d ON d.id = f.dealership_id
       WHERE ${scope} AND f.period >= ? AND f.period <= ?
       GROUP BY f.period ORDER BY f.period`
    )
    .all(...args, from, to) as MonthRow[];

  const byPeriod = new Map(window.map((r) => [r.period, r]));
  const priorPeriod = subtractMonths(current, 1);
  const priorMonth = byPeriod.has(priorPeriod) ? priorPeriod : null;

  const derive = (r: MonthRow | undefined) =>
    r && {
      period: r.period,
      leads: r.leads,
      sales: r.sales,
      gross: r.gross,
      closing: r.leads > 0 ? (r.sales / r.leads) * 100 : null,
    };
  const cur = derive(byPeriod.get(current))!;
  const prev = priorMonth ? derive(byPeriod.get(priorMonth)) : null;

  const withDerived = window.map((r) => derive(r)!);
  const series = (pick: (r: NonNullable<ReturnType<typeof derive>>) => number | null): SeriesPoint[] =>
    withDerived.filter((r) => pick(r) != null).map((r) => ({ period: r.period, value: pick(r) as number }));

  const cards: KpiCard[] = [
    {
      key: "gross",
      label: "Gross Profit",
      value: formatCompactMoney(cur.gross),
      deltaPct: relDelta(cur.gross, prev?.gross ?? null),
      higherIsBetter: true,
      accent: true,
      color: C.accent,
      series: series((r) => r.gross),
    },
    {
      key: "sales",
      label: "Sales",
      value: formatUnits(cur.sales),
      deltaPct: relDelta(cur.sales, prev?.sales ?? null),
      higherIsBetter: true,
      accent: false,
      color: C.success,
      series: series((r) => r.sales),
    },
    {
      key: "leads",
      label: "Leads",
      value: formatUnits(cur.leads),
      deltaPct: relDelta(cur.leads, prev?.leads ?? null),
      higherIsBetter: true,
      accent: false,
      color: C.info,
      series: series((r) => r.leads),
    },
    {
      key: "closing",
      label: "Closing Ratio",
      value: formatPercent(cur.closing),
      deltaPct: relDelta(cur.closing, prev?.closing ?? null),
      higherIsBetter: true,
      accent: false,
      color: C.warning,
      series: series((r) => r.closing),
    },
  ];

  return { ...base, month: current, priorMonth, from, to, cards };
}
