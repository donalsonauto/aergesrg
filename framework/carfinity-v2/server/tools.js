// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Lifted from the real dashboard for the Claude for Dealers toolkit. Credentials removed: every
// host, user, password and database now comes from the environment. Read framework/README.md.
import http from 'http';
import mysql from 'mysql2/promise';
import { getDealershipDMA, getDealerGroupDMAs, queryMarketData, getMarketSummary, getMarketTrend } from './market-db.js';

const API_URL = process.env.CARFINITY_API_URL || 'http://localhost:4010';

// Server-side auth token management — AI server authenticates directly with Carfinity API
const AUTH_CREDS = {
  username: process.env.CARFINITY_API_USER || '',
  password: process.env.CARFINITY_API_PASS || '',
};
const API_HOST = process.env.CARFINITY_API_HOST || 'api.carfinity.io';
let _serverToken = null;
let _serverTokenExpiry = 0;

function apiLogin() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: AUTH_CREDS.username,
      password: AUTH_CREDS.password,
      fingerprint: 'carfinity-ai-server',
    });
    const parsedUrl = new URL(API_URL);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': API_HOST,
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const inner = data.data || data;
          if (inner.accessToken) {
            resolve(inner);
          } else {
            reject(new Error(`Login failed: ${body.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Login parse error: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', (e) => reject(new Error(`Login request failed: ${e.message}`)));
    req.write(postData);
    req.end();
  });
}

async function getServerToken() {
  const now = Math.floor(Date.now() / 1000);
  // Refresh 60 seconds before expiry
  if (_serverToken && now < _serverTokenExpiry - 60) {
    return _serverToken;
  }
  try {
    const result = await apiLogin();
    _serverToken = result.accessToken;
    _serverTokenExpiry = result.expiresAt || (now + 1800);
    console.log('[Auth] Server token refreshed, expires at', new Date(_serverTokenExpiry * 1000).toISOString());
    return _serverToken;
  } catch (e) {
    console.error('[Auth] Server login failed:', e.message);
    return _serverToken; // return stale token as fallback
  }
}

export { getServerToken, apiRequest };

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_kpis_list",
      description: "Get all available KPI metrics. Returns metric keys grouped by category with total count. Call this first to discover what data is available.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_kpi_data",
      description: "Get a KPI metric's current value vs previous month and last year same month. Comparisons are already pace-adjusted (same day range). Defaults to the user's selected period. Can fetch multiple metrics by calling this multiple times in parallel.",
      parameters: {
        type: "object",
        properties: {
          metricKey: { type: "string", description: "Exact metric key (e.g., 'lead-source-roi.goodLeads', 'sales.sales', 'sales.closingRatio')" },
          dealerShipId: { type: "string", description: "Dealership ID, or '0' for all stores (default)" },
          year: { type: "number", description: "Year (defaults to user's selected period)" },
          month: { type: "number", description: "Month 1-12 (defaults to user's selected period)" }
        },
        required: ["metricKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_drilldown_options",
      description: "Get available drill-down dimensions for a KPI (e.g., by dealership, tag, carType, salePerson). Call this to know WHAT you can break down BEFORE calling get_drilldown_data.",
      parameters: {
        type: "object",
        properties: {
          metricKey: { type: "string", description: "The metric key" }
        },
        required: ["metricKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_drilldown_data",
      description: "Break down a KPI by a dimension (tag, dealership, carType, salePerson, leadType, carMake, etc). Returns top entries sorted by biggest change. Comparisons are pace-adjusted. Defaults to the user's selected period.",
      parameters: {
        type: "object",
        properties: {
          metricKey: { type: "string", description: "The metric key" },
          drillDownType: { type: "string", description: "Dimension to break down by (e.g., 'tag', 'dealership', 'carType', 'salePerson', 'leadType', 'carMake')" },
          dealerShipId: { type: "string", description: "Dealership ID or '0' for all (default)" },
          year: { type: "number", description: "Year (defaults to user's selected period)" },
          month: { type: "number", description: "Month 1-12 (defaults to user's selected period)" }
        },
        required: ["metricKey", "drillDownType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dealerships",
      description: "Get all dealerships (stores) in the user's dealer group with IDs and names.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_daily_trend",
      description: "Get daily data points for a KPI metric over a month. Returns an array of {date, value} entries — one per day. Use this to identify WHEN data stopped flowing (data gap detection), spot daily patterns, or verify form/activity submissions in recent days. Key metrics for data gaps: 'lead-source-roi.forms', 'website.goals/type=2' (Website Forms), 'website.ascContacts', 'lead-source-roi.goodLeads'.",
      parameters: {
        type: "object",
        properties: {
          metricKey: { type: "string", description: "Exact metric key (e.g., 'lead-source-roi.goodLeads', 'lead-source-roi.forms', 'website.goals/type=2')" },
          dealerShipId: { type: "string", description: "Dealership ID, or '0' for all stores (default)" },
          year: { type: "number", description: "Year (defaults to user's selected period)" },
          month: { type: "number", description: "Month 1-12 (defaults to user's selected period)" }
        },
        required: ["metricKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search the automotive analytics knowledge base for expert guidance on diagnosing problems, understanding KPI patterns, seasonality, best practices, and troubleshooting. Use this to get expert-level context BEFORE presenting findings. Examples: 'sales decline troubleshooting', 'closing ratio', 'lead source ROI', 'new car sales', 'F&I back gross', 'seasonality February'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query — topic, KPI name, or problem description" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_monthly_trend",
      description: "Get a KPI metric's value over the last 6 months to reveal historical trends. Returns an array of {month, year, value, lastYearValue} entries. Use this to determine if a decline is new or has been ongoing, whether it's seasonal, and whether it's happening across all stores or just specific ones. The frontend automatically renders an inline trendline chart from this data.",
      parameters: {
        type: "object",
        properties: {
          metricKey: { type: "string", description: "Exact metric key (e.g., 'sales.sales', 'lead-source-roi.goodLeads', 'sales.closingRatio')" },
          dealerShipId: { type: "string", description: "Dealership ID, or '0' for all stores (default). Use specific IDs to compare store-level trends." },
          months: { type: "number", description: "Number of months to look back (default 6, max 12)" }
        },
        required: ["metricKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_market_data",
      description: "Get automotive market sales data for a dealership's local market (DMA region). Compares store performance to broader market trends by make/model. Use this to benchmark dealership performance against the market. Shows how the overall market is doing for specific makes.",
      parameters: {
        type: "object",
        properties: {
          dealerShipId: { type: "string", description: "Dealership ID to look up its market. Or '0' to use the group's primary market." },
          make: { type: "string", description: "Vehicle make to filter (e.g. 'FORD', 'TOYOTA'). Optional — omit for all makes." },
          model: { type: "string", description: "Vehicle model to filter (e.g. 'F-150', 'CAMRY'). Optional." },
          car_type: { type: "string", enum: ["New", "Used"], description: "Filter by New or Used. Optional." },
          period: { type: "string", enum: ["latest_week", "last_4_weeks", "ytd"], description: "Time period for the data." },
          scope: { type: "string", enum: ["local", "national"], description: "Scope: 'local' for the dealership's DMA region (default), 'national' for entire US market." }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_market_trend",
      description: "Get weekly market sales trend data for charting. Returns individual weekly data points (not aggregated) for creating trend comparison charts. Use this AFTER get_market_data to show visual trends. The frontend will render an inline chart automatically.",
      parameters: {
        type: "object",
        properties: {
          make: { type: "string", description: "Vehicle make to filter (e.g. 'TOYOTA'). Optional." },
          car_type: { type: "string", enum: ["New", "Used"], description: "Filter by New or Used. Optional." },
          scope: { type: "string", enum: ["local", "national"], description: "Scope: 'local' (default) or 'national'." }
        },
        required: []
      }
    }
  }
];

const parsedUrl = new URL(API_URL);

async function apiRequest(path) {
  const token = await getServerToken();

  return new Promise((resolve, reject) => {
    console.log(`[Tool] Fetching: ${API_URL}${path}`);

    const headers = {
      'Accept': 'application/json',
      'Host': API_HOST,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path,
      method: 'GET',
      headers,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', async () => {
        if (res.statusCode === 401) {
          // Token expired — force refresh and retry once
          console.log('[Auth] Got 401, forcing token refresh...');
          _serverToken = null;
          _serverTokenExpiry = 0;
          try {
            const freshToken = await getServerToken();
            if (!freshToken) {
              reject(new Error('API 401: Authentication failed after retry'));
              return;
            }
            // Retry the request with the new token
            const retryHeaders = { ...headers, 'Authorization': `Bearer ${freshToken}` };
            const retryOpts = { ...options, headers: retryHeaders };
            const retryReq = http.request(retryOpts, (retryRes) => {
              let retryBody = '';
              retryRes.on('data', (chunk) => { retryBody += chunk; });
              retryRes.on('end', () => {
                if (retryRes.statusCode < 200 || retryRes.statusCode >= 300) {
                  reject(new Error(`API ${retryRes.statusCode}: ${retryBody.substring(0, 200)}`));
                  return;
                }
                try {
                  const data = JSON.parse(retryBody);
                  resolve(data.data !== undefined ? data.data : data);
                } catch (e) {
                  reject(new Error(`Failed to parse JSON: ${retryBody.substring(0, 200)}`));
                }
              });
            });
            retryReq.on('error', (e) => reject(new Error(`Retry failed: ${e.message}`)));
            retryReq.end();
          } catch (retryErr) {
            reject(new Error(`API auth retry failed: ${retryErr.message}`));
          }
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`API ${res.statusCode}: ${body.substring(0, 200)}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(data.data !== undefined ? data.data : data);
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Request failed: ${e.message}`)));
    req.end();
  });
}

// MySQL connection pool for knowledge base queries
let _pool = null;
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3316),
      user: process.env.MYSQL_USER || 'onevision',
      password: process.env.MYSQL_PASSWORD || '2sEYgCKiUikHhXavgJgbqYzrNeJDL24d',
      database: process.env.MYSQL_DATABASE || 'onevision',
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return _pool;
}

// Context holds the user's current dealer group + selected date — set per-request from the chat endpoint
let _context = { dealerGroupId: null, dealerGroupName: null, year: null, month: null };

export function setToolContext(ctx) {
  _context = { ..._context, ...ctx };
}

export async function executeTool(name, args) {
  const dgId = _context.dealerGroupId;
  if (!dgId && name !== 'get_dealerships' && name !== 'search_knowledge') {
    return { error: 'No dealer group selected. Please select a dealer group first.' };
  }

  try {
    switch (name) {
      case 'get_kpis_list': {
        const raw = await apiRequest(`/kpi/list?dealerGroupId=${dgId}`);
        let totalMetrics = 0;
        const groups = (raw || []).map(group => {
          const slimMetrics = {};
          for (const [key, name] of Object.entries(group.metrics || {})) {
            if (!key.includes('/')) {
              slimMetrics[key] = name;
            }
          }
          totalMetrics += Object.keys(slimMetrics).length;
          return { group: group.group, name: group.name, metrics: slimMetrics };
        });
        return { totalMetrics, groups };
      }

      case 'get_kpi_data': {
        const params = new URLSearchParams();
        params.set('metric', args.metricKey);
        params.set('dealerGroupId', String(dgId));
        params.set('dealerShipId', args.dealerShipId || '0');
        params.set('year', String(args.year || _context.year || new Date().getFullYear()));
        params.set('month', String(args.month || _context.month || (new Date().getMonth() + 1)));
        params.set('view', 'month');
        const result = await apiRequest(`/kpi/get?${params.toString()}`);
        return result;
      }

      case 'get_drilldown_options': {
        const params = new URLSearchParams();
        params.set('metric', args.metricKey);
        params.set('dealerGroupId', String(dgId));
        params.set('dealerShipId', args.dealerShipId || '0');
        params.set('view', 'month');
        params.set('year', String(args.year || _context.year || new Date().getFullYear()));
        params.set('month', String(args.month || _context.month || (new Date().getMonth() + 1)));
        const raw = await apiRequest(`/kpi/drill-down-settings?${params.toString()}`);
        return { drillDowns: raw.drillDowns || {} };
      }

      case 'get_drilldown_data': {
        const reqYear = args.year || _context.year || new Date().getFullYear();
        const reqMonth = args.month || _context.month || (new Date().getMonth() + 1);
        const params = new URLSearchParams();
        params.set('metric', args.metricKey);
        params.set('drillDown', args.drillDownType);
        params.set('dealerGroupId', String(dgId));
        params.set('dealerShipId', args.dealerShipId || '0');
        params.set('view', 'month');
        params.set('year', String(reqYear));
        params.set('month', String(reqMonth));
        const raw = await apiRequest(`/kpi/drill-down?${params.toString()}`);
        const data = raw.data || {};
        const entries = Object.values(data)
          .filter(e => e && typeof e === 'object' && e.label)
          .sort((a, b) => Math.abs(b.variance || 0) - Math.abs(a.variance || 0))
          .slice(0, 15)
          .map(e => {
            const curr = typeof e.current === 'object' ? Number(e.current?.value ?? e.current) : Number(e.current);
            const prev = typeof e.previous === 'object' ? Number(e.previous?.value ?? e.previous) : Number(e.previous);
            const pctChange = (!isNaN(prev) && prev !== 0) ? ((curr - prev) / Math.abs(prev)) * 100 : null;
            return { label: e.label, current: e.current, previous: e.previous, variance: e.variance, variancePct: pctChange != null ? Math.round(pctChange * 10) / 10 : null, lastYear: e.lastYear };
          });
        return { drillDown: raw.drillDown, drillDownName: raw.drillDownName, dataType: raw.dataType, data: entries };
      }

      case 'get_dealerships': {
        if (!dgId) {
          return { error: 'No dealer group selected. Please select a dealer group first.' };
        }
        const raw = await apiRequest('/dealer/full-list');
        const allGroups = [...(raw.active || []), ...(raw.inactive || [])];
        const myGroup = allGroups.find(g => Number(g.id) === Number(dgId));
        if (myGroup) {
          return {
            dealerGroup: { id: myGroup.id, name: myGroup.name },
            dealerships: (myGroup.dealerships || []).map(d => ({ id: d.id, name: d.name }))
          };
        }
        return { dealerGroup: { id: dgId, name: _context.dealerGroupName }, dealerships: [] };
      }

      case 'get_daily_trend': {
        const params = new URLSearchParams();
        params.set('metric', args.metricKey);
        params.set('dealerGroupId', String(dgId));
        params.set('dealerShipId', args.dealerShipId || '0');
        params.set('year', String(args.year || _context.year || new Date().getFullYear()));
        params.set('month', String(args.month || _context.month || (new Date().getMonth() + 1)));
        params.set('view', 'month');
        params.set('period', 'current');
        const raw = await apiRequest(`/kpi/daily-trend?${params.toString()}`);
        // API returns { kpi: {...}, trend: { status, trend: [{date, value}, ...] } }
        const trendData = raw.trend?.trend || raw.trend || raw;
        return {
          metric: args.metricKey,
          kpiName: raw.kpi?.name || args.metricKey,
          year: args.year || _context.year || new Date().getFullYear(),
          month: args.month || _context.month || (new Date().getMonth() + 1),
          dailyValues: Array.isArray(trendData) ? trendData.map(d => ({ date: d.date, value: d.value })) : trendData,
        };
      }

      case 'search_knowledge': {
        const query = args.query || '';
        const pool = getPool();
        // Filter out stop words and very short words for better relevance
        const stopWords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','its','how','what','when','why','who','which','this','that','with','from','been','have','will','they','their','them','than','each','make','like','just','over','such','also','into','year','some','than','most','many','very','after','more','get','got','let','may','say','she','him','his','could','about','these','should','would','being','where','does']);
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)).slice(0, 6);
        if (!words.length) return { results: [], query };

        // Relevance-scored search: title/kpiName matches count 3x, content matches 1x
        // Build scoring expression in SQL
        const scoreParts = [];
        const allParams = [];
        for (const w of words) {
          scoreParts.push(`(CASE WHEN title LIKE ? THEN 3 ELSE 0 END)`);
          allParams.push(`%${w}%`);
          scoreParts.push(`(CASE WHEN kpiName LIKE ? THEN 3 ELSE 0 END)`);
          allParams.push(`%${w}%`);
          scoreParts.push(`(CASE WHEN content LIKE ? THEN 1 ELSE 0 END)`);
          allParams.push(`%${w}%`);
        }
        const scoreExpr = scoreParts.join(' + ');

        // Require at least one word matches somewhere
        const filterConditions = words.map(() => `(title LIKE ? OR kpiName LIKE ? OR content LIKE ?)`).join(' OR ');
        const filterParams = words.flatMap(w => [`%${w}%`, `%${w}%`, `%${w}%`]);

        const sql = `SELECT id, title, content, kpiName, problemType, documentType,
          (${scoreExpr}) AS relevance
          FROM aiKnowledgeDocuments
          WHERE deletedAt IS NULL AND (${filterConditions})
          ORDER BY relevance DESC, problemType DESC
          LIMIT 5`;

        const [rows] = await pool.execute(sql, [...allParams, ...filterParams]);

        return {
          query: args.query,
          searchTerms: words,
          resultsCount: rows.length,
          documents: rows.map(r => ({
            id: r.id,
            title: r.title,
            kpiName: r.kpiName,
            type: r.problemType === 1 ? 'troubleshooting' : 'best-practice',
            relevance: r.relevance,
            content: r.content.length > 2000 ? r.content.substring(0, 2000) + '...' : r.content
          }))
        };
      }

      case 'get_monthly_trend': {
        const numMonths = Math.min(args.months || 6, 12);
        const baseYear = _context.year || new Date().getFullYear();
        const baseMonth = _context.month || (new Date().getMonth() + 1);

        // Build list of months to fetch (going backwards from the analysis period)
        const monthsToFetch = [];
        for (let i = 0; i < numMonths; i++) {
          let m = baseMonth - i;
          let y = baseYear;
          while (m < 1) { m += 12; y -= 1; }
          monthsToFetch.push({ month: m, year: y });
        }
        monthsToFetch.reverse(); // oldest first

        // Fetch all months in parallel
        const fetches = monthsToFetch.map(async ({ month, year }) => {
          try {
            const params = new URLSearchParams();
            params.set('metric', args.metricKey);
            params.set('dealerGroupId', String(dgId));
            params.set('dealerShipId', args.dealerShipId || '0');
            params.set('year', String(year));
            params.set('month', String(month));
            params.set('view', 'month');
            const r = await apiRequest(`/kpi/get?${params.toString()}`);
            const curr = typeof r.current === 'object' ? r.current?.value : r.current;
            const ly = r.lastYear ? (typeof r.lastYear === 'object' ? r.lastYear?.value : r.lastYear) : null;
            return { month, year, value: curr != null ? Number(curr) : null, lastYearValue: ly != null ? Number(ly) : null, kpiName: r.fullName || r.name || null, dataType: r.dataType || null };
          } catch {
            return { month, year, value: null, lastYearValue: null };
          }
        });

        const results = await Promise.all(fetches);
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        // Extract KPI name and dataType from first successful result
        const firstValid = results.find(r => r.kpiName);
        const kpiName = firstValid?.kpiName || args.metricKey;
        const dataType = firstValid?.dataType || 'number';

        return {
          metric: args.metricKey,
          kpiName,
          dataType,
          dealerShipId: args.dealerShipId || '0',
          months: results.map(r => ({
            month: r.month,
            year: r.year,
            value: r.value,
            lastYearValue: r.lastYearValue,
            label: MONTH_NAMES[r.month - 1] + ' ' + String(r.year).slice(-2)
          }))
        };
      }

      case 'get_market_data': {
        try {
          const isNational = args.scope === 'national';
          let dmaInfo = null;
          const dealerShipId = args.dealerShipId || '0';

          if (!isNational) {
            // Local scope: find the dealership's DMA
            if (dealerShipId && dealerShipId !== '0') {
              dmaInfo = await getDealershipDMA(parseInt(dealerShipId));
            }
            // Fallback: get the group's primary DMA
            if (!dmaInfo && dgId) {
              const groupDMAs = await getDealerGroupDMAs(dgId);
              if (groupDMAs.length > 0) {
                dmaInfo = groupDMAs[0];
              }
            }
            if (!dmaInfo) {
              return { error: 'Could not determine the market area for this dealership. No DMA mapping found.' };
            }
          }

          // Query market data (null dmaId = national/all DMAs)
          const data = await queryMarketData({
            dmaId: isNational ? null : dmaInfo.dma_id,
            make: args.make || null,
            model: args.model || null,
            carType: args.car_type || null,
            period: args.period || 'latest_week',
          });

          const summary = await getMarketSummary({
            dmaId: isNational ? null : dmaInfo.dma_id,
            carType: args.car_type || null,
            period: args.period || 'latest_week',
          });

          return {
            market: isNational ? 'National (US)' : dmaInfo.dma_name,
            scope: isNational ? 'national' : 'local',
            dma_id: isNational ? null : dmaInfo.dma_id,
            period: args.period || 'latest_week',
            data: data.map(r => ({
              make: r.make,
              model: r.model,
              car_type: r.car_type,
              market_sales: parseInt(r.total_sales) || 0,
              market_py_sales: parseInt(r.total_py_sales) || 0,
              yoy_pchg: r.yoy_pchg ? parseFloat(r.yoy_pchg) : null,
              market_listed: parseInt(r.total_listed) || 0,
              market_vdp: parseInt(r.total_vdp) || 0,
              market_dollars: parseInt(r.total_dollars) || 0,
            })),
            summary: {
              total_market_sales: parseInt(summary.total_market_sales) || 0,
              total_market_py_sales: parseInt(summary.total_market_py_sales) || 0,
              total_yoy_pchg: summary.total_yoy_pchg ? parseFloat(summary.total_yoy_pchg) : null,
              total_market_listed: parseInt(summary.total_market_listed) || 0,
              unique_makes: parseInt(summary.unique_makes) || 0,
            }
          };
        } catch (err) {
          console.error('[Tool] Market data error:', err.message);
          return { error: 'Market data is not yet available. ' + err.message };
        }
      }

      case 'get_market_trend': {
        try {
          const isNational = args.scope === 'national';
          let dmaInfo = null;

          if (!isNational) {
            if (dgId) {
              const groupDMAs = await getDealerGroupDMAs(dgId);
              if (groupDMAs.length > 0) dmaInfo = groupDMAs[0];
            }
            if (!dmaInfo) {
              return { error: 'Could not determine market area. No DMA mapping found.' };
            }
          }

          const trend = await getMarketTrend({
            dmaId: isNational ? null : dmaInfo.dma_id,
            make: args.make || null,
            carType: args.car_type || null,
          });

          return {
            market: isNational ? 'National (US)' : dmaInfo.dma_name,
            scope: isNational ? 'national' : 'local',
            make: args.make || 'All Makes',
            weeks: trend,
          };
        } catch (err) {
          console.error('[Tool] Market trend error:', err.message);
          return { error: 'Market trend data unavailable. ' + err.message };
        }
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`[Tool] Error executing ${name}:`, error.message);
    return { error: error.message };
  }
}
