// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Marketing ROI Analyst
 *
 * Analyzes dealership marketing spend efficiency across all lead sources.
 * Fetches KPI data from the Carfinity API, builds a rich data snapshot,
 * sends it to Claude for analysis, and returns a structured JSON result.
 */

import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

// KPI metrics to fetch for the analysis
const MARKETING_METRICS = [
  'lead-source-roi.budget',
  'lead-source-roi.cpl',
  'lead-source-roi.cps',
  'lead-source-roi.goodLeads',
  'lead-source-roi.forms',
  'paid-search.spend',
  'paid-search.clicks',
  'paid-search.avgCpc',
  'paid-search.impressions',
  'paid-search.sessions',
  'sales.sales',
  'sales.closingRatio',
  'sales.revenue',
  'website.sessions',
  'website.conversion',
];

async function fetchKpi(metric, dealerGroupId, year, month) {
  try {
    const data = await apiRequest(`/kpi/get?metric=${encodeURIComponent(metric)}&dealerGroupId=${dealerGroupId}&year=${year}&month=${month}&view=month`);
    return data;
  } catch {
    return null;
  }
}

async function fetchDrilldown(metric, dealerGroupId, year, month, drillDown) {
  try {
    const data = await apiRequest(
      `/kpi/drill-down?metric=${encodeURIComponent(metric)}&dealerGroupId=${dealerGroupId}&year=${year}&month=${month}&view=month&drillDown=${drillDown}`
    );
    return data;
  } catch {
    return null;
  }
}

// Fetch the same metric for N months back to build trend data
async function fetchTrend(metric, dealerGroupId, year, month, monthsBack) {
  const results = [];
  for (let i = 0; i < monthsBack; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    const d = await fetchKpi(metric, dealerGroupId, y, m);
    if (d) results.push({ year: y, month: m, ...d });
  }
  return results.reverse();
}

function formatMonth(year, month) {
  return new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function safeVal(obj) {
  if (!obj) return null;
  return obj.current?.value ?? obj.value ?? null;
}

function safeMom(obj) {
  if (!obj) return null;
  return obj.mom ?? obj.current?.mom ?? null;
}

function safeYoy(obj) {
  if (!obj) return null;
  return obj.yoy ?? obj.current?.yoy ?? null;
}

export async function runMarketingRoiAnalyst({ dealerGroupId, year, month, dealerGroupName = 'the dealership' }) {
  // 1. Fetch all marketing KPIs in parallel
  const [kpiResults, leadsDrilldown, budgetDrilldown] = await Promise.all([
    Promise.all(MARKETING_METRICS.map(m => fetchKpi(m, dealerGroupId, year, month).then(v => [m, v]))),
    fetchDrilldown('lead-source-roi.goodLeads', dealerGroupId, year, month, 'tag'),
    fetchDrilldown('lead-source-roi.budget', dealerGroupId, year, month, 'tag'),
  ]);

  const kpis = Object.fromEntries(kpiResults);

  // 2. Fetch 4-month trend for key metrics
  const trendMetrics = ['lead-source-roi.budget', 'lead-source-roi.cpl', 'lead-source-roi.cps', 'lead-source-roi.goodLeads', 'sales.sales'];
  const trends = {};
  await Promise.all(trendMetrics.map(async (m) => {
    trends[m] = await fetchTrend(m, dealerGroupId, year, month, 4);
  }));

  // 3. Build the data payload for Claude
  const period = formatMonth(year, month);
  const kpiSnapshot = {};
  for (const [metric, data] of Object.entries(kpis)) {
    kpiSnapshot[metric] = {
      value: safeVal(data),
      mom: safeMom(data),
      yoy: safeYoy(data),
    };
  }

  // Normalize drilldown rows into clean arrays
  const leadsbySource = normalizeTagDrilldown(leadsDrilldown);
  const budgetBySource = normalizeTagDrilldown(budgetDrilldown);

  // Merge into unified per-source view
  const sourceMap = {};
  for (const row of leadsbySource) {
    sourceMap[row.tag] = { name: row.tag, leads: row.value, leadsMom: row.mom, leadsYoy: row.yoy };
  }
  for (const row of budgetBySource) {
    if (!sourceMap[row.tag]) sourceMap[row.tag] = { name: row.tag };
    sourceMap[row.tag].budget = row.value;
    sourceMap[row.tag].budgetMom = row.mom;
  }
  // Compute CPL per source where both budget and leads are known
  for (const src of Object.values(sourceMap)) {
    if (src.budget && src.leads && src.leads > 0) {
      src.cpl = Math.round(src.budget / src.leads);
    }
  }
  const sources = Object.values(sourceMap).filter(s => s.leads > 0 || s.budget > 0);

  // 4. Build prompt for Claude
  const prompt = buildAnalysisPrompt({
    period,
    dealerGroupName,
    kpiSnapshot,
    sources,
    trends,
  });

  // 5. Call Claude for analysis
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are the Marketing ROI Analyst for Carfinity Intelligence, an AI platform built for automotive dealerships.
Your job is to analyze marketing spend data and return a precise, actionable JSON analysis.
You understand automotive dealer marketing: lead sources (Cars.com, AutoTrader, CarGurus, TrueCar, Dealer.com, etc.),
paid search (Google Ads), SEO, and how marketing efficiency connects to unit sales and gross profit.
Always return valid JSON only — no markdown, no explanation outside the JSON.`,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0]?.text?.trim() || '{}';

  // Strip markdown code fences if Claude wrapped it
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    result = { error: 'Failed to parse Claude response', raw: jsonStr.slice(0, 500) };
  }

  // Attach the raw data snapshot so the frontend can display live numbers
  result._data = {
    period,
    year,
    month,
    kpiSnapshot,
    sources,
    trends,
    usage: {
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
    },
  };

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTagDrilldown(drilldownData) {
  if (!drilldownData) return [];
  // API returns { drillDown, drillDownName, dataType, data: { key: { label, current, previous, ... } } }
  const dataObj = drilldownData?.data || {};
  if (typeof dataObj !== 'object' || Array.isArray(dataObj)) return [];
  return Object.values(dataObj)
    .filter(e => e && e.label)
    .map(e => {
      const currVal = typeof e.current === 'object' ? (e.current?.value ?? 0) : (e.current ?? 0);
      const prevVal = typeof e.previous === 'object' ? (e.previous?.value ?? 0) : (e.previous ?? 0);
      const mom = (!isNaN(prevVal) && prevVal !== 0) ? ((currVal - prevVal) / Math.abs(prevVal)) * 100 : null;
      return {
        tag: e.label,
        value: currVal,
        mom: mom != null ? Math.round(mom * 10) / 10 : null,
        yoy: null,
      };
    })
    .filter(r => r.tag && r.tag.toLowerCase() !== 'unknown' && r.tag !== '');
}

function buildAnalysisPrompt({ period, dealerGroupName, kpiSnapshot, sources, trends }) {
  const fmt = (v, prefix = '', suffix = '', decimals = 0) =>
    v != null ? `${prefix}${Number(v).toFixed(decimals)}${suffix}` : 'N/A';
  const fmtMom = (v) => v != null ? `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}% MoM` : '';

  const kpiLines = Object.entries(kpiSnapshot)
    .filter(([, d]) => d.value != null)
    .map(([metric, d]) => `  ${metric}: ${d.value} ${fmtMom(d.mom)} (YoY: ${d.yoy != null ? (d.yoy > 0 ? '+' : '') + Number(d.yoy).toFixed(1) + '%' : 'N/A'})`)
    .join('\n');

  const sourceLines = sources.length > 0
    ? sources.map(s =>
        `  - ${s.name}: ${s.leads ?? 'N/A'} leads, budget $${s.budget ?? 'N/A'}, CPL $${s.cpl ?? 'N/A'}`
      ).join('\n')
    : '  No source-level breakdown available';

  const trendLines = Object.entries(trends)
    .filter(([, arr]) => arr.length > 0)
    .map(([metric, arr]) => {
      const vals = arr.map(t => `${formatMonthShort(t.year, t.month)}: ${t.current?.value ?? t.value ?? 'N/A'}`).join(', ');
      return `  ${metric}: ${vals}`;
    })
    .join('\n');

  return `Analyze the marketing performance for ${dealerGroupName} for ${period}.

## Current Month KPIs
${kpiLines || '  No KPI data available'}

## Lead Source Breakdown
${sourceLines}

## 4-Month Trend
${trendLines || '  No trend data available'}

Return a JSON object with this exact structure:
{
  "score": <integer 0-100, overall marketing health>,
  "grade": <"A+"|"A"|"B+"|"B"|"C+"|"C"|"D"|"F">,
  "summary": <string, 2-3 sentence executive summary for a dealer principal>,
  "keyFindings": [<string>, ...],
  "leadSources": [
    {
      "name": <string>,
      "leads": <number or null>,
      "budget": <number or null>,
      "cpl": <number or null>,
      "performance": <"strong"|"average"|"weak">,
      "roiScore": <0-100>,
      "recommendation": <string, specific action>
    }
  ],
  "recommendations": [
    {
      "priority": <"critical"|"high"|"medium"|"low">,
      "title": <string>,
      "detail": <string, specific and data-driven>,
      "estimatedImpact": <string, e.g. "+3-5 sales/month" or "$8,000 savings">
    }
  ],
  "budgetReallocation": [
    {
      "from": <source name>,
      "to": <source name or "reinvest">,
      "amount": <dollar amount>,
      "rationale": <string>
    }
  ],
  "paidSearch": {
    "assessment": <"excellent"|"good"|"average"|"poor">,
    "cpcEfficiency": <string>,
    "topInsight": <string>
  },
  "alerts": [
    {
      "severity": <"critical"|"warning"|"info">,
      "message": <string>
    }
  ],
  "trendInsight": <string, 1-2 sentences on the 4-month trend>
}

Scoring guide: 90-100=A+(exceptional efficiency), 80-89=A, 70-79=B+(good with room),
60-69=B, 50-59=C+(average), 40-49=C, 30-39=D, 0-29=F(immediate action needed).
Focus on what the dealer can ACT ON this week. Be specific with numbers.`;
}

function formatMonthShort(year, month) {
  return new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
}
