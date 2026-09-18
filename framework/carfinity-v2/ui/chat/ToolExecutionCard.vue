<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  toolCall: { type: Object, required: true }
});

const expanded = ref(false);

// Human-readable labels for running state (present continuous)
const runningLabels = {
  get_kpi_data: 'Fetching KPI Data',
  get_drilldown_data: 'Analyzing Drill-Down',
  get_dealerships: 'Loading Dealerships',
  get_kpis_list: 'Loading Available Metrics',
  get_drilldown_options: 'Checking Drill-Down Options',
  search_knowledge: 'Searching Knowledge Base',
  get_market_data: 'Pulling Market Data',
  get_market_trend: 'Loading Market Trend',
  get_daily_trend: 'Loading Daily Trend',
  get_monthly_trend: 'Loading Monthly History'
};

// Human-readable labels for completed state (past tense)
const completedLabels = {
  get_kpi_data: 'Fetched KPI Data',
  get_drilldown_data: 'Analyzed Drill-Down',
  get_dealerships: 'Loaded Dealerships',
  get_kpis_list: 'Loaded Available Metrics',
  get_drilldown_options: 'Checked Drill-Down Options',
  search_knowledge: 'Searched Knowledge Base',
  get_market_data: 'Market Data',
  get_market_trend: 'Market Trend',
  get_daily_trend: 'Daily Trend',
  get_monthly_trend: 'Monthly History'
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isRunning = computed(() => props.toolCall.status === 'running');
const isCompleted = computed(() => props.toolCall.status === 'completed');
const isFailed = computed(() => props.toolCall.status === 'failed');

const label = computed(() => {
  const name = props.toolCall.name;
  if (isCompleted.value || isFailed.value) {
    return completedLabels[name] || name;
  }
  return runningLabels[name] || name;
});

// Convert metric key to readable name: "lead-source-roi.goodLeads" → "Good Leads"
function humanizeMetricKey(key) {
  if (!key) return '';
  const part = key.includes('.') ? key.split('.').pop() : key;
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// Format args into a human-readable string
const argsDescription = computed(() => {
  const args = props.toolCall.args;
  if (!args || !Object.keys(args).length) return '';

  const parts = [];

  // Show human-readable metric name (prefer result.fullName if available, else humanize the key)
  if (args.metricKey) {
    const r = props.toolCall.result;
    const friendlyName = r?.fullName || r?.name || r?.kpiName || humanizeMetricKey(args.metricKey);
    parts.push(friendlyName);
  }

  // Show drill-down type
  if (args.drillDownType) {
    parts.push(`by ${args.drillDownType}`);
  }

  // Show search query for knowledge search
  if (args.query) {
    parts.push(`"${args.query}"`);
  }

  // Show time period
  if (args.month && args.year) {
    const monthName = MONTH_NAMES[args.month - 1] || args.month;
    parts.push(`for ${monthName} ${args.year}`);
  } else if (args.year) {
    parts.push(`for ${args.year}`);
  }

  // Show months count for monthly trend
  if (args.months) {
    parts.push(`${args.months} months`);
  }

  return parts.join(' ');
});

// Brief summary of the result
const resultSummary = computed(() => {
  if (!props.toolCall.result) return '';
  const r = props.toolCall.result;

  if (typeof r === 'string') {
    return r.length > 80 ? r.substring(0, 77) + '...' : r;
  }
  if (r.error) return r.error;

  // For arrays, show count
  if (Array.isArray(r)) {
    return `${r.length} items`;
  }

  // For KPI list with total count
  if (r.totalMetrics !== undefined && r.groups) {
    return `${r.totalMetrics} metrics in ${r.groups.length} groups`;
  }

  // For drill-down data
  if (r.data && Array.isArray(r.data)) {
    return `${r.data.length} entries`;
  }

  // For drilldown options
  if (r.drillDowns) {
    const count = Object.keys(r.drillDowns).length;
    return `${count} options`;
  }

  // For dealerships
  if (r.dealerships) {
    return r.dealerships.length === 0 ? 'No stores found' : `${r.dealerships.length} stores`;
  }

  // For knowledge base search
  if (r.documents) {
    return `${r.resultsCount} docs`;
  }

  // For KPI data - show current value
  if (r.current && r.current.value !== undefined) {
    return `${r.fullName || r.name || ''}`;
  }

  return '';
});

const hasDetails = computed(() => {
  if (!props.toolCall.result) return false;
  if (isRunning.value) return false;
  const r = props.toolCall.result;
  if (typeof r === 'string') return r.length > 0;
  return Object.keys(r).length > 0;
});

const formattedResult = computed(() => {
  if (!props.toolCall.result) return '';
  try {
    return JSON.stringify(props.toolCall.result, null, 2);
  } catch {
    return String(props.toolCall.result);
  }
});

function toggle() {
  if (hasDetails.value) expanded.value = !expanded.value;
}
</script>

<template>
  <div class="rounded-lg transition-all duration-300 overflow-hidden"
    :class="{
      'bg-primary-50 dark:bg-primary-900/10 border border-primary-200/50 dark:border-primary-700/30': isRunning,
      'bg-surface-50 dark:bg-surface-800/50': isCompleted && !expanded,
      'bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/50': isCompleted && expanded,
      'bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-700/30': isFailed
    }"
  >
    <!-- Header row -->
    <div
      class="flex items-center gap-2 px-3 py-1.5 text-xs"
      :class="{ 'cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700/40 rounded-lg': hasDetails }"
      @click="toggle"
    >
      <!-- Running spinner -->
      <span v-if="isRunning" class="relative flex h-3.5 w-3.5 shrink-0">
        <svg class="animate-spin h-3.5 w-3.5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </span>

      <!-- Completed checkmark -->
      <span v-else-if="isCompleted" class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg class="h-3.5 w-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </span>

      <!-- Failed X -->
      <span v-else-if="isFailed" class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg class="h-3.5 w-3.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>

      <!-- Content -->
      <div class="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
        <span
          class="font-medium whitespace-nowrap"
          :class="{
            'text-primary-700 dark:text-primary-300': isRunning,
            'text-surface-500 dark:text-surface-400': isCompleted,
            'text-red-700 dark:text-red-300': isFailed
          }"
        >{{ label }}</span>

        <!-- Args description -->
        <span
          v-if="argsDescription"
          class="truncate"
          :class="{
            'text-primary-500/70 dark:text-primary-400/60': isRunning,
            'text-surface-400 dark:text-surface-500': isCompleted,
            'text-red-400 dark:text-red-500': isFailed
          }"
        >{{ argsDescription }}</span>

        <!-- Result summary for completed -->
        <span
          v-if="isCompleted && resultSummary"
          class="text-surface-400 dark:text-surface-500 shrink-0"
        >&middot; {{ resultSummary }}</span>

        <!-- Error message for failed -->
        <span
          v-if="isFailed && resultSummary"
          class="text-red-500 dark:text-red-400 truncate"
        >&middot; {{ resultSummary }}</span>
      </div>

      <!-- Expand chevron -->
      <span v-if="hasDetails" class="shrink-0 text-surface-400 dark:text-surface-500 transition-transform duration-200" :class="{ 'rotate-180': expanded }">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>

    <!-- Expanded details -->
    <div v-if="expanded" class="px-3 pb-2">
      <pre class="text-[11px] leading-relaxed text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-900/60 rounded-md p-2.5 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-mono">{{ formattedResult }}</pre>
    </div>
  </div>
</template>
