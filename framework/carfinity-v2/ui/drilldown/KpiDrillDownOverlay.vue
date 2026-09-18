<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { formatValue, pctChange, changeColor, badgeClass } from '@/composables/useFormatKpi';
import KpiAPI from '@/api/KpiAPI';
import DrillDownHeader from './DrillDownHeader.vue';
import ImpactAnalysis from './ImpactAnalysis.vue';
import DailyTrendChart from './DailyTrendChart.vue';
import MonthlyTrendChart from './MonthlyTrendChart.vue';
import RelatedKpis from './RelatedKpis.vue';
import BreakdownTable from './BreakdownTable.vue';
import DimensionSelector from './DimensionSelector.vue';
import DrillDownChatPanel from './DrillDownChatPanel.vue';
import KpiThreadPanel from '@/components/comments/KpiThreadPanel.vue';
import { useCommentsStore } from '@/stores/comments';
import { useDrillDownChat } from '@/composables/useDrillDownChat';

const props = defineProps({
  metricKey: { type: String, required: true },
  metricName: { type: String, default: '' },
  dataType: { type: String, default: 'int' },
  currentValue: { type: [Number, Object], default: null },
  previousValue: { type: [Number, Object], default: null },
  lastYearValue: { type: [Number, Object], default: null },
  apiColor: { type: String, default: null },
  apiParams: { type: Object, required: true },
  zIndex: { type: Number, default: 9999 },
  deepLinkDim: { type: String, default: null },
  initialFilters: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'drillDown', 'filtersChanged']);

// --- State ---
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const chatOpen = ref(!isMobile);
const chat = useDrillDownChat();
const commentsStore = useCommentsStore();
const threadPanelOpen = ref(false);
const visible = ref(false);
const historyPushed = ref(false);
const filters = ref([]);
const availableDimensions = ref([]);
const selectedDimension = ref(null);
const breakdownData = ref([]);
const breakdownDataType = ref('int');
const impactData = ref({});
const dailyTrend = ref(null);
const monthlyTrend = ref(null);
const kpiTotal = ref(null);

const loadingBreakdown = ref(false);
const loadingImpact = ref(false);
const loadingDaily = ref(false);
const loadingMonthly = ref(false);
const initialLoading = ref(true);

// --- Comments ---
const commentCount = computed(() => {
  const year = props.apiParams.year;
  const month = props.apiParams.month;
  for (const t of commentsStore.threads || []) {
    if (t.kpi_key === props.metricKey && t.year === year && t.month === month) {
      return t.commentCount || 0;
    }
  }
  return 0;
});

// Comment counts for dimension cards (by Tag, by Category, etc.)
const dimensionCommentCounts = computed(() => {
  const counts = {};
  const year = props.apiParams.year;
  const month = props.apiParams.month;
  const prefix = props.metricKey + '#';
  for (const t of commentsStore.threads || []) {
    if (t.year === year && t.month === month && t.kpi_key?.startsWith(prefix)) {
      const dim = t.kpi_key.slice(prefix.length).replace(/^by/, '');
      // Lowercase first char to match dimension keys (e.g. 'Tag' → 'tag')
      const dimKey = dim.charAt(0).toLowerCase() + dim.slice(1);
      counts[dimKey] = (counts[dimKey] || 0) + (t.commentCount || 0);
    }
  }
  return counts;
});

// Comment counts for related KPIs
const relatedCommentCounts = computed(() => {
  const counts = {};
  const year = props.apiParams.year;
  const month = props.apiParams.month;
  for (const t of commentsStore.threads || []) {
    if (t.year === year && t.month === month && !t.kpi_key?.includes('#')) {
      counts[t.kpi_key] = (counts[t.kpi_key] || 0) + (t.commentCount || 0);
    }
  }
  return counts;
});

// Sub-box thread panel state
const subThreadKpiKey = ref(null);
const subThreadMetricName = ref('');
const subThreadCurrentValue = ref(null);
const subThreadPreviousValue = ref(null);
const subThreadDataType = ref('int');
const subThreadDimensionRows = ref(null);

function openThreadPanel() {
  subThreadKpiKey.value = null;
  threadPanelOpen.value = true;
}

function openSubThread(info) {
  subThreadKpiKey.value = info.kpiKey;
  subThreadMetricName.value = info.metricName || '';
  subThreadCurrentValue.value = info.currentValue ?? null;
  subThreadPreviousValue.value = info.previousValue ?? null;
  subThreadDataType.value = info.dataType || 'int';
  subThreadDimensionRows.value = info.dimensionRows || null;
  threadPanelOpen.value = true;
}

function closeThreadPanel() {
  threadPanelOpen.value = false;
  subThreadKpiKey.value = null;
  if (props.apiParams.dealerGroupId) {
    commentsStore.fetchThreads(props.apiParams.dealerGroupId).catch(() => {});
  }
}

// --- Computed ---
const displayName = computed(() => props.metricName || formatMetricKey(props.metricKey));
const currentVal = computed(() => {
  if (kpiTotal.value?.current?.value != null) return kpiTotal.value.current.value;
  const v = props.currentValue;
  return typeof v === 'object' ? v?.value : v;
});
const previousVal = computed(() => {
  if (kpiTotal.value?.previous?.value != null) return kpiTotal.value.previous.value;
  const v = props.previousValue;
  return typeof v === 'object' ? v?.value : v;
});
const lastYearVal = computed(() => {
  if (kpiTotal.value?.lastYear?.value != null) return kpiTotal.value.lastYear.value;
  const v = props.lastYearValue;
  return typeof v === 'object' ? v?.value : v;
});
const effectiveDataType = computed(() => kpiTotal.value?.dataType || props.dataType);
const effectiveApiColor = computed(() => props.apiColor || kpiTotal.value?.previous?.color || null);

// OneVision embeds filters INTO the metric key: metric/dim=value/dim2=value2
// Dealership is special — it uses dealerShipId query param instead
const filteredMetricKey = computed(() => {
  let key = props.metricKey;
  for (const f of filters.value) {
    if (f.dimension !== 'dealership') {
      key += `/${f.dimension}=${f.value}`;
    }
  }
  return key;
});

const filteredApiParams = computed(() => {
  const base = { ...props.apiParams };
  // Only dealership goes as a query param
  for (const f of filters.value) {
    if (f.dimension === 'dealership' && f.value) {
      base.dealerShipId = f.value;
    }
  }
  return base;
});

const breadcrumbs = computed(() => [
  { label: 'All', index: -1 },
  ...filters.value.map((f, i) => ({
    label: `${f.dimension}: "${f.label}"`,
    index: i,
  })),
]);

// --- Lifecycle ---
onMounted(() => {
  visible.value = true;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleKeydown);
  // Push history state so browser back closes the overlay
  window.history.pushState({ drilldown: true }, '');
  window.addEventListener('popstate', handlePopState);
  historyPushed.value = true;

  // Restore filters from initialFilters prop (deep-link support)
  if (props.initialFilters && props.initialFilters.length > 0) {
    filters.value = [...props.initialFilters];
  }

  loadAll();

  // Auto-open thread panel for deep-linked dimension
  if (props.deepLinkDim) {
    const dim = props.deepLinkDim;
    openSubThread({
      kpiKey: props.metricKey + '#' + dim,
      metricName: 'By ' + dim.replace(/^by/, '').replace(/([A-Z])/g, ' $1').trim(),
    });
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('popstate', handlePopState);
});

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closeOverlay();
  }
}

function closeOverlay() {
  if (historyPushed.value) {
    historyPushed.value = false;
    window.history.back(); // This will trigger popstate which calls emit('close')
  } else {
    emit('close');
  }
}

function handlePopState(e) {
  historyPushed.value = false;
  emit('close');
}

// --- Data Loading ---
async function loadAll() {
  initialLoading.value = true;
  await Promise.all([
    loadKpiTotal(),
    loadDimensions(),
    loadImpactAnalysis(),
    loadDailyTrend(),
    loadMonthlyTrend(),
  ]);
  initialLoading.value = false;
}

async function loadKpiTotal() {
  try {
    const result = await KpiAPI.get(filteredMetricKey.value, filteredApiParams.value);
    if (result) kpiTotal.value = result;
  } catch (e) {
    console.error('Failed to load KPI total:', e);
  }
}

async function loadDimensions() {
  try {
    const params = { metric: filteredMetricKey.value, ...filteredApiParams.value };
    const result = await KpiAPI.getDrillDownSettings(params);
    const raw = result?.drillDowns || result?.drilldowns || {};
    let dims = Array.isArray(raw) ? raw : Object.keys(raw);
    // Sort with priority order: tag first, category second
    const priorityOrder = ['tag', 'category'];
    dims = [...dims].sort((a, b) => {
      const ai = priorityOrder.indexOf(a);
      const bi = priorityOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
    // Remove dimensions that are already used as filters
    const usedDims = new Set(filters.value.map(f => f.dimension));
    availableDimensions.value = dims.filter(d => !usedDims.has(d));
    if (availableDimensions.value.length > 0 && !selectedDimension.value) {
      selectedDimension.value = availableDimensions.value[0];
      await fetchBreakdown();
    }
  } catch (e) {
    console.error('Failed to load dimensions:', e);
  }
}

async function fetchBreakdown() {
  if (!selectedDimension.value) return;
  loadingBreakdown.value = true;
  try {
    const params = {
      metric: filteredMetricKey.value,
      drillDown: selectedDimension.value,
      ...filteredApiParams.value,
    };
    const result = await KpiAPI.getDrillDown(params);
    breakdownDataType.value = result?.dataType || effectiveDataType.value;
    const raw = result?.data || result?.products || result?.items || result;
    if (Array.isArray(raw)) {
      breakdownData.value = raw.map(item => normalizeRow(item));
    } else if (raw && typeof raw === 'object') {
      breakdownData.value = Object.entries(raw).map(([key, item]) => normalizeRow(item, key));
    } else {
      breakdownData.value = [];
    }
  } catch (e) {
    console.error('Failed to fetch breakdown:', e);
    breakdownData.value = [];
  } finally {
    loadingBreakdown.value = false;
  }
}

async function loadImpactAnalysis() {
  loadingImpact.value = true;
  try {
    const params = { metric: filteredMetricKey.value, ...filteredApiParams.value };
    const settingsResult = await KpiAPI.getDrillDownSettings(params);
    const raw = settingsResult?.drillDowns || settingsResult?.drilldowns || {};
    let dims = Array.isArray(raw) ? raw : Object.keys(raw);
    // Sort with priority order: tag first, category second
    const priorityOrder = ['tag', 'category'];
    dims = [...dims].sort((a, b) => {
      const ai = priorityOrder.indexOf(a);
      const bi = priorityOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });

    const results = {};
    const batchSize = 4;
    for (let i = 0; i < dims.length; i += batchSize) {
      const batch = dims.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(dim => KpiAPI.getDrillDown({
          metric: filteredMetricKey.value,
          drillDown: dim,
          ...filteredApiParams.value,
        }))
      );
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          const data = r.value?.data || r.value?.products || r.value?.items || r.value;
          let arr;
          if (Array.isArray(data)) {
            arr = data.map(item => normalizeRow(item));
          } else if (data && typeof data === 'object') {
            arr = Object.entries(data).map(([key, item]) => normalizeRow(item, key));
          } else {
            arr = [];
          }
          // Sort by variance ascending — biggest drops first by count
          results[batch[idx]] = {
            data: arr
              .filter(row => row.variance !== 0)
              .sort((a, b) => a.variance - b.variance)
              .slice(0, 5),
            dataType: r.value?.dataType || 'int',
          };
        }
      });
    }
    impactData.value = results;
  } catch (e) {
    console.error('Failed to load impact data:', e);
  } finally {
    loadingImpact.value = false;
  }
}

function parseDailyTrend(result) {
  const trendArr = result?.trend?.trend || result?.trend || result?.dailyValues || [];
  if (!Array.isArray(trendArr) || trendArr.length === 0) return null;
  return {
    values: trendArr.map(d => d.value ?? d),
    labels: trendArr.map(d => {
      if (d.date) {
        const parts = String(d.date).split('-');
        return parts.length >= 3 ? `${parseInt(parts[2])}` : d.date; // just day number
      }
      return '';
    }),
  };
}

async function loadDailyTrend() {
  loadingDaily.value = true;
  try {
    const baseParams = { metric: filteredMetricKey.value, ...filteredApiParams.value };

    // Fetch current, previous period, and last year in parallel
    const [currentResult, prevResult, lyResult] = await Promise.allSettled([
      KpiAPI.getDailyTrend({ ...baseParams, period: 'current' }),
      KpiAPI.getDailyTrend({ ...baseParams, period: 'previous' }),
      KpiAPI.getDailyTrend({
        ...baseParams,
        period: 'current',
        year: (baseParams.year || new Date().getFullYear()) - 1,
      }),
    ]);

    const current = currentResult.status === 'fulfilled' ? parseDailyTrend(currentResult.value) : null;
    const prev = prevResult.status === 'fulfilled' ? parseDailyTrend(prevResult.value) : null;
    const ly = lyResult.status === 'fulfilled' ? parseDailyTrend(lyResult.value) : null;

    if (current && current.values.length > 0) {
      // Calculate projected end-of-month value from daily pace
      let projectedValue = null;
      let dowPredictions = null; // DOW-weighted per-day predictions
      const now = new Date();
      const year = baseParams.year || now.getFullYear();
      const month = baseParams.month || (now.getMonth() + 1);
      if (year === now.getFullYear() && month === now.getMonth() + 1) {
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(year, month, 0).getDate();
        // Sum of daily values up to today
        const cumulative = current.values.reduce((sum, v) => sum + (Number(v) || 0), 0);
        if (dayOfMonth > 0 && dayOfMonth < daysInMonth && cumulative > 0) {
          projectedValue = Math.round((cumulative / dayOfMonth) * daysInMonth);
        }

        // Build DOW-weighted predictions from previous month's daily data
        const prevValues = (prev?.values || []).map(v => Number(v) || 0);
        const pastDays = current.values.slice(0, dayOfMonth).map(v => Number(v) || 0);
        const pastNonZero = pastDays.filter(v => v > 0);
        const simpleAvg = pastNonZero.length > 0
          ? pastNonZero.reduce((a, b) => a + b, 0) / pastNonZero.length
          : 0;

        if (simpleAvg > 0) {
          // Compute DOW weights from previous period data
          let dowWeights = null;
          if (prevValues.length > 0 && prevValues.some(v => v > 0)) {
            const prevMonth = month - 1 || 12;
            const prevYear = month === 1 ? year - 1 : year;
            const dowSums = [0, 0, 0, 0, 0, 0, 0];
            const dowCounts = [0, 0, 0, 0, 0, 0, 0];
            prevValues.forEach((val, i) => {
              const d = new Date(prevYear, prevMonth - 1, i + 1);
              const dow = d.getDay();
              dowSums[dow] += val;
              dowCounts[dow]++;
            });
            const dowAvg = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : 0);
            const overallAvg = prevValues.reduce((a, b) => a + b, 0) / prevValues.length;
            if (overallAvg > 0) {
              dowWeights = dowAvg.map(a => a / overallAvg);
            }
          }

          // Generate per-day predictions for today onward
          dowPredictions = new Array(daysInMonth).fill(null);
          for (let i = dayOfMonth - 1; i < daysInMonth; i++) {
            const actualVal = Number(current.values[i]) || 0;
            if (actualVal > 0 && i === dayOfMonth - 1) continue; // today has data
            let predicted = simpleAvg;
            if (dowWeights) {
              const d = new Date(year, month - 1, i + 1);
              predicted = simpleAvg * dowWeights[d.getDay()];
            }
            dowPredictions[i] = Math.max(Math.round(predicted), 0);
          }
        }
      }

      dailyTrend.value = {
        dailyValues: current.values,
        previousDailyValues: prev?.values || [],
        lastYearDailyValues: ly?.values || [],
        labels: current.labels,
        projectedValue,
        dowPredictions,
      };
    } else {
      dailyTrend.value = null;
    }
  } catch {
    dailyTrend.value = null;
  } finally {
    loadingDaily.value = false;
  }
}

async function loadMonthlyTrend() {
  loadingMonthly.value = true;
  try {
    const months = [];
    const baseYear = props.apiParams.year;
    const baseMonth = props.apiParams.month;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const results = await Promise.allSettled(
      months.map(m => KpiAPI.get(filteredMetricKey.value, {
        dealerGroupId: props.apiParams.dealerGroupId,
        dealerShipId: filteredApiParams.value.dealerShipId,
        year: m.year, month: m.month, view: 'month',
      }))
    );
    const labels = months.map(m => {
      const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return names[m.month - 1] + " '" + String(m.year).slice(-2);
    });
    const current = results.map(r => r.status === 'fulfilled' && r.value ? Number(r.value?.current?.value) || 0 : 0);
    const lastYear = results.map(r => r.status === 'fulfilled' && r.value ? Number(r.value?.lastYear?.value) || 0 : 0);

    // Calculate projected value for current month (last in series)
    // Extrapolate: (MTD value / days elapsed) * days in month
    let projectedValue = null;
    const now = new Date();
    const lastMonth = months[months.length - 1];
    if (lastMonth.year === now.getFullYear() && lastMonth.month === now.getMonth() + 1) {
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(lastMonth.year, lastMonth.month, 0).getDate();
      const mtdValue = current[current.length - 1];
      if (dayOfMonth > 0 && dayOfMonth < daysInMonth && mtdValue > 0) {
        projectedValue = Math.round((mtdValue / dayOfMonth) * daysInMonth);
      }
    }

    monthlyTrend.value = {
      labels, current,
      lastYear: lastYear.some(v => v > 0) ? lastYear : null,
      projectedValue,
    };
  } catch {
    monthlyTrend.value = null;
  } finally {
    loadingMonthly.value = false;
  }
}

// --- Actions ---
function onDimensionSelect(dim) {
  selectedDimension.value = dim;
  fetchBreakdown();
}

function onRowClick(row) {
  if (!selectedDimension.value) return;
  filters.value = [...filters.value, {
    dimension: selectedDimension.value,
    value: row.id || row.label,
    label: row.label,
  }];
  emit('filtersChanged', filters.value);
  // Reload everything with new filter
  selectedDimension.value = null;
  breakdownData.value = [];
  loadAll();
}

function onBreadcrumbClick(index) {
  if (index < 0) {
    filters.value = [];
  } else {
    filters.value = filters.value.slice(0, index + 1);
  }
  emit('filtersChanged', filters.value);
  selectedDimension.value = null;
  breakdownData.value = [];
  loadAll();
}

function onRelatedKpiClick(kpi) {
  emit('drillDown', kpi);
}

// --- Helpers ---
function normalizeRow(item, objectKey = null) {
  const cur = typeof item.current === 'object' ? item.current?.value : item.current;
  const prev = typeof item.previous === 'object' ? item.previous?.value : item.previous;
  const ly = typeof item.lastYear === 'object' ? item.lastYear?.value : item.lastYear;
  const variance = (cur != null && prev != null) ? cur - prev : 0;
  const variancePct = prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
  return {
    label: item.label || item.name || objectKey || '\u2014',
    current: cur, previous: prev, lastYear: ly,
    variance, variancePct,
    // Use the object key as primary ID (it's what the API expects for filtering)
    id: objectKey || item.id || item.value || item.label || item.name,
  };
}

function formatMetricKey(key) {
  if (!key) return '';
  const part = key.includes('.') ? key.split('.').pop() : key;
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drilldown">
      <div
        v-if="visible"
        class="fixed inset-0 flex flex-col bg-surface-0 dark:bg-surface-950 overflow-hidden"
        :style="{ zIndex: zIndex }"
      >
        <!-- Header -->
        <DrillDownHeader
          :metricName="displayName"
          :currentValue="currentVal"
          :previousValue="previousVal"
          :lastYearValue="lastYearVal"
          :dataType="effectiveDataType"
          :apiColor="effectiveApiColor"
          :breadcrumbs="breadcrumbs"
          :periodLabel="(filteredApiParams.month || '') + '/' + (filteredApiParams.year || '')"
          :chatOpen="chatOpen"
          :dailyTrend="dailyTrend"
          :loadingDaily="loadingDaily"
          :commentCount="commentCount"
          @close="closeOverlay()"
          @breadcrumbClick="onBreadcrumbClick"
          @toggleChat="chatOpen = !chatOpen"
          @openThread="openThreadPanel"
        />

        <!-- Main content + chat sidebar -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto">
            <div class="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

              <!-- Initial loading skeleton — mirrors real layout structure -->
              <template v-if="initialLoading">
                <div class="space-y-4 sm:space-y-6">

                  <!-- Related KPIs skeleton -->
                  <div>
                    <div class="h-3 w-28 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2 sm:mb-3"></div>
                    <div class="flex gap-2 sm:gap-3 overflow-hidden pb-2 -mx-1 px-1">
                      <div v-for="i in 6" :key="'rel-skel-'+i" class="min-w-[130px] sm:min-w-[160px] bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-2.5 sm:p-3 shrink-0">
                        <div class="h-2.5 w-20 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2"></div>
                        <div class="h-5 w-16 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-1.5"></div>
                        <div class="h-2 w-12 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Impact Analysis skeleton -->
                  <div>
                    <div class="h-3 w-44 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2 sm:mb-3"></div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      <div v-for="i in 3" :key="'impact-skel-'+i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
                        <div class="h-2.5 w-20 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2 sm:mb-3"></div>
                        <div v-for="j in 5" :key="j" class="flex items-center gap-2 mb-2">
                          <div class="w-4 h-3 rounded animate-pulse bg-surface-200 dark:bg-surface-700 shrink-0"></div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1">
                              <div class="h-2.5 rounded animate-pulse bg-surface-200 dark:bg-surface-700" :style="{ width: (70 - j * 8) + '%' }"></div>
                              <div class="flex items-center gap-1">
                                <div class="h-2.5 w-10 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                                <div class="h-3 w-8 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                              </div>
                            </div>
                            <div class="h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                              <div class="h-full rounded-full animate-pulse bg-surface-200 dark:bg-surface-700" :style="{ width: (90 - j * 14) + '%' }"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Charts skeleton -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
                      <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <div class="h-2.5 w-24 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        <div class="flex gap-2">
                          <div class="h-2 w-12 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                          <div class="h-2 w-12 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        </div>
                      </div>
                      <div class="h-[160px] sm:h-[200px] rounded-lg animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                    </div>
                    <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
                      <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <div class="h-2.5 w-28 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        <div class="flex gap-2">
                          <div class="h-2 w-12 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                          <div class="h-2 w-12 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        </div>
                      </div>
                      <div class="h-[160px] sm:h-[200px] rounded-lg animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                    </div>
                  </div>

                  <!-- Dimension selector + Breakdown table skeleton -->
                  <div>
                    <!-- Dimension pills -->
                    <div class="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                      <div class="h-2.5 w-16 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mr-0.5 sm:mr-1"></div>
                      <div v-for="i in 4" :key="'dim-skel-'+i" class="h-6 sm:h-7 rounded-full animate-pulse bg-surface-200 dark:bg-surface-700" :style="{ width: (50 + i * 12) + 'px' }"></div>
                    </div>
                    <!-- Table -->
                    <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface overflow-hidden">
                      <!-- Header row -->
                      <div class="border-b border-surface-200 dark:border-surface-700">
                        <div class="flex px-2.5 sm:px-4 py-2 sm:py-2.5 gap-3 sm:gap-4">
                          <div class="h-2.5 w-24 rounded animate-pulse bg-surface-200 dark:bg-surface-700 flex-1"></div>
                          <div class="h-2.5 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                          <div class="h-2.5 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700 hidden sm:block"></div>
                          <div class="h-2.5 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700 hidden sm:block"></div>
                          <div class="h-2.5 w-10 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        </div>
                      </div>
                      <!-- Data rows -->
                      <div v-for="i in 8" :key="'row-skel-'+i" class="flex px-2.5 sm:px-4 py-2.5 sm:py-3 gap-3 sm:gap-4 border-b border-surface-100 dark:border-surface-800">
                        <div class="h-3 rounded animate-pulse bg-surface-200 dark:bg-surface-700 flex-1" :style="{ maxWidth: (180 + (i % 3) * 30) + 'px' }"></div>
                        <div class="h-3 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                        <div class="h-3 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700 hidden sm:block"></div>
                        <div class="h-3 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700 hidden sm:block"></div>
                        <div class="h-3 w-10 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                      </div>
                    </div>
                  </div>

                </div>
              </template>

              <!-- Real content with staggered fade-in -->
              <template v-else>

              <!-- Related KPIs -->
              <div class="section-stagger" style="--stagger: 0">
                <RelatedKpis
                  :metricKey="metricKey"
                  :apiParams="filteredApiParams"
                  :commentCounts="relatedCommentCounts"
                  @click="onRelatedKpiClick"
                  @openThread="openSubThread"
                />
              </div>

              <!-- Impact Analysis -->
              <div class="section-stagger" style="--stagger: 1">
                <ImpactAnalysis
                  :impactData="impactData"
                  :loading="loadingImpact"
                  :dataType="effectiveDataType"
                  :metricKey="metricKey"
                  :commentCounts="dimensionCommentCounts"
                  @filterClick="(dim, row) => { selectedDimension = dim; onRowClick(row); }"
                  @openThread="openSubThread"
                />
              </div>

              <!-- Charts row -->
              <div class="section-stagger" style="--stagger: 2">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <DailyTrendChart
                    :trendData="dailyTrend"
                    :loading="loadingDaily"
                    :dataType="effectiveDataType"
                    :metricName="displayName"
                  />
                  <MonthlyTrendChart
                    :trendData="monthlyTrend"
                    :loading="loadingMonthly"
                    :dataType="effectiveDataType"
                    :metricName="displayName"
                  />
                </div>
              </div>

              <!-- Dimension selector + Breakdown table -->
              <div class="section-stagger" style="--stagger: 3">
                <DimensionSelector
                  :dimensions="availableDimensions"
                  :selected="selectedDimension"
                  @select="onDimensionSelect"
                />
                <BreakdownTable
                  :data="breakdownData"
                  :dataType="breakdownDataType"
                  :loading="loadingBreakdown"
                  :dimension="selectedDimension"
                  @rowClick="onRowClick"
                />
              </div>

              </template>
            </div>
          </div>

          <!-- Chat sidebar (desktop) -->
          <Transition name="slide-chat">
            <DrillDownChatPanel
              v-if="chatOpen"
              class="w-[360px] xl:w-[400px] shrink-0 hidden md:flex"
              :metricKey="metricKey"
              :metricName="displayName"
              :dataType="effectiveDataType"
              :currentValue="currentVal"
              :previousValue="previousVal"
              :lastYearValue="lastYearVal"
              :filters="filters"
              :apiParams="filteredApiParams"
              :chat="chat"
              @close="chatOpen = false"
            />
          </Transition>
        </div>

        <!-- KPI Thread Panel -->
        <KpiThreadPanel
          v-if="threadPanelOpen"
          :kpiKey="subThreadKpiKey || metricKey"
          :metricName="subThreadKpiKey ? subThreadMetricName : displayName"
          :currentValue="subThreadKpiKey ? subThreadCurrentValue : currentVal"
          :previousValue="subThreadKpiKey ? subThreadPreviousValue : previousVal"
          :lastYearValue="subThreadKpiKey ? null : lastYearVal"
          :dataType="subThreadKpiKey ? subThreadDataType : effectiveDataType"
          :dimensionRows="subThreadKpiKey ? subThreadDimensionRows : null"
          :apiParams="filteredApiParams"
          @close="closeThreadPanel"
        />

        <!-- Mobile: bottom sheet -->
        <Teleport to="body">
          <Transition name="slide-up">
            <div
              v-if="chatOpen"
              class="fixed inset-x-0 bottom-0 h-[70vh] md:hidden rounded-t-2xl shadow-2xl overflow-hidden bg-surface-0 dark:bg-surface-950"
              :style="{ zIndex: zIndex + 2 }"
            >
              <DrillDownChatPanel
                :metricKey="metricKey"
                :metricName="displayName"
                :dataType="effectiveDataType"
                :currentValue="currentVal"
                :previousValue="previousVal"
                :lastYearValue="lastYearVal"
                :filters="filters"
                :apiParams="filteredApiParams"
                :chat="chat"
                @close="chatOpen = false"
              />
            </div>
          </Transition>
        </Teleport>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drilldown-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.drilldown-leave-active {
  transition: all 0.2s ease-in;
}
.drilldown-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.98);
}
.drilldown-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* Chat sidebar slide-in from right */
.slide-chat-enter-active, .slide-chat-leave-active {
  transition: all 0.3s ease;
}
.slide-chat-enter-from, .slide-chat-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Mobile bottom sheet slide-up */
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}

/* Staggered section fade-in */
.section-stagger {
  animation: section-fade-in 0.4s ease-out both;
  animation-delay: calc(var(--stagger, 0) * 0.08s);
}
@keyframes section-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
