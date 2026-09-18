// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Compute realistic demo data from reference/leads_monthly.csv following the
// rules in reference/METRICS.md, and emit lib/demo-data.ts. Run: node scripts/gen-demo.mjs
//
// This is a build-time step, not shipped to the browser. The output is a static
// typed module the gallery imports so the UI renders with no backend.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---- parse CSV -----------------------------------------------------------
// The CSV uses CRLF line endings, so split on \r?\n and trim each cell; otherwise
// the last column key ("budget") silently carries a trailing \r and every budget
// read comes back undefined.
// The kit ships the CSV at sample-data/ two levels up; a standalone copy of this
// folder can drop the same file into reference/ instead.
const CSV_CANDIDATES = [join(ROOT, "reference/leads_monthly.csv"), join(ROOT, "../../sample-data/leads_monthly.csv")];
const csvPath = CSV_CANDIDATES.find((f) => existsSync(f));
if (!csvPath) throw new Error("leads_monthly.csv not found in reference/ or ../../sample-data/");
const raw = readFileSync(csvPath, "utf8").trim();
const [header, ...lines] = raw.split(/\r?\n/);
const cols = header.split(",").map((c) => c.trim());
const rows = lines.map((line) => {
  const parts = line.split(",").map((p) => p.trim());
  const r = {};
  cols.forEach((c, i) => (r[c] = parts[i]));
  return {
    period: r.period,
    store: r.store,
    source: r.source,
    lead_type: r.lead_type,
    leads: Number(r.leads) || 0,
    sales: Number(r.sales) || 0,
    new_sales: Number(r.new_sales) || 0,
    used_sales: Number(r.used_sales) || 0,
    gross: Number(r.gross) || 0,
    budget: r.budget === "" || r.budget == null ? null : Number(r.budget),
  };
});

// ---- period grid (the analysis window) -----------------------------------
const periods = [...new Set(rows.map((r) => r.period))].sort();
const analysisMonth = periods[periods.length - 1]; // latest period in the file
const priorMonth = periods[periods.length - 2];
const last12 = periods.slice(-12);

function monthsBetween(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// place a source's rows onto the full period grid, missing month = real zero
function onGrid(sourceRows, grid) {
  const byPeriod = new Map(sourceRows.map((r) => [r.period, r]));
  return grid.map((p) => byPeriod.get(p) || { period: p, leads: 0, sales: 0, new_sales: 0, used_sales: 0, gross: 0, budget: null });
}

function rollingAvg3(arr) {
  // highest 3-month rolling average
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i <= arr.length - 3; i++) {
    const avg = (arr[i] + arr[i + 1] + arr[i + 2]) / 3;
    if (avg > peak) {
      peak = avg;
      peakIdx = i;
    }
  }
  return { peak, peakIdx };
}

// ---- Revenue Recovery model ----------------------------------------------
// Pooled by source across all stores (All Stores scope).
const sourceNames = [...new Set(rows.map((r) => r.source))];
const leadTypeBySource = {};
for (const s of sourceNames) {
  const lts = [...new Set(rows.filter((r) => r.source === s).map((r) => r.lead_type))];
  leadTypeBySource[s] = lts;
}

// Recovery is computed on the full analysis window (METRICS.md: "We analyzed
// 3 Years of CRM data"), pooled by source across all stores.
function poolBySource(sourceName, filterStore = null) {
  const src = rows.filter((r) => r.source === sourceName && (!filterStore || r.store === filterStore));
  // pool stores into one series per period
  const byPeriod = new Map();
  for (const r of src) {
    const cur = byPeriod.get(r.period) || { period: r.period, leads: 0, sales: 0, new_sales: 0, used_sales: 0, gross: 0, budget: 0, budgetKnown: 0 };
    cur.leads += r.leads;
    cur.sales += r.sales;
    cur.new_sales += r.new_sales;
    cur.used_sales += r.used_sales;
    cur.gross += r.gross;
    if (r.budget != null) {
      cur.budget += r.budget;
      cur.budgetKnown += 1;
    }
    byPeriod.set(r.period, cur);
  }
  return onGrid([...byPeriod.values()], periods);
}

// detect feed loss: a lead_type at a store where every source's leads go to zero
// in a month and stay there. Simplified for demo: flag sources whose lead_type is
// "internet" for a store that went dark. We detect per (store, lead_type).
const feedLostSources = new Set();
{
  const stores = [...new Set(rows.map((r) => r.store))];
  const leadTypes = [...new Set(rows.map((r) => r.lead_type))];
  for (const store of stores) {
    for (const lt of leadTypes) {
      // Feed loss = a CRM feed died, killing EVERY source of a lead type at once.
      // With only one source you cannot tell a dead feed from a vendor that quit,
      // so require the lead type to have carried >= 2 sources at this store.
      const ltSources = new Set(
        rows.filter((r) => r.store === store && r.lead_type === lt && r.leads > 0).map((r) => r.source),
      );
      if (ltSources.size < 2) continue;
      const grid = periods.map((p) => {
        const leads = rows
          .filter((r) => r.store === store && r.lead_type === lt && r.period === p)
          .reduce((a, r) => a + r.leads, 0);
        return { period: p, leads };
      });
      // went to zero in the last few months and stays there, but had leads before
      const tail = grid.slice(-3);
      const head = grid.slice(0, -3);
      const hadLeads = head.some((g) => g.leads > 0);
      const deadTail = tail.every((g) => g.leads === 0);
      if (hadLeads && deadTail) {
        // total store sales did not collapse that month => feed loss, not demand loss
        // (kept simple for demo)
        rows
          .filter((r) => r.store === store && r.lead_type === lt)
          .forEach((r) => feedLostSources.add(`${r.source}`));
      }
    }
  }
}

function classify(series) {
  const salesArr = series.map((r) => r.sales);
  const lastActiveIdx = salesArr.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
  const lastActiveMonth = lastActiveIdx >= 0 ? series[lastActiveIdx].period : null;
  const monthsInactive = lastActiveMonth ? monthsBetween(lastActiveMonth, analysisMonth) : series.length;

  const { peak } = rollingAvg3(salesArr);
  const recent3 = salesArr.slice(-3);
  const recentMonthlySales = recent3.reduce((a, b) => a + b, 0) / 3;

  // historical: mean over active months excluding trailing dormant run
  const trimmed = lastActiveIdx >= 0 ? salesArr.slice(0, lastActiveIdx + 1) : [];
  const activeVals = trimmed.filter((v) => v > 0);
  const historicalMonthlySales = activeVals.length ? activeVals.reduce((a, b) => a + b, 0) / activeVals.length : 0;

  let status = "steady";
  if (monthsInactive >= 3) status = "dormant";
  else if (peak > 0 && recentMonthlySales < 0.3 * peak) status = "declining";

  return { lastActiveMonth, monthsInactive, peak, recentMonthlySales, historicalMonthlySales, status };
}

const opportunities = [];
for (const source of sourceNames) {
  const series = poolBySource(source);
  const totalSales = series.reduce((a, r) => a + r.sales, 0);
  const totalLeads = series.reduce((a, r) => a + r.leads, 0);
  const totalGross = series.reduce((a, r) => a + r.gross, 0);
  const newSales = series.reduce((a, r) => a + r.new_sales, 0);
  const usedSales = series.reduce((a, r) => a + r.used_sales, 0);
  const activeMonths = series.filter((r) => r.sales > 0).length;
  const avgGrossPerSale = totalSales > 0 ? totalGross / totalSales : 0;
  const closingRatio = totalLeads > 0 ? (totalSales / totalLeads) * 100 : null;
  const budgetKnownAll = series.every((r) => r.budgetKnown > 0);
  const totalBudget = series.reduce((a, r) => a + (r.budget || 0), 0);

  const c = classify(series);
  const feedLost = feedLostSources.has(source);

  // estimate (floor 0), require >= 5 total sales
  const estMonthlySales = Math.max(0, c.historicalMonthlySales - c.recentMonthlySales);
  const insufficient = totalSales < 5;
  const estMonthlyRevenue = insufficient ? null : estMonthlySales * avgGrossPerSale;

  // evidence score
  let evidence = 40;
  evidence += 30 * Math.min(activeMonths / 12, 1);
  evidence += 20 * Math.min(totalSales / 50, 1);
  evidence += budgetKnownAll ? 10 : 0;
  evidence = Math.max(0, Math.min(100, Math.round(evidence)));

  const storesAffected = [...new Set(rows.filter((r) => r.source === source).map((r) => r.store))];
  // Per-store totals for the STORES AFFECTED list (sales, new, used, gross).
  const storeBreakdown = storesAffected
    .map((store) => {
      const sr = rows.filter((r) => r.source === source && r.store === store);
      return {
        store,
        sales: sr.reduce((a, r) => a + r.sales, 0),
        newSales: sr.reduce((a, r) => a + r.new_sales, 0),
        usedSales: sr.reduce((a, r) => a + r.used_sales, 0),
        gross: sr.reduce((a, r) => a + r.gross, 0),
      };
    })
    .sort((a, b) => b.sales - a.sales);
  // One timeline per lead type the source carries, for the tabs on the chart.
  const timelineByLeadType = {};
  for (const lt of leadTypeBySource[source]) {
    const ltRows = rows.filter((r) => r.source === source && r.lead_type === lt);
    const byP = new Map();
    for (const r of ltRows) {
      const c = byP.get(r.period) || { period: r.period, leads: 0, sales: 0 };
      c.leads += r.leads; c.sales += r.sales; byP.set(r.period, c);
    }
    timelineByLeadType[lt] = periods.map((p) => {
      const c = byP.get(p) || { leads: 0, sales: 0 };
      return { month: p, sales: c.sales, leads: c.leads, closingRate: c.leads > 0 ? (c.sales / c.leads) * 100 : 0 };
    });
  }
  const { peakIdx } = rollingAvg3(series.map((r) => r.sales));
  const peakPeriod = { start: series[peakIdx]?.period ?? periods[0], end: series[Math.min(peakIdx + 2, series.length - 1)]?.period ?? analysisMonth };

  opportunities.push({
    source,
    leadTypes: leadTypeBySource[source],
    status: c.status,
    feedLost,
    monthsInactive: c.monthsInactive,
    lastActiveMonth: c.lastActiveMonth,
    metrics: {
      totalSales,
      totalLeads,
      totalGross,
      newSales,
      usedSales,
      pctNew: newSales + usedSales > 0 ? (newSales / (newSales + usedSales)) * 100 : null,
      closingRatio,
      avgGrossPerSale,
      peakMonthlySales: c.peak,
      recentMonthlySales: c.recentMonthlySales,
      historicalMonthlySales: c.historicalMonthlySales,
      cpl: budgetKnownAll && totalLeads > 0 ? totalBudget / totalLeads : null,
      cps: budgetKnownAll && totalSales > 0 ? totalBudget / totalSales : null,
    },
    estMonthlySales: insufficient ? null : estMonthlySales,
    estMonthlyRevenue,
    insufficient,
    evidenceScore: evidence,
    storesAffected,
    storeBreakdown,
    peakPeriod,
    activeMonths,
    totalMonths: series.length,
    timelineByLeadType,
    // three-axis monthly timeline (sales, leads, closing rate) over the window
    timeline: series.map((r) => ({
      month: r.period,
      sales: r.sales,
      leads: r.leads,
      closingRate: r.leads > 0 ? (r.sales / r.leads) * 100 : 0,
    })),
  });
}

// rank by recoverable revenue (dormant + declining first, then estimate desc)
const recoverable = opportunities
  .filter((o) => o.status === "dormant" || o.status === "declining")
  .sort((a, b) => (b.estMonthlyRevenue || 0) - (a.estMonthlyRevenue || 0));

// Steady sources still ship in the list, after the recoverable ones, in source
// order. They are context, never part of the headline: the screen shows them
// with a neutral chip and "steady, not in total" instead of a dollar figure.
const steady = opportunities.filter((o) => o.status === "steady");

const headlineMonthly = recoverable
  .filter((o) => !o.feedLost && o.estMonthlyRevenue != null)
  .reduce((a, o) => a + o.estMonthlyRevenue, 0);

const dormantCount = recoverable.filter((o) => o.status === "dormant").length;
const decliningCount = recoverable.filter((o) => o.status === "declining").length;

// ---- KPI cards (All Stores) ----------------------------------------------
function monthTotals(period) {
  const r = rows.filter((x) => x.period === period);
  const leads = r.reduce((a, x) => a + x.leads, 0);
  const sales = r.reduce((a, x) => a + x.sales, 0);
  const gross = r.reduce((a, x) => a + x.gross, 0);
  // Spend metrics only over budgeted rows (METRICS.md): a partial sum divided by
  // all sales quietly understates cost per sale.
  const budgetRows = r.filter((x) => x.budget != null);
  const budget = budgetRows.reduce((a, x) => a + x.budget, 0);
  const budgetedSales = budgetRows.reduce((a, x) => a + x.sales, 0);
  return {
    leads,
    sales,
    gross,
    closingRatio: leads > 0 ? (sales / leads) * 100 : 0,
    avgGross: sales > 0 ? gross / sales : 0,
    cps: budgetedSales > 0 ? budget / budgetedSales : 0,
    cpl: budgetRows.reduce((a, x) => a + x.leads, 0) > 0 ? budget / budgetRows.reduce((a, x) => a + x.leads, 0) : 0,
  };
}

function series12(metric) {
  return last12.map((p) => monthTotals(p)[metric]);
}

const cur = monthTotals(analysisMonth);
const prev = monthTotals(priorMonth);

const kpis = [
  { key: "gross", label: "Total Gross", value: cur.gross, prior: prev.gross, dataType: "money", accent: "accent", spark: series12("gross") },
  { key: "sales", label: "Units Sold", value: cur.sales, prior: prev.sales, dataType: "units", accent: "info", spark: series12("sales") },
  { key: "leads", label: "Total Leads", value: cur.leads, prior: prev.leads, dataType: "int", accent: "success", spark: series12("leads") },
  { key: "closingRatio", label: "Closing Ratio", value: cur.closingRatio, prior: prev.closingRatio, dataType: "pct", accent: "warning", spark: series12("closingRatio") },
  { key: "avgGross", label: "Avg Gross / Sale", value: cur.avgGross, prior: prev.avgGross, dataType: "moneyWhole", accent: "accent", spark: series12("avgGross") },
  { key: "cps", label: "Cost Per Sale", value: cur.cps, prior: prev.cps, dataType: "moneyWhole", accent: "danger", costMetric: true, spark: series12("cps") },
];

// ---- Highlights (MoM moves as questions, threshold 20%) -------------------
const HL_METRICS = [
  { key: "gross", label: "Total gross profit", dataType: "money" },
  { key: "sales", label: "Units sold", dataType: "units" },
  { key: "leads", label: "Total leads", dataType: "int" },
  { key: "closingRatio", label: "Closing ratio", dataType: "pct" },
  { key: "cps", label: "Cost per sale", dataType: "moneyWhole", costMetric: true },
];
const highlights = [];
for (const m of HL_METRICS) {
  const c = cur[m.key === "gross" ? "gross" : m.key];
  const p = prev[m.key === "gross" ? "gross" : m.key];
  if (p === 0) continue;
  const change = ((c - p) / Math.abs(p)) * 100;
  // highlights.js surfaces suggested-question chips above a 5% MoM move.
  if (Math.abs(change) > 5) {
    highlights.push({ key: m.key, label: m.label, dataType: m.dataType, costMetric: !!m.costMetric, current: c, previous: p, changePct: change });
  }
}
// Source-level movers: biggest MoM lead drops per source, phrased as questions.
for (const source of sourceNames) {
  const c = rows.filter((r) => r.source === source && r.period === analysisMonth).reduce((a, r) => a + r.leads, 0);
  const p = rows.filter((r) => r.source === source && r.period === priorMonth).reduce((a, r) => a + r.leads, 0);
  if (p === 0) continue;
  const change = ((c - p) / Math.abs(p)) * 100;
  if (Math.abs(change) > 15) {
    highlights.push({ key: `leads.${source}`, label: `${source} leads`, dataType: "int", costMetric: false, current: c, previous: p, changePct: change });
  }
}
highlights.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
const topHighlights = highlights.slice(0, 6);

// ---- Drilldown demo (Total Gross by dimension) ---------------------------
function breakdownBy(dim) {
  const keys = [...new Set(rows.map((r) => r[dim]))];
  return keys
    .map((k) => {
      const c = rows.filter((r) => r[dim] === k && r.period === analysisMonth).reduce((a, r) => a + r.gross, 0);
      const p = rows.filter((r) => r[dim] === k && r.period === priorMonth).reduce((a, r) => a + r.gross, 0);
      const variance = c - p;
      const variancePct = p ? (variance / Math.abs(p)) * 100 : null;
      return { id: k, label: k, current: c, previous: p, variance, variancePct };
    })
    .sort((a, b) => b.current - a.current);
}

const drilldown = {
  metricKey: "sales.revenue",
  metricName: "Total Gross",
  dataType: "money",
  current: cur.gross,
  previous: prev.gross,
  lastYear: monthTotals(periods[periods.length - 13] || priorMonth).gross,
  periodLabel: `${analysisMonth}`,
  dimensions: [
    { key: "store", label: "Store" },
    { key: "source", label: "Source" },
    { key: "lead_type", label: "Lead Type" },
  ],
  breakdowns: {
    store: breakdownBy("store"),
    source: breakdownBy("source"),
    lead_type: breakdownBy("lead_type"),
  },
  monthlyTrend: {
    labels: last12.map((p) => p),
    current: series12("gross"),
  },
  relatedKpis: [
    { key: "sales", name: "Units Sold", dataType: "units", current: cur.sales, previous: prev.sales, relationshipType: "component" },
    { key: "leads", name: "Total Leads", dataType: "int", current: cur.leads, previous: prev.leads, relationshipType: "upstream" },
    { key: "closingRatio", name: "Closing Ratio", dataType: "pct", current: cur.closingRatio, previous: prev.closingRatio, relationshipType: "driver" },
    { key: "avgGross", name: "Avg Gross / Sale", dataType: "moneyWhole", current: cur.avgGross, previous: prev.avgGross, relationshipType: "driver" },
    { key: "cps", name: "Cost Per Sale", dataType: "moneyWhole", current: cur.cps, previous: prev.cps, relationshipType: "correlated" },
  ],
};

// impact analysis: biggest movers per dimension (variance ascending -> drops first)
const impact = {};
for (const d of ["store", "source", "lead_type"]) {
  impact[d] = breakdownBy(d)
    .filter((r) => r.variance !== 0)
    .sort((a, b) => a.variance - b.variance)
    .slice(0, 5);
}
drilldown.impact = impact;

const window = { start: periods[0], end: analysisMonth, months: periods.length };

// ---- Traffic channels (GA4 style, optional second file) --------------------
// The Traffic Channels side of Revenue Recovery. Rules in reference/METRICS.md:
// a channel is dormant after 3 months with no sessions, declining when its
// recent 3-month sessions run under 45% of its own peak (3-month rolling).
const TRAFFIC_CANDIDATES = [join(ROOT, "reference/traffic_monthly.csv"), join(ROOT, "../../sample-data/traffic_monthly.csv")];
const trafficPath = TRAFFIC_CANDIDATES.find((f) => existsSync(f));
let traffic = null;
if (trafficPath) {
  const [th, ...tlines] = readFileSync(trafficPath, "utf8").trim().split(/\r?\n/);
  const tcols = th.split(",").map((c) => c.trim());
  const trows = tlines.map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const r = {}; tcols.forEach((c, i) => (r[c] = parts[i]));
    return { period: r.period, store: r.store, channel: r.channel, sessions: +r.sessions || 0, users: +r.users || 0, vdp_views: +r.vdp_views || 0, form_submissions: +r.form_submissions || 0, click_to_call: +r.click_to_call || 0, conversions: +r.conversions || 0 };
  });
  const tperiods = [...new Set(trows.map((r) => r.period))].sort();
  const channels = [...new Set(trows.map((r) => r.channel))];
  const tgrid = periods.length ? periods : tperiods;
  const sumT = (pred, field) => trows.filter(pred).reduce((a, r) => a + r[field], 0);
  const chans = channels.map((ch) => {
    const series = tgrid.map((p) => {
      const pr = trows.filter((r) => r.channel === ch && r.period === p);
      const s = (f) => pr.reduce((a, r) => a + r[f], 0);
      return { month: p, sessions: s("sessions"), vdpViews: s("vdp_views"), conversions: s("conversions"), forms: s("form_submissions"), calls: s("click_to_call") };
    });
    const sess = series.map((r) => r.sessions);
    const lastIdx = sess.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
    const lastActiveMonth = lastIdx >= 0 ? series[lastIdx].month : null;
    const monthsInactive = lastActiveMonth ? monthsBetween(lastActiveMonth, analysisMonth) : series.length;
    const { peak, peakIdx } = rollingAvg3(sess);
    const recent = sess.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const activeVals = sess.slice(0, lastIdx + 1).filter((v) => v > 0);
    const historical = activeVals.length ? activeVals.reduce((a, b) => a + b, 0) / activeVals.length : 0;
    let status = "steady";
    if (monthsInactive >= 3) status = "dormant";
    else if (peak > 0 && recent < 0.45 * peak) status = "declining";
    const totalSessions = sumT((r) => r.channel === ch, "sessions");
    const totalConversions = sumT((r) => r.channel === ch, "conversions");
    const totalVdp = sumT((r) => r.channel === ch, "vdp_views");
    const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    const lostSessions = status === "steady" ? 0 : Math.max(0, historical - recent);
    return {
      channel: ch, status, monthsInactive, lastActiveMonth,
      peakPeriod: { start: series[peakIdx]?.month ?? tgrid[0], end: series[Math.min(peakIdx + 2, series.length - 1)]?.month ?? analysisMonth },
      activeMonths: sess.filter((v) => v > 0).length, totalMonths: series.length,
      metrics: { totalSessions, totalUsers: sumT((r) => r.channel === ch, "users"), totalVdpViews: totalVdp, formSubmissions: sumT((r) => r.channel === ch, "form_submissions"), clickToCall: sumT((r) => r.channel === ch, "click_to_call"), totalConversions, conversionRate: convRate, peakMonthlySessions: peak, recentMonthlySessions: recent, historicalMonthlySessions: historical },
      estMonthlySessions: lostSessions,
      estMonthlyConversions: lostSessions * (convRate / 100),
      storesAffected: [...new Set(trows.filter((r) => r.channel === ch).map((r) => r.store))],
      timeline: series,
    };
  });
  const rank = (c) => (c.status === "steady" ? 1 : 0);
  chans.sort((a, b) => rank(a) - rank(b) || b.estMonthlySessions - a.estMonthlySessions);
  const counted = chans.filter((c) => c.status !== "steady");
  traffic = {
    window: { start: tgrid[0], end: tgrid[tgrid.length - 1], months: tgrid.length },
    summary: {
      lostSessionsMonthly: counted.reduce((a, c) => a + c.estMonthlySessions, 0),
      lostConversionsMonthly: counted.reduce((a, c) => a + c.estMonthlyConversions, 0),
      dormantChannels: chans.filter((c) => c.status === "dormant").length,
      decliningChannels: chans.filter((c) => c.status === "declining").length,
    },
    month: { sessions: sumT((r) => r.period === analysisMonth, "sessions"), users: sumT((r) => r.period === analysisMonth, "users"), vdpViews: sumT((r) => r.period === analysisMonth, "vdp_views"), forms: sumT((r) => r.period === analysisMonth, "form_submissions"), calls: sumT((r) => r.period === analysisMonth, "click_to_call"), conversions: sumT((r) => r.period === analysisMonth, "conversions"),
      prior: { sessions: sumT((r) => r.period === priorMonth, "sessions"), users: sumT((r) => r.period === priorMonth, "users"), vdpViews: sumT((r) => r.period === priorMonth, "vdp_views"), forms: sumT((r) => r.period === priorMonth, "form_submissions"), calls: sumT((r) => r.period === priorMonth, "click_to_call"), conversions: sumT((r) => r.period === priorMonth, "conversions") },
      spark: last12.map((p) => sumT((r) => r.period === p, "sessions")) },
    channels: chans,
  };
}


// ---- Home dashboard (the v2 "/" page, CRM flavored) ----------------------
// Same layout as v2's RankmaticDashboard.vue: four hero tiles with sparklines,
// six secondary tiles, a trend / health / do-this-now row, then ranked lists.
// GA metrics (sessions, ASC events) become CRM metrics (leads, sales, closing
// ratio, gross). Every number is derived from the rows, nothing is imported.
const last6 = periods.slice(-6);
const last12Labels = last12.map((p) => p);
const lastYearMonth = periods[periods.length - 13] || null;
const ly = lastYearMonth ? monthTotals(lastYearMonth) : null;

function storeTotals(store, period) {
  const r = rows.filter((x) => x.store === store && x.period === period);
  const leads = r.reduce((a, x) => a + x.leads, 0);
  const sales = r.reduce((a, x) => a + x.sales, 0);
  const gross = r.reduce((a, x) => a + x.gross, 0);
  return { leads, sales, gross, closingRatio: leads > 0 ? (sales / leads) * 100 : 0, avgGross: sales > 0 ? gross / sales : 0 };
}
function sumBy(pred, period, field) {
  return rows.filter((x) => x.period === period && pred(x)).reduce((a, x) => a + x[field], 0);
}
const HERO_COLORS = { leads: "#818cf8", sales: "#34d399", closingRatio: "#38bdf8", gross: "#fb923c" };
const heroDefs = [
  { key: "leads", label: "Total Leads", dataType: "int" },
  { key: "sales", label: "Units Sold", dataType: "units" },
  { key: "closingRatio", label: "Closing Ratio", dataType: "pct" },
  { key: "gross", label: "Total Gross", dataType: "money" },
];
const hero = heroDefs.map((h) => ({
  key: h.key,
  label: h.label,
  dataType: h.dataType,
  value: cur[h.key],
  prior: prev[h.key],
  lastYear: ly ? ly[h.key] : null,
  color: HERO_COLORS[h.key],
  spark: series12(h.key),
  sparkLabels: last12Labels,
  sparkLastYear: last12.map((p) => {
    const i = periods.indexOf(p) - 12;
    return i >= 0 ? monthTotals(periods[i])[h.key] : null;
  }),
}));

const budgetKnown = rows.some((r) => r.budget != null);
const secondary = [
  { key: "newSales", label: "New Sales", dataType: "units", value: sumBy(() => true, analysisMonth, "new_sales"), prior: sumBy(() => true, priorMonth, "new_sales") },
  { key: "usedSales", label: "Used Sales", dataType: "units", value: sumBy(() => true, analysisMonth, "used_sales"), prior: sumBy(() => true, priorMonth, "used_sales") },
  { key: "avgGross", label: "Avg Gross / Sale", dataType: "moneyWhole", value: cur.avgGross, prior: prev.avgGross },
  { key: "internetLeads", label: "Internet Leads", dataType: "int", value: sumBy((x) => x.lead_type === "internet", analysisMonth, "leads"), prior: sumBy((x) => x.lead_type === "internet", priorMonth, "leads") },
  { key: "phoneLeads", label: "Phone Leads", dataType: "int", value: sumBy((x) => x.lead_type === "phone", analysisMonth, "leads"), prior: sumBy((x) => x.lead_type === "phone", priorMonth, "leads") },
  budgetKnown
    ? { key: "cps", label: "Cost Per Sale", dataType: "moneyWhole", value: cur.cps, prior: prev.cps, invert: true }
    : { key: "activeSources", label: "Active Sources", dataType: "int", value: new Set(rows.filter((x) => x.period === analysisMonth && x.sales > 0).map((x) => x.source)).size, prior: new Set(rows.filter((x) => x.period === priorMonth && x.sales > 0).map((x) => x.source)).size },
];

const trend = {
  labels: last6,
  leads: last6.map((p) => monthTotals(p).leads),
  sales: last6.map((p) => monthTotals(p).sales),
};

// Lead Health: a 0-100 composite the way v2 scores Website Performance Health,
// five sub-scores averaged, each already oriented so higher is better
// (reference/METRICS.md, "Lead Health score").
function healthFor(filterStore = null, endIdx = periods.length - 1) {
  const tot = (p) => (filterStore ? storeTotals(filterStore, p) : monthTotals(p));
  const win = periods.slice(Math.max(0, endIdx - 11), endIdx + 1);
  const t12 = win.map(tot);
  const now = tot(periods[endIdx]);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const maxClose = Math.max(...t12.map((t) => t.closingRatio), 0.0001);
  const avgLeads = t12.reduce((a, t) => a + t.leads, 0) / t12.length || 1;
  const maxAvgGross = Math.max(...t12.map((t) => t.avgGross), 1);
  const recent3 = t12.slice(-3).reduce((a, t) => a + t.sales, 0);
  const prior3 = t12.slice(-6, -3).reduce((a, t) => a + t.sales, 0) || 1;
  const srcRows = rows.filter((x) => !filterStore || x.store === filterStore);
  const srcNames = [...new Set(srcRows.map((x) => x.source))];
  const quiet = srcNames.filter((s) => {
    const recent = srcRows.filter((x) => x.source === s && win.slice(-3).includes(x.period)).reduce((a, x) => a + x.sales, 0);
    const ever = srcRows.filter((x) => x.source === s).reduce((a, x) => a + x.sales, 0);
    return ever >= 5 && recent === 0;
  }).length;
  const sub = {
    closing: clamp((now.closingRatio / maxClose) * 100),
    volume: clamp((now.leads / avgLeads) * 100),
    gross: clamp((now.avgGross / maxAvgGross) * 100),
    momentum: clamp((recent3 / prior3) * 50),
    sources: clamp((1 - quiet / Math.max(srcNames.length, 1)) * 100),
  };
  const score = Math.round(Object.values(sub).reduce((a, v) => a + v, 0) / 5);
  return { score, sub };
}
const HEALTH_SUBS = [
  { key: "closing", label: "Closing", color: "#34d399" },
  { key: "volume", label: "Lead volume", color: "#818cf8" },
  { key: "gross", label: "Gross / sale", color: "#fb923c" },
  { key: "momentum", label: "Momentum", color: "#38bdf8" },
  { key: "sources", label: "Sources", color: "#c084fc" },
];
const groupHealth = healthFor(null);
const storeNames = [...new Set(rows.map((r) => r.store))];
const storeHealth = storeNames.map((s) => ({ store: s, score: healthFor(s).score })).sort((a, b) => b.score - a.score);
const health = {
  score: groupHealth.score,
  subScores: HEALTH_SUBS.map((h) => ({ ...h, value: groupHealth.sub[h.key] })),
  stores: storeHealth,
  bestStore: storeHealth[0] || null,
  worstStore: storeHealth[storeHealth.length - 1] || null,
};

// Do This Now: a rule engine, not a model (the same idea as the highlights).
const actions = [];
for (const o of recoverable.filter((o) => o.status === "dormant" && !o.feedLost && o.estMonthlyRevenue).slice(0, 2)) {
  actions.push({ priority: "critical", text: `${o.source} has had no sales for ${o.monthsInactive} months and was worth about ${fmtMoney(o.estMonthlyRevenue)}/mo at its own historical rate. Decide: reactivate it or stop paying for it.` });
}
for (const o of recoverable.filter((o) => o.status === "declining" && o.estMonthlyRevenue).slice(0, 1)) {
  actions.push({ priority: "warning", text: `${o.source} is running under 30% of its own peak (${Math.round(o.metrics.peakMonthlySales)} sales/mo at best). Call the vendor before the contract renews.` });
}
for (const h of topHighlights.filter((h) => !h.key.startsWith("leads.") && h.changePct < -20).slice(0, 1)) {
  actions.push({ priority: "warning", text: `${h.label} dropped ${Math.abs(Math.round(h.changePct))}% month over month. Open the drill-down and find which store moved it.` });
}
{
  const byStore = storeNames.map((s) => ({ store: s, ...storeTotals(s, analysisMonth) })).filter((s) => s.leads >= 20);
  const worst = [...byStore].sort((a, b) => a.closingRatio - b.closingRatio)[0];
  if (worst && cur.closingRatio > 0 && worst.closingRatio < cur.closingRatio * 0.8) {
    actions.push({ priority: "info", text: `${worst.store} closed ${worst.closingRatio.toFixed(1)}% of leads this month against ${cur.closingRatio.toFixed(1)}% for the group. Review its internet follow-up.` });
  }
}
function fmtMoney(n) {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs)}`;
}

const topSources = sourceNames
  .map((s) => {
    const leads = sumBy((x) => x.source === s, analysisMonth, "leads");
    const pLeads = sumBy((x) => x.source === s, priorMonth, "leads");
    const sales = sumBy((x) => x.source === s, analysisMonth, "sales");
    return { source: s, leads, sales, change: pLeads > 0 ? ((leads - pLeads) / pLeads) * 100 : null };
  })
  .filter((s) => s.leads > 0)
  .sort((a, b) => b.leads - a.leads)
  .slice(0, 8);

const storeRankings = storeNames.map((s) => {
  const c = storeTotals(s, analysisMonth);
  const p = storeTotals(s, priorMonth);
  const chg = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
  return { store: s, leads: c.leads, sales: c.sales, gross: c.gross, closingRatio: c.closingRatio, change: { leads: chg(c.leads, p.leads), sales: chg(c.sales, p.sales), gross: chg(c.gross, p.gross) } };
});

const LT_COLORS = ["#818cf8", "#34d399", "#38bdf8", "#fb923c", "#c084fc", "#f472b6"];
const ltNames = [...new Set(rows.map((r) => r.lead_type))];
const totalLeadsNow = cur.leads || 1;
const leadTypes = ltNames
  .map((lt, i) => {
    const leads = sumBy((x) => x.lead_type === lt, analysisMonth, "leads");
    const sales = sumBy((x) => x.lead_type === lt, analysisMonth, "sales");
    return { key: lt, label: lt.charAt(0).toUpperCase() + lt.slice(1), leads, sales, share: (leads / totalLeadsNow) * 100, closingRatio: leads > 0 ? (sales / leads) * 100 : null, color: LT_COLORS[i % LT_COLORS.length] };
  })
  .sort((a, b) => b.leads - a.leads);


// Financial Focus strip (v2's eight small tiles), only what the file supports.
const budgetNow = rows.filter((r) => r.period === analysisMonth && r.budget != null).reduce((a, r) => a + r.budget, 0);
const budgetPrev = rows.filter((r) => r.period === priorMonth && r.budget != null).reduce((a, r) => a + r.budget, 0);
const financial = [
  { key: "gross", label: "Total Gross", dataType: "money", value: cur.gross, prior: prev.gross },
  { key: "avgGross", label: "Avg Gross / Sale", dataType: "moneyWhole", value: cur.avgGross, prior: prev.avgGross },
  { key: "grossPerLead", label: "Gross / Lead", dataType: "moneyWhole", value: cur.leads ? cur.gross / cur.leads : null, prior: prev.leads ? prev.gross / prev.leads : null },
  { key: "newSales", label: "New Units", dataType: "int", value: sumBy(() => true, analysisMonth, "new_sales"), prior: sumBy(() => true, priorMonth, "new_sales") },
  { key: "usedSales", label: "Used Units", dataType: "int", value: sumBy(() => true, analysisMonth, "used_sales"), prior: sumBy(() => true, priorMonth, "used_sales") },
];
if (budgetKnown) {
  financial.push(
    { key: "budget", label: "Ad Spend (tracked)", dataType: "money", value: budgetNow, prior: budgetPrev, invert: true },
    { key: "cpl", label: "Cost / Lead", dataType: "moneyWhole", value: cur.cpl, prior: prev.cpl, invert: true },
    { key: "cps", label: "Cost / Sale", dataType: "moneyWhole", value: cur.cps, prior: prev.cps, invert: true },
  );
}

// Store performance: the three columns (Sales by Store, New vs Used, Gross by Store).
const storePerformance = storeNames.map((s) => {
  const c = storeTotals(s, analysisMonth), p = storeTotals(s, priorMonth);
  return { store: s, sales: c.sales, prevSales: p.sales, newSales: sumBy((x) => x.store === s, analysisMonth, "new_sales"), usedSales: sumBy((x) => x.store === s, analysisMonth, "used_sales"), gross: c.gross, prevGross: p.gross };
});

// Health Scores strip: one tile per tracked metric, scored against its own 12-month best.
const HS = [
  { key: "sales", label: "Sales Volume", category: "Sales", dataType: "units" },
  { key: "closingRatio", label: "Closing Ratio", category: "Sales", dataType: "pct" },
  { key: "leads", label: "Lead Volume", category: "Leads", dataType: "int" },
  { key: "avgGross", label: "Gross / Sale", category: "Revenue", dataType: "moneyWhole" },
  { key: "gross", label: "Gross Profit", category: "Revenue", dataType: "money" },
];
if (budgetKnown) HS.push({ key: "cps", label: "Cost Per Sale", category: "Cost", dataType: "moneyWhole", invert: true });
const t12all = last12.map(monthTotals);
const healthScores = HS.map((h) => {
  const vals = t12all.map((t) => t[h.key]).filter((v) => v != null && v > 0);
  const best = h.invert ? Math.min(...vals) : Math.max(...vals);
  const now = cur[h.key];
  const score = !best || !now ? null : Math.round(Math.max(0, Math.min(100, h.invert ? (best / now) * 100 : (now / best) * 100)));
  const ch = prev[h.key] ? ((now - prev[h.key]) / Math.abs(prev[h.key])) * 100 : null;
  const good = ch == null ? null : h.invert ? ch < 0 : ch > 0;
  return { ...h, current: now, previous: prev[h.key], score, tone: ch == null || Math.abs(ch) < 1 ? "neutral" : good ? "positive" : "negative" };
});

// Health By Store: the score walked back twelve months, per store, plus the group average.
const healthByStore = {
  labels: last12,
  stores: storeNames,
  series: Object.fromEntries(storeNames.map((s) => [s, last12.map((p) => healthFor(s, periods.indexOf(p)).score)])),
  average: last12.map((p) => healthFor(null, periods.indexOf(p)).score),
};

// Digital & Marketing strip from the traffic file, when present.
const digital = traffic
  ? (() => {
      const m = traffic.month, pr = traffic.month.prior;
      const rate = (x) => (x.sessions ? (x.conversions / x.sessions) * 100 : null);
      return [
        { key: "sessions", label: "Sessions", dataType: "int", value: m.sessions, prior: pr.sessions },
        { key: "users", label: "Users", dataType: "int", value: m.users, prior: pr.users },
        { key: "vdpViews", label: "VDP Views", dataType: "int", value: m.vdpViews, prior: pr.vdpViews },
        { key: "forms", label: "Form Submissions", dataType: "int", value: m.forms, prior: pr.forms },
        { key: "calls", label: "Click-to-Call", dataType: "int", value: m.calls, prior: pr.calls },
        { key: "conversionRate", label: "Conversion Rate", dataType: "pct", value: rate(m), prior: rate(pr) },
      ];
    })()
  : [];

// With a traffic file the hero row is v2's: Sales, Gross, Leads, Sessions.
if (traffic) {
  const pick = (k) => hero.find((h) => h.key === k);
  const sales = pick("sales"), gross = pick("gross"), leads = pick("leads");
  sales.color = "#818cf8"; gross.color = "#34d399"; leads.color = "#38bdf8";
  hero.splice(0, hero.length, sales, gross, leads,
    { key: "sessions", label: "Sessions", dataType: "int", value: traffic.month.sessions, prior: traffic.month.prior.sessions, lastYear: null, color: "#fb923c", spark: traffic.month.spark, sparkLabels: last12Labels, sparkLastYear: last12.map(() => null) },
  );
  const vdp = digital.find((d) => d.key === "vdpViews");
  const conv = digital.find((d) => d.key === "conversionRate");
  secondary.splice(0, secondary.length,
    { key: "closingRatio", label: "Closing Ratio", dataType: "pct", value: cur.closingRatio, prior: prev.closingRatio },
    { key: "avgGross", label: "Avg Gross / Sale", dataType: "moneyWhole", value: cur.avgGross, prior: prev.avgGross },
    { key: "internetLeads", label: "Internet Leads", dataType: "int", value: sumBy((x) => x.lead_type === "internet", analysisMonth, "leads"), prior: sumBy((x) => x.lead_type === "internet", priorMonth, "leads") },
    budgetKnown ? { key: "cps", label: "Cost / Sale", dataType: "moneyWhole", value: cur.cps, prior: prev.cps, invert: true } : { key: "phoneLeads", label: "Phone Leads", dataType: "int", value: sumBy((x) => x.lead_type === "phone", analysisMonth, "leads"), prior: sumBy((x) => x.lead_type === "phone", priorMonth, "leads") },
    { key: "vdpViews", label: "VDP Views", dataType: "int", value: vdp.value, prior: vdp.prior },
    { key: "conversion", label: "Conversion", dataType: "pct", value: conv.value, prior: conv.prior },
  );
}

const home = { hero, secondary, trend, health, actions: actions.slice(0, 4), topSources, storeRankings, leadTypes, financial, storePerformance, healthScores, healthByStore, digital };



// ---- emit ----------------------------------------------------------------
const out = {
  meta: { analysisMonth, priorMonth, window, stores: [...new Set(rows.map((r) => r.store))], sources: sourceNames, leadTypes: [...new Set(rows.map((r) => r.lead_type))] },
  kpis,
  recovery: {
    headlineMonthly,
    headlineAnnual: headlineMonthly * 12,
    dormantCount,
    decliningCount,
    totalOpportunities: recoverable.length,
    window,
    // Recoverable first (ranked by estimate), then steady for context.
    sources: [...recoverable, ...steady],
  },
  highlights: topHighlights,
  drilldown,
  home,
  traffic,
};

const banner = `// AUTO-GENERATED by scripts/gen-demo.mjs from sample-data/leads_monthly.csv.
// Do not edit by hand. Numbers follow reference/METRICS.md. Regenerate with:
//   node scripts/gen-demo.mjs
`;

const body = `${banner}
import type { DemoData } from "./demo-types";

// Double assertion: the JSON literal carries wide string types (e.g. dataType),
// which the DemoData unions narrow. The generator guarantees the shape.
export const demo = ${JSON.stringify(out, null, 2)} as unknown as DemoData;

export default demo;
`;

writeFileSync(join(ROOT, "lib/demo-data.ts"), body);
console.log("wrote lib/demo-data.ts");
console.log("headline monthly:", Math.round(headlineMonthly), "dormant:", dormantCount, "declining:", decliningCount, "steady:", steady.length);
console.log("analysis month:", analysisMonth, "window:", window.start, "->", window.end);
