// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { executeTool, setToolContext } from './tools.js';
import * as db from './db.js';

const METRICS = [
  { key: 'sales.sales', label: 'Total sales', priority: 1 },
  { key: 'sales.internetSales', label: 'Internet sales', priority: 2 },
  { key: 'lead-source-roi.goodLeads', label: 'Quality leads', priority: 3 },
  { key: 'sales.closingRatio', label: 'Closing ratio', pct: true, priority: 4 },
  { key: 'website.sessions', label: 'Website sessions', priority: 5 },
  { key: 'sales.revenue', label: 'Total gross profit', priority: 6 },
  { key: 'inventory.avgInventory', label: 'Inventory', priority: 7 },
  { key: 'lead-source-roi.cps', label: 'Cost per sale', costMetric: true, priority: 8 },
];

const FALLBACK_SUGGESTIONS = [
  "Give me a full performance overview for this month",
  "Which store needs the most attention right now?",
  "Compare my lead sources by ROI",
];

/**
 * Extract the numeric value from a KPI API response field.
 * API shape: { current: { value: 1245 }, previous: { value: 1338 }, lastYear: { value: 1293 } }
 */
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

function formatVariance(label, current, previous, pctChange, metric) {
  const abs = Math.abs(Math.round(pctChange));
  const curStr = formatValue(current, metric);
  const prevStr = formatValue(previous, metric);

  if (metric.costMetric) {
    if (pctChange > 0) {
      return `${label} rose to ${curStr} (up ${abs}% from ${prevStr}) — what's driving costs up?`;
    }
    return `${label} improved to ${curStr} (down ${abs}% from ${prevStr}) — what changed?`;
  }
  if (pctChange < 0) {
    return `${label} dropped to ${curStr} (down ${abs}% from ${prevStr}) — what's causing this?`;
  }
  return `${label} grew to ${curStr} (up ${abs}% from ${prevStr}) — what's driving this?`;
}

export async function getHighlights(dealerGroupId, year, month) {
  // Check cache first (2hr TTL handled by db.getHighlightsCache)
  const cached = db.getHighlightsCache(dealerGroupId, year, month);
  if (cached) return cached;

  try {
    // Set tool context for this request
    setToolContext({ dealerGroupId, year, month });

    // Fetch all metrics in parallel (server-side auth managed by tools.js)
    const results = await Promise.allSettled(
      METRICS.map(m => executeTool('get_kpi_data', { metricKey: m.key, dealerShipId: '0', year, month }))
    );

    const variances = [];
    let successCount = 0;

    for (let i = 0; i < METRICS.length; i++) {
      const r = results[i];
      if (r.status !== 'fulfilled' || !r.value || r.value.error) {
        console.log(`[Highlights] ${METRICS[i].key} failed:`, r.status === 'fulfilled' ? r.value?.error : r.reason?.message);
        continue;
      }

      const data = r.value;
      successCount++;

      const current = extractNum(data, 'current');
      const previous = extractNum(data, 'previous');

      // Skip metrics where both values are 0 or null (not tracked)
      if (current == null || previous == null) continue;
      if (current === 0 && previous === 0) continue;

      // For percentage metrics, compare the raw values directly
      // For absolute metrics, calculate percent change
      let pctChange;
      if (METRICS[i].pct) {
        // Already a percentage (e.g., closing ratio 14.5% vs 17.1%)
        // Calculate the absolute point change as a relative percent
        if (previous === 0) continue;
        pctChange = ((current - previous) / Math.abs(previous)) * 100;
      } else {
        if (previous === 0) continue;
        pctChange = ((current - previous) / Math.abs(previous)) * 100;
      }

      // Only include significant variances (>5%)
      if (Math.abs(pctChange) > 5) {
        variances.push({
          metric: METRICS[i],
          current,
          previous,
          pctChange,
          magnitude: Math.abs(pctChange),
        });
      }
    }

    console.log(`[Highlights] ${successCount}/${METRICS.length} metrics fetched, ${variances.length} significant variances`);

    if (variances.length === 0) {
      // Don't cache fallback suggestions — let it retry next time
      if (successCount === 0) {
        console.log('[Highlights] All API calls failed — returning fallback (not cached)');
        return FALLBACK_SUGGESTIONS;
      }
      // All metrics fetched but no significant changes — cache that as empty (no highlights)
      console.log('[Highlights] No significant variances found — returning fallback (not cached)');
      return FALLBACK_SUGGESTIONS;
    }

    // Sort by magnitude (largest changes first), with priority as tiebreaker
    variances.sort((a, b) => b.magnitude - a.magnitude || a.metric.priority - b.metric.priority);
    const highlights = variances.slice(0, 5).map(v => formatVariance(v.metric.label, v.current, v.previous, v.pctChange, v.metric));

    console.log('[Highlights] Generated:', highlights);

    // Only cache real data-driven highlights
    db.upsertHighlightsCache(dealerGroupId, year, month, highlights);
    return highlights;
  } catch (err) {
    console.error('[Highlights] Fetch error:', err);
    return FALLBACK_SUGGESTIONS;
  }
}
