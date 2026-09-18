// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Market Radar Analyst
 * Competitive positioning: market share, price position vs. market,
 * DMA competitive landscape, and lead source market intelligence.
 */
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

const RADAR_METRICS = [
  'inventory.priceToMarket','inventory.lastDayPriceToMarket','inventory.inventory',
  'inventory.totalVdpViewsPerVin','inventory.thirdPartyViewsPerVin',
  'lead-source-roi.goodLeads','lead-source-roi.cps','lead-source-roi.totalVdpViews',
  'lead-source-roi.thirdPartyVdpViews','lead-source-roi.thirdPartyInventory',
  'lead-source-roi.leadsPerVdpView','lead-source-roi.salesPerVdpView',
  'website.sessions','website.vdpViews','website.conversion','website.viewsPerVdp',
  'sales.sales','sales.closingRatio',
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
  for(let i=0;i<n;i++){let m=month-i,y=year;while(m<=0){m+=12;y--;}const d=await fetchKpi(metric,dgId,y,m);if(d) out.push({year:y,month:m,value:d?.current?.value??d?.value??null});}
  return out.reverse();
}

const safeVal = d => d?.current?.value ?? d?.value ?? null;
const safeMom = d => d?.current?.mom ?? d?.mom ?? null;
function fmtM(y,m){return new Date(y,m-1).toLocaleString('en-US',{month:'short'});}
function normDrill(raw) {
  if(!raw?.data||typeof raw.data!=='object') return [];
  return Object.values(raw.data).filter(e=>e?.label).map(e=>({
    label:e.label, value:typeof e.current==='object'?(e.current?.value??0):(e.current??0),
    mom:null
  })).sort((a,b)=>b.value-a.value);
}

export async function runMarketRadarAnalyst({ dealerGroupId, year, month, dealerGroupName='the dealership' }) {
  const period = new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'});

  const [kpiRes, ptmByType, vdpBySource, leadsByMake] = await Promise.all([
    Promise.all(RADAR_METRICS.map(m=>fetchKpi(m,dealerGroupId,year,month).then(v=>[m,v]))),
    fetchDrill('inventory.priceToMarket',dealerGroupId,year,month,'carType'),
    fetchDrill('lead-source-roi.thirdPartyVdpViews',dealerGroupId,year,month,'tag'),
    fetchDrill('lead-source-roi.goodLeads',dealerGroupId,year,month,'carMake'),
  ]);

  const kpis = Object.fromEntries(kpiRes);
  const kpiSnap = {};
  for(const[k,d] of Object.entries(kpis)) kpiSnap[k]={value:safeVal(d),mom:safeMom(d)};

  const trends={};
  await Promise.all(['inventory.priceToMarket','lead-source-roi.thirdPartyVdpViews','sales.sales'].map(async m=>{
    trends[m]=await fetchTrend(m,dealerGroupId,year,month,4);
  }));

  const ptmByTypeRows = normDrill(ptmByType);
  const vdpBySourceRows = normDrill(vdpBySource).slice(0,10);
  const leadsByMakeRows = normDrill(leadsByMake).slice(0,10);

  const kpiLines = Object.entries(kpiSnap).filter(([,d])=>d.value!=null)
    .map(([k,d])=>`  ${k}: ${d.value}${d.mom!=null?` (${d.mom>0?'+':''}${Number(d.mom).toFixed(1)}% MoM)`:''}`).join('\n');

  const ptmLines = ptmByTypeRows.map(r=>`  ${r.label}: ${Math.round(r.value||0)}% price-to-market`).join('\n');
  const vdpLines = vdpBySourceRows.map(r=>`  ${r.label}: ${Number(r.value||0).toLocaleString()} 3rd-party VDP views`).join('\n');
  const makeLines = leadsByMakeRows.map(r=>`  ${r.label}: ${r.value} leads`).join('\n');
  const trendLines = Object.entries(trends).map(([m,arr])=>`  ${m}: ${arr.map(t=>`${fmtM(t.year,t.month)}: ${t.value??'N/A'}`).join(', ')}`).join('\n');

  const prompt = `Analyze competitive market positioning for ${dealerGroupName} for ${period}.

## Market Position KPIs
${kpiLines||'  No data'}

## Price-to-Market by Vehicle Type
${ptmLines||'  No breakdown'}

## 3rd-Party VDP Views by Platform
${vdpLines||'  No data'}

## Lead Demand by Make/Brand
${makeLines||'  No data'}

## 4-Month Trend
${trendLines||'  No trend'}

Return JSON:
{
  "score": <0-100>,
  "grade": <letter>,
  "summary": <2-3 sentence exec summary>,
  "keyFindings": [<string>],
  "marketPosition": {
    "priceToMarket": <number, avg PTM% or null>,
    "pricePositionAssessment": <"competitive"|"overpriced"|"underpriced"|"mixed">,
    "vdpViewsPerVin": <number or null>,
    "digitalVisibilityAssessment": <"strong"|"average"|"weak">,
    "competitiveStrength": <string, one sentence>
  },
  "platformPerformance": [
    { "platform": <string>, "vdpViews": <number>, "assessment": <"strong"|"average"|"weak">, "action": <string> }
  ],
  "demandSignals": {
    "topDemandMakes": [{ "make": <string>, "leads": <number> }],
    "insight": <string, what demand trends reveal about the market>
  },
  "competitiveThreats": [{ "threat": <string>, "severity": <"high"|"medium"|"low">, "response": <string> }],
  "recommendations": [{ "priority": <critical|high|medium|low>, "title": <string>, "detail": <string>, "estimatedImpact": <string> }],
  "alerts": [{ "severity": <critical|warning|info>, "message": <string> }],
  "trendInsight": <string>
}
Benchmarks: PTM 95-102% = competitive, <95% = leaving money, >105% = overpriced and slow turn.
VDP views/VIN: 15+ is strong, <8 is poor visibility. Be specific about competitive threats and responses.`;

  const msg = await anthropic.messages.create({ model:MODEL, max_tokens:3500,
    system:`You are the Market Radar Analyst for Carfinity Intelligence. Analyze competitive positioning, market pricing, and digital visibility. Return valid JSON only.`,
    messages:[{role:'user',content:prompt}] });

  const raw = msg.content[0]?.text?.trim()||'{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
  let result;
  try { result=JSON.parse(jsonStr); } catch { result={error:'Parse failed',raw:jsonStr.slice(0,300)}; }
  result._data={period,year,month,kpiSnap,ptmByType:ptmByTypeRows,vdpBySource:vdpBySourceRows,leadsByMake:leadsByMakeRows,trends,usage:{inputTokens:msg.usage?.input_tokens,outputTokens:msg.usage?.output_tokens}};
  return result;
}
