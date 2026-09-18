// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Revenue Recovery: find lead sources that used to sell and no longer do, and put a
// dollar figure on winning them back. All formulas from reference/METRICS.md.
//
// The dangerous trap: a dormant source stops emitting rows, so every source is
// reindexed onto the FULL month grid with a missing month treated as a real zero
// before any rolling average. "The last 3 months" means the last 3 months of the
// analysis window, not the last 3 rows a source happens to have.
//
// Feed loss (METRICS.md): when >= 2 sources of ONE lead type at ONE store all go to
// zero in the same month and stay there, that is a CRM feed that died, not vendors
// that stopped. Those sources are flagged feed_lost, listed separately, and kept
// OUT of the recoverable headline (and out of the dormant/declining counts). The
// confirming signal is that the store kept selling that month.
//
// Recovery is computed on the selected scope, pooled by source. A per-store view
// recomputes on that store's rows; it does NOT add up to the group. Status is
// mutually exclusive (dormant wins). The headline is the SUM of the per-source
// estimates over dormant + declining sources with >= 5 total sales.
import { getDb } from "./db";
import type { RecoveryResult, RecoverySource, FeedLoss } from "./types";

const DORMANT_MONTHS = 3; // monthsInactive >= 3 -> dormant
const DECLINE_FRAC = 0.3; // recent < 30% of peak -> declining
const MIN_SALES = 5; // fewer than this: estimate is noise, flag and exclude
const FEED_MIN_SOURCES = 2; // a feed is >= 2 sources of one type dying together
const FEED_MIN_DARK = 3; // ...and staying dark >= 3 months (matches dormancy)

function monthIndex(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return y * 12 + (m - 1);
}
function addMonths(period: string, n: number): string {
  const t = monthIndex(period) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
function monthGrid(from: string, to: string): string[] {
  const out: string[] = [];
  for (let p = from; monthIndex(p) <= monthIndex(to); p = addMonths(p, 1)) out.push(p);
  return out;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

type Raw = {
  src: string; ltype: string | null; period: string;
  sales: number; leads: number; gross: number;
  nnew: number; nused: number; budgetrows: number;
};

export function getRecovery(opts: {
  groupId?: string;
  store?: string | null;
  years?: number;
  leadType?: string | null;
} = {}): RecoveryResult {
  const db = getDb();
  const groupId = opts.groupId ?? "summit-auto-group";
  const store = opts.store ?? null;
  const years = opts.years ?? 3;
  const leadType = opts.leadType ?? null;

  const scopeLabel = store
    ? (db.prepare(`SELECT name FROM dealership WHERE id = ?`).get(store) as { name: string } | undefined)?.name ?? store
    : ((db.prepare(`SELECT name FROM dealer_group WHERE id = ?`).get(groupId) as { name: string } | undefined)?.name ?? groupId);

  const cond = ["d.group_id = ?"];
  const args: (string | number)[] = [groupId];
  if (store) { cond.push("d.id = ?"); args.push(store); }
  if (leadType) { cond.push("f.lead_type = ?"); args.push(leadType); }
  const scope = cond.join(" AND ");

  // Analysis month = the latest period in the FILE for this group (METRICS.md),
  // independent of the store/lead-type filter, so a dead feed cannot look alive.
  const to = (
    db.prepare(`SELECT MAX(f.period) p FROM fact_leads f
                JOIN dealership d ON d.id = f.dealership_id WHERE d.group_id = ?`).get(groupId) as {
      p: string | null;
    }
  ).p;

  const empty: RecoveryResult = {
    scopeLabel, store, years, from: "-", to: "-", totalMonths: 0,
    estMonthlyRevenue: 0, estMonthlySales: 0, dormantCount: 0, decliningCount: 0,
    feedLostCount: 0, feedLoss: [], windowShort: false, sources: [],
  };
  if (!to) return empty;

  const from = addMonths(to, -(years * 12 - 1));
  const grid = monthGrid(from, to);
  const totalMonths = grid.length;
  const gridIdx = new Map(grid.map((p, i) => [p, i]));
  const analysisIdx = monthIndex(to);

  const raw = db
    .prepare(
      `SELECT s.canonical_name src, s.lead_type ltype, f.period period,
              SUM(f.sales) sales, SUM(f.leads) leads, SUM(f.gross) gross,
              SUM(f.new_sales) nnew, SUM(f.used_sales) nused,
              SUM(CASE WHEN f.budget IS NOT NULL THEN 1 ELSE 0 END) budgetrows
       FROM fact_leads f
       JOIN dealership d ON d.id = f.dealership_id
       JOIN source s ON s.id = f.source_id
       WHERE ${scope} AND f.period >= ? AND f.period <= ?
       GROUP BY s.canonical_name, f.period`
    )
    .all(...args, from, to) as Raw[];

  // ---- feed-loss detection, per lead type within this scope ----
  // For each lead type: aggregate leads on the grid, count its sources. A feed is
  // lost if >= 2 sources exist, the type had activity, and its leads go to zero at
  // month F and stay zero through the analysis month (>= FEED_MIN_DARK months).
  const typeLeads = new Map<string, number[]>();
  const typeSources = new Map<string, Set<string>>();
  for (const r of raw) {
    const lt = r.ltype ?? "?";
    if (!typeLeads.has(lt)) { typeLeads.set(lt, new Array(grid.length).fill(0)); typeSources.set(lt, new Set()); }
    const gi = gridIdx.get(r.period);
    if (gi != null) typeLeads.get(lt)![gi] += r.leads;
    if (r.leads > 0) typeSources.get(lt)!.add(r.src);
  }
  const feedLostTypes = new Map<string, string>(); // lead_type -> firstMissingMonth
  for (const [lt, arr] of typeLeads) {
    if ((typeSources.get(lt)?.size ?? 0) < FEED_MIN_SOURCES) continue;
    // last month with any leads for the type
    let last = -1;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] > 0) { last = i; break; }
    if (last < 0) continue;
    const hadEarlier = arr.slice(0, last + 1).some((v) => v > 0);
    const darkTail = grid.length - 1 - last; // months of zero after `last`, ending at analysis
    if (hadEarlier && darkTail >= FEED_MIN_DARK) {
      feedLostTypes.set(lt, grid[last + 1]); // first missing month
    }
  }

  // Group rows by source, then reindex onto the full grid.
  const bySource = new Map<string, { ltype: string | null; rows: Map<string, Raw> }>();
  for (const r of raw) {
    if (!bySource.has(r.src)) bySource.set(r.src, { ltype: r.ltype, rows: new Map() });
    bySource.get(r.src)!.rows.set(r.period, r);
  }

  const sources: RecoverySource[] = [];
  for (const [src, { ltype, rows }] of bySource) {
    const timeline = grid.map((period) => {
      const r = rows.get(period);
      const sales = r?.sales ?? 0, leads = r?.leads ?? 0, gross = r?.gross ?? 0;
      return { period, sales, leads, gross, closing: leads > 0 ? (sales / leads) * 100 : null };
    });
    const salesArr = timeline.map((t) => t.sales);

    const totalSales = salesArr.reduce((a, b) => a + b, 0);
    const totalLeads = timeline.reduce((a, t) => a + t.leads, 0);
    const totalGross = timeline.reduce((a, t) => a + t.gross, 0);
    const newSales = grid.reduce((a, p) => a + (rows.get(p)?.nnew ?? 0), 0);
    const usedSales = grid.reduce((a, p) => a + (rows.get(p)?.nused ?? 0), 0);
    // "Budget present" for the evidence score = budget known for EVERY month in the window.
    const hasBudget = grid.every((p) => (rows.get(p)?.budgetrows ?? 0) > 0);

    const activeMonths = salesArr.filter((s) => s > 0).length;
    const closingRatio = totalLeads > 0 ? (totalSales / totalLeads) * 100 : null;
    const avgGrossPerSale = totalSales > 0 ? totalGross / totalSales : null;

    let lastActiveMonth: string | null = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].sales > 0) { lastActiveMonth = timeline[i].period; break; }
    }
    const monthsInactive = lastActiveMonth == null ? totalMonths : analysisIdx - monthIndex(lastActiveMonth);

    // Highest 3-month rolling average (METRICS.md). Only full 3-month windows count -
    // a growing window at the start would let a single spike month masquerade as a
    // 3-month average and inflate the peak.
    let peakMonthlySales = 0;
    let peakPeriod: string | null = null;
    const peakWin = Math.min(3, salesArr.length);
    for (let i = peakWin - 1; i < salesArr.length; i++) {
      const avg = mean(salesArr.slice(i - peakWin + 1, i + 1));
      if (avg > peakMonthlySales) { peakMonthlySales = avg; peakPeriod = grid[i]; }
    }
    const recentMonthlySales = mean(salesArr.slice(-3));
    const historicalMonthlySales = activeMonths > 0 ? totalSales / activeMonths : 0;

    // Feed loss wins over dormant/declining: is this source part of a dead feed?
    const feedMonth = ltype ? feedLostTypes.get(ltype) : undefined;
    const lastLeadPeriod = (() => {
      for (let i = timeline.length - 1; i >= 0; i--) if (timeline[i].leads > 0) return timeline[i].period;
      return null;
    })();
    const isFeedLost =
      !!feedMonth &&
      lastLeadPeriod != null &&
      monthIndex(lastLeadPeriod) >= monthIndex(feedMonth) - 3 &&
      monthIndex(lastLeadPeriod) < monthIndex(feedMonth);

    let status: RecoverySource["status"] = "steady";
    if (isFeedLost) status = "feed_lost";
    else if (monthsInactive >= DORMANT_MONTHS) status = "dormant";
    else if (peakMonthlySales > 0 && recentMonthlySales < DECLINE_FRAC * peakMonthlySales) status = "declining";

    const recoverable = status === "dormant" || status === "declining";
    const insufficientData = recoverable && totalSales < MIN_SALES;
    const estimatedMonthlySales = recoverable && !insufficientData ? Math.max(0, historicalMonthlySales - recentMonthlySales) : null;
    const estimatedMonthlyRevenue =
      estimatedMonthlySales != null && avgGrossPerSale != null ? estimatedMonthlySales * avgGrossPerSale : null;
    const inHeadline = recoverable && !insufficientData && estimatedMonthlyRevenue != null && estimatedMonthlyRevenue > 0;

    const evidenceScore = Math.round(
      Math.max(0, Math.min(100,
        40 + 30 * Math.min(activeMonths / 12, 1) + 20 * Math.min(totalSales / 50, 1) + (hasBudget ? 10 : 0)
      ))
    );

    sources.push({
      source: src, leadType: ltype, status,
      totalSales, totalLeads, totalGross, newSales, usedSales,
      closingRatio, avgGrossPerSale,
      activeMonths, totalMonths,
      lastActiveMonth, monthsInactive,
      peakMonthlySales, peakPeriod, recentMonthlySales, historicalMonthlySales,
      estimatedMonthlySales, estimatedMonthlyRevenue, insufficientData, inHeadline,
      evidenceScore, hasBudget, feedLostMonth: isFeedLost ? feedMonth! : null, timeline,
    });
  }

  sources.sort((a, b) => {
    const av = a.estimatedMonthlyRevenue ?? -1;
    const bv = b.estimatedMonthlyRevenue ?? -1;
    if (bv !== av) return bv - av;
    return b.totalSales - a.totalSales;
  });

  const headlineSet = sources.filter((s) => s.inHeadline);
  const estMonthlyRevenue = headlineSet.reduce((a, s) => a + (s.estimatedMonthlyRevenue ?? 0), 0);
  const estMonthlySales = headlineSet.reduce((a, s) => a + (s.estimatedMonthlySales ?? 0), 0);
  const dormantCount = sources.filter((s) => s.status === "dormant").length;
  const decliningCount = sources.filter((s) => s.status === "declining").length;
  const feedLostCount = sources.filter((s) => s.status === "feed_lost").length;

  // Feed-loss summary per lead type, with the confirming "store kept selling" signal.
  const feedLoss: FeedLoss[] = [];
  for (const [lt, firstMissing] of feedLostTypes) {
    const fi = gridIdx.get(firstMissing)!;
    // store total sales (all lead types) before vs after the feed died, from a scope
    // query that ignores the lead-type filter (we need the whole store).
    const sc = ["d.group_id = ?"]; const sa: (string | number)[] = [groupId];
    if (store) { sc.push("d.id = ?"); sa.push(store); }
    const totalByPeriod = db
      .prepare(`SELECT f.period p, SUM(f.sales) s FROM fact_leads f JOIN dealership d ON d.id=f.dealership_id
                WHERE ${sc.join(" AND ")} AND f.period >= ? AND f.period <= ? GROUP BY f.period`)
      .all(...sa, from, to) as { p: string; s: number }[];
    const salesBy = new Map(totalByPeriod.map((r) => [r.p, r.s]));
    const before = mean(grid.slice(Math.max(0, fi - 3), fi).map((p) => salesBy.get(p) ?? 0));
    const after = mean(grid.slice(fi, fi + 3).map((p) => salesBy.get(p) ?? 0));
    feedLoss.push({
      leadType: lt,
      firstMissingMonth: firstMissing,
      sourceCount: sources.filter((s) => s.status === "feed_lost" && s.leadType === lt).length,
      storeKeptSelling: after >= 0.8 * before,
      salesBefore: Math.round(before),
      salesAfter: Math.round(after),
    });
  }

  return {
    scopeLabel, store, years, from, to, totalMonths,
    estMonthlyRevenue, estMonthlySales, dormantCount, decliningCount,
    feedLostCount, feedLoss,
    windowShort: years < 2,
    sources,
  };
}
