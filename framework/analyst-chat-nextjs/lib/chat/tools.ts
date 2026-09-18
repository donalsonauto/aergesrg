// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type Anthropic from "@anthropic-ai/sdk";
import type { Row } from "@/lib/data";
import { analyze, filterData, rollup, periodGrid, monthIndex, monthName } from "@/lib/metrics";
import { searchKnowledge } from "./knowledge";

// ---- shared helpers -------------------------------------------------------
// Every rollup here is computed as SUM/SUM, never an average of ratios.

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

function scopeRows(rows: Row[], store?: string) {
 if (!store || store === "All") return rows;
 return rows.filter(r => r.store === store);
}

function allPeriods(rows: Row[]) {
 return [...new Set(rows.map(r => r.period))].sort();
}

function aggregate(rows: Row[]) {
 const leads = sum(rows.map(r => r.leads ?? 0));
 const sales = sum(rows.map(r => r.sales ?? 0));
 const gross = sum(rows.map(r => r.gross ?? 0));
 const budget = rows.some(r => r.budget === null) ? null : sum(rows.map(r => r.budget as number));
 const new_sales = rows.some(r => r.new_sales === null) ? null : sum(rows.map(r => r.new_sales as number));
 const used_sales = rows.some(r => r.used_sales === null) ? null : sum(rows.map(r => r.used_sales as number));
 return {
 leads, sales, gross, budget, new_sales, used_sales,
 closing_ratio: ratio(sales, leads) === null ? null : ratio(sales, leads)! * 100,
 avg_gross_per_sale: ratio(gross, sales),
 cpl: budget === null ? null : ratio(budget, leads),
 cps: budget === null ? null : ratio(budget, sales),
 net_profit: budget === null ? null : gross - budget,
 roi: budget === null || budget === 0 ? null : ((gross - budget) / budget) * 100,
 };
}

export type Metric = keyof ReturnType<typeof aggregate>;
const METRICS: Metric[] = ["leads", "sales", "gross", "budget", "new_sales", "used_sales", "closing_ratio", "avg_gross_per_sale", "cpl", "cps", "net_profit", "roi"];

function priorMonthOf(period: string) {
 return monthName(monthIndex(period) - 1);
}
function priorYearOf(period: string) {
 return monthName(monthIndex(period) - 12);
}
function pctChange(current: number | null, prior: number | null) {
 if (current === null || prior === null || prior === 0) return null;
 return ((current - prior) / Math.abs(prior)) * 100;
}

// ---- tool implementations ---------------------------------------------------

function list_stores(rows: Row[]) {
 const stores = [...new Set(rows.map(r => r.store))];
 return stores.map(store => {
 const a = aggregate(rows.filter(r => r.store === store));
 return { store, total_leads: a.leads, total_sales: a.sales, total_gross: a.gross };
 });
}

function get_kpi(rows: Row[], input: { store?: string; metric: Metric; period: string }) {
 const scoped = scopeRows(rows, input.store);
 const dataPeriods = allPeriods(rows);
 if (!dataPeriods.includes(input.period)) {
 return { error: `No data for period ${input.period}. Data covers ${dataPeriods[0]} to ${dataPeriods.at(-1)}.` };
 }
 const current = aggregate(scoped.filter(r => r.period === input.period))[input.metric];
 const priorMonthPeriod = priorMonthOf(input.period);
 const priorYearPeriod = priorYearOf(input.period);
 const priorMonth = dataPeriods.includes(priorMonthPeriod)
 ? aggregate(scoped.filter(r => r.period === priorMonthPeriod))[input.metric]
 : null;
 const priorYear = dataPeriods.includes(priorYearPeriod)
 ? aggregate(scoped.filter(r => r.period === priorYearPeriod))[input.metric]
 : null;
 return {
 scope: input.store ?? "All",
 metric: input.metric,
 period: input.period,
 value: current,
 prior_month: priorMonth === null ? null : { period: priorMonthPeriod, value: priorMonth, change_pct: pctChange(current, priorMonth) },
 prior_year: priorYear === null ? null : { period: priorYearPeriod, value: priorYear, change_pct: pctChange(current, priorYear) },
 note: priorMonthPeriod && !dataPeriods.includes(priorMonthPeriod) ? "Prior month is outside the data window." : undefined,
 };
}

function get_kpi_timeline(rows: Row[], input: { store?: string; metric: Metric; months?: number }) {
 const scoped = scopeRows(rows, input.store);
 const periods = allPeriods(rows);
 const months = Math.min(input.months ?? 12, periods.length);
 const window = periods.slice(-months);
 return {
 scope: input.store ?? "All",
 metric: input.metric,
 series: window.map(period => ({ period, value: aggregate(scoped.filter(r => r.period === period))[input.metric] })),
 };
}

function get_source_rollup(rows: Row[], input: { store?: string; years?: number }) {
 const { rows: filtered, periods } = filterData(rows, input.store ?? "All", input.years ?? 3, "All");
 const metrics = analyze(filtered, periods);
 return {
 scope: input.store ?? "All",
 window: { from: periods[0], to: periods.at(-1), months: periods.length },
 sources: metrics.map(m => ({
 source: m.source, lead_types: m.leadTypes, total_leads: m.totalLeads, total_sales: m.totalSales,
 total_gross: m.totalGross, closing_ratio: m.closingRatio, avg_gross_per_sale: m.avgGrossPerSale,
 status: m.status, months_inactive: m.monthsInactive, last_active_month: m.lastActiveMonth,
 // No dollar estimate here on purpose: call get_revenue_recovery for the
 // recoverable-revenue figure, so that reliability caveat is never skipped.
 })),
 };
}

function get_revenue_recovery(rows: Row[], input: { store?: string; years?: number }) {
 const { rows: filtered, periods } = filterData(rows, input.store ?? "All", input.years ?? 3, "All");
 const metrics = analyze(filtered, periods);
 const kpi = rollup(metrics);
 const opportunities = metrics
 .filter(m => m.status === "dormant" || m.status === "declining")
 .map(m => ({
 source: m.source, status: m.status, estimated_monthly_revenue: m.estimatedMonthlyRevenue,
 estimated_monthly_sales: m.estimatedMonthlySales, months_inactive: m.monthsInactive,
 peak_monthly_sales: m.peakMonthlySales, peak_period: m.peakPeriod, confidence: m.confidence,
 }))
 .sort((a, b) => (b.estimated_monthly_revenue ?? 0) - (a.estimated_monthly_revenue ?? 0));
 return {
 scope: input.store ?? "All",
 window: { from: periods[0], to: periods.at(-1), months: periods.length },
 total_recoverable_monthly_revenue: kpi.revenue,
 total_recoverable_monthly_sales: kpi.sales,
 dormant_count: kpi.dormant,
 declining_count: kpi.declining,
 opportunities,
 caveat: "This is a planning estimate (each source returns to its own historical run rate), not a forecast. See search_knowledge for reliability caveats before quoting a figure.",
 };
}

function drilldown(rows: Row[], input: { dimension: "store" | "source" | "month"; store?: string; source?: string; years?: number }) {
 const years = input.years ?? 3;
 if (input.dimension === "store") {
 const { rows: filtered, periods } = filterData(rows, "All", years, "All");
 const stores = [...new Set(filtered.map(r => r.store))];
 return {
 dimension: "store", window: { from: periods[0], to: periods.at(-1) },
 rows: stores.map(store => ({ store, ...aggregate(filtered.filter(r => r.store === store)) })),
 };
 }
 if (input.dimension === "source") {
 const { rows: filtered, periods } = filterData(rows, input.store ?? "All", years, "All");
 const sources = [...new Set(filtered.map(r => r.source))];
 return {
 dimension: "source", scope: input.store ?? "All", window: { from: periods[0], to: periods.at(-1) },
 rows: sources.map(source => ({ source, ...aggregate(filtered.filter(r => r.source === source)) })),
 };
 }
 // month
 const { rows: filtered, periods } = filterData(rows, input.store ?? "All", years, "All");
 const bySource = input.source ? filtered.filter(r => r.source === input.source) : filtered;
 return {
 dimension: "month", scope: input.store ?? "All", source: input.source ?? "All",
 rows: periods.map(period => ({ period, ...aggregate(bySource.filter(r => r.period === period)) })),
 };
}

function search_knowledge_tool(input: { query: string }) {
 const results = searchKnowledge(input.query, 3);
 if (results.length === 0) return { results: [], note: "No knowledge base note matched this query." };
 return { results: results.map(r => ({ title: r.title, type: r.type, tags: r.tags, body: r.body })) };
}

// ---- tool schemas (Anthropic.Tool[]) ----------------------------------------

const metricEnum = { type: "string" as const, enum: METRICS, description: "One of: " + METRICS.join(", ") + ". All are SUM/SUM rollups, never averaged ratios." };
const storeParam = { type: "string" as const, description: "A store name from list_stores, or omit / \"All\" for the whole group." };

export const TOOLS: Anthropic.Tool[] = [
 {
 name: "think",
 description: "Write down your reasoning between data-gathering steps. Does not fetch data or change anything; use it to plan the next tool call or state a hypothesis before confirming it.",
 input_schema: { type: "object", properties: { thought: { type: "string" } }, required: ["thought"] },
 },
 {
 name: "list_stores",
 description: "List the rooftops (stores) in this dealer group, with lifetime totals, for scoping later calls.",
 input_schema: { type: "object", properties: {} },
 },
 {
 name: "get_kpi",
 description: "One metric for a scope and a single month, with prior-month and prior-year comparisons when those periods exist in the data. Use this for 'what was X in month Y' or 'how did X change' questions.",
 input_schema: {
 type: "object",
 properties: { store: storeParam, metric: metricEnum, period: { type: "string", description: "Month as YYYY-MM." } },
 required: ["metric", "period"],
 },
 },
 {
 name: "get_kpi_timeline",
 description: "A monthly series for one metric, for trend lines and spotting when a drop or drift started.",
 input_schema: {
 type: "object",
 properties: { store: storeParam, metric: metricEnum, months: { type: "integer", description: "How many recent months, default 12." } },
 required: ["metric"],
 },
 },
 {
 name: "get_source_rollup",
 description: "Per-lead-source totals (leads, sales, gross, closing ratio, dormant/declining status) over an analysis window. Does NOT include a dollar recoverable-revenue estimate - call get_revenue_recovery for that, never infer it from status alone.",
 input_schema: {
 type: "object",
 properties: { store: storeParam, years: { type: "integer", description: "Analysis window in years, default 3." } },
 },
 },
 {
 name: "get_revenue_recovery",
 description: "Dormant and declining sources with recoverable monthly revenue, exactly as shown on the dashboard's headline cards. This is the required tool for any question about which source to cut, drop, keep, or win back - call it even if you already have ROI numbers from another tool, because it carries the dormant/declining classification and the recoverable-revenue estimate those decisions turn on. Always pair with search_knowledge before quoting a recoverable-revenue figure, to check reliability caveats.",
 input_schema: {
 type: "object",
 properties: { store: storeParam, years: { type: "integer", description: "Analysis window in years, default 3." } },
 },
 },
 {
 name: "drilldown",
 description: "Break a total down one dimension: 'store' splits the whole group by store, 'source' splits a store (or the whole group) by lead source, 'month' splits a store+source into a monthly timeline. Use this to decompose a headline move before concluding a cause.",
 input_schema: {
 type: "object",
 properties: {
 dimension: { type: "string", enum: ["store", "source", "month"] },
 store: storeParam,
 source: { type: "string", description: "A source name, only used with dimension 'month' (optional) to narrow to one source." },
 years: { type: "integer", description: "Analysis window in years, default 3." },
 },
 required: ["dimension"],
 },
 },
 {
 name: "search_knowledge",
 description: "Search the dealer-analytics knowledge base (troubleshooting guides and best practices) for how to read a metric, a known data pattern (like a CRM cutover), or a caveat on an estimate. Always cite the note's title when you use it.",
 input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
 },
];

export function executeTool(name: string, input: Record<string, unknown>, rows: Row[]): unknown {
 switch (name) {
 case "think":
 return { acknowledged: true };
 case "list_stores":
 return list_stores(rows);
 case "get_kpi":
 return get_kpi(rows, input as { store?: string; metric: Metric; period: string });
 case "get_kpi_timeline":
 return get_kpi_timeline(rows, input as { store?: string; metric: Metric; months?: number });
 case "get_source_rollup":
 return get_source_rollup(rows, input as { store?: string; years?: number });
 case "get_revenue_recovery":
 return get_revenue_recovery(rows, input as { store?: string; years?: number });
 case "drilldown":
 return drilldown(rows, input as { dimension: "store" | "source" | "month"; store?: string; source?: string; years?: number });
 case "search_knowledge":
 return search_knowledge_tool(input as { query: string });
 default:
 return { error: `Unknown tool: ${name}` };
 }
}

export { periodGrid };
