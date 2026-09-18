<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  metric: { type: String, required: true },
  metricName: { type: String, default: '' },
  currentValue: { type: [Number, null], default: null },
  previousValue: { type: [Number, null], default: null },
  changeValue: { type: [Number, null], default: null },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
})

const emit = defineEmits(['close'])

// Constants
const ASC_DIMENSIONS = ['item_condition', 'item_make', 'item_model', 'item_year', 'department', 'item_category', 'source_medium', 'device', 'city', 'landing_page', 'event_owner', 'form_type', 'page_type', 'channel_group']
const GA4_DIMENSIONS = ['source_medium', 'device', 'page', 'city', 'country', 'landing_page', 'browser', 'operating_system', 'channel_group', 'campaign']
const CARD_COLORS = ['#a78bfa', '#34d399', '#38bdf8', '#f472b6', '#fb923c', '#818cf8', '#22d3ee', '#facc15']

// State
const loading = ref(true)
const impactData = ref({})
const loadingImpact = ref(true)
const monthlyTrend = ref([])
const availableDimensions = ref([])
const selectedDimension = ref('')
const breakdownData = ref([])
const loadingBreakdown = ref(false)
const filters = ref([])
const trendCanvas = ref(null)
let trendChart = null

const isAscEvent = computed(() => props.metric.startsWith('asc_'))
const displayName = computed(() => props.metricName || formatKey(props.metric))
const breadcrumbs = computed(() => [
  { label: 'All', index: -1 },
  ...filters.value.map((f, i) => ({ label: `${formatKey(f.dimension)}: ${f.value}`, index: i })),
])

// Formatting helpers
function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatNum(val) {
  if (val == null) return '--'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatPct(pct) {
  if (pct == null) return ''
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
}

function varianceColor(pct) {
  if (pct == null) return 'text-white/40'
  if (pct < -3) return 'text-red-400'
  if (pct > 3) return 'text-green-400'
  return 'text-yellow-400'
}

function varianceBg(pct) {
  if (pct == null) return ''
  if (pct < -5) return 'bg-red-500/5'
  if (pct > 5) return 'bg-green-500/5'
  return ''
}

function maxCurrentInDim(data) {
  if (!data || !data.length) return 1
  return Math.max(...data.map(d => Math.abs(d.current || 0)), 1)
}

// Fetch impact analysis (all dimensions at once)
async function fetchImpactAnalysis() {
  loadingImpact.value = true
  try {
    const body = {
      metric: props.metric,
      property_id: props.propertyId || undefined,
    }
    // Apply last filter if any
    if (filters.value.length > 0) {
      const lastFilter = filters.value[filters.value.length - 1]
      body.filter_dimension = lastFilter.dimension
      body.filter_value = lastFilter.value
    }

    const res = await fetch('/api/ai/drilldown/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to fetch impact data')
    const result = await res.json()

    impactData.value = result.dimensions || {}

    if (result.monthly_trend && result.monthly_trend.length > 0) {
      monthlyTrend.value = result.monthly_trend
    }

    if (result.available_dimensions) {
      const usedDims = new Set(filters.value.map(f => f.dimension))
      availableDimensions.value = result.available_dimensions.filter(d => !usedDims.has(d))
    } else {
      const dims = isAscEvent.value ? ASC_DIMENSIONS : GA4_DIMENSIONS
      const usedDims = new Set(filters.value.map(f => f.dimension))
      availableDimensions.value = dims.filter(d => !usedDims.has(d))
    }

    // Auto-select first dimension for detailed breakdown
    if (!selectedDimension.value && availableDimensions.value.length > 0) {
      selectedDimension.value = availableDimensions.value[0]
    }
  } catch (e) {
    console.error('Impact analysis fetch error:', e)
    impactData.value = {}
  } finally {
    loadingImpact.value = false
    loading.value = false
    // Build chart after loading=false so the canvas element is rendered
    if (monthlyTrend.value.length > 0) {
      nextTick(() => buildTrendChart())
    }
  }
}

// Fetch single dimension breakdown (detailed table)
async function fetchBreakdown(dimension, filterDim, filterVal) {
  loadingBreakdown.value = true
  try {
    const body = {
      metric: props.metric,
      dimension,
      property_id: props.propertyId || undefined,
    }
    if (filterDim && filterVal) {
      body.filter_dimension = filterDim
      body.filter_value = filterVal
    }
    if (filters.value.length > 0 && !filterDim) {
      const lastFilter = filters.value[filters.value.length - 1]
      body.filter_dimension = lastFilter.dimension
      body.filter_value = lastFilter.value
    }

    const res = await fetch('/api/ai/drilldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed')
    const data = await res.json()

    breakdownData.value = data.data || []
    if (data.available_dimensions) {
      const usedDims = new Set(filters.value.map(f => f.dimension))
      availableDimensions.value = data.available_dimensions.filter(d => !usedDims.has(d))
    }
  } catch (e) {
    console.error('Breakdown fetch error:', e)
    breakdownData.value = []
  } finally {
    loadingBreakdown.value = false
  }
}

function selectDimension(dim) {
  selectedDimension.value = dim
  fetchBreakdown(dim)
}

function viewFullBreakdown(dim) {
  selectedDimension.value = dim
  fetchBreakdown(dim)
  // Scroll to the breakdown table
  nextTick(() => {
    const el = document.getElementById('breakdown-table-section')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function onImpactRowClick(dim, row) {
  // Apply filter from impact card click
  filters.value = [...filters.value, {
    dimension: dim,
    value: row.label,
  }]
  selectedDimension.value = ''
  breakdownData.value = []
  impactData.value = {}
  // Re-fetch everything
  loading.value = true
  fetchImpactAnalysis().then(() => {
    if (availableDimensions.value.length > 0) {
      const nextDim = availableDimensions.value[0]
      selectedDimension.value = nextDim
      fetchBreakdown(nextDim)
    }
  })
}

function onRowClick(row) {
  if (!selectedDimension.value) return
  filters.value = [...filters.value, {
    dimension: selectedDimension.value,
    value: row.label,
  }]
  selectedDimension.value = ''
  breakdownData.value = []
  impactData.value = {}
  loading.value = true
  fetchImpactAnalysis().then(() => {
    const usedDims = new Set(filters.value.map(f => f.dimension))
    const nextDim = availableDimensions.value.find(d => !usedDims.has(d)) || availableDimensions.value[0]
    if (nextDim) {
      selectedDimension.value = nextDim
      fetchBreakdown(nextDim)
    }
  })
}

function onBreadcrumbClick(index) {
  if (index < 0) {
    filters.value = []
  } else {
    filters.value = filters.value.slice(0, index + 1)
  }
  selectedDimension.value = ''
  breakdownData.value = []
  impactData.value = {}
  loading.value = true
  fetchImpactAnalysis().then(() => {
    if (availableDimensions.value.length > 0) {
      selectedDimension.value = availableDimensions.value[0]
      fetchBreakdown(availableDimensions.value[0])
    }
  })
}

function buildTrendChart() {
  if (!trendCanvas.value || !monthlyTrend.value.length) return
  if (trendChart) trendChart.destroy()

  const data = monthlyTrend.value
  const labels = data.map(d => d.label)
  const values = data.map(d => d.value)
  const lastYearValues = data.map(d => d.lastYearValue || 0)
  const hasLastYear = lastYearValues.some(v => v > 0)

  // Build projected dataset: null for all months except current month
  const hasProjection = data.some(d => d.projected)
  const projData = data.map((d, i) => {
    if (d.projected) return d.projected
    // Connect projected line from the previous month's actual value
    if (i < data.length - 1 && data[i + 1]?.projected) return d.value
    return null
  })

  // Color based on trend direction (last 2 complete months)
  const completeMonths = data.filter(d => !d.isCurrentMonth)
  const trendColor = completeMonths.length >= 2 && completeMonths[completeMonths.length - 1].value >= completeMonths[completeMonths.length - 2].value
    ? '#818cf8' : '#ef4444'

  const datasets = [{
    label: 'This Year',
    data: values,
    borderColor: trendColor,
    backgroundColor: trendColor + '18',
    borderWidth: 2.5,
    fill: true,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: data.map(d => d.isCurrentMonth ? '#f59e0b' : trendColor),
    pointBorderColor: data.map(d => d.isCurrentMonth ? '#f59e0b' : trendColor),
    pointBorderWidth: 2,
  }]

  if (hasLastYear) {
    datasets.push({
      label: 'Last Year',
      data: lastYearValues,
      borderColor: 'rgba(148, 163, 184, 0.4)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: 'rgba(148, 163, 184, 0.5)',
      pointBorderColor: 'rgba(148, 163, 184, 0.4)',
    })
  }

  if (hasProjection) {
    datasets.push({
      label: 'Projected',
      data: projData,
      borderColor: '#f59e0b',
      borderDash: [4, 3],
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: ctx => projData[ctx.dataIndex] != null && data[ctx.dataIndex]?.isCurrentMonth ? 6 : 0,
      pointHoverRadius: 6,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: '#f59e0b',
      pointStyle: 'triangle',
      spanGaps: false,
    })
  }

  trendChart = new Chart(trendCanvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: 'rgba(255,255,255,0.5)',
            font: { size: 10 },
            boxWidth: 8,
            boxHeight: 2,
            padding: 12,
            usePointStyle: true,
            pointStyle: 'line',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(3,0,20,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.7)',
          bodyColor: '#fff',
          bodyFont: { weight: 'bold' },
          padding: 10,
          callbacks: {
            label: ctx => {
              const val = formatNum(ctx.raw)
              if (ctx.dataset.label === 'Projected') return `${ctx.dataset.label}: ${val} (est.)`
              return `${ctx.dataset.label}: ${val}`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 10 },
            maxRotation: 0,
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 10 },
            callback: v => formatNum(v),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  })
}

function handleKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'

  // Set initial dimensions
  const dims = isAscEvent.value ? ASC_DIMENSIONS : GA4_DIMENSIONS
  availableDimensions.value = [...dims]

  // Fetch impact analysis (all dimensions + trend)
  fetchImpactAnalysis().then(() => {
    // Also fetch detailed breakdown for first dimension
    if (availableDimensions.value.length > 0) {
      selectedDimension.value = availableDimensions.value[0]
      fetchBreakdown(availableDimensions.value[0])
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  if (trendChart) trendChart.destroy()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] flex flex-col bg-brand-dark">
      <!-- Backdrop click to close -->
      <div class="absolute inset-0 bg-black/60" @click="emit('close')"></div>

      <!-- Overlay content -->
      <div class="relative z-10 flex flex-col h-full max-w-[1400px] mx-auto w-full">

        <!-- Header -->
        <div class="shrink-0 px-6 py-4 border-b border-white/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button @click="emit('close')" class="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 class="text-lg font-bold text-white">{{ displayName }}</h2>
                <p v-if="propertyName" class="text-xs text-white/40 mt-0.5">{{ propertyName }}</p>
              </div>
            </div>

            <!-- KPI Summary -->
            <div class="flex items-center gap-6">
              <div class="text-right">
                <div class="text-2xl font-bold text-white">{{ formatNum(currentValue) }}</div>
                <div class="text-xs text-white/40">Current Period</div>
              </div>
              <div v-if="previousValue != null" class="text-right">
                <div class="text-lg text-white/50">{{ formatNum(previousValue) }}</div>
                <div class="text-xs text-white/30">Previous</div>
              </div>
              <div v-if="changeValue != null" class="text-right">
                <div class="text-lg font-semibold" :class="varianceColor(changeValue)">{{ formatPct(changeValue) }}</div>
                <div class="text-xs text-white/30">Change</div>
              </div>
            </div>
          </div>

          <!-- Breadcrumbs -->
          <div v-if="filters.length > 0" class="flex items-center gap-1.5 mt-3">
            <button
              v-for="bc in breadcrumbs"
              :key="bc.index"
              @click="onBreadcrumbClick(bc.index)"
              class="text-[11px] px-2 py-0.5 rounded-md cursor-pointer transition-colors"
              :class="bc.index === breadcrumbs.length - 2 ? 'bg-brand-purple/20 text-brand-purple' : 'text-white/40 hover:text-white/70 hover:bg-white/5'"
            >{{ bc.label }}</button>
            <svg class="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>

        <!-- Main content -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- Initial loading skeleton -->
          <div v-if="loading" class="space-y-6">
            <!-- Trend chart skeleton -->
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div class="h-4 w-32 rounded bg-white/10 animate-pulse mb-3"></div>
              <div class="h-[200px] rounded-lg bg-white/5 animate-pulse"></div>
            </div>
            <!-- Impact cards skeleton -->
            <div>
              <div class="h-4 w-48 rounded bg-white/10 animate-pulse mb-3"></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div v-for="i in 6" :key="i" class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div class="h-3 w-24 rounded bg-white/10 animate-pulse mb-4"></div>
                  <div v-for="j in 5" :key="j" class="flex items-center gap-2 mb-3">
                    <div class="w-4 h-3 rounded bg-white/10 animate-pulse shrink-0"></div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-1">
                        <div class="h-2.5 rounded bg-white/10 animate-pulse" :style="{ width: (70 - j * 8) + '%' }"></div>
                        <div class="h-2.5 w-12 rounded bg-white/10 animate-pulse"></div>
                      </div>
                      <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-white/10 animate-pulse" :style="{ width: (90 - j * 14) + '%' }"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="space-y-6">
            <!-- Monthly Trend Chart -->
            <div v-if="monthlyTrend.length > 0" class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">Monthly Trend</h3>
                <div class="flex items-center gap-3 text-[10px]">
                  <span class="text-white/30">{{ monthlyTrend.length }} months</span>
                  <span v-if="monthlyTrend.some(m => m.projected)" class="text-amber-400/60">&#9650; projected</span>
                </div>
              </div>
              <div class="h-[180px] sm:h-[200px]">
                <canvas ref="trendCanvas"></canvas>
              </div>
            </div>

            <!-- Impact Analysis Section -->
            <div>
              <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">What's Driving This Change</h3>

              <!-- Loading state for impact cards -->
              <div v-if="loadingImpact" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div v-for="i in 3" :key="i" class="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-pulse">
                  <div class="h-3 w-24 rounded bg-white/10 mb-4"></div>
                  <div v-for="j in 4" :key="j" class="flex items-center gap-2 mb-3">
                    <div class="h-3 rounded bg-white/10 flex-1"></div>
                    <div class="h-3 w-12 rounded bg-white/10"></div>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-else-if="Object.keys(impactData).length === 0" class="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p class="text-sm text-white/30">No impact data available for this metric.</p>
              </div>

              <!-- Impact dimension cards grid -->
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div
                  v-for="(dimData, dim, dimIdx) in impactData"
                  :key="dim"
                  class="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors"
                >
                  <!-- Card header -->
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-[10px] font-semibold text-white/50 uppercase tracking-wider">By {{ formatKey(dim) }}</h4>
                    <button
                      @click="viewFullBreakdown(dim)"
                      class="text-[10px] text-brand-purple hover:text-brand-purple/80 transition-colors cursor-pointer"
                    >View all</button>
                  </div>

                  <!-- Rows -->
                  <div v-if="dimData.data && dimData.data.length" class="flex flex-col gap-1.5">
                    <div
                      v-for="(row, i) in dimData.data"
                      :key="i"
                      class="group flex items-center gap-2 cursor-pointer hover:bg-white/[0.04] rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                      @click="onImpactRowClick(dim, row)"
                    >
                      <!-- Rank -->
                      <span
                        class="w-4 text-[10px] font-bold text-right shrink-0"
                        :class="i < 3 ? 'text-brand-purple' : 'text-white/30'"
                      >{{ i + 1 }}</span>

                      <!-- Label + value + bar -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-0.5">
                          <span class="text-[11px] font-medium text-white/70 truncate pr-2 group-hover:text-white/90">{{ row.label }}</span>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[11px] font-semibold tabular-nums text-white">{{ formatNum(row.current) }}</span>
                            <span
                              class="text-[9px] font-semibold tabular-nums"
                              :class="{
                                'text-green-400': row.variance > 0,
                                'text-red-400': row.variance < 0,
                                'text-white/30': !row.variance,
                              }"
                            >{{ row.variance > 0 ? '+' : '' }}{{ formatNum(row.variance) }}</span>
                            <span
                              v-if="row.variancePct != null"
                              class="text-[8px] font-semibold px-1 py-0.5 rounded"
                              :class="{
                                'text-green-400 bg-green-500/10': row.variancePct > 0,
                                'text-red-400 bg-red-500/10': row.variancePct < 0,
                              }"
                            >{{ row.variancePct > 0 ? '+' : '' }}{{ row.variancePct.toFixed(0) }}%</span>
                          </div>
                        </div>
                        <!-- Bar -->
                        <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all duration-700"
                            :style="{
                              width: ((Math.abs(row.current || 0) / maxCurrentInDim(dimData.data)) * 100) + '%',
                              backgroundColor: CARD_COLORS[dimIdx % CARD_COLORS.length],
                              opacity: 1 - (i * 0.12),
                            }"
                          ></div>
                        </div>
                      </div>

                      <!-- Drill arrow on hover -->
                      <svg class="w-3 h-3 text-white/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                  <div v-else class="text-xs text-white/20 py-2">No significant changes</div>
                </div>
              </div>
            </div>

            <!-- Detailed Breakdown Section -->
            <div id="breakdown-table-section">
              <!-- Dimension Selector -->
              <div>
                <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Full Breakdown</h3>
                <div class="flex flex-wrap gap-2 mb-3">
                  <button
                    v-for="dim in availableDimensions"
                    :key="dim"
                    @click="selectDimension(dim)"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    :class="selectedDimension === dim
                      ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-white/10'"
                  >{{ formatKey(dim) }}</button>
                </div>
              </div>

              <!-- Breakdown Table -->
              <div v-if="selectedDimension" class="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div class="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <span class="text-sm font-semibold text-white/70">
                    {{ displayName }} <span class="text-white/40 font-normal">by {{ formatKey(selectedDimension) }}</span>
                  </span>
                  <span v-if="breakdownData.length" class="text-[10px] text-white/30">{{ breakdownData.length }} items</span>
                </div>

                <!-- Loading -->
                <div v-if="loadingBreakdown" class="p-8 flex justify-center">
                  <svg class="w-6 h-6 text-brand-purple animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>

                <!-- Table -->
                <div v-else-if="breakdownData.length > 0" class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-white/40 text-xs">
                        <th class="text-left px-4 py-2 font-medium">{{ formatKey(selectedDimension) }}</th>
                        <th class="text-right px-4 py-2 font-medium">Current</th>
                        <th class="text-right px-4 py-2 font-medium">Previous</th>
                        <th class="text-right px-4 py-2 font-medium">Change</th>
                        <th class="text-right px-4 py-2 font-medium w-[200px]">Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in breakdownData.slice(0, 20)"
                        :key="ri"
                        @click="onRowClick(row)"
                        class="border-t border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors group"
                        :class="varianceBg(row.change)"
                      >
                        <td class="px-4 py-2 text-white/80 group-hover:text-white">
                          <div class="flex items-center gap-2">
                            <span class="truncate max-w-[280px]">{{ row.label }}</span>
                            <svg class="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </td>
                        <td class="px-4 py-2 text-right text-white font-medium tabular-nums">{{ formatNum(row.current) }}</td>
                        <td class="px-4 py-2 text-right text-white/40 tabular-nums">{{ formatNum(row.previous) }}</td>
                        <td class="px-4 py-2 text-right font-semibold tabular-nums" :class="varianceColor(row.change)">{{ formatPct(row.change) }}</td>
                        <td class="px-4 py-2">
                          <div class="flex items-center gap-2">
                            <div class="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                class="h-full rounded-full bg-brand-purple/60"
                                :style="{ width: Math.min(100, (row.current / (breakdownData[0]?.current || 1)) * 100) + '%' }"
                              ></div>
                            </div>
                            <span class="text-[10px] text-white/30 w-8 text-right tabular-nums">
                              {{ breakdownData.reduce((s, r) => s + (r.current || 0), 0) > 0 ? Math.round((row.current / breakdownData.reduce((s, r) => s + (r.current || 0), 0)) * 100) : 0 }}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr class="border-t-2 border-white/10 font-semibold">
                        <td class="px-4 py-2 text-white/60">Total</td>
                        <td class="px-4 py-2 text-right text-white tabular-nums">{{ formatNum(breakdownData.reduce((s, r) => s + (r.current || 0), 0)) }}</td>
                        <td class="px-4 py-2 text-right text-white/40 tabular-nums">{{ formatNum(breakdownData.reduce((s, r) => s + (r.previous || 0), 0)) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums"
                            :class="varianceColor(
                              breakdownData.reduce((s, r) => s + (r.previous || 0), 0) > 0
                                ? ((breakdownData.reduce((s, r) => s + (r.current || 0), 0) - breakdownData.reduce((s, r) => s + (r.previous || 0), 0)) / breakdownData.reduce((s, r) => s + (r.previous || 0), 0)) * 100
                                : null
                            )">
                          {{
                            breakdownData.reduce((s, r) => s + (r.previous || 0), 0) > 0
                              ? formatPct(((breakdownData.reduce((s, r) => s + (r.current || 0), 0) - breakdownData.reduce((s, r) => s + (r.previous || 0), 0)) / breakdownData.reduce((s, r) => s + (r.previous || 0), 0)) * 100)
                              : ''
                          }}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <!-- Empty -->
                <div v-else class="p-8 text-center text-white/30 text-sm">
                  No data available for this breakdown.
                </div>
              </div>

              <p v-if="breakdownData.length > 0 && !loadingBreakdown" class="text-[11px] text-white/25 text-center mt-2">
                Click any row to drill deeper with that value as a filter
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
