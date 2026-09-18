// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// The read layer over data/dealer.db. Every rollup SUMs the components and
// recomputes the ratio in SQL (SUM(sales)*1.0/SUM(leads)); never the mean of
// per-store ratios. These same pure functions are what the dashboard renders and
// what the AI analyst chat calls as tools. See recipes/data-model.md Steps 4-5.
import { getDb } from "./db";
import type { SeriesPoint } from "./types";

export type Filter = {
  store?: string; // dealership id
  source?: string; // canonical source name
  leadType?: string;
  from?: string; // YYYY-MM inclusive
  to?: string; // YYYY-MM inclusive
};

function where(f: Filter, alias = "f"): { sql: string; args: any[] } {
  const c: string[] = [];
  const a: any[] = [];
  if (f.store) { c.push(`${alias}.dealership_id = ?`); a.push(f.store); }
  if (f.leadType) { c.push(`${alias}.lead_type = ?`); a.push(f.leadType); }
  if (f.from) { c.push(`${alias}.period >= ?`); a.push(f.from); }
  if (f.to) { c.push(`${alias}.period <= ?`); a.push(f.to); }
  return { sql: c.length ? "WHERE " + c.join(" AND ") : "", args: a };
}

// Per-source rollup for the ranked list and Revenue Recovery.
export function sourcesForGroup(groupId: string, f: Filter = {}) {
  const db = getDb();
  const w = where(f);
  const src = f.source ? " AND s.canonical_name = ?" : "";
  return db.prepare(`
    SELECT s.canonical_name AS source,
           SUM(f.leads)  AS leads,
           SUM(f.sales)  AS sales,
           SUM(f.gross)  AS gross,
           ROUND(SUM(f.sales) * 1.0 / NULLIF(SUM(f.leads), 0), 4) AS closing_ratio,
           ROUND(SUM(f.gross) * 1.0 / NULLIF(SUM(f.sales), 0), 2) AS avg_gross,
           MIN(f.period) AS first_period,
           MAX(f.period) AS last_period
    FROM fact_leads f
    JOIN source s ON s.id = f.source_id
    JOIN dealership d ON d.id = f.dealership_id
    ${w.sql}${w.sql ? " AND" : "WHERE"} d.group_id = ?${src}
    GROUP BY s.canonical_name
    ORDER BY gross DESC
  `).all(...w.args, groupId, ...(f.source ? [f.source] : []));
}

// Monthly series for a KPI trend line.
export function kpiTimeline(
  metric: "leads" | "sales" | "gross" | "closing_ratio",
  f: Filter = {}
) {
  const db = getDb();
  const w = where(f);
  const src = f.source ? " AND s.canonical_name = ?" : "";
  const expr =
    metric === "closing_ratio"
      ? "ROUND(SUM(f.sales) * 1.0 / NULLIF(SUM(f.leads), 0), 4)"
      : `SUM(f.${metric})`;
  return db.prepare(`
    SELECT f.period AS period, ${expr} AS value
    FROM fact_leads f
    JOIN source s ON s.id = f.source_id
    ${w.sql}${src}
    GROUP BY f.period
    ORDER BY f.period
  `).all(...w.args, ...(f.source ? [f.source] : []));
}

// Filter / drill-down options.
export function dealerships(groupId: string) {
  return getDb().prepare(
    `SELECT id, name, brand, region FROM dealership WHERE group_id = ? ORDER BY name`
  ).all(groupId);
}

// GA4 traffic rollup.
export function channelTraffic(f: Filter = {}) {
  const db = getDb();
  const w = where(f);
  return db.prepare(`
    SELECT f.channel AS channel,
           SUM(f.sessions)    AS sessions,
           SUM(f.users)       AS users,
           SUM(f.vdp_views)   AS vdp_views,
           SUM(f.conversions) AS conversions
    FROM fact_ga4 f
    ${w.sql}
    GROUP BY f.channel
    ORDER BY sessions DESC
  `).all(...w.args);
}

// ---------------------------------------------------------------------------
// Generic drill-down engine (recipes/dashboard.md Step 5).
//
// The whole dashboard drills through ONE pair of functions, not one handler per
// card. A drill is just: pick a metric, accumulate a scope filter as you go one
// level down (group -> rooftop -> source -> month), and ask for (a) the metric's
// monthly timeline for that scope and (b) the list of children one level below.
// Because both come from the same SUM/SUM query layer, a drilled-in number can
// never disagree with the level above it.
// ---------------------------------------------------------------------------

export type DrillMetric = "leads" | "sales" | "gross" | "closing_ratio";
export type DrillDimension = "rooftop" | "source" | "month";
export type DrillChild = { key: string; label: string; value: number | null };

// The metric expression, always summing components and recomputing the ratio.
function metricExpr(metric: DrillMetric): string {
  if (metric === "closing_ratio") return "SUM(f.sales) * 100.0 / NULLIF(SUM(f.leads), 0)";
  return `SUM(f.${metric})`;
}

// Scope = group (always) + optional rooftop + optional source + optional lead type.
// The month is never part of the scope: months are the x-axis of the timeline and
// the leaf level of the drill, so selecting one highlights a point, it does not
// filter the series.
function scope(
  groupId: string,
  f: Filter,
  needSourceJoin: boolean
): { joins: string; sql: string; args: (string | number)[] } {
  const joins = ["JOIN dealership d ON d.id = f.dealership_id"];
  if (needSourceJoin || f.source) joins.push("JOIN source s ON s.id = f.source_id");
  const c = ["d.group_id = ?"];
  const args: (string | number)[] = [groupId];
  if (f.store) { c.push("d.id = ?"); args.push(f.store); }
  if (f.source) { c.push("s.canonical_name = ?"); args.push(f.source); }
  if (f.leadType) { c.push("f.lead_type = ?"); args.push(f.leadType); }
  if (f.from) { c.push("f.period >= ?"); args.push(f.from); }
  if (f.to) { c.push("f.period <= ?"); args.push(f.to); }
  return { joins: joins.join(" "), sql: "WHERE " + c.join(" AND "), args };
}

// (a) The metric's full monthly series for the current scope.
export function drillTimeline(
  metric: DrillMetric,
  filter: Filter = {},
  groupId = "summit-auto-group"
): SeriesPoint[] {
  const s = scope(groupId, filter, false);
  return getDb()
    .prepare(
      `SELECT f.period AS period, ${metricExpr(metric)} AS value
       FROM fact_leads f ${s.joins} ${s.sql}
       GROUP BY f.period
       HAVING value IS NOT NULL
       ORDER BY f.period`
    )
    .all(...s.args) as SeriesPoint[];
}

// (b) The children one level below the current scope, with each child's metric
// value (rolled up the same way), ready to become the next drill level.
export function drillChildren(
  metric: DrillMetric,
  dimension: DrillDimension,
  filter: Filter = {},
  groupId = "summit-auto-group"
): DrillChild[] {
  const needSource = dimension === "source";
  const s = scope(groupId, filter, needSource);
  const dim =
    dimension === "rooftop"
      ? { key: "d.id", label: "d.name", group: "d.id, d.name", order: "value DESC" }
      : dimension === "source"
      ? { key: "s.canonical_name", label: "s.canonical_name", group: "s.canonical_name", order: "value DESC" }
      : { key: "f.period", label: "f.period", group: "f.period", order: "f.period ASC" };
  return getDb()
    .prepare(
      `SELECT ${dim.key} AS key, ${dim.label} AS label, ${metricExpr(metric)} AS value
       FROM fact_leads f ${s.joins} ${s.sql}
       GROUP BY ${dim.group}
       HAVING value IS NOT NULL
       ORDER BY ${dim.order}`
    )
    .all(...s.args) as DrillChild[];
}

// Paid media spend from fact_spend, scoped to a group (and optionally a store)
// the same way sourcesForGroup is. Returns per-channel spend plus the total, so
// the caller can derive cost per lead and cost per sale against the same scope.
//
// Honest scope note: fact_spend covers only the paid channels the dealer tracks
// there (this dataset carries Paid Search and Paid Social). It is not the group's
// total marketing cost, and there is no per-source budget in this data model, so
// a cost per LEAD SOURCE cannot be derived from it.
export function spendForGroup(groupId: string, f: Filter = {}) {
  const db = getDb();
  const cond = ["d.group_id = ?"];
  const args: (string | number)[] = [groupId];
  if (f.store) { cond.push("d.id = ?"); args.push(f.store); }
  if (f.from) { cond.push("s.period >= ?"); args.push(f.from); }
  if (f.to) { cond.push("s.period <= ?"); args.push(f.to); }
  return db
    .prepare(
      `SELECT s.channel AS channel, SUM(s.spend) AS spend
       FROM fact_spend s
       JOIN dealership d ON d.id = s.dealership_id
       WHERE ${cond.join(" AND ")}
       GROUP BY s.channel
       ORDER BY spend DESC`
    )
    .all(...args) as Array<{ channel: string; spend: number }>;
}
