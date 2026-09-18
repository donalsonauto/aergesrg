// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Fixed Ops Analyst
 * Service department: RO volume, appointment performance, service retention,
 * and website/digital engagement for the service lane.
 */
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

const SERVICE_METRICS = [
  'service.closedRo','service.sessions','service.goals','service.users','service.newUsers','service.pageViews',
  'appointments.total','appointments.confirmed','appointments.created','appointments.missed','appointments.completed',
  'sales.sales','sales.revenue',
];

async function fetchKpi(metric, dgId, year, month) {
  try { return await apiRequest(`/kpi/get?metric=${encodeURIComponent(metric)}&dealerGroupId=${dgId}&year=${year}&month=${month}&view=month`); }
  catch { return null; }
}
async function fetchDrill(metric, dgId, year, month, dim) {
  try { return await apiRequest(`/kpi/drill-down?metric=${encodeURIComponent(metric)}&dealerGroupId=${dgId}&year=${year}&month=${month}&view=month&drillDown=${dim}`); }
  catch { return null; }
}
async function fetchTrend(metric, dgId, year, month, n) {
  const out=[];
  for(let i=0;i<n;i++){let m=month-i,y=year;while(m<=0){m+=12;y--;}const d=await fetchKpi(metric,dgId,y,m);if(d) out.push({year:y,month:m,value:safeVal(d)});}
  return out.reverse();
}

const safeVal = d => d?.current?.value ?? d?.value ?? null;
const safeMom = d => d?.current?.mom ?? d?.mom ?? null;
const safeYoy = d => d?.current?.yoy ?? d?.yoy ?? null;
function fmtM(y,m){return new Date(y,m-1).toLocaleString('en-US',{month:'short'});}

export async function runFixedOpsAnalyst({ dealerGroupId, year, month, dealerGroupName='the dealership' }) {
  const period = new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'});

  const [kpiRes, roDrill] = await Promise.all([
    Promise.all(SERVICE_METRICS.map(m=>fetchKpi(m,dealerGroupId,year,month).then(v=>[m,v]))),
    fetchDrill('service.closedRo',dealerGroupId,year,month,'dealership'),
  ]);

  const kpis = Object.fromEntries(kpiRes);
  const kpiSnap = {};
  for (const [k,d] of Object.entries(kpis)) kpiSnap[k]={value:safeVal(d),mom:safeMom(d),yoy:safeYoy(d)};

  const trends = {};
  await Promise.all(['service.closedRo','appointments.total','appointments.missed'].map(async m=>{
    trends[m]=await fetchTrend(m,dealerGroupId,year,month,4);
  }));

  function normDrill(raw) {
    if (!raw?.data||typeof raw.data!=='object') return [];
    return Object.values(raw.data).filter(e=>e?.label).map(e=>{
      const curr=typeof e.current==='object'?(e.current?.value??0):(e.current??0);
      return {label:e.label,value:curr};
    }).sort((a,b)=>b.value-a.value);
  }

  const roByStore = normDrill(roDrill);

  const kpiLines = Object.entries(kpiSnap).filter(([,d])=>d.value!=null)
    .map(([k,d])=>`  ${k}: ${d.value}${d.mom!=null?` (${d.mom>0?'+':''}${Number(d.mom).toFixed(1)}% MoM)`:''}`).join('\n');

  const aptTotal = kpiSnap['appointments.total']?.value;
  const aptMissed = kpiSnap['appointments.missed']?.value;
  const aptCompleted = kpiSnap['appointments.completed']?.value;
  const missRate = aptTotal&&aptMissed ? Math.round((aptMissed/aptTotal)*100) : null;

  const trendLines = Object.entries(trends).map(([m,arr])=>`  ${m}: ${arr.map(t=>`${fmtM(t.year,t.month)}: ${t.value??'N/A'}`).join(', ')}`).join('\n');

  const prompt = `Analyze fixed ops (service department) performance for ${dealerGroupName} for ${period}.

## Service KPIs
${kpiLines||'  No data'}
${missRate!=null?`  Appointment no-show rate: ${missRate}%`:''}

## Closed ROs by Store
${roByStore.map(r=>`  ${r.label}: ${r.value} ROs`).join('\n')||'  No store breakdown'}

## 4-Month Trend
${trendLines||'  No trend data'}

Note: Service absorption rate = service gross profit / total dealership fixed costs. Target: 70-100%+.
We have RO count and appointment data. Use these to infer service health.

Return JSON:
{
  "score": <0-100>,
  "grade": <letter>,
  "summary": <2-3 sentence exec summary>,
  "keyFindings": [<string>],
  "serviceHealth": {
    "roVolume": <number or null>,
    "roMom": <number or null>,
    "appointmentShowRate": <number, percentage shown of booked or null>,
    "noShowRate": <number or null>,
    "digitalEngagement": <string, assessment of service.sessions and goals>,
    "assessment": <"strong"|"average"|"weak">
  },
  "appointmentAnalysis": {
    "totalBooked": <number or null>,
    "completed": <number or null>,
    "missed": <number or null>,
    "noShowImpact": <string, estimated revenue loss from missed apts>,
    "recommendations": [<string>]
  },
  "storePerformance": [{ "store": <string>, "ros": <number>, "assessment": <"strong"|"average"|"weak"> }],
  "recommendations": [{ "priority": <critical|high|medium|low>, "title": <string>, "detail": <string>, "estimatedImpact": <string> }],
  "alerts": [{ "severity": <critical|warning|info>, "message": <string> }],
  "trendInsight": <string>
}
Benchmarks: 350+ ROs/month/rooftop is healthy; no-show rate should be <15%; service absorption target 70%+.`;

  const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 3000,
    system: `You are the Fixed Ops Analyst for Carfinity Intelligence. Analyze service department performance. Return valid JSON only.`,
    messages: [{role:'user',content:prompt}] });

  const raw = msg.content[0]?.text?.trim()||'{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
  let result;
  try { result = JSON.parse(jsonStr); } catch { result = {error:'Parse failed',raw:jsonStr.slice(0,300)}; }
  result._data = { period,year,month,kpiSnap,roByStore,trends,usage:{inputTokens:msg.usage?.input_tokens,outputTokens:msg.usage?.output_tokens}};
  return result;
}
