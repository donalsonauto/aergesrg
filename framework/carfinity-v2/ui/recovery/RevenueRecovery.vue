<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useScopeStore } from '@/stores/scope';
import RecoveryAPI from '@/api/RecoveryAPI';
import Chart from 'primevue/chart';
import KpiInfo from '@/components/common/KpiInfo.vue';

const scope = useScopeStore();

const loading = ref(true);
// 'ga' is the real, working tab; 'crm' is a placeholder pending a CRM/DMS integration.
const activeTab = ref('ga');
const expandedSource = ref(null);

const gaData = ref(null);
// soft-error state: 'quota' | 'auth' | 'disconnected' | 'unknown'
const softError = ref(null);

const filteredGaOpportunities = computed(() => gaData.value?.opportunities || []);

// ─── Period label — the fixed 14-month lookback window from the response ───
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtPeriodPart(dateStr) {
  if (!dateStr) return '';
  const [y, m] = String(dateStr).split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${y}`;
}

const periodLabel = computed(() => {
  const p = gaData.value?.period;
  if (!p) return '';
  return `${fmtPeriodPart(p.startDate)} – ${fmtPeriodPart(p.endDate)}`;
});

// ─── Methodology lines for the "How this is calculated" info popover ───
// Built from the `methodology` object the /api/recovery/ga response carries.
const methodologyLines = computed(() => {
  const m = gaData.value?.methodology;
  if (!m) return [];
  const lines = [];
  if (m.conversions) lines.push({ label: 'Conversions', text: m.conversions });
  if (m.conversionRate) lines.push({ label: 'Conversion rate', text: m.conversionRate });
  if (m.status) lines.push({ label: 'Dormant / Declining', text: m.status });
  return lines;
});

function toggleExpand(source) {
  expandedSource.value = expandedSource.value === source ? null : source;
}

// ─── Chart builder — monthly sessions for one opportunity ───
function buildGAChart(monthly) {
  if (!monthly?.length) return null;
  const labels = monthly.map(t => {
    const [y, m] = t.month.split('-');
    return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${y.slice(-2)}`;
  });
  const hasConversions = monthly.some(t => (t.conversions || 0) > 0);
  const datasets = [
    {
      label: 'Sessions', data: monthly.map(t => t.sessions),
      borderColor: 'rgb(251,146,60)', backgroundColor: 'rgba(251,146,60,0.1)',
      borderWidth: 2, fill: true, tension: 0.3, pointRadius: 1, pointHoverRadius: 4,
    },
  ];
  if (hasConversions) {
    datasets.push({
      label: 'Conversions', data: monthly.map(t => t.conversions || 0),
      borderColor: 'rgb(168,85,247)', backgroundColor: 'rgba(168,85,247,0.15)',
      borderWidth: 2, fill: false, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, yAxisID: 'y1',
    });
  }
  const scales = {
    x: { ticks: { font: { size: 9 }, color: '#64748b', maxTicksLimit: 14 }, grid: { display: false } },
    y: { title: { display: true, text: 'Sessions', font: { size: 10 }, color: 'rgb(251,146,60)' }, ticks: { font: { size: 9 }, color: 'rgb(251,146,60)' }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true },
  };
  if (hasConversions) {
    scales.y1 = {
      position: 'right',
      title: { display: true, text: 'Conversions', font: { size: 10 }, color: 'rgb(168,85,247)' },
      ticks: { font: { size: 9 }, color: 'rgb(168,85,247)' },
      grid: { display: false, drawOnChartArea: false },
      beginAtZero: true,
    };
  }
  return {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 }, color: '#94a3b8', usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 11 }, bodyFont: { size: 11 } },
      },
      scales,
    },
  };
}

// ─── Helpers ───
function fmtNum(n) {
  if (n == null) return '--';
  return Number(n).toLocaleString();
}

function statusLabel(s) { return s === 'dormant' ? 'Dormant' : 'Declining'; }

function statusBadge(s) {
  return s === 'dormant'
    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
}

const softErrorMessage = computed(() => {
  switch (softError.value) {
    case 'quota': return 'GA4 API rate limit reached. Please try again in a little while.';
    case 'auth': return 'Google authentication expired. Please sign out and sign back in from Settings.';
    case 'disconnected': return 'No GA4 properties are connected for this scope. Connect a property in Settings.';
    default: return 'Something went wrong loading recovery data. Please try again.';
  }
});

// ─── Data fetch ───
async function fetchGaData() {
  loading.value = true;
  softError.value = null;
  gaData.value = null;
  expandedSource.value = null;

  try {
    const data = await RecoveryAPI.getGaRecovery({
      scopeType: scope.current.type,
      scopeId: scope.current.id,
    });
    if (data?.error) {
      softError.value = data.error;
    } else if (!data || data.connected === false) {
      softError.value = 'disconnected';
    } else {
      gaData.value = data;
    }
  } catch (e) {
    console.error('Revenue recovery fetch error:', e);
    softError.value = 'unknown';
  }
  loading.value = false;
}

onMounted(fetchGaData);
// Refetch when the global topbar scope (group/property) changes.
watch(() => [scope.current.type, scope.current.id], fetchGaData);
</script>

<template>
  <div class="p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">Revenue Recovery</h1>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
          Find proven traffic sources that worked before but are no longer active
          <span v-if="activeTab === 'ga' && periodLabel" class="ml-2 text-surface-400 dark:text-surface-500">
            14-month lookback &middot; {{ periodLabel }}
          </span>
        </p>
      </div>
      <div class="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5">
        <button @click="activeTab = 'ga'" :class="['px-3 py-1.5 text-xs font-medium rounded-md transition-all', activeTab === 'ga' ? 'bg-indigo-500 text-white shadow-sm' : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white']">
          <i class="pi pi-globe text-[10px] mr-1"></i>Traffic Sources
        </button>
        <button @click="activeTab = 'crm'" :class="['px-3 py-1.5 text-xs font-medium rounded-md transition-all', activeTab === 'crm' ? 'bg-indigo-500 text-white shadow-sm' : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white']">
          <i class="pi pi-filter text-[10px] mr-1"></i>CRM Sources
        </button>
      </div>
    </div>

    <!-- ==================== CRM TAB — placeholder ==================== -->
    <template v-if="activeTab === 'crm'">
      <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-12 text-center">
        <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
          <i class="pi pi-database text-2xl text-indigo-400"></i>
        </div>
        <p class="text-base font-semibold text-surface-800 dark:text-surface-100">CRM Lead Recovery</p>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-2 max-w-md mx-auto leading-relaxed">
          This view needs a CRM / DMS integration to surface un-worked and lost leads.
          Not yet connected.
        </p>
      </div>
    </template>

    <!-- ==================== GA TAB ==================== -->
    <template v-else>
      <!-- Loading -->
      <template v-if="loading">
        <div class="text-center py-3">
          <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
            <i class="pi pi-spin pi-spinner text-primary-400 text-[13px]"></i>
            <span class="text-[12px] text-surface-500 dark:text-surface-400">
              Analyzing 14 months of traffic — this may take a moment...
            </span>
          </div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-5 animate-pulse">
            <div class="h-3 w-24 bg-surface-200 dark:bg-surface-700 rounded mb-3"></div>
            <div class="h-8 w-20 bg-surface-200 dark:bg-surface-700 rounded mb-2"></div>
            <div class="h-3 w-16 bg-surface-200 dark:bg-surface-700 rounded"></div>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="i in 5" :key="i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-5 animate-pulse h-16"></div>
        </div>
      </template>

      <!-- Soft error -->
      <div v-else-if="softError" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-8 text-center">
        <i class="pi pi-exclamation-triangle text-2xl text-amber-500 mb-2"></i>
        <p class="text-sm text-amber-700 dark:text-amber-300 max-w-md mx-auto">{{ softErrorMessage }}</p>
      </div>

      <!-- Data -->
      <template v-else-if="gaData">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20 rounded-xl border border-orange-200/50 dark:border-orange-500/20 p-5">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-globe text-xs text-orange-400"></i>
              <span class="flex-1 text-[10px] sm:text-xs font-medium text-orange-400 uppercase tracking-wider">Total Opportunities</span>
              <KpiInfo
                v-if="methodologyLines.length"
                title="How this is calculated"
                :lines="methodologyLines"
              />
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">{{ gaData.summary.totalOpportunities }}</div>
            <p class="text-[10px] text-surface-500 dark:text-surface-400 mt-1">traffic sources to investigate</p>
          </div>
          <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-5">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-pause-circle text-xs text-red-400"></i>
              <span class="text-[10px] sm:text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Dormant Sources</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">{{ gaData.summary.dormantChannels }}</div>
            <p class="text-[10px] text-surface-500 dark:text-surface-400 mt-1">had traffic, now silent</p>
          </div>
          <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-5">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-arrow-down text-xs text-amber-400"></i>
              <span class="text-[10px] sm:text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Declining Sources</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">{{ gaData.summary.decliningChannels }}</div>
            <p class="text-[10px] text-surface-500 dark:text-surface-400 mt-1">&lt; 45% of peak performance</p>
          </div>
        </div>

        <!-- Info -->
        <div class="bg-orange-50 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/10 rounded-xl px-5 py-3 flex items-start gap-3">
          <i class="pi pi-info-circle text-orange-400 mt-0.5"></i>
          <div class="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
            <strong>Traffic analysis:</strong> GA4 source / medium combinations that previously drove significant sessions
            and conversions but have gone silent or severely declined over the last 14 months.
          </div>
        </div>

        <!-- No results -->
        <div v-if="!filteredGaOpportunities.length" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-12 text-center">
          <i class="pi pi-check-circle text-4xl text-green-400 mb-3"></i>
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300">All Clear!</p>
          <p class="text-xs text-surface-500 dark:text-surface-400 mt-1">No dormant or declining traffic sources found.</p>
        </div>

        <!-- GA Opportunity Cards -->
        <div v-else class="space-y-3">
          <div v-for="opp in filteredGaOpportunities" :key="opp.source" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface overflow-hidden">
            <!-- Header row -->
            <div class="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-colors" @click="toggleExpand(opp.source)">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <i :class="['pi text-xs transition-transform', expandedSource === opp.source ? 'pi-chevron-down text-orange-400' : 'pi-chevron-right text-surface-400']"></i>
                <span class="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{{ opp.source }}</span>
                <span :class="['text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0', statusBadge(opp.status)]">{{ statusLabel(opp.status) }}</span>
              </div>
              <div class="flex items-center gap-4 sm:gap-6 text-xs text-surface-500 dark:text-surface-400 flex-shrink-0">
                <div class="hidden sm:block">
                  <span class="text-surface-400">Peak:</span>
                  <span class="text-surface-700 dark:text-surface-300 font-medium ml-1">{{ fmtNum(opp.metrics.peakMonthlySessions) }} sess/mo</span>
                </div>
                <div class="hidden md:block" v-if="opp.metrics.totalConversions > 0">
                  <span class="text-surface-400">Conv:</span>
                  <span class="text-purple-500 dark:text-purple-400 font-medium ml-1">{{ fmtNum(opp.metrics.totalConversions) }}</span>
                  <span class="text-surface-400 ml-0.5">({{ opp.metrics.conversionRate }}%)</span>
                </div>
                <div class="hidden lg:block">
                  <span class="text-surface-400">Sessions:</span>
                  <span class="text-surface-700 dark:text-surface-300 font-medium ml-1">{{ fmtNum(opp.metrics.totalSessions) }}</span>
                </div>
                <div v-if="opp.monthsInactive != null && opp.monthsInactive > 0" class="hidden sm:block">
                  <span class="text-surface-400">Inactive:</span>
                  <span class="text-surface-700 dark:text-surface-300 font-medium ml-1">{{ opp.monthsInactive }}mo</span>
                </div>
              </div>
            </div>

            <!-- Expanded -->
            <div v-if="expandedSource === opp.source" class="border-t border-surface/50 px-5 py-4">
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Metrics -->
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-surface-100/80 dark:bg-surface-800/50 rounded-lg p-3">
                      <div class="text-[10px] text-surface-500 dark:text-surface-400 uppercase">Total Sessions</div>
                      <div class="text-lg font-bold text-surface-900 dark:text-white">{{ fmtNum(opp.metrics.totalSessions) }}</div>
                    </div>
                    <div class="bg-surface-100/80 dark:bg-surface-800/50 rounded-lg p-3">
                      <div class="text-[10px] text-surface-500 dark:text-surface-400 uppercase">Total Conversions</div>
                      <div class="text-lg font-bold text-purple-500">{{ fmtNum(opp.metrics.totalConversions) }}</div>
                    </div>
                    <div class="bg-surface-100/80 dark:bg-surface-800/50 rounded-lg p-3">
                      <div class="text-[10px] text-surface-500 dark:text-surface-400 uppercase">Conversion Rate</div>
                      <div class="text-lg font-bold text-surface-900 dark:text-white">{{ opp.metrics.conversionRate }}%</div>
                    </div>
                    <div class="bg-surface-100/80 dark:bg-surface-800/50 rounded-lg p-3">
                      <div class="text-[10px] text-surface-500 dark:text-surface-400 uppercase">Peak Sessions/mo</div>
                      <div class="text-lg font-bold text-surface-900 dark:text-white">{{ fmtNum(opp.metrics.peakMonthlySessions) }}</div>
                    </div>
                  </div>
                  <div class="space-y-2 text-xs text-surface-600 dark:text-surface-400">
                    <div class="flex items-center gap-2" v-if="opp.lastActiveMonth">
                      <i class="pi pi-clock text-surface-400 text-[10px]"></i>
                      <span><strong>Last active:</strong> {{ fmtPeriodPart(opp.lastActiveMonth) }}</span>
                    </div>
                    <div class="flex items-center gap-2" v-if="opp.monthsInactive > 0">
                      <i class="pi pi-pause-circle text-surface-400 text-[10px]"></i>
                      <span><strong>Inactive for:</strong> {{ opp.monthsInactive }} month{{ opp.monthsInactive !== 1 ? 's' : '' }}</span>
                    </div>
                  </div>
                </div>
                <!-- Chart -->
                <div class="lg:col-span-2">
                  <h4 class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Monthly Sessions</h4>
                  <div v-if="buildGAChart(opp.monthly)" class="h-[260px]">
                    <Chart type="line" :data="buildGAChart(opp.monthly).data" :options="buildGAChart(opp.monthly).options" class="h-full w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
