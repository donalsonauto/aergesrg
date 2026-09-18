// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Strategy Analyst
 * Synthesizes all 7 other analysts into a weekly SWOT, priority ranking,
 * and cross-department action plan. Runs last; reads other analysts' results.
 */
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import * as db from '../db.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

const CORE_METRICS = [
  'sales.sales','sales.pvr','sales.revenue','sales.closingRatio',
  'lead-source-roi.goodLeads','lead-source-roi.cps','lead-source-roi.budget',
  'inventory.inventory','inventory.priceToMarket',
  'service.closedRo','appointments.total',
];

async function fetchKpi(metric, dgId, year, month) {
  try { return await apiRequest(`/kpi/get?metric=${encodeURIComponent(metric)}&dealerGroupId=${dgId}&year=${year}&month=${month}&view=month`); }
  catch { return null; }
}

const safeVal = d => d?.current?.value ?? d?.value ?? null;
const safeMom = d => d?.current?.mom ?? d?.mom ?? null;

export async function runStrategyAnalyst({ dealerGroupId, year, month, dealerGroupName='the dealership' }) {
  const period = new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'});

  // Fetch core KPIs + all other analyst latest results in parallel
  const analystIds = ['marketing-roi','deal-desk','sales-team','fixed-ops','lot','market-radar','acquisition'];

  const [kpiRes, ...analystRuns] = await Promise.all([
    Promise.all(CORE_METRICS.map(m=>fetchKpi(m,dealerGroupId,year,month).then(v=>[m,v]))),
    ...analystIds.map(id => Promise.resolve(db.getLatestAnalystRun(id, dealerGroupId, year, month))),
  ]);

  const kpis = Object.fromEntries(kpiRes);
  const kpiSnap = {};
  for(const[k,d] of Object.entries(kpis)) kpiSnap[k]={value:safeVal(d),mom:safeMom(d)};

  // Collect summaries and scores from each analyst
  const analystSummaries = {};
  for (let i=0; i<analystIds.length; i++) {
    const run = analystRuns[i];
    if (run?.result_json) {
      try {
        const r = JSON.parse(run.result_json);
        analystSummaries[analystIds[i]] = {
          score: r.score, grade: r.grade, summary: r.summary,
          keyFindings: r.keyFindings || [],
          topRec: r.recommendations?.[0] || null,
          alerts: r.alerts?.filter(a=>a.severity==='critical') || [],
        };
      } catch {}
    }
  }

  const kpiLines = Object.entries(kpiSnap).filter(([,d])=>d.value!=null)
    .map(([k,d])=>`  ${k}: ${d.value}${d.mom!=null?` (${d.mom>0?'+':''}${Number(d.mom).toFixed(1)}% MoM)`:''}`).join('\n');

  const analystLines = Object.entries(analystSummaries).map(([id, a]) =>
    `  [${id.toUpperCase()}] Score: ${a.score||'N/A'}/100 (${a.grade||'?'})\n  Summary: ${a.summary||'No summary'}\n  Top Issue: ${a.topRec?.title||'None'}\n  Critical Alerts: ${a.alerts.map(x=>x.message).join('; ')||'None'}`
  ).join('\n\n');

  const prompt = `Generate a strategic weekly analysis for ${dealerGroupName} for ${period}.

## Core KPIs This Month
${kpiLines||'  No data'}

## Other Analyst Results
${analystLines||'  No analyst results yet — run other analysts first for richer strategy analysis'}

Return JSON:
{
  "score": <0-100 — overall dealership health score weighted across all departments>,
  "grade": <letter>,
  "summary": <3-4 sentence comprehensive executive summary — the most important things happening across the dealership>,
  "weeklyFocus": <string, THE single most important thing to focus on this week and why>,
  "swot": {
    "strengths": [<string, specific strength with data>],
    "weaknesses": [<string, specific weakness with data>],
    "opportunities": [<string, specific opportunity with potential impact>],
    "threats": [<string, specific threat with context>]
  },
  "departmentScorecard": [
    { "department": <string>, "score": <number or null>, "grade": <string or null>, "status": <"on-track"|"at-risk"|"critical">, "topPriority": <string> }
  ],
  "crossDepartmentPriorities": [
    { "rank": <1-5>, "initiative": <string>, "departments": [<string>], "impact": <string>, "timeframe": <string, e.g. "This week"|"This month"> }
  ],
  "recommendations": [
    { "priority": <critical|high|medium|low>, "title": <string>, "detail": <string>, "owner": <string, which role/department>, "estimatedImpact": <string> }
  ],
  "alerts": [{ "severity": <critical|warning|info>, "message": <string> }],
  "monthlyOutlook": <string, 2-3 sentences on how the month is tracking and what to expect>
}
Be bold and specific. The dealer principal reads this Monday morning. Make it count.`;

  const msg = await anthropic.messages.create({ model:MODEL, max_tokens:5000,
    system:`You are the Strategy Analyst for Carfinity Intelligence — the senior analyst who synthesizes all other analysts into a coherent executive strategy. Return valid JSON only.`,
    messages:[{role:'user',content:prompt}] });

  const raw = msg.content[0]?.text?.trim()||'{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
  let result;
  try { result=JSON.parse(jsonStr); } catch { result={error:'Parse failed',raw:jsonStr.slice(0,300)}; }
  result._data={period,year,month,kpiSnap,analystSummaries,usage:{inputTokens:msg.usage?.input_tokens,outputTokens:msg.usage?.output_tokens}};
  return result;
}
