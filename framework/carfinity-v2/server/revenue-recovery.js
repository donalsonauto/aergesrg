// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Lifted from the real dashboard for the Claude for Dealers toolkit. Credentials removed: every
// host, user, password and database now comes from the environment. Read framework/README.md.
/**
 * Revenue Recovery Engine
 *
 * Analyzes historical CRM lead sources & GA traffic channels to find
 * "hidden gems" — sources that delivered strong leads/sales in the past
 * but are no longer active. Estimates recoverable revenue to help
 * dealerships re-activate proven winners.
 */

import mysql from 'mysql2/promise';

const MYSQL_CONFIG = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 3,
};

let pool = null;
function getPool() {
  if (!pool) pool = mysql.createPool(MYSQL_CONFIG);
  return pool;
}

// Sources that are organic/always-on and can't be "re-activated" as marketing channels
const EXCLUDED_SOURCES = new Set([
  'Walk-In', 'Walk In', 'Walkin', 'Walk-in',
  'Phone Up', 'Phone-Up', 'Phone', 'Inbound Call',
  'Service', 'Service Department', 'Service Drive',
  'Repeat', 'Repeat Customer', 'Be-Back', 'Be Back',
  'Referral', 'Owner Referral', 'Employee Referral',
  'Unknown', 'Other', 'N/A', '', 'null',
  'House', 'House Deal', 'Salesperson',
  'Showroom', 'Drive-By', 'Drive By', 'Lot', 'Lot Traffic',
  'Previous Customer', 'Return Customer', 'Loyalty',
  'Floor', 'Floor Traffic', 'Manager Referral',
]);

function isExcludedSource(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  for (const ex of EXCLUDED_SOURCES) {
    if (lower === ex.toLowerCase()) return true;
  }
  if (lower.includes('walk-in') || lower.includes('walk in') || lower.includes('walkin')) return true;
  if (lower.includes('phone up') || lower === 'phone') return true;
  if (lower.startsWith('service ') && !lower.includes('service king') && !lower.includes('service.com')) return true;
  if (lower.includes('showroom') || lower.includes('drive-by') || lower.includes('drive by')) return true;
  if (lower.includes('floor traffic') || lower === 'floor' || lower === 'lot') return true;
  return false;
}

async function findLatestDataMonth(dealerGroupId) {
  const db = getPool();
  const [rows] = await db.query(`
    SELECT DATE_FORMAT(MAX(date), '%Y') as y, DATE_FORMAT(MAX(date), '%m') as m
    FROM analyticsLeads WHERE dealerGroupId = ?
  `, [dealerGroupId]);
  if (rows.length && rows[0].y && rows[0].m) {
    return { year: parseInt(rows[0].y), month: parseInt(rows[0].m) };
  }
  return null;
}

async function findLatestGADataMonth(dealerGroupId) {
  const db = getPool();
  const [rows] = await db.query(`
    SELECT DATE_FORMAT(MAX(date), '%Y') as y, DATE_FORMAT(MAX(date), '%m') as m
    FROM analyticsGaData WHERE dealerGroupId = ?
  `, [dealerGroupId]);
  if (rows.length && rows[0].y && rows[0].m) {
    return { year: parseInt(rows[0].y), month: parseInt(rows[0].m) };
  }
  return null;
}

function dateRange(endYear, endMonth, monthsBack) {
  const startDate = new Date(endYear, endMonth - 1 - monthsBack, 1);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-28`;
  return { startStr, endStr };
}

function generatePeriods(startStr, endStr) {
  const allPeriods = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    allPeriods.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return allPeriods;
}

// ─── BUDGET QUERIES ───

/**
 * Get budget data per product (tag) per month for a dealer group.
 * Returns a map: directoryId -> { productId, productName, totalBudget, monthlyBudgets: { period: cents } }
 */
async function getBudgetByDirectory(dealerGroupId, startStr, endStr) {
  const db = getPool();

  // Get directory -> product mapping
  const [dirMap] = await db.query(`
    SELECT sd.id as directory_id, sd.value as tag_name, sd.matchedProduct as product_id, p.name as product_name
    FROM analyticsSourceDirectory sd
    LEFT JOIN product p ON sd.matchedProduct = p.id
    WHERE sd.dealerGroupId = ? AND sd.matchedProduct > 0
  `, [dealerGroupId]);

  if (!dirMap.length) return {};

  const productIds = [...new Set(dirMap.map(d => d.product_id).filter(Boolean))];
  if (!productIds.length) return {};

  // Parse date range for year/month filtering
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  // Get expenses for these products
  const [expenses] = await db.query(`
    SELECT e.productId, b.year, b.month,
      SUM(COALESCE(e.plannedBudget, 0)) as planned_cents,
      SUM(COALESCE(e.actualBudget, 0)) as actual_cents
    FROM expense e
    JOIN budget b ON e.budgetId = b.id
    WHERE b.dealerGroupId = ?
      AND e.productId IN (${productIds.map(() => '?').join(',')})
      AND CONCAT(b.year, '-', LPAD(b.month, 2, '0'), '-01') >= ?
      AND CONCAT(b.year, '-', LPAD(b.month, 2, '0'), '-01') <= ?
    GROUP BY e.productId, b.year, b.month
  `, [dealerGroupId, ...productIds, startStr, endStr]);

  // Build per-product budget map
  const productBudgets = {};
  for (const e of expenses) {
    if (!productBudgets[e.productId]) productBudgets[e.productId] = {};
    const period = `${e.year}-${String(e.month).padStart(2, '0')}`;
    const budget = Number(e.actual_cents || e.planned_cents || 0) / 100; // cents to dollars
    productBudgets[e.productId][period] = (productBudgets[e.productId][period] || 0) + budget;
  }

  // Map directory IDs to budget data using tag name as key
  const result = {};
  for (const d of dirMap) {
    const budgets = productBudgets[d.product_id] || {};
    const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
    // Use tag name as key since that's how we group sources
    if (!result[d.tag_name]) {
      result[d.tag_name] = { productId: d.product_id, productName: d.product_name, totalBudget: 0, monthlyBudgets: {} };
    }
    result[d.tag_name].totalBudget += totalBudget;
    for (const [period, amount] of Object.entries(budgets)) {
      result[d.tag_name].monthlyBudgets[period] = (result[d.tag_name].monthlyBudgets[period] || 0) + amount;
    }
  }

  return result;
}

// ─── CRM QUERIES ───

async function getSourceMonthlyData(dealerGroupId, startStr, endStr) {
  const db = getPool();

  const [leads] = await db.query(`
    SELECT
      DATE_FORMAT(l.date, '%Y-%m') as period,
      COALESCE(sd.value, sv.value, l.source, 'Unknown') as source_name,
      sd.id as directory_id,
      COUNT(*) as leads,
      SUM(CASE WHEN l.type = 1 THEN 1 ELSE 0 END) as internet_leads,
      SUM(CASE WHEN l.type = 2 THEN 1 ELSE 0 END) as phone_leads,
      SUM(CASE WHEN l.type = 5 THEN 1 ELSE 0 END) as campaign_leads,
      SUM(CASE WHEN l.type = 7 THEN 1 ELSE 0 END) as chat_leads,
      SUM(CASE WHEN l.type = 6 THEN 1 ELSE 0 END) as showroom_leads,
      SUM(CASE WHEN l.type = 4 THEN 1 ELSE 0 END) as service_leads,
      CASE WHEN sd.id IS NOT NULL THEN 'tag' ELSE 'source' END as source_kind
    FROM analyticsLeads l
    LEFT JOIN analyticsSourceValues sv ON l.valueId = sv.id
    LEFT JOIN analyticsSourceDirectory sd ON sv.directoryId = sd.id
    WHERE l.dealerGroupId = ? AND l.date >= ? AND l.date <= ?
      AND l.status != 'bad'
    GROUP BY period, source_name, sd.id, source_kind
    ORDER BY period
  `, [dealerGroupId, startStr, endStr]);

  const [sales] = await db.query(`
    SELECT
      DATE_FORMAT(s.saleDate, '%Y-%m') as period,
      COALESCE(sd.value, sv.value, s.source, 'Unknown') as source_name,
      sd.id as directory_id,
      COUNT(*) as sales,
      SUM(COALESCE(s.totalGrossProfit, 0)) as total_gross,
      SUM(CASE WHEN s.carType = 10 THEN 1 ELSE 0 END) as new_sales,
      SUM(CASE WHEN s.carType = 1 THEN 1 ELSE 0 END) as used_sales,
      CASE WHEN sd.id IS NOT NULL THEN 'tag' ELSE 'source' END as source_kind
    FROM analyticsSales s
    LEFT JOIN analyticsSourceValues sv ON s.valueId = sv.id
    LEFT JOIN analyticsSourceDirectory sd ON sv.directoryId = sd.id
    WHERE s.dealerGroupId = ? AND s.saleDate >= ? AND s.saleDate <= ?
    GROUP BY period, source_name, sd.id, source_kind
    ORDER BY period
  `, [dealerGroupId, startStr, endStr]);

  return { leads, sales };
}

/**
 * Get per-store breakdown for each source (sales, leads, new/used).
 * Returns a map: sourceName -> [{ storeId, storeName, sales, newSales, usedSales, leads }]
 */
async function getStoreBreakdownBySource(dealerGroupId, startStr, endStr) {
  const db = getPool();

  const [rows] = await db.query(`
    SELECT
      COALESCE(sd.value, sv.value, s.source, 'Unknown') as source_name,
      s.dealerShipId as store_id,
      ds.name as store_name,
      COUNT(*) as sales,
      SUM(CASE WHEN s.carType = 10 THEN 1 ELSE 0 END) as new_sales,
      SUM(CASE WHEN s.carType = 1 THEN 1 ELSE 0 END) as used_sales,
      SUM(COALESCE(s.totalGrossProfit, 0)) as gross
    FROM analyticsSales s
    LEFT JOIN analyticsSourceValues sv ON s.valueId = sv.id
    LEFT JOIN analyticsSourceDirectory sd ON sv.directoryId = sd.id
    LEFT JOIN dealerShip ds ON s.dealerShipId = ds.id
    WHERE s.dealerGroupId = ? AND s.saleDate >= ? AND s.saleDate <= ?
    GROUP BY source_name, s.dealerShipId, ds.name
    ORDER BY source_name, sales DESC
  `, [dealerGroupId, startStr, endStr]);

  const map = {};
  for (const r of rows) {
    if (!map[r.source_name]) map[r.source_name] = [];
    map[r.source_name].push({
      storeId: r.store_id,
      storeName: r.store_name || `Store #${r.store_id}`,
      sales: Number(r.sales),
      newSales: Number(r.new_sales),
      usedSales: Number(r.used_sales),
      gross: Math.round(Number(r.gross)),
    });
  }
  return map;
}

// ─── GA QUERIES ───

async function getGAMonthlyData(dealerGroupId, startStr, endStr) {
  const db = getPool();

  const [traffic] = await db.query(`
    SELECT
      DATE_FORMAT(date, '%Y-%m') as period,
      COALESCE(channel, 'Direct') as channel,
      source as ga_source,
      SUM(sessions) as sessions,
      SUM(users) as users,
      SUM(COALESCE(vdpViews, 0) + COALESCE(vdpUsedViews, 0)) as vdp_views,
      SUM(COALESCE(engagedSessions, 0)) as engaged_sessions
    FROM analyticsGaData
    WHERE dealerGroupId = ? AND date >= ? AND date <= ?
    GROUP BY period, channel, ga_source
    ORDER BY period
  `, [dealerGroupId, startStr, endStr]);

  return traffic;
}

/**
 * Get GA conversion events (form submissions + click-to-call) by channel/source/month.
 */
async function getGAConversions(dealerGroupId, startStr, endStr) {
  const db = getPool();

  const [rows] = await db.query(`
    SELECT
      DATE_FORMAT(date, '%Y-%m') as period,
      COALESCE(channel, 'Direct') as channel,
      source as ga_source,
      SUM(CASE WHEN name IN ('asc_form_submission', 'asc_form_submission_sales') THEN ascEvents ELSE 0 END) as form_submissions,
      SUM(CASE WHEN name = 'asc_click_to_call' THEN ascEvents ELSE 0 END) as click_to_call,
      SUM(ascEvents) as total_conversions
    FROM analyticsGaEventsV2
    WHERE dealerGroupId = ? AND date >= ? AND date <= ?
      AND name IN ('asc_form_submission', 'asc_form_submission_sales', 'asc_click_to_call')
    GROUP BY period, channel, ga_source
    ORDER BY period
  `, [dealerGroupId, startStr, endStr]);

  return rows;
}

// ─── CRM ANALYSIS ───

export async function analyzeRecoveryOpportunities(dealerGroupId, refYear, refMonth, monthsBack = 36) {
  const latestData = await findLatestDataMonth(dealerGroupId);
  const effectiveYear = latestData ? latestData.year : refYear;
  const effectiveMonth = latestData ? latestData.month : refMonth;
  const { startStr, endStr } = dateRange(effectiveYear, effectiveMonth, monthsBack);

  const [{ leads, sales }, storeMap, budgetMap] = await Promise.all([
    getSourceMonthlyData(dealerGroupId, startStr, endStr),
    getStoreBreakdownBySource(dealerGroupId, startStr, endStr),
    getBudgetByDirectory(dealerGroupId, startStr, endStr),
  ]);

  // Build per-source monthly timeline
  const sourceMap = {};

  const EMPTY_MONTH = { leads: 0, internet_leads: 0, phone_leads: 0, campaign_leads: 0, chat_leads: 0, showroom_leads: 0, service_leads: 0, sales: 0, gross: 0, new_sales: 0, used_sales: 0 };

  for (const row of leads) {
    const key = row.source_name;
    if (!sourceMap[key]) sourceMap[key] = { name: key, directoryId: row.directory_id, sourceKind: row.source_kind || 'source', months: {} };
    if (row.source_kind === 'tag') sourceMap[key].sourceKind = 'tag';
    if (!sourceMap[key].months[row.period]) sourceMap[key].months[row.period] = { ...EMPTY_MONTH };
    sourceMap[key].months[row.period].leads += Number(row.leads);
    sourceMap[key].months[row.period].internet_leads += Number(row.internet_leads);
    sourceMap[key].months[row.period].phone_leads += Number(row.phone_leads);
    sourceMap[key].months[row.period].campaign_leads += Number(row.campaign_leads);
    sourceMap[key].months[row.period].chat_leads += Number(row.chat_leads);
    sourceMap[key].months[row.period].showroom_leads += Number(row.showroom_leads);
    sourceMap[key].months[row.period].service_leads += Number(row.service_leads);
  }

  for (const row of sales) {
    const key = row.source_name;
    if (!sourceMap[key]) sourceMap[key] = { name: key, directoryId: row.directory_id, sourceKind: row.source_kind || 'source', months: {} };
    if (row.source_kind === 'tag') sourceMap[key].sourceKind = 'tag';
    if (!sourceMap[key].months[row.period]) sourceMap[key].months[row.period] = { ...EMPTY_MONTH };
    sourceMap[key].months[row.period].sales += Number(row.sales);
    sourceMap[key].months[row.period].gross += Number(row.total_gross);
    sourceMap[key].months[row.period].new_sales += Number(row.new_sales);
    sourceMap[key].months[row.period].used_sales += Number(row.used_sales);
  }

  const allPeriods = generatePeriods(startStr, endStr);
  const recentMonths = allPeriods.slice(-3);
  const opportunities = [];

  for (const src of Object.values(sourceMap)) {
    if (isExcludedSource(src.name)) continue;

    const timeline = allPeriods.map(p => ({
      period: p,
      ...(src.months[p] || { ...EMPTY_MONTH })
    }));

    const totalLeads = timeline.reduce((s, m) => s + m.leads, 0);
    const totalSales = timeline.reduce((s, m) => s + m.sales, 0);
    const totalGross = timeline.reduce((s, m) => s + m.gross, 0);
    const totalNewSales = timeline.reduce((s, m) => s + m.new_sales, 0);
    const totalUsedSales = timeline.reduce((s, m) => s + m.used_sales, 0);

    if (totalSales < 5) continue;

    // Peak 3-month rolling avg
    let peakSalesAvg = 0, peakPeriodStart = '', peakPeriodEnd = '';
    for (let i = 0; i <= timeline.length - 3; i++) {
      const avg = (timeline[i].sales + timeline[i + 1].sales + timeline[i + 2].sales) / 3;
      if (avg > peakSalesAvg) {
        peakSalesAvg = avg;
        peakPeriodStart = timeline[i].period;
        peakPeriodEnd = timeline[i + 2].period;
      }
    }

    // Recent 3 months
    const recentData = recentMonths.map(p => src.months[p] || { leads: 0, sales: 0, gross: 0 });
    const recentSalesAvg = recentData.reduce((s, m) => s + m.sales, 0) / 3;
    const recentLeadsAvg = recentData.reduce((s, m) => s + m.leads, 0) / 3;

    const activeMonths = timeline.filter(m => m.sales > 0 || m.leads > 0);
    const historicalSalesAvg = activeMonths.length > 0
      ? activeMonths.reduce((s, m) => s + m.sales, 0) / activeMonths.length : 0;
    const avgGrossPerSale = totalSales > 0 ? totalGross / totalSales : 0;
    const closingRatio = totalLeads > 0 ? totalSales / totalLeads : 0;

    let status;
    if (recentSalesAvg === 0 && recentLeadsAvg === 0) status = 'dormant';
    else if (peakSalesAvg > 0 && recentSalesAvg / peakSalesAvg < 0.3) status = 'declining';
    else status = 'active';

    if (status === 'active') continue;

    let lastActiveMonth = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].sales > 0 || timeline[i].leads > 0) { lastActiveMonth = timeline[i].period; break; }
    }
    const lastActiveIdx = lastActiveMonth ? allPeriods.indexOf(lastActiveMonth) : -1;
    const monthsInactive = lastActiveIdx >= 0 ? allPeriods.length - 1 - lastActiveIdx : null;

    const estimatedMonthlySales = Math.round(historicalSalesAvg * 10) / 10;
    const estimatedMonthlyRevenue = Math.round(historicalSalesAvg * avgGrossPerSale);

    const consistencyRatio = activeMonths.length / allPeriods.length;
    const volumeScore = Math.min(totalSales / 50, 1);
    const recencyPenalty = monthsInactive ? Math.max(0, 1 - monthsInactive / 24) : 0.5;
    const confidence = Math.round((consistencyRatio * 0.3 + volumeScore * 0.4 + recencyPenalty * 0.3) * 100);
    const opportunityScore = estimatedMonthlyRevenue * (confidence / 100);

    // Store breakdown for this source
    const stores = (storeMap[src.name] || []).map(s => ({
      ...s,
      pctNew: s.sales > 0 ? Math.round(s.newSales / s.sales * 100) : 0,
    }));

    // Determine lead types present for this source
    const totalInternetLeads = timeline.reduce((s, m) => s + m.internet_leads, 0);
    const totalPhoneLeads = timeline.reduce((s, m) => s + m.phone_leads, 0);
    const totalCampaignLeads = timeline.reduce((s, m) => s + m.campaign_leads, 0);
    const totalChatLeads = timeline.reduce((s, m) => s + m.chat_leads, 0);
    const totalShowroomLeads = timeline.reduce((s, m) => s + m.showroom_leads, 0);
    const totalServiceLeads = timeline.reduce((s, m) => s + m.service_leads, 0);
    const leadTypes = [];
    if (totalInternetLeads > 0) leadTypes.push('Internet');
    if (totalPhoneLeads > 0) leadTypes.push('Phone');
    if (totalCampaignLeads > 0) leadTypes.push('Campaign');
    if (totalChatLeads > 0) leadTypes.push('Chat');
    if (totalShowroomLeads > 0) leadTypes.push('Showroom');
    if (totalServiceLeads > 0) leadTypes.push('Service');

    // Budget data (from product/expense tables)
    const srcBudget = budgetMap[src.name] || null;
    const totalBudget = srcBudget ? Math.round(srcBudget.totalBudget) : null;
    const cpl = totalBudget && totalLeads > 0 ? Math.round(totalBudget / totalLeads) : null;
    const cps = totalBudget && totalSales > 0 ? Math.round(totalBudget / totalSales) : null;

    opportunities.push({
      source: src.name,
      directoryId: src.directoryId,
      status,
      leadTypes,
      sourceKind: src.sourceKind,
      timeline: timeline.map(m => ({
        period: m.period, leads: m.leads, sales: m.sales, gross: Math.round(m.gross),
        internet_leads: m.internet_leads, phone_leads: m.phone_leads,
        campaign_leads: m.campaign_leads, chat_leads: m.chat_leads,
        showroom_leads: m.showroom_leads, service_leads: m.service_leads,
        new_sales: m.new_sales, used_sales: m.used_sales,
        budget: srcBudget?.monthlyBudgets?.[m.period] ? Math.round(srcBudget.monthlyBudgets[m.period]) : null,
      })),
      metrics: {
        totalLeads, totalSales,
        totalInternetLeads, totalPhoneLeads, totalCampaignLeads, totalChatLeads, totalShowroomLeads, totalServiceLeads,
        totalGross: Math.round(totalGross),
        avgGrossPerSale: Math.round(avgGrossPerSale),
        closingRatio: Math.round(closingRatio * 1000) / 10,
        totalBudget, cpl, cps,
        peakMonthlySales: Math.round(peakSalesAvg * 10) / 10,
        peakPeriod: peakPeriodStart && peakPeriodEnd ? `${peakPeriodStart} to ${peakPeriodEnd}` : null,
        recentMonthlySales: Math.round(recentSalesAvg * 10) / 10,
        recentMonthlyLeads: Math.round(recentLeadsAvg * 10) / 10,
        historicalMonthlySales: Math.round(historicalSalesAvg * 10) / 10,
        activeMonthsCount: activeMonths.length,
        totalMonthsCount: allPeriods.length,
        newSales: totalNewSales,
        usedSales: totalUsedSales,
        pctNew: totalSales > 0 ? Math.round(totalNewSales / totalSales * 100) : 0,
      },
      stores,
      lastActiveMonth, monthsInactive, estimatedMonthlySales, estimatedMonthlyRevenue,
      confidence, opportunityScore: Math.round(opportunityScore),
    });
  }

  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  const dormantCount = opportunities.filter(o => o.status === 'dormant').length;
  const decliningCount = opportunities.filter(o => o.status === 'declining').length;

  return {
    summary: {
      totalOpportunities: opportunities.length,
      dormantSources: dormantCount,
      decliningSources: decliningCount,
      estimatedMonthlyRevenue: Math.round(opportunities.reduce((s, o) => s + o.estimatedMonthlyRevenue, 0)),
      estimatedMonthlySales: Math.round(opportunities.reduce((s, o) => s + o.estimatedMonthlySales, 0) * 10) / 10,
      periodAnalyzed: `${startStr} to ${endStr}`,
      monthsAnalyzed: allPeriods.length,
      dataAsOf: `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`,
    },
    opportunities,
  };
}

// ─── GA ANALYSIS ───

export async function analyzeGARecoveryOpportunities(dealerGroupId, refYear, refMonth, monthsBack = 36) {
  const latestGA = await findLatestGADataMonth(dealerGroupId);
  const effectiveYear = latestGA ? latestGA.year : refYear;
  const effectiveMonth = latestGA ? latestGA.month : refMonth;
  const { startStr, endStr } = dateRange(effectiveYear, effectiveMonth, monthsBack);

  // Fetch traffic + conversions in parallel
  const [traffic, conversions] = await Promise.all([
    getGAMonthlyData(dealerGroupId, startStr, endStr),
    getGAConversions(dealerGroupId, startStr, endStr),
  ]);

  // Build conversion map: "channel/source/period" -> { forms, calls }
  const convMap = {};
  for (const row of conversions) {
    const key = row.ga_source ? `${row.channel} / ${row.ga_source}` : row.channel;
    if (!convMap[key]) convMap[key] = {};
    if (!convMap[key][row.period]) convMap[key][row.period] = { forms: 0, calls: 0 };
    convMap[key][row.period].forms += Number(row.form_submissions);
    convMap[key][row.period].calls += Number(row.click_to_call);
  }

  // Aggregate traffic by channel+source
  const channelMap = {};
  for (const row of traffic) {
    const key = row.ga_source ? `${row.channel} / ${row.ga_source}` : row.channel;
    if (!channelMap[key]) channelMap[key] = { name: key, channel: row.channel, source: row.ga_source, months: {} };
    if (!channelMap[key].months[row.period]) {
      channelMap[key].months[row.period] = { sessions: 0, users: 0, vdp_views: 0, engaged_sessions: 0, forms: 0, calls: 0 };
    }
    channelMap[key].months[row.period].sessions += Number(row.sessions);
    channelMap[key].months[row.period].users += Number(row.users);
    channelMap[key].months[row.period].vdp_views += Number(row.vdp_views);
    channelMap[key].months[row.period].engaged_sessions += Number(row.engaged_sessions);
  }

  // Merge conversions into channelMap
  for (const [key, periods] of Object.entries(convMap)) {
    if (!channelMap[key]) continue;
    for (const [period, data] of Object.entries(periods)) {
      if (channelMap[key].months[period]) {
        channelMap[key].months[period].forms += data.forms;
        channelMap[key].months[period].calls += data.calls;
      }
    }
  }

  const allPeriods = generatePeriods(startStr, endStr);
  const recentMonths = allPeriods.slice(-3);
  const opportunities = [];

  const excludedGA = new Set([
    'Direct', 'Direct / (direct)', '(not set)', 'Unassigned',
    'Unassigned / (not set)', 'Organic Search / google',
  ]);

  for (const ch of Object.values(channelMap)) {
    if (!ch.name || excludedGA.has(ch.name)) continue;

    const timeline = allPeriods.map(p => ({
      period: p,
      ...(ch.months[p] || { sessions: 0, users: 0, vdp_views: 0, engaged_sessions: 0, forms: 0, calls: 0 })
    }));

    const totalSessions = timeline.reduce((s, m) => s + m.sessions, 0);
    const totalVDPs = timeline.reduce((s, m) => s + m.vdp_views, 0);
    const totalForms = timeline.reduce((s, m) => s + m.forms, 0);
    const totalCalls = timeline.reduce((s, m) => s + m.calls, 0);
    const totalConversions = totalForms + totalCalls;

    if (totalSessions < 500) continue;

    let peakSessionsAvg = 0, peakPeriod = '';
    for (let i = 0; i <= timeline.length - 3; i++) {
      const avg = (timeline[i].sessions + timeline[i + 1].sessions + timeline[i + 2].sessions) / 3;
      if (avg > peakSessionsAvg) {
        peakSessionsAvg = avg;
        peakPeriod = `${timeline[i].period} to ${timeline[i + 2].period}`;
      }
    }

    const recentData = recentMonths.map(p => ch.months[p] || { sessions: 0 });
    const recentSessionsAvg = recentData.reduce((s, m) => s + m.sessions, 0) / 3;

    let status;
    if (recentSessionsAvg === 0) status = 'dormant';
    else if (peakSessionsAvg > 0 && recentSessionsAvg / peakSessionsAvg < 0.3) status = 'declining';
    else status = 'active';

    if (status === 'active') continue;

    let lastActiveMonth = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].sessions > 0) { lastActiveMonth = timeline[i].period; break; }
    }
    const lastActiveIdx = lastActiveMonth ? allPeriods.indexOf(lastActiveMonth) : -1;
    const monthsInactive = lastActiveIdx >= 0 ? allPeriods.length - 1 - lastActiveIdx : null;

    const activeMonths = timeline.filter(m => m.sessions > 0);
    const historicalAvg = activeMonths.length > 0
      ? activeMonths.reduce((s, m) => s + m.sessions, 0) / activeMonths.length : 0;

    const conversionRate = totalSessions > 0 ? totalConversions / totalSessions * 100 : 0;

    opportunities.push({
      source: ch.name,
      channel: ch.channel,
      gaSource: ch.source,
      status,
      timeline: timeline.map(m => ({
        period: m.period,
        sessions: m.sessions,
        vdp_views: m.vdp_views,
        forms: m.forms,
        calls: m.calls,
      })),
      metrics: {
        totalSessions,
        totalVDPs,
        totalForms,
        totalCalls,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        peakMonthlySessions: Math.round(peakSessionsAvg),
        peakPeriod,
        recentMonthlySessions: Math.round(recentSessionsAvg),
        historicalMonthlySessions: Math.round(historicalAvg),
        activeMonthsCount: activeMonths.length,
      },
      lastActiveMonth,
      monthsInactive,
    });
  }

  opportunities.sort((a, b) => b.metrics.peakMonthlySessions - a.metrics.peakMonthlySessions);

  return {
    summary: {
      totalOpportunities: opportunities.length,
      dormantChannels: opportunities.filter(o => o.status === 'dormant').length,
      decliningChannels: opportunities.filter(o => o.status === 'declining').length,
      periodAnalyzed: `${startStr} to ${endStr}`,
      dataAsOf: `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`,
    },
    opportunities,
  };
}
