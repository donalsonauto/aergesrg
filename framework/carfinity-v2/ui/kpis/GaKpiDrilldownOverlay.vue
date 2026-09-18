<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
// GaKpiDrilldownOverlay — full-screen drilldown for one GA4 KPI.
//
// Visual port of the carfinity src/components/drilldown/KpiDrillDownOverlay.vue:
// teleported full-screen overlay, sticky DrillDownHeader, staggered sections —
// Impact Analysis, Daily + Monthly trend charts, and a dimension-switchable
// BreakdownTable. Wired to the GA4 /api/kpi/* endpoints via GaKpiAPI.
//
// Carfinity-specific pieces are intentionally dropped: RelatedKpis (needs the
// carfinity KpiRelationshipsAPI), the AI chat panel and the comments thread
// panel (no GA4 equivalent on this page).
//
// Reused carfinity sub-components: DrillDownHeader, ImpactAnalysis,
// DailyTrendChart, MonthlyTrendChart, DimensionSelector, BreakdownTable.

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import GaKpiAPI from '@/api/GaKpiAPI';
import DrillDownHeader from '@/components/drilldown/DrillDownHeader.vue';
import ImpactAnalysis from '@/components/drilldown/ImpactAnalysis.vue';
import DailyTrendChart from '@/components/drilldown/DailyTrendChart.vue';
import MonthlyTrendChart from '@/components/drilldown/MonthlyTrendChart.vue';
import DimensionSelector from '@/components/drilldown/DimensionSelector.vue';
import BreakdownTable from '@/components/drilldown/BreakdownTable.vue';

const props = defineProps({
  kpi: { type: Object, default: null },          // catalog def { key, name, dataType, source, invert, drilldownDims }
  scope: { type: Object, required: true },        // { type, id, label }
  dateRange: { type: Object, required: true },    // { startDate, endDate }
  initialDimension: { type: String, default: null },
  zIndex: { type: Number, default: 9999 },
});

const emit = defineEmits(['close']);

// ── state ──────────────────────────────────────────────────────────────
const visible = ref(false);
const historyPushed = ref(false);

const initialLoading = ref(true);
const loadingDaily = ref(false);
const loadingMonthly = ref(false);
const loadingImpact = ref(false);
const loadingBreakdown = ref(false);

const softError = ref(null);     // { kind, message }
const value = ref(null);         // { dataType, invert, current, previous, lastYear }
const monthlyTrend = ref(null);  // { labels, current, lastYear }
const dailyTrend = ref(null);    // { dailyValues, labels }
const impactData = ref({});      // { dim: { data: [...], dataType } }
const breakdownData = ref([]);   // [{ label, current, previous, variance, variancePct }]

const availableDimensions = ref([]);     // string keys
const selectedDimension = ref(null);

// ── data type ──────────────────────────────────────────────────────────
// GA4 catalog uses int/money/pcnt/duration — all handled by useFormatKpi.
const effectiveDataType = computed(() => value.value?.dataType || props.kpi?.dataType || 'int');

// ── headline ───────────────────────────────────────────────────────────
const displayName = computed(() => props.kpi?.name || props.kpi?.key || 'KPI Detail');
const currentVal = computed(() => value.value?.current?.value ?? null);
const previousVal = computed(() => value.value?.previous?.value ?? null);
const lastYearVal = computed(() => value.value?.lastYear?.value ?? null);

// DrillDownHeader colours the trend badge; for invert KPIs we feed it an
// explicit apiColor so a "down is good" metric shows green on a decrease.
const headerApiColor = computed(() => {
  const change = value.value?.previous?.change;
  if (change == null || !props.kpi?.invert) return null;
  if (change < -0.5) return 'green';
  if (change > 0.5) return 'red';
  return null;
});

// dimension labels from the catalog ({key,label} objects)
const dimLabelMap = computed(() => {
  const map = {};
  for (const d of props.kpi?.drilldownDims || []) {
    if (d && d.key) map[d.key] = d.label;
  }
  map.property = 'Property';
  return map;
});

const dimensionKeys = computed(() => {
  const keys = (props.kpi?.drilldownDims || []).map(d => d.key);
  if (props.scope.type === 'group' || props.scope.type === 'all') {
    return ['property', ...keys];
  }
  return keys;
});

const currentDimLabel = computed(() => dimLabelMap.value[selectedDimension.value] || 'Dimension');

const baseParams = computed(() => ({
  key: props.kpi?.key,
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

// ── lifecycle ──────────────────────────────────────────────────────────
onMounted(() => {
  visible.value = true;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleKeydown);
  window.history.pushState({ gaDrilldown: true }, '');
  window.addEventListener('popstate', handlePopState);
  historyPushed.value = true;
  loadAll();
});

onUnmounted(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('popstate', handlePopState);
});

function handleKeydown(e) {
  if (e.key === 'Escape') closeOverlay();
}

function closeOverlay() {
  if (historyPushed.value) {
    historyPushed.value = false;
    window.history.back();
  } else {
    emit('close');
  }
}

function handlePopState() {
  historyPushed.value = false;
  emit('close');
}

// ── data loading ───────────────────────────────────────────────────────
async function loadAll() {
  if (!props.kpi) return;
  initialLoading.value = true;
  softError.value = null;
  selectedDimension.value = (props.initialDimension && dimensionKeys.value.includes(props.initialDimension))
    ? props.initialDimension
    : (dimensionKeys.value[0] || null);
  availableDimensions.value = dimensionKeys.value;

  await Promise.all([
    loadValue(),
    loadMonthly(),
    loadDaily(),
    loadImpact(),
  ]);
  await fetchBreakdown();
  initialLoading.value = false;
}

async function loadValue() {
  try {
    const res = await GaKpiAPI.getValue(baseParams.value);
    const soft = classifySoft(res);
    if (soft) { softError.value = soft; value.value = null; }
    else value.value = res;
  } catch (e) {
    softError.value = { kind: 'unknown', message: e?.message || 'Failed to load' };
  }
}

async function loadMonthly() {
  loadingMonthly.value = true;
  try {
    const res = await GaKpiAPI.getMonthly({ ...baseParams.value });
    const soft = classifySoft(res);
    if (soft) { softError.value = softError.value || soft; monthlyTrend.value = null; return; }
    const pts = res?.points || [];
    if (!pts.length) { monthlyTrend.value = null; return; }
    monthlyTrend.value = {
      labels: pts.map(p => p.label),
      current: pts.map(p => Number(p.value) || 0),
      lastYear: pts.some(p => p.lastYearValue) ? pts.map(p => Number(p.lastYearValue) || 0) : null,
    };
  } catch {
    monthlyTrend.value = null;
  } finally {
    loadingMonthly.value = false;
  }
}

async function loadDaily() {
  loadingDaily.value = true;
  try {
    const res = await GaKpiAPI.getDaily(baseParams.value);
    const soft = classifySoft(res);
    if (soft) { softError.value = softError.value || soft; dailyTrend.value = null; return; }
    const pts = res?.points || [];
    if (!pts.length) { dailyTrend.value = null; return; }
    dailyTrend.value = {
      dailyValues: pts.map(p => Number(p.value) || 0),
      labels: pts.map(p => p.label),
      previousDailyValues: [],
      lastYearDailyValues: [],
      projectedValue: null,
    };
  } catch {
    dailyTrend.value = null;
  } finally {
    loadingDaily.value = false;
  }
}

// Impact Analysis — biggest movers per dimension. Carfinity batches several
// drilldown calls; we do the same against GaKpiAPI.getDrilldown.
function normalizeRow(r) {
  const cur = Number(r.current) || 0;
  const prev = r.previous != null ? Number(r.previous) || 0 : 0;
  const variance = cur - prev;
  const variancePct = (r.change !== null && r.change !== undefined)
    ? r.change
    : (prev ? (variance / Math.abs(prev)) * 100 : null);
  return { label: r.label ?? '—', current: cur, previous: prev, variance, variancePct };
}

async function loadImpact() {
  loadingImpact.value = true;
  try {
    const dims = dimensionKeys.value.slice(0, 3); // top 3 dimensions, like carfinity
    const results = await Promise.allSettled(
      dims.map(dim => GaKpiAPI.getDrilldown({ ...baseParams.value, dimension: dim }))
    );
    const out = {};
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value && !classifySoft(r.value)) {
        const rows = (r.value.rows || []).map(normalizeRow);
        out[dims[idx]] = {
          data: rows
            .filter(row => row.variance !== 0)
            .sort((a, b) => a.variance - b.variance)
            .slice(0, 5),
          dataType: effectiveDataType.value,
        };
      }
    });
    impactData.value = out;
  } catch {
    impactData.value = {};
  } finally {
    loadingImpact.value = false;
  }
}

async function fetchBreakdown() {
  if (!selectedDimension.value) { breakdownData.value = []; return; }
  loadingBreakdown.value = true;
  try {
    const res = await GaKpiAPI.getDrilldown({ ...baseParams.value, dimension: selectedDimension.value });
    breakdownData.value = classifySoft(res) ? [] : (res?.rows || []).map(normalizeRow);
  } catch {
    breakdownData.value = [];
  } finally {
    loadingBreakdown.value = false;
  }
}

// ── actions ────────────────────────────────────────────────────────────
function onDimensionSelect(dim) {
  selectedDimension.value = dim;
  fetchBreakdown();
}

// ImpactAnalysis emits (dim, row); jump the breakdown table to that dimension.
function onImpactFilter(dim) {
  if (availableDimensions.value.includes(dim)) {
    selectedDimension.value = dim;
    fetchBreakdown();
  }
}

watch(() => props.kpi, () => { if (props.kpi) loadAll(); });
</script>

<template>
  <Teleport to="body">
    <Transition name="ga-drilldown">
      <div
        v-if="visible && kpi"
        class="fixed inset-0 flex flex-col bg-surface-0 dark:bg-surface-950 overflow-hidden"
        :style="{ zIndex }"
      >
        <!-- Sticky header -->
        <DrillDownHeader
          :metricName="displayName"
          :currentValue="currentVal"
          :previousValue="previousVal"
          :lastYearValue="lastYearVal"
          :dataType="effectiveDataType"
          :apiColor="headerApiColor"
          :breadcrumbs="[]"
          :periodLabel="`${dateRange.startDate} → ${dateRange.endDate}`"
          :dailyTrend="dailyTrend"
          :loadingDaily="loadingDaily"
          :chatOpen="false"
          @close="closeOverlay()"
        />

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto">
          <div class="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

            <!-- Scope line -->
            <div class="text-xs text-surface-500 dark:text-surface-400">
              Scope:
              <span class="font-medium text-surface-700 dark:text-surface-200">{{ scope.label }}</span>
            </div>

            <!-- Soft errors -->
            <div
              v-if="softError && softError.kind === 'quota'"
              class="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2"
            >
              <i class="pi pi-clock"></i>
              GA4 API quota reached — trend data may be incomplete. Try again later.
            </div>
            <div
              v-else-if="softError && softError.kind === 'no_property'"
              class="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 px-3 py-2 text-xs text-surface-500 dark:text-surface-400 flex items-center gap-2"
            >
              <i class="pi pi-info-circle"></i>
              No GA4 property in this scope.
            </div>

            <!-- Loading skeleton — mirrors the real layout -->
            <template v-if="initialLoading">
              <div class="space-y-4 sm:space-y-6">
                <!-- Impact skeleton -->
                <div>
                  <div class="h-3 w-44 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2 sm:mb-3"></div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    <div v-for="i in 3" :key="'imp-'+i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
                      <div class="h-2.5 w-20 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-2 sm:mb-3"></div>
                      <div v-for="j in 5" :key="j" class="flex items-center gap-2 mb-2">
                        <div class="w-4 h-3 rounded animate-pulse bg-surface-200 dark:bg-surface-700 shrink-0"></div>
                        <div class="flex-1">
                          <div class="h-2.5 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-1" :style="{ width: (70 - j * 8) + '%' }"></div>
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
                  <div v-for="i in 2" :key="'ch-'+i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
                    <div class="h-2.5 w-24 rounded animate-pulse bg-surface-200 dark:bg-surface-700 mb-3"></div>
                    <div class="h-[160px] sm:h-[200px] rounded-lg animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                  </div>
                </div>
                <!-- Table skeleton -->
                <div>
                  <div class="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <div class="h-2.5 w-16 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                    <div v-for="i in 4" :key="'d-'+i" class="h-6 sm:h-7 rounded-full animate-pulse bg-surface-200 dark:bg-surface-700" :style="{ width: (50 + i * 12) + 'px' }"></div>
                  </div>
                  <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface overflow-hidden">
                    <div v-for="i in 8" :key="'r-'+i" class="flex px-2.5 sm:px-4 py-2.5 sm:py-3 gap-3 sm:gap-4 border-b border-surface-100 dark:border-surface-800">
                      <div class="h-3 rounded animate-pulse bg-surface-200 dark:bg-surface-700 flex-1"></div>
                      <div class="h-3 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                      <div class="h-3 w-14 rounded animate-pulse bg-surface-200 dark:bg-surface-700"></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Real content -->
            <template v-else>
              <!-- Impact Analysis -->
              <div class="section-stagger" style="--stagger: 0">
                <ImpactAnalysis
                  :impactData="impactData"
                  :loading="loadingImpact"
                  :dataType="effectiveDataType"
                  metricKey=""
                  @filterClick="onImpactFilter"
                />
              </div>

              <!-- Charts row -->
              <div class="section-stagger" style="--stagger: 1">
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
              <div class="section-stagger" style="--stagger: 2">
                <DimensionSelector
                  :dimensions="availableDimensions"
                  :selected="selectedDimension"
                  @select="onDimensionSelect"
                />
                <BreakdownTable
                  :data="breakdownData"
                  :dataType="effectiveDataType"
                  :loading="loadingBreakdown"
                  :dimension="currentDimLabel"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ga-drilldown-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.ga-drilldown-leave-active {
  transition: all 0.2s ease-in;
}
.ga-drilldown-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.98);
}
.ga-drilldown-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.section-stagger {
  animation: section-fade-in 0.4s ease-out both;
  animation-delay: calc(var(--stagger, 0) * 0.08s);
}
@keyframes section-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
