// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Sales Team Analyst
 * Individual salesperson coaching: leads → appts → sold → gross funnel analysis.
 */
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

const TOP_METRICS = ['sales.leads','sales.sales','sales.revenue','sales.closingRatio','sales.pvr','sales.frontPvr','sales.backPvr'];

async function fetchKpi(metric, dgId, year, month) {
  try { return await apiRequest(`/kpi/get?metric=${encodeURIComponent(metric)}&dealerGroupId=${dgId}&year=${year}&month=${month}&view=month`); }
  catch { return null; }
}
async function fetchDrill(metric, dgId, year, month, dim) {
  try { return await apiRequest(`/kpi/drill-down?metric=${encodeURIComponent(metric)}&dealerGroupId=${dgId}&year=${year}&month=${month}&view=month&drillDown=${dim}`); }
  catch { return null; }
}
async function fetchTrend(metric, dgId, year, month, n) {
  const out = [];
  for (let i=0;i<n;i++) { let m=month-i,y=year; while(m<=0){m+=12;y--;} const d=await fetchKpi(metric,dgId,y,m); if(d) out.push({year:y,month:m,value:safeVal(d)}); }
  return out.reverse();
}

const safeVal = d => d?.current?.value ?? d?.value ?? null;
const safeMom = d => d?.current?.mom ?? d?.mom ?? null;
const safeYoy = d => d?.current?.yoy ?? d?.yoy ?? null;

function normDrill(raw) {
  if (!raw?.data || typeof raw.data !== 'object') return [];
  return Object.values(raw.data)
    .filter(e => e?.label)
    .map(e => {
      const curr = typeof e.current==='object' ? (e.current?.value??0) : (e.current??0);
      const prev = typeof e.previous==='object' ? (e.previous?.value??0) : (e.previous??0);
      const mom = prev!==0 ? Math.round(((curr-prev)/Math.abs(prev))*1000)/10 : null;
      return { label: e.label, value: curr, mom };
    })
    .sort((a,b)=>(b.value||0)-(a.value||0));
}

function fmtM(y,m) { return new Date(y,m-1).toLocaleString('en-US',{month:'short'}); }

export async function runSalesTeamAnalyst({ dealerGroupId, year, month, dealerGroupName='the dealership' }) {
  const period = new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'});

  const [kpiRes, leadsBySP, salesBySP, pvrBySP, revBySP, closingBySP] = await Promise.all([
    Promise.all(TOP_METRICS.map(m=>fetchKpi(m,dealerGroupId,year,month).then(v=>[m,v]))),
    fetchDrill('sales.leads',dealerGroupId,year,month,'salePerson'),
    fetchDrill('sales.sales',dealerGroupId,year,month,'salePerson'),
    fetchDrill('sales.pvr',dealerGroupId,year,month,'salePerson'),
    fetchDrill('sales.revenue',dealerGroupId,year,month,'salePerson'),
    fetchDrill('sales.closingRatio',dealerGroupId,year,month,'salePerson'),
  ]);

  const kpis = Object.fromEntries(kpiRes);
  const kpiSnap = {};
  for (const [k,d] of Object.entries(kpis)) kpiSnap[k]={value:safeVal(d),mom:safeMom(d),yoy:safeYoy(d)};

  const trends = {};
  await Promise.all(['sales.sales','sales.pvr','sales.closingRatio'].map(async m => { trends[m]=await fetchTrend(m,dealerGroupId,year,month,4); }));

  const leads = normDrill(leadsBySP);
  const sales = normDrill(salesBySP);
  const pvr = normDrill(pvrBySP);
  const rev = normDrill(revBySP);
  const closing = normDrill(closingBySP);

  // Merge into unified per-salesperson view
  const spMap = {};
  for (const r of leads) { spMap[r.label]={name:r.label,leads:r.value}; }
  for (const r of sales) { if(!spMap[r.label]) spMap[r.label]={name:r.label}; spMap[r.label].sales=r.value; }
  for (const r of pvr) { if(!spMap[r.label]) spMap[r.label]={name:r.label}; spMap[r.label].pvr=r.value; }
  for (const r of rev) { if(!spMap[r.label]) spMap[r.label]={name:r.label}; spMap[r.label].revenue=r.value; }
  for (const r of closing) { if(!spMap[r.label]) spMap[r.label]={name:r.label}; spMap[r.label].closingRatio=r.value; }
  // Derived closing ratio if not from API
  for (const sp of Object.values(spMap)) {
    if (!sp.closingRatio && sp.leads && sp.leads>0 && sp.sales!=null) sp.closingRatio=Math.round((sp.sales/sp.leads)*1000)/10;
  }
  const spList = Object.values(spMap).filter(s=>s.sales!=null||s.leads!=null).sort((a,b)=>(b.pvr||0)-(a.pvr||0));

  const kpiLines = Object.entries(kpiSnap).filter(([,d])=>d.value!=null)
    .map(([k,d])=>`  ${k}: ${d.value}${d.mom!=null?` (${d.mom>0?'+':''}${Number(d.mom).toFixed(1)}% MoM)`:''}`).join('\n');

  const spLines = spList.slice(0,20).map(s=>
    `  ${s.name}: ${s.leads??'?'} leads → ${s.sales??'?'} sold | ${s.closingRatio?.toFixed(1)??'?'}% close | $${s.pvr?.toLocaleString()??'?'} PVR | $${s.revenue?.toLocaleString()??'?'} gross`
  ).join('\n');

  const trendLines = Object.entries(trends).map(([m,arr])=>`  ${m}: ${arr.map(t=>`${fmtM(t.year,t.month)}: ${t.value??'N/A'}`).join(', ')}`).join('\n');

  const prompt = `Analyze the sales team performance for ${dealerGroupName} for ${period}.

## Team-Level KPIs
${kpiLines||'  No data'}

## Salesperson Breakdown (sorted by PVR)
${spLines||'  No salesperson data available'}

## 4-Month Trend
${trendLines||'  No trend data'}

Return JSON:
{
  "score": <0-100>,
  "grade": <letter>,
  "summary": <2-3 sentence exec summary>,
  "keyFindings": [<string>],
  "teamStats": {
    "totalSalespeople": <number>,
    "avgPvr": <number or null>,
    "avgClosingRatio": <number or null>,
    "topPerformerName": <string or null>,
    "bottomPerformerName": <string or null>,
    "pvrSpread": <top minus bottom or null>
  },
  "performers": {
    "stars": [{ "name": <string>, "pvr": <number>, "closingRatio": <number>, "strength": <string> }],
    "needsCoaching": [{ "name": <string>, "issue": <string>, "coachingFocus": <string>, "specificScript": <string, a 1-2 sentence coaching talking point> }]
  },
  "recommendations": [{ "priority": <critical|high|medium|low>, "title": <string>, "detail": <string>, "estimatedImpact": <string> }],
  "coachingPriorities": [{ "rank": <1-3>, "focus": <string>, "whyNow": <string>, "action": <string> }],
  "alerts": [{ "severity": <critical|warning|info>, "message": <string> }],
  "trendInsight": <string>
}
Benchmarks: good closing ratio 10-15%, good PVR $2,500+. Be direct — name who needs coaching and exactly what to work on.`;

  const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 4096,
    system: `You are the Sales Team Analyst for Carfinity Intelligence. Analyze individual salesperson performance data and generate specific, actionable coaching recommendations. Return valid JSON only.`,
    messages: [{role:'user',content:prompt}] });

  const raw = msg.content[0]?.text?.trim()||'{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
  let result;
  try { result = JSON.parse(jsonStr); } catch { result = {error:'Parse failed',raw:jsonStr.slice(0,300)}; }

  result._data = { period, year, month, kpiSnap, salespeople: spList, trends,
    usage: {inputTokens:msg.usage?.input_tokens,outputTokens:msg.usage?.output_tokens} };
  return result;
}
