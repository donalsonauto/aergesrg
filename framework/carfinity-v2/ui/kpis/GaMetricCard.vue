<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
// GaMetricCard — one GA4 KPI card on the "My KPIs" page.
//
// Visual port of the carfinity cashflow MetricCard.vue: same header layout,
// trend badges, kebab menu, and the 4 view modes (sparkline / daily /
// breakdown / hero). Wired to the GA4 /api/kpi/* endpoints via GaKpiAPI.
//
// Owns its own data fetching (value + whichever series the active view mode
// needs) and persists viewMode + breakdown dimension to localStorage
// (myKpis_cardPrefs, keyed by KPI key).
//
// Click the body to open the drilldown overlay (emits 'drilldown').

import { ref, computed, watch, onMounted } from 'vue';
import GaKpiAPI from '@/api/GaKpiAPI';
import MiniLineChart from '@/components/dashboard/charts/MiniLineChart.vue';
import { formatValue } from '@/composables/useFormatKpi';
import KpiInfo from '@/components/common/KpiInfo.vue';
import Menu from 'primevue/menu';
import { useAiStore } from '@/chat/stores/ai';
import { useThreadsStore } from '@/stores/threads';

const aiStore = useAiStore();
const threadStore = useThreadsStore();

const LEAD_COLORS = ['#818cf8', '#34d399', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa', '#22d3ee', '#facc15'];

const props = defineProps({
  kpi: { type: Object, required: true },           // catalog def { key, name, dataType, source, invert, drilldownDims }
  scope: { type: Object, required: true },          // { type, id, label }
  dateRange: { type: Object, required: true },      // { startDate, endDate }
});

const emit = defineEmits(['remove', 'drilldown']);

// ── per-card prefs (localStorage) ──────────────────────────────────────
const PREFS_KEY = 'myKpis_cardPrefs';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
function savePref(patch) {
  const all = loadPrefs();
  all[props.kpi.key] = { ...(all[props.kpi.key] || {}), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(all));
}

const VIEW_MODES = ['sparkline', 'daily', 'breakdown', 'hero'];
const stored = loadPrefs()[props.kpi.key] || {};
const viewMode = ref(VIEW_MODES.includes(stored.viewMode) ? stored.viewMode : 'sparkline');

// breakdown dimension — for a group/all scope, default to 'property'
const dimOptions = computed(() => {
  const opts = (props.kpi.drilldownDims || []).map(d => ({ key: d.key, label: d.label }));
  if (props.scope.type === 'group' || props.scope.type === 'all') {
    opts.unshift({ key: 'property', label: 'Property' });
  }
  return opts;
});
const defaultDim = computed(() =>
  (props.scope.type === 'group' || props.scope.type === 'all') ? 'property' : (dimOptions.value[0]?.key || null)
);
const dimension = ref(stored.dimension && dimOptions.value.some(d => d.key === stored.dimension)
  ? stored.dimension : defaultDim.value);
const breakdownSort = ref(['value', 'drops', 'gains', 'pct-worst', 'pct-best'].includes(stored.breakdownSort)
  ? stored.breakdownSort : 'value');

watch(viewMode, v => savePref({ viewMode: v }));
watch(dimension, d => savePref({ dimension: d }));
watch(breakdownSort, s => savePref({ breakdownSort: s }));

// ── data state ─────────────────────────────────────────────────────────
const loading = ref(true);
const error = ref(null);          // { kind, message }
const value = ref(null);          // { dataType, invert, current, previous, lastYear }
const monthly = ref(null);        // { points }
const daily = ref(null);          // { points }
const breakdown = ref(null);      // { rows }
const seriesLoading = ref(false);

const scopeParams = computed(() => ({
  key: props.kpi.key,
  scopeType: props.scope.type,
  scopeId: props.scope.id,
  startDate: props.dateRange.startDate,
  endDate: props.dateRange.endDate,
}));

function classifySoft(res) {
  if (res && res.error) return { kind: res.error, message: res.message || 'Data unavailable' };
  if (res && res.no_property) return { kind: 'no_property', message: 'No GA4 property in this scope' };
  return null;
}

async function fetchValue() {
  loading.value = true;
  error.value = null;
  try {
    const res = await GaKpiAPI.getValue(scopeParams.value);
    const soft = classifySoft(res);
    if (soft) { error.value = soft; value.value = null; }
    else value.value = res;
  } catch (e) {
    error.value = { kind: 'unknown', message: e?.message || 'Failed to load' };
  } finally {
    loading.value = false;
  }
}

async function fetchSeries() {
  if (error.value) return;
  seriesLoading.value = true;
  try {
    const mode = viewMode.value;
    if (mode === 'sparkline' || mode === 'hero') {
      if (!monthly.value) {
        const res = await GaKpiAPI.getMonthly({ ...scopeParams.value });
        monthly.value = classifySoft(res) ? { points: [] } : res;
      }
    }
    if (mode === 'daily') {
      if (!daily.value) {
        const res = await GaKpiAPI.getDaily(scopeParams.value);
        daily.value = classifySoft(res) ? { points: [] } : res;
      }
    }
    if (mode === 'breakdown' || mode === 'hero') {
      await fetchBreakdown();
    }
  } finally {
    seriesLoading.value = false;
  }
}

async function fetchBreakdown() {
  const res = await GaKpiAPI.getDrilldown({ ...scopeParams.value, dimension: dimension.value });
  breakdown.value = classifySoft(res) ? { rows: [] } : res;
}

// reset + refetch when scope / date / KPI changes
watch(
  () => [props.kpi.key, props.scope.type, props.scope.id, props.dateRange.startDate, props.dateRange.endDate],
  async () => {
    monthly.value = null; daily.value = null; breakdown.value = null;
    await fetchValue();
    await fetchSeries();
  }
);
watch(viewMode, () => fetchSeries());
watch(dimension, async () => {
  if (viewMode.value === 'breakdown' || viewMode.value === 'hero') {
    breakdown.value = null;
    // Flag loading so the skeleton shows instead of "No breakdown data"
    // while the new dimension's drilldown is in flight.
    seriesLoading.value = true;
    try {
      await fetchBreakdown();
    } finally {
      seriesLoading.value = false;
    }
  }
});

onMounted(async () => {
  await fetchValue();
  await fetchSeries();
  threadStore.loadCounts();
});

// ── data type ──────────────────────────────────────────────────────────
// GA4 catalog uses int/money/pcnt/duration — all handled by useFormatKpi.
const dataType = computed(() => value.value?.dataType || props.kpi.dataType || 'int');

// ── headline display ───────────────────────────────────────────────────
const metricName = computed(() => props.kpi.name || props.kpi.key);
const currentValue = computed(() => formatValue(value.value?.current?.value, dataType.value));
const previousValue = computed(() => formatValue(value.value?.previous?.value, dataType.value));
const lastYearValue = computed(() => formatValue(value.value?.lastYear?.value, dataType.value));
const hasPrevious = computed(() => value.value?.previous?.value != null);
const hasLastYear = computed(() => value.value?.lastYear?.value != null);

// GA4 backend returns `change` (a percentage) directly on previous/lastYear.
const trendPct = computed(() => {
  const c = value.value?.previous?.change;
  return (c === null || c === undefined) ? null : c;
});

// invert flips colour semantics (down is good for bounceRate etc.)
const trendColor = computed(() => {
  const pct = trendPct.value;
  if (pct == null) return 'neutral';
  const good = props.kpi.invert ? pct < -0.5 : pct > 0.5;
  const bad = props.kpi.invert ? pct > 0.5 : pct < -0.5;
  if (good) return 'positive';
  if (bad) return 'negative';
  return 'neutral';
});

const trendDisplay = computed(() => {
  const pct = trendPct.value;
  if (pct == null) return null;
  const arrow = pct > 0.5 ? '↑' : pct < -0.5 ? '↓' : '';
  return arrow + Math.abs(pct).toFixed(0) + '%';
});

const trendCountDisplay = computed(() => {
  const cur = value.value?.current?.value;
  const prev = value.value?.previous?.value;
  if (cur == null || prev == null) return null;
  const diff = cur - prev;
  if (diff === 0) return null;
  const sign = diff > 0 ? '+' : '';
  return sign + formatValue(diff, dataType.value);
});

const badgeClasses = computed(() => {
  if (trendColor.value === 'positive') return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
  if (trendColor.value === 'negative') return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
  return 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400';
});

const chartBorderColor = computed(() => {
  if (trendColor.value === 'positive') return 'rgb(34, 197, 94)';
  if (trendColor.value === 'negative') return 'rgb(239, 68, 68)';
  return undefined;
});

const chartBgColor = computed(() => {
  if (trendColor.value === 'positive') return ['rgba(34,197,94,0.3)', 'rgba(34,197,94,0)'];
  if (trendColor.value === 'negative') return ['rgba(239,68,68,0.3)', 'rgba(239,68,68,0)'];
  return undefined;
});

// ── sparkline / hero monthly series ────────────────────────────────────
const chartData = computed(() => (monthly.value?.points || []).map(p => Number(p.value) || 0));
const lastYearTrendData = computed(() => {
  const pts = monthly.value?.points || [];
  return pts.some(p => p.lastYearValue) ? pts.map(p => Number(p.lastYearValue) || 0) : null;
});
const trendLabels = computed(() => (monthly.value?.points || []).map(p => p.label));

// ── daily series ───────────────────────────────────────────────────────
const dailyTrendData = computed(() => {
  const pts = daily.value?.points || [];
  return {
    values: pts.map(p => Number(p.value) || 0),
    labels: pts.map(p => p.label),
  };
});

const maxDailyValue = computed(() => {
  const vals = dailyTrendData.value.values;
  return vals.length ? Math.max(...vals, 1) : 1;
});

function dailyBarHeight(val) {
  if (val === 0) return '8%';
  return Math.max((val / maxDailyValue.value) * 100, 4) + '%';
}

function dailyBarTitle(val, i) {
  const label = dailyTrendData.value.labels[i] || '';
  return `${label}: ${formatValue(val, dataType.value)}`;
}

// ── breakdown rows ─────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'value', label: 'Top Value' },
  { value: 'drops', label: 'Biggest Drops' },
  { value: 'gains', label: 'Biggest Gains' },
  { value: 'pct-worst', label: '% Worst First' },
  { value: 'pct-best', label: '% Best First' },
];

function normalizeRow(r) {
  const cur = Number(r.current) || 0;
  const prev = r.previous != null ? Number(r.previous) || 0 : 0;
  const variance = cur - prev;
  // GA4 backend gives `change` directly; fall back to computed pct.
  const variancePct = (r.change !== null && r.change !== undefined)
    ? r.change
    : (prev ? (variance / Math.abs(prev)) * 100 : null);
  return { label: r.label ?? '—', current: cur, previous: prev, variance, variancePct };
}

const allBreakdownRows = computed(() => (breakdown.value?.rows || []).map(normalizeRow));

function sortBreakdownRows(rows, mode) {
  const sorted = [...rows];
  switch (mode) {
    case 'drops':     sorted.sort((a, b) => a.variance - b.variance); break;
    case 'gains':     sorted.sort((a, b) => b.variance - a.variance); break;
    case 'pct-worst': sorted.sort((a, b) => (a.variancePct ?? 0) - (b.variancePct ?? 0)); break;
    case 'pct-best':  sorted.sort((a, b) => (b.variancePct ?? 0) - (a.variancePct ?? 0)); break;
    default:          sorted.sort((a, b) => Math.abs(b.current) - Math.abs(a.current)); break;
  }
  return sorted;
}

const breakdownItems = computed(() =>
  sortBreakdownRows(allBreakdownRows.value, breakdownSort.value).slice(0, 5)
);

const isVarianceSort = computed(() => ['drops', 'gains', 'pct-worst', 'pct-best'].includes(breakdownSort.value));

const maxBreakdownValue = computed(() => {
  if (!breakdownItems.value.length) return 1;
  if (isVarianceSort.value) {
    return Math.max(...breakdownItems.value.map(r => Math.abs(r.variance)), 1);
  }
  return Math.max(...breakdownItems.value.map(r => Math.abs(r.current)), 1);
});

function breakdownBarValue(row) {
  return isVarianceSort.value ? Math.abs(row.variance) : Math.abs(row.current);
}

function breakdownBarColor(row) {
  if (!isVarianceSort.value) return null; // use cycling LEAD_COLORS
  if (row.variance > 0) return '#22c55e';
  if (row.variance < 0) return '#ef4444';
  return '#94a3b8';
}

const currentSortLabel = computed(() => SORT_OPTIONS.find(o => o.value === breakdownSort.value)?.label || '');
const currentDimLabel = computed(() => dimOptions.value.find(d => d.key === dimension.value)?.label || '');

// ── kebab menu ─────────────────────────────────────────────────────────
const menuRef = ref(null);
const menuItems = computed(() => {
  const modeItems = [
    { label: 'Sparkline', icon: viewMode.value === 'sparkline' ? 'pi pi-check' : 'pi pi-chart-line', command: (e) => { e.originalEvent?.stopPropagation(); viewMode.value = 'sparkline'; } },
    { label: 'Daily Trend', icon: viewMode.value === 'daily' ? 'pi pi-check' : 'pi pi-chart-bar', command: (e) => { e.originalEvent?.stopPropagation(); viewMode.value = 'daily'; } },
    { label: 'Breakdown', icon: viewMode.value === 'breakdown' ? 'pi pi-check' : 'pi pi-list', command: (e) => { e.originalEvent?.stopPropagation(); viewMode.value = 'breakdown'; } },
    { label: 'Expanded', icon: viewMode.value === 'hero' ? 'pi pi-check' : 'pi pi-arrows-alt', command: (e) => { e.originalEvent?.stopPropagation(); viewMode.value = 'hero'; } },
  ];

  const items = [{ label: 'View Mode', items: modeItems }];

  if ((viewMode.value === 'breakdown' || viewMode.value === 'hero') && dimOptions.value.length > 0) {
    items.push({ separator: true });
    items.push({
      label: 'Break Down By',
      items: dimOptions.value.map(d => ({
        label: d.label,
        icon: dimension.value === d.key ? 'pi pi-check' : undefined,
        command: (e) => { e.originalEvent?.stopPropagation(); dimension.value = d.key; },
      })),
    });
  }

  if (viewMode.value === 'breakdown' || viewMode.value === 'hero') {
    items.push({ separator: true });
    items.push({
      label: 'Sort By',
      items: SORT_OPTIONS.map(opt => ({
        label: opt.label,
        icon: breakdownSort.value === opt.value ? 'pi pi-check' : undefined,
        command: (e) => { e.originalEvent?.stopPropagation(); breakdownSort.value = opt.value; },
      })),
    });
  }

  items.push({ separator: true });
  items.push({ label: 'Remove', icon: 'pi pi-times', command: (e) => { e.originalEvent?.stopPropagation(); emit('remove', props.kpi.key); } });

  return items;
});

function toggleMenu(event) {
  event.stopPropagation();
  menuRef.value.toggle(event);
}

function handleClick() {
  emit('drilldown', { kpi: props.kpi, dimension: dimension.value });
}

// Open the per-KPI conversation thread (a global slide-over) for this KPI.
function askAboutKpi() {
  const label = metricName.value || props.kpi.name || props.kpi.key;
  threadStore.openThread({
    kpiKey: props.kpi.key,
    kpiLabel: label,
    scopeType: props.scope?.type,
    scopeId: props.scope?.id,
  });
}
</script>

<template>
  <div
    class="card flex-1 mb-0! p-0! min-w-52 rounded-2xl border border-surface shadow-[0px_1px_2px_0px_rgba(18,18,23,0.05)] cursor-pointer transition-all hover:shadow-md"
    :class="viewMode === 'hero' ? 'sm:col-span-2' : ''"
    @click="handleClick"
  >
    <!-- Header — same for all modes -->
    <div class="px-4 pt-3.5 pb-1">
      <div class="flex items-start gap-2">
        <span class="flex-1 label-medium truncate">{{ metricName }}</span>
        <span v-if="kpi.source === 'asc'" class="text-[10px] font-semibold text-primary-500 self-center">ASC</span>
        <KpiInfo
          v-if="kpi.methodology"
          class="self-center"
          :title="metricName"
          :lines="[kpi.methodology]"
        />
        <button
          class="relative inline-flex items-center justify-center w-[22px] h-[22px] rounded-md text-surface-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors self-center"
          title="Ask AI about this KPI"
          aria-label="Ask AI about this KPI"
          @click.stop="askAboutKpi"
        >
          <i class="pi pi-comments text-[12px]" />
          <span
            v-if="threadStore.countFor(kpi.key, scope?.type, scope?.id) > 0"
            class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-[9px] font-bold text-white flex items-center justify-center leading-none"
          >{{ threadStore.countFor(kpi.key, scope?.type, scope?.id) }}</span>
        </button>
        <button @click="toggleMenu">
          <i class="pi pi-ellipsis-h text-surface-500 hover:text-surface-950 dark:hover:text-surface-0 transition-all" />
        </button>
        <Menu ref="menuRef" :model="menuItems" :popup="true" />
      </div>
      <div class="flex items-center gap-3 text-[13px] text-surface-500 dark:text-surface-400 mt-1">
        <span v-if="hasPrevious">Prev: {{ previousValue }}</span>
        <span v-if="hasLastYear">LY: {{ lastYearValue }}</span>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <span class="label-large">{{ loading ? '—' : currentValue }}</span>
        <div v-if="trendDisplay" :class="[badgeClasses, 'px-2 py-0.5 rounded-lg text-sm font-semibold']">
          {{ trendDisplay }}
        </div>
        <span v-if="trendCountDisplay" class="text-[12px] tabular-nums"
          :class="trendColor === 'positive' ? 'text-green-600 dark:text-green-400' : trendColor === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-surface-400'">{{ trendCountDisplay }}</span>
      </div>
    </div>

    <!-- ===== Error / quota state ===== -->
    <div v-if="error" class="px-4 pb-4 pt-2 flex flex-col items-center justify-center text-center min-h-20">
      <i class="pi text-xl mb-1.5"
         :class="error.kind === 'quota' ? 'pi-clock text-amber-500'
                 : error.kind === 'no_property' ? 'pi-info-circle text-surface-400'
                 : 'pi-exclamation-triangle text-red-500'" />
      <div class="text-xs text-surface-500 dark:text-surface-400 max-w-[14rem]">
        {{ error.kind === 'quota' ? 'GA4 quota reached — try again later'
           : error.kind === 'no_property' ? 'No GA4 property in this scope'
           : error.message }}
      </div>
    </div>

    <template v-else>
      <!-- ===== Sparkline mode (default) ===== -->
      <template v-if="viewMode === 'sparkline'">
        <MiniLineChart
          v-if="chartData.length >= 2"
          class="max-h-20!"
          :data="chartData"
          :lastYearData="lastYearTrendData"
          :labels="trendLabels"
          :bgColor="chartBgColor"
          :borderColor="chartBorderColor"
          :tooltipPrefix="dataType === 'money' ? '$' : ''"
        />
        <div v-else class="max-h-20 h-16 flex items-center px-1">
          <div class="w-full h-[1.5px] rounded-full opacity-30 animate-pulse" :style="{ backgroundColor: chartBorderColor || '#94a3b8' }"></div>
        </div>
      </template>

      <!-- ===== Breakdown mode ===== -->
      <div v-else-if="viewMode === 'breakdown'" class="px-3 pb-3 pt-1">
        <div v-if="seriesLoading && !breakdown" class="flex flex-col gap-2">
          <div v-for="i in 5" :key="i" class="animate-pulse">
            <div class="flex items-center justify-between mb-1">
              <div class="h-2.5 bg-surface-200 dark:bg-surface-700 rounded w-20"></div>
              <div class="h-2.5 bg-surface-200 dark:bg-surface-700 rounded w-10"></div>
            </div>
            <div class="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full">
              <div class="h-full bg-surface-200 dark:bg-surface-700 rounded-full" :style="{ width: (90 - i * 15) + '%' }"></div>
            </div>
          </div>
        </div>
        <div v-else-if="!breakdownItems.length" class="py-4 text-center text-xs text-surface-400">No breakdown data</div>
        <div v-else class="flex flex-col gap-1.5">
          <div v-for="(row, i) in breakdownItems" :key="i">
            <div class="flex items-center justify-between mb-0.5">
              <span class="text-[11px] font-medium text-surface-700 dark:text-surface-300 truncate pr-2 max-w-[50%]">{{ row.label }}</span>
              <div class="flex items-center gap-1 shrink-0">
                <span v-if="isVarianceSort"
                  class="text-[11px] font-semibold tabular-nums"
                  :class="row.variance > 0 ? 'text-green-600 dark:text-green-400' : row.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-500'"
                >{{ row.variance > 0 ? '+' : '' }}{{ formatValue(row.variance, dataType) }}</span>
                <span v-else class="text-[11px] font-semibold tabular-nums text-surface-950 dark:text-surface-0">{{ formatValue(row.current, dataType) }}</span>
                <span v-if="row.variancePct != null"
                  class="text-[8px] font-semibold px-1 py-0.5 rounded"
                  :class="{
                    'text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-400': row.variancePct > 0,
                    'text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400': row.variancePct < 0,
                    'text-surface-400 bg-surface-100 dark:bg-surface-700': !row.variancePct,
                  }">{{ row.variancePct > 0 ? '+' : '' }}{{ row.variancePct.toFixed(0) }}%</span>
              </div>
            </div>
            <div class="h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="{
                  width: ((breakdownBarValue(row) / maxBreakdownValue) * 100) + '%',
                  backgroundColor: breakdownBarColor(row) || LEAD_COLORS[i % LEAD_COLORS.length],
                  opacity: isVarianceSort ? 1 : 1 - (i * 0.07),
                }"
              ></div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-0.5">
            <span v-if="isVarianceSort" class="text-[9px] text-surface-400 italic">{{ currentSortLabel }}</span>
            <span v-else class="text-[9px] text-surface-400"></span>
            <span v-if="currentDimLabel" class="text-[9px] text-surface-400">by {{ currentDimLabel }}</span>
          </div>
        </div>
      </div>

      <!-- ===== Daily Trend mode ===== -->
      <div v-else-if="viewMode === 'daily'" class="px-2 pb-2 pt-1">
        <div v-if="seriesLoading && !daily" class="h-20 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-surface-400"></i>
        </div>
        <div v-else-if="!dailyTrendData.values.length" class="py-4 text-center text-xs text-surface-400">No daily data</div>
        <div v-else>
          <div class="flex items-end gap-px h-16">
            <div
              v-for="(val, i) in dailyTrendData.values"
              :key="i"
              class="flex-1 rounded-t-sm transition-all duration-300"
              :style="{
                height: dailyBarHeight(val),
                backgroundColor: val === 0 ? '#ef4444' : '#6366f1',
                minHeight: '2px',
              }"
              :title="dailyBarTitle(val, i)"
            ></div>
          </div>
          <div class="flex gap-px mt-0.5">
            <span
              v-for="(label, i) in dailyTrendData.labels"
              :key="i"
              class="flex-1 text-center text-[6px] truncate text-surface-400"
              v-text="i % 5 === 0 ? label : ''"
            ></span>
          </div>
        </div>
      </div>

      <!-- ===== Expanded / Hero mode ===== -->
      <div v-else-if="viewMode === 'hero'" class="grid grid-cols-2 gap-2 px-3 pb-3">
        <!-- Left: sparkline -->
        <div>
          <MiniLineChart
            v-if="chartData.length >= 2"
            class="max-h-24!"
            :data="chartData"
            :lastYearData="lastYearTrendData"
            :labels="trendLabels"
            :bgColor="chartBgColor"
            :borderColor="chartBorderColor"
            :tooltipPrefix="dataType === 'money' ? '$' : ''"
          />
          <div v-else class="h-20 flex items-center px-1">
            <div class="w-full h-[1.5px] rounded-full opacity-30 animate-pulse" :style="{ backgroundColor: chartBorderColor || '#94a3b8' }"></div>
          </div>
        </div>
        <!-- Right: compact breakdown -->
        <div class="flex flex-col justify-center">
          <div v-if="seriesLoading && !breakdown" class="flex flex-col gap-1.5">
            <div v-for="i in 5" :key="i" class="animate-pulse">
              <div class="h-2 bg-surface-200 dark:bg-surface-700 rounded" :style="{ width: (80 - i * 12) + '%' }"></div>
            </div>
          </div>
          <div v-else-if="!breakdownItems.length" class="text-[9px] text-surface-400 text-center">No data</div>
          <div v-else class="flex flex-col gap-1">
            <div v-for="(row, i) in breakdownItems" :key="i">
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-medium text-surface-600 dark:text-surface-400 truncate pr-1 max-w-[45%]">{{ row.label }}</span>
                <span v-if="isVarianceSort"
                  class="text-[9px] font-semibold tabular-nums"
                  :class="row.variance > 0 ? 'text-green-600 dark:text-green-400' : row.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-500'"
                >{{ row.variance > 0 ? '+' : '' }}{{ formatValue(row.variance, dataType) }}</span>
                <span v-else class="text-[9px] font-semibold tabular-nums text-surface-800 dark:text-surface-200">{{ formatValue(row.current, dataType) }}</span>
              </div>
              <div class="h-0.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden mt-0.5">
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: ((breakdownBarValue(row) / maxBreakdownValue) * 100) + '%',
                    backgroundColor: breakdownBarColor(row) || LEAD_COLORS[i % LEAD_COLORS.length],
                  }"
                ></div>
              </div>
            </div>
            <div v-if="currentDimLabel" class="text-right">
              <span class="text-[8px] text-surface-400">by {{ currentDimLabel }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
