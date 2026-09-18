// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Deal Desk Analyst
 *
 * Analyzes per-deal profitability: front/back gross mix, PVR trends,
 * gross efficiency by segment, and identifies where money is being left
 * on the table across deals.
 */

import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

const DEAL_METRICS = [
  'sales.pvr',
  'sales.frontPvr',
  'sales.backPvr',
  'sales.frontGross',
  'sales.backGross',
  'sales.revenue',
  'sales.sales',
  'sales.closingRatio',
  'sales.advPerUnit',
  'sales.gap',
];

async function fetchKpi(metric, dealerGroupId, year, month) {
  try {
    return await apiRequest(`/kpi/get?metric=${encodeURIComponent(metric)}&dealerGroupId=${dealerGroupId}&year=${year}&month=${month}&view=month`);
  } catch { return null; }
}

async function fetchDrilldown(metric, dealerGroupId, year, month, drillDown) {
  try {
    return await apiRequest(`/kpi/drill-down?metric=${encodeURIComponent(metric)}&dealerGroupId=${dealerGroupId}&year=${year}&month=${month}&view=month&drillDown=${drillDown}`);
  } catch { return null; }
}

async function fetchTrend(metric, dealerGroupId, year, month, monthsBack) {
  const results = [];
  for (let i = 0; i < monthsBack; i++) {
    let m = month - i, y = year;
    while (m <= 0) { m += 12; y -= 1; }
    const d = await fetchKpi(metric, dealerGroupId, y, m);
    if (d) results.push({ year: y, month: m, value: safeVal(d), mom: safeMom(d) });
  }
  return results.reverse();
}

const safeVal = (d) => d?.current?.value ?? d?.value ?? null;
const safeMom = (d) => d?.current?.mom ?? d?.mom ?? null;
const safeYoy = (d) => d?.current?.yoy ?? d?.yoy ?? null;
const fmt2 = (v) => v != null ? Number(v).toFixed(1) : 'N/A';
const fmtMom = (v) => v != null ? `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}% MoM` : '';

function normalizeDrilldown(raw) {
  if (!raw?.data || typeof raw.data !== 'object') return [];
  return Object.values(raw.data)
    .filter(e => e?.label)
    .map(e => {
      const curr = typeof e.current === 'object' ? (e.current?.value ?? 0) : (e.current ?? 0);
      const prev = typeof e.previous === 'object' ? (e.previous?.value ?? 0) : (e.previous ?? 0);
      const mom = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
      return { label: e.label, value: curr, mom: mom != null ? Math.round(mom * 10) / 10 : null };
    })
    .sort((a, b) => (b.value || 0) - (a.value || 0));
}

function formatMonthShort(year, month) {
  return new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
}

export async function runDealDeskAnalyst({ dealerGroupId, year, month, dealerGroupName = 'the dealership' }) {
  const period = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Fetch all KPIs + drilldowns in parallel
  const [kpiResults, pvrByType, revenueByType, grossByType, pvrBySalesperson] = await Promise.all([
    Promise.all(DEAL_METRICS.map(m => fetchKpi(m, dealerGroupId, year, month).then(v => [m, v]))),
    fetchDrilldown('sales.pvr', dealerGroupId, year, month, 'carType'),
    fetchDrilldown('sales.revenue', dealerGroupId, year, month, 'carType'),
    fetchDrilldown('sales.backGross', dealerGroupId, year, month, 'carType'),
    fetchDrilldown('sales.pvr', dealerGroupId, year, month, 'salePerson'),
  ]);

  const kpis = Object.fromEntries(kpiResults);

  // Fetch 4-month trend for key metrics
  const trendMetrics = ['sales.pvr', 'sales.frontPvr', 'sales.backPvr', 'sales.revenue', 'sales.sales'];
  const trends = {};
  await Promise.all(trendMetrics.map(async m => {
    trends[m] = await fetchTrend(m, dealerGroupId, year, month, 4);
  }));

  const kpiSnapshot = {};
  for (const [metric, data] of Object.entries(kpis)) {
    kpiSnapshot[metric] = { value: safeVal(data), mom: safeMom(data), yoy: safeYoy(data) };
  }

  const pvrByTypeRows = normalizeDrilldown(pvrByType);
  const revenueByTypeRows = normalizeDrilldown(revenueByType);
  const backGrossByTypeRows = normalizeDrilldown(grossByType);
  const pvrBySalespersonRows = normalizeDrilldown(pvrBySalesperson).slice(0, 15);

  // Build prompt
  const kpiLines = Object.entries(kpiSnapshot)
    .filter(([, d]) => d.value != null)
    .map(([k, d]) => `  ${k}: ${d.value} ${fmtMom(d.mom)} ${d.yoy != null ? `(YoY: ${d.yoy > 0 ? '+' : ''}${fmt2(d.yoy)}%)` : ''}`)
    .join('\n');

  const pvrLines = pvrByTypeRows.map(r => `  ${r.label}: $${r.value?.toLocaleString?.() ?? r.value} PVR ${r.mom != null ? `(${r.mom > 0 ? '+' : ''}${r.mom.toFixed(1)}% MoM)` : ''}`).join('\n');
  const revLines = revenueByTypeRows.map(r => `  ${r.label}: $${r.value?.toLocaleString?.() ?? r.value} gross`).join('\n');
  const backLines = backGrossByTypeRows.map(r => `  ${r.label}: $${r.value?.toLocaleString?.() ?? r.value} back-end gross`).join('\n');

  const topSalespeople = pvrBySalespersonRows.slice(0, 8).map(r => `  ${r.label}: $${r.value?.toLocaleString?.() ?? r.value} PVR`).join('\n');
  const bottomSalespeople = pvrBySalespersonRows.slice(-5).map(r => `  ${r.label}: $${r.value?.toLocaleString?.() ?? r.value} PVR`).join('\n');

  const trendLines = Object.entries(trends)
    .filter(([, arr]) => arr.length > 0)
    .map(([metric, arr]) => {
      const vals = arr.map(t => `${formatMonthShort(t.year, t.month)}: $${t.value != null ? Math.round(t.value).toLocaleString() : 'N/A'}`).join(', ');
      return `  ${metric}: ${vals}`;
    })
    .join('\n');

  const prompt = `Analyze deal desk profitability for ${dealerGroupName} for ${period}.

## Current Month KPIs
${kpiLines || '  No data'}

## PVR by Vehicle Type (New/Used/CPO)
${pvrLines || '  No breakdown available'}

## Gross Revenue by Type
${revLines || '  No breakdown available'}

## Back-End Gross by Type
${backLines || '  No breakdown available'}

## Salesperson PVR (Top Performers)
${topSalespeople || '  No data'}

## Salesperson PVR (Bottom Performers)
${bottomSalespeople || '  No data'}

## 4-Month Trend
${trendLines || '  No trend data'}

Return a JSON object with this exact structure:
{
  "score": <integer 0-100, overall deal desk health>,
  "grade": <"A+"|"A"|"B+"|"B"|"C+"|"C"|"D"|"F">,
  "summary": <string, 2-3 sentence executive summary for dealer principal>,
  "keyFindings": [<string>, ...],
  "grossMix": {
    "frontPvr": <number or null>,
    "backPvr": <number or null>,
    "totalPvr": <number or null>,
    "frontPct": <percent of total PVR that is front-end, or null>,
    "backPct": <percent of total PVR that is back-end, or null>,
    "assessment": <string, one sentence on the front/back balance>
  },
  "segmentPerformance": [
    {
      "segment": <"New"|"Used"|"CPO"|string>,
      "pvr": <number or null>,
      "revenue": <number or null>,
      "backGross": <number or null>,
      "assessment": <"strong"|"average"|"weak">,
      "insight": <string>
    }
  ],
  "salespersonInsights": {
    "topPerformerPvr": <number or null>,
    "bottomPerformerPvr": <number or null>,
    "pvrSpread": <number or null, top minus bottom>,
    "coachingFocus": <string, what area needs most coaching>,
    "insight": <string>
  },
  "recommendations": [
    {
      "priority": <"critical"|"high"|"medium"|"low">,
      "title": <string>,
      "detail": <string, specific and data-driven>,
      "estimatedImpact": <string>
    }
  ],
  "grossLeakage": [
    {
      "area": <string, e.g. "Back-end on used vehicles">,
      "estimatedLoss": <string, e.g. "$150/unit" or "$45,000/month">,
      "cause": <string>,
      "fix": <string>
    }
  ],
  "trendInsight": <string, 1-2 sentences on 4-month trend>,
  "alerts": [
    { "severity": <"critical"|"warning"|"info">, "message": <string> }
  ]
}

Scoring: 90-100=A+(exceptional), 80-89=A, 70-79=B+, 60-69=B, 50-59=C+, 40-49=C, 30-39=D, 0-29=F.
Industry benchmarks: $2,500-$3,000+ total PVR is good; 40-50% back-end contribution is healthy.
Be specific with dollar amounts. Focus on actionable insights the desk can use this week.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are the Deal Desk Analyst for Carfinity Intelligence, an AI platform built for automotive dealerships.
Analyze front-end gross, back-end F&I performance, PVR trends, and per-deal profitability.
Industry context: good dealers target $2,500-$3,500+ total PVR. Back-end (F&I) should contribute 40-55% of total gross.
Return valid JSON only — no markdown, no explanation outside the JSON.`,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0]?.text?.trim() || '{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    result = { error: 'Failed to parse Claude response', raw: jsonStr.slice(0, 500) };
  }

  result._data = {
    period, year, month,
    kpiSnapshot,
    pvrByType: pvrByTypeRows,
    revenueByType: revenueByTypeRows,
    pvrBySalesperson: pvrBySalespersonRows,
    trends,
    usage: { inputTokens: message.usage?.input_tokens, outputTokens: message.usage?.output_tokens },
  };

  return result;
}
