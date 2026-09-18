// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Lifted from the real dashboard (the Daily Pulse engine) for the Claude for Dealers toolkit. Credentials
// removed: keys and hosts come from the environment. Read recipes/email-reports.md.
import { executeTool, setToolContext, apiRequest } from './tools.js';
import * as db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { CHEAP_MODEL } from './models.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PULSE_METRICS = [
  { key: 'sales.sales', label: 'Total Sales', priority: 1 },
  { key: 'sales.internetSales', label: 'Internet Sales', priority: 2 },
  { key: 'lead-source-roi.goodLeads', label: 'Quality Leads', priority: 3 },
  { key: 'sales.closingRatio', label: 'Closing Ratio', pct: true, priority: 4 },
  { key: 'website.sessions', label: 'Website Sessions', priority: 5 },
  { key: 'sales.revenue', label: 'Total Gross Profit', priority: 6 },
  { key: 'inventory.avgInventory', label: 'Average Inventory', priority: 7 },
  { key: 'lead-source-roi.cps', label: 'Cost Per Sale', costMetric: true, priority: 8 },
  { key: 'sales.pvr', label: 'Per Vehicle Revenue', priority: 9 },
  { key: 'paid-search.spend', label: 'Ad Spend', costMetric: true, priority: 10 },
];

export { PULSE_METRICS };

function extractNum(data, field) {
  if (!data || typeof data !== 'object') return null;
  const v = data[field];
  if (v == null) return null;
  if (typeof v === 'object' && v.value !== undefined) return Number(v.value);
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') return Number(v);
  return null;
}

function formatValue(val, metric) {
  if (metric.pct) return `${val.toFixed(1)}%`;
  if (metric.costMetric) return `$${Math.round(val).toLocaleString()}`;
  if (val >= 10000) return val.toLocaleString();
  return String(Math.round(val));
}

function classifySeverity(pctChange, metric) {
  const abs = Math.abs(pctChange);
  const isBad = metric.costMetric ? pctChange > 0 : pctChange < 0;
  if (!isBad) return 'positive';
  if (abs >= 20) return 'critical';
  if (abs >= 10) return 'warning';
  return 'info';
}

function classifyCategory(pctChange, metric) {
  const isBad = metric.costMetric ? pctChange > 0 : pctChange < 0;
  if (!isBad) return 'recovery';
  return Math.abs(pctChange) >= 15 ? 'threshold_breach' : 'kpi_variance';
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr, value) {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

/**
 * Fetch the list of all active dealer groups from the OneVision API.
 */
async function getAllDealerGroups() {
  try {
    const raw = await apiRequest('/dealer/full-list');
    const groups = [...(raw.active || [])];
    return groups.map(g => ({ id: Number(g.id), name: g.name }));
  } catch (e) {
    console.error('[Pulse] Failed to fetch dealer groups:', e.message);
    return [];
  }
}

/**
 * Generate benchmark data across all dealer groups for today.
 * Fetches each metric for every active group and computes distributions.
 */
async function generateBenchmarks() {
  const pulseDate = todayDate();

  // Check if benchmarks already exist for today
  const existing = db.getPulseBenchmarks(pulseDate);
  if (existing.length >= PULSE_METRICS.length * 0.5) {
    return existing; // Already generated
  }

  console.log('[Pulse] Generating benchmark data across all dealer groups...');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const groups = await getAllDealerGroups();
  if (groups.length < 3) {
    console.log('[Pulse] Not enough groups for benchmarking:', groups.length);
    return [];
  }

  console.log(`[Pulse] Benchmarking ${PULSE_METRICS.length} metrics across ${groups.length} groups...`);

  // For each metric, fetch data for all groups
  for (const metric of PULSE_METRICS) {
    try {
      // Fetch this metric for all groups in parallel (batches of 10 to avoid overwhelming API)
      const groupData = [];

      for (let batch = 0; batch < groups.length; batch += 10) {
        const batchGroups = groups.slice(batch, batch + 10);
        const batchResults = await Promise.allSettled(
          batchGroups.map(g => {
            setToolContext({ dealerGroupId: g.id, year, month });
            return executeTool('get_kpi_data', { metricKey: metric.key, dealerShipId: '0', year, month });
          })
        );

        for (let i = 0; i < batchResults.length; i++) {
          const r = batchResults[i];
          if (r.status !== 'fulfilled' || !r.value || r.value.error) continue;

          const current = extractNum(r.value, 'current');
          const previous = extractNum(r.value, 'previous');
          if (current == null || previous == null || previous === 0) continue;

          const pctChange = ((current - previous) / Math.abs(previous)) * 100;
          groupData.push({
            groupId: batchGroups[i].id,
            current,
            previous,
            pctChange: Math.round(pctChange * 10) / 10,
          });
        }
      }

      if (groupData.length < 2) continue;

      const currentValues = groupData.map(d => d.current);
      const changeValues = groupData.map(d => d.pctChange);
      const avgCurrent = currentValues.reduce((s, v) => s + v, 0) / currentValues.length;
      const avgChange = changeValues.reduce((s, v) => s + v, 0) / changeValues.length;
      const medianCurrent = median(currentValues);

      // Store anonymous sorted values (no group names) for percentile computation
      const anonymousValues = groupData.map(d => ({
        current: d.current,
        pctChange: d.pctChange,
        groupId: d.groupId, // Keep ID for lookup, but NEVER expose to frontend
      }));

      db.upsertPulseBenchmark(
        pulseDate, metric.key, groupData.length,
        anonymousValues, avgCurrent, avgChange, medianCurrent
      );

      console.log(`[Pulse] Benchmark ${metric.key}: ${groupData.length} groups, avg change ${avgChange.toFixed(1)}%`);
    } catch (e) {
      console.error(`[Pulse] Benchmark failed for ${metric.key}:`, e.message);
    }
  }

  return db.getPulseBenchmarks(pulseDate);
}

/**
 * Get benchmark context for a specific dealer group's metrics.
 * Returns an object keyed by metric_key with percentile rankings and peer comparison data.
 */
export async function getBenchmarkContext(dealerGroupId) {
  const pulseDate = todayDate();
  let benchmarks = db.getPulseBenchmarks(pulseDate);

  // Generate if not yet available
  if (benchmarks.length < PULSE_METRICS.length * 0.3) {
    // Run benchmark generation in the background — don't block the page load
    generateBenchmarks().catch(e => console.error('[Pulse] Background benchmark generation failed:', e.message));
    benchmarks = db.getPulseBenchmarks(pulseDate);
  }

  const result = {};

  for (const b of benchmarks) {
    try {
      const values = JSON.parse(b.values_json || '[]');
      const myData = values.find(v => Number(v.groupId) === Number(dealerGroupId));

      if (!myData) {
        result[b.metric_key] = {
          totalGroups: b.total_groups,
          avgChange: b.avg_change,
          medianCurrent: b.median_current,
          hasData: false,
        };
        continue;
      }

      const currentValues = values.map(v => v.current);
      const changeValues = values.map(v => v.pctChange);

      // For "good" metrics (higher = better), higher percentile = better
      // For "cost" metrics (lower = better), we invert
      const metricDef = PULSE_METRICS.find(m => m.key === b.metric_key);
      const isCost = metricDef?.costMetric;

      const valuePercentile = percentile(currentValues, myData.current);
      const changePercentile = percentile(changeValues, myData.pctChange);

      // Count how many groups have similar trend direction
      const myDir = myData.pctChange > 0 ? 'up' : 'down';
      const sameDirCount = values.filter(v => (v.pctChange > 0 ? 'up' : 'down') === myDir).length;

      // Rank (1 = best). For cost metrics, lower is better.
      const sortedCurrent = [...currentValues].sort((a, b) => isCost ? a - b : b - a);
      const rank = sortedCurrent.indexOf(myData.current) + 1;

      result[b.metric_key] = {
        totalGroups: b.total_groups,
        rank,
        valuePercentile: isCost ? (100 - valuePercentile) : valuePercentile,
        changePercentile,
        avgChange: Math.round(b.avg_change * 10) / 10,
        avgCurrent: Math.round(b.avg_current),
        medianCurrent: Math.round(b.median_current),
        sameDirCount,
        sameDirPct: Math.round((sameDirCount / values.length) * 100),
        myChange: myData.pctChange,
        myCurrent: myData.current,
        hasData: true,
      };
    } catch (e) {
      console.error(`[Pulse] Failed to compute benchmark for ${b.metric_key}:`, e.message);
    }
  }

  return result;
}

/**
 * Generate pulse insights for a dealer group.
 */
export async function generatePulseInsights(dealerGroupId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pulseDate = todayDate();

  const existing = db.getPulseInsights(dealerGroupId, pulseDate);
  if (existing.length > 0) return existing;

  console.log(`[Pulse] Generating insights for dealer group ${dealerGroupId} (${year}-${month})`);

  setToolContext({ dealerGroupId, year, month });

  const results = await Promise.allSettled(
    PULSE_METRICS.map(m => executeTool('get_kpi_data', { metricKey: m.key, dealerShipId: '0', year, month }))
  );

  const variances = [];
  let successCount = 0;

  for (let i = 0; i < PULSE_METRICS.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value || r.value.error) {
      console.log(`[Pulse] ${PULSE_METRICS[i].key} failed:`, r.status === 'fulfilled' ? r.value?.error : r.reason?.message);
      continue;
    }

    const data = r.value;
    successCount++;

    const current = extractNum(data, 'current');
    const previous = extractNum(data, 'previous');
    const lastYear = extractNum(data, 'lastYear');

    if (current == null || previous == null) continue;
    if (current === 0 && previous === 0) continue;
    if (previous === 0) continue;

    const pctChange = ((current - previous) / Math.abs(previous)) * 100;

    if (Math.abs(pctChange) > 5) {
      variances.push({
        metric: PULSE_METRICS[i],
        current,
        previous,
        lastYear,
        pctChange,
        magnitude: Math.abs(pctChange),
        severity: classifySeverity(pctChange, PULSE_METRICS[i]),
        category: classifyCategory(pctChange, PULSE_METRICS[i]),
      });
    }
  }

  console.log(`[Pulse] ${successCount}/${PULSE_METRICS.length} metrics fetched, ${variances.length} significant variances`);

  if (variances.length === 0 && successCount > 0) {
    const id = uuidv4();
    db.upsertPulseInsight(
      id, dealerGroupId, pulseDate, 'recovery', 'positive', null, null,
      'All Clear — Performance On Track',
      'All monitored KPIs are within normal ranges. No significant changes detected compared to last month.',
      'Keep up the great work! Consider reviewing longer-term trends for optimization opportunities.',
      null
    );
    return db.getPulseInsights(dealerGroupId, pulseDate);
  }

  if (successCount === 0) return [];

  variances.sort((a, b) => b.magnitude - a.magnitude || a.metric.priority - b.metric.priority);
  const topVariances = variances.slice(0, 8);

  let recommendations = {};
  try {
    recommendations = await generateRecommendations(topVariances, dealerGroupId);
  } catch (e) {
    console.error('[Pulse] AI recommendation generation failed:', e.message);
  }

  for (const v of topVariances) {
    const id = uuidv4();
    const abs = Math.abs(Math.round(v.pctChange));
    const direction = v.pctChange > 0 ? 'up' : 'down';
    const curStr = formatValue(v.current, v.metric);
    const prevStr = formatValue(v.previous, v.metric);

    let title, detail;
    if (v.severity === 'positive') {
      title = `${v.metric.label} improved ${abs}%`;
      detail = `${v.metric.label} is ${direction} to ${curStr} from ${prevStr} last month — a ${abs}% improvement.`;
      if (v.lastYear != null) detail += ` Last year same month: ${formatValue(v.lastYear, v.metric)}.`;
    } else {
      title = `${v.metric.label} ${direction} ${abs}%`;
      detail = `${v.metric.label} moved to ${curStr} from ${prevStr} last month — a ${abs}% ${direction === 'down' ? 'decrease' : 'increase'} that needs attention.`;
      if (v.lastYear != null) detail += ` Last year same month: ${formatValue(v.lastYear, v.metric)}.`;
    }

    const recommendation = recommendations[v.metric.key] || `Investigate what's driving the ${abs}% change in ${v.metric.label}. Compare by store and lead source for deeper insights.`;

    db.upsertPulseInsight(
      id, dealerGroupId, pulseDate, v.category, v.severity,
      v.metric.key, v.metric.label, title, detail, recommendation,
      { current: v.current, previous: v.previous, lastYear: v.lastYear, pctChange: v.pctChange }
    );
  }

  return db.getPulseInsights(dealerGroupId, pulseDate);
}

async function generateRecommendations(variances, dealerGroupId) {
  const summary = variances.map(v => {
    const dir = v.pctChange > 0 ? 'up' : 'down';
    return `- ${v.metric.label} (${v.metric.key}): ${dir} ${Math.abs(Math.round(v.pctChange))}% — current: ${formatValue(v.current, v.metric)}, previous: ${formatValue(v.previous, v.metric)}, severity: ${v.severity}`;
  }).join('\n');

  const response = await client.messages.create({
    model: CHEAP_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are an automotive dealership performance consultant. Given these KPI changes for a dealer group, provide ONE specific, actionable recommendation for each metric. Be concise (1-2 sentences each). Focus on what the dealership manager should DO, not just observe.

KPI Changes:
${summary}

Respond in JSON format: { "metric.key": "recommendation text", ... }
Only include the JSON, no other text.`
    }],
  });

  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return {};
  } catch (e) {
    console.error('[Pulse] Failed to parse AI recommendations:', e.message);
    return {};
  }
}

export async function getTodayInsights(dealerGroupId) {
  const pulseDate = todayDate();
  const existing = db.getPulseInsights(dealerGroupId, pulseDate);
  if (existing.length > 0) return existing;
  return generatePulseInsights(dealerGroupId);
}

export function getInsightsHistory(dealerGroupId, days = 7) {
  const today = todayDate();
  return db.getPulseInsightsHistory(dealerGroupId, today, days);
}
