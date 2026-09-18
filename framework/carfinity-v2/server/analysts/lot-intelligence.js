// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Lifted from the real dashboard for the Claude for Dealers toolkit. Credentials removed: every
// host, user, password and database now comes from the environment. Read framework/README.md.
/**
 * Lot Intelligence Analyst
 * Inventory health: price-to-market, aged units, marketplace listing gaps,
 * and turn rate analysis using both KPI API and MySQL vehicleReports data.
 */
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../tools.js';
import mysql from 'mysql2/promise';
import { ANALYST_MODEL } from '../models.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = ANALYST_MODEL;

let pool = null;
function getPool() {
  if (!pool) pool = mysql.createPool({ host: process.env.DB_HOST,port: Number(process.env.DB_PORT || 3306),user: process.env.DB_USER,password: process.env.DB_PASSWORD,database: process.env.DB_NAME,connectionLimit:3 });
  return pool;
}

const INV_METRICS = [
  'inventory.inventory','inventory.avgInventory','inventory.website','inventory.priceToMarket',
  'inventory.lastDayPriceToMarket','inventory.missingPhotos','inventory.missingPhotosPercentage',
  'inventory.totalVdpViewsPerVin','sales.sales',
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

async function getInventoryStats(dealerGroupId) {
  try {
    const db = getPool();
    // Get dealer group dealership IDs
    const [dealers] = await db.execute(
      'SELECT id FROM dealerships WHERE dealer_group_id = ? AND is_active = 1 LIMIT 50',
      [dealerGroupId]
    );
    if (!dealers.length) return null;
    const ids = dealers.map(d=>d.id);
    const placeholders = ids.map(()=>'?').join(',');

    // Price-to-market summary from vehiclePriceToMarket
    const [ptmRows] = await db.execute(`
      SELECT
        COUNT(*) as total_vehicles,
        AVG(price_to_market) as avg_ptm,
        SUM(CASE WHEN price_to_market < 95 THEN 1 ELSE 0 END) as under_market,
        SUM(CASE WHEN price_to_market BETWEEN 95 AND 105 THEN 1 ELSE 0 END) as at_market,
        SUM(CASE WHEN price_to_market > 105 THEN 1 ELSE 0 END) as over_market,
        SUM(CASE WHEN days_in_stock >= 90 THEN 1 ELSE 0 END) as aged_90plus,
        SUM(CASE WHEN days_in_stock >= 60 AND days_in_stock < 90 THEN 1 ELSE 0 END) as aged_60_90,
        SUM(CASE WHEN days_in_stock >= 45 AND days_in_stock < 60 THEN 1 ELSE 0 END) as aged_45_60,
        AVG(days_in_stock) as avg_days_in_stock
      FROM vehiclePriceToMarket
      WHERE dealership_id IN (${placeholders}) AND is_active = 1
    `, ids);

    // Top aged vehicles
    const [agedVehicles] = await db.execute(`
      SELECT v.year, v.make, v.model, vp.days_in_stock, vp.price_to_market, vp.price
      FROM vehiclePriceToMarket vp
      JOIN vehicles v ON vp.vin = v.vin
      WHERE vp.dealership_id IN (${placeholders}) AND vp.is_active = 1 AND vp.days_in_stock >= 60
      ORDER BY vp.days_in_stock DESC LIMIT 10
    `, ids);

    // Make/model performance (most inventory)
    const [makeRows] = await db.execute(`
      SELECT v.make, COUNT(*) as count, AVG(vp.price_to_market) as avg_ptm, AVG(vp.days_in_stock) as avg_days
      FROM vehiclePriceToMarket vp
      JOIN vehicles v ON vp.vin = v.vin
      WHERE vp.dealership_id IN (${placeholders}) AND vp.is_active = 1
      GROUP BY v.make ORDER BY count DESC LIMIT 10
    `, ids);

    // Marketplace listing gaps (vehicles not on key platforms)
    const [listingGaps] = await db.execute(`
      SELECT
        SUM(CASE WHEN vr.carsComPrice IS NULL OR vr.carsComPrice = 0 THEN 1 ELSE 0 END) as missing_carscom,
        SUM(CASE WHEN vr.autotraderSrps IS NULL THEN 1 ELSE 0 END) as missing_autotrader,
        SUM(CASE WHEN vr.cargurusPrice IS NULL THEN 1 ELSE 0 END) as missing_cargurus,
        COUNT(*) as total
      FROM vehicleReports vr
      WHERE vr.dealership_id IN (${placeholders}) AND vr.is_active = 1
    `, ids);

    return {
      summary: ptmRows[0] || {},
      aged: agedVehicles,
      makeBreakdown: makeRows,
      listingGaps: listingGaps[0] || {},
    };
  } catch (e) {
    console.error('[LotAnalyst] MySQL error:', e.message);
    return null;
  }
}

const safeVal = d => d?.current?.value ?? d?.value ?? null;
const safeMom = d => d?.current?.mom ?? d?.mom ?? null;
function fmtM(y,m){return new Date(y,m-1).toLocaleString('en-US',{month:'short'});}
function normDrill(raw) {
  if (!raw?.data||typeof raw.data!=='object') return [];
  return Object.values(raw.data).filter(e=>e?.label).map(e=>({
    label:e.label, value:typeof e.current==='object'?(e.current?.value??0):(e.current??0)
  })).sort((a,b)=>b.value-a.value);
}

export async function runLotIntelligenceAnalyst({ dealerGroupId, year, month, dealerGroupName='the dealership' }) {
  const period = new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'});

  const [kpiRes, invByType, ptmByType, mysqlData] = await Promise.all([
    Promise.all(INV_METRICS.map(m=>fetchKpi(m,dealerGroupId,year,month).then(v=>[m,v]))),
    fetchDrill('inventory.inventory',dealerGroupId,year,month,'carType'),
    fetchDrill('inventory.priceToMarket',dealerGroupId,year,month,'carType'),
    getInventoryStats(dealerGroupId),
  ]);

  const kpis = Object.fromEntries(kpiRes);
  const kpiSnap = {};
  for(const[k,d] of Object.entries(kpis)) kpiSnap[k]={value:safeVal(d),mom:safeMom(d)};

  const trends={};
  await Promise.all(['inventory.inventory','inventory.priceToMarket'].map(async m=>{
    trends[m]=await fetchTrend(m,dealerGroupId,year,month,4);
  }));

  const kpiLines = Object.entries(kpiSnap).filter(([,d])=>d.value!=null)
    .map(([k,d])=>`  ${k}: ${d.value}${d.mom!=null?` (${d.mom>0?'+':''}${Number(d.mom).toFixed(1)}% MoM)`:''}`).join('\n');

  const ptmSummary = mysqlData?.summary ? `
  Total active vehicles: ${mysqlData.summary.total_vehicles}
  Avg price-to-market: ${Math.round(mysqlData.summary.avg_ptm||0)}%
  Under market (<95%): ${mysqlData.summary.under_market}
  At market (95-105%): ${mysqlData.summary.at_market}
  Over market (>105%): ${mysqlData.summary.over_market}
  Aged 90+ days: ${mysqlData.summary.aged_90plus}
  Aged 60-89 days: ${mysqlData.summary.aged_60_90}
  Aged 45-59 days: ${mysqlData.summary.aged_45_60}
  Avg days in stock: ${Math.round(mysqlData.summary.avg_days_in_stock||0)}` : '  (No MySQL data available)';

  const agedLines = mysqlData?.aged?.length ? mysqlData.aged.map(v=>
    `  ${v.year} ${v.make} ${v.model}: ${v.days_in_stock} days, ${Math.round(v.price_to_market||0)}% PTM, $${Number(v.price||0).toLocaleString()}`
  ).join('\n') : '  No aged units found';

  const makeLines = mysqlData?.makeBreakdown?.length ? mysqlData.makeBreakdown.map(r=>
    `  ${r.make}: ${r.count} units, ${Math.round(r.avg_ptm||0)}% avg PTM, ${Math.round(r.avg_days||0)} avg days`
  ).join('\n') : '  No make data';

  const gaps = mysqlData?.listingGaps;
  const gapLines = gaps ? `  Missing Cars.com: ${gaps.missing_carscom||0}/${gaps.total||0}\n  Missing AutoTrader: ${gaps.missing_autotrader||0}/${gaps.total||0}\n  Missing CarGurus: ${gaps.missing_cargurus||0}/${gaps.total||0}` : '  No listing data';

  const trendLines = Object.entries(trends).map(([m,arr])=>`  ${m}: ${arr.map(t=>`${fmtM(t.year,t.month)}: ${t.value??'N/A'}`).join(', ')}`).join('\n');

  const prompt = `Analyze lot intelligence and inventory health for ${dealerGroupName} for ${period}.

## Inventory KPIs (from management system)
${kpiLines||'  No data'}

## Price-to-Market Analysis (live vehicle data)
${ptmSummary}

## Top Aged Vehicles (60+ days on lot)
${agedLines}

## Inventory by Make
${makeLines}

## Marketplace Listing Gaps
${gapLines}

## 4-Month Trend
${trendLines||'  No trend'}

Return JSON:
{
  "score": <0-100>,
  "grade": <letter>,
  "summary": <2-3 sentence exec summary>,
  "keyFindings": [<string>],
  "inventoryHealth": {
    "totalUnits": <number or null>,
    "avgPriceToMarket": <number or null>,
    "avgDaysInStock": <number or null>,
    "agedInventoryRisk": <string, assessment of 60/90+ day units>,
    "assessment": <"strong"|"average"|"weak">
  },
  "agedInventory": {
    "units90Plus": <number or null>,
    "units60To89": <number or null>,
    "estimatedCarryingCost": <string, e.g. "$X/day total" based on ~$35-50/unit/day>,
    "urgentActions": [<string>]
  },
  "pricingAnalysis": {
    "overMarketCount": <number or null>,
    "underMarketCount": <number or null>,
    "priceReductionOpportunity": <string>,
    "topMakeInsights": [{ "make": <string>, "issue": <string> }]
  },
  "listingGaps": {
    "assessment": <string>,
    "estimatedLostVdpViews": <string>,
    "action": <string>
  },
  "recommendations": [{ "priority": <critical|high|medium|low>, "title": <string>, "detail": <string>, "estimatedImpact": <string> }],
  "alerts": [{ "severity": <critical|warning|info>, "message": <string> }],
  "trendInsight": <string>
}
Benchmarks: avg days in stock <45 is good; PTM 95-102% is ideal; 0 units 90+ days is the goal.
$35-50/unit/day is typical carrying cost. Be specific about which vehicles to wholesale vs. price-reduce vs. recondition.`;

  const msg = await anthropic.messages.create({ model:MODEL, max_tokens:4096,
    system:`You are the Lot Intelligence Analyst for Carfinity Intelligence. Analyze automotive inventory health, pricing, and aged unit risk. Return valid JSON only.`,
    messages:[{role:'user',content:prompt}] });

  const raw = msg.content[0]?.text?.trim()||'{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
  let result;
  try { result=JSON.parse(jsonStr); } catch { result={error:'Parse failed',raw:jsonStr.slice(0,300)}; }
  result._data={period,year,month,kpiSnap,mysqlData,trends,usage:{inputTokens:msg.usage?.input_tokens,outputTokens:msg.usage?.output_tokens}};
  return result;
}
