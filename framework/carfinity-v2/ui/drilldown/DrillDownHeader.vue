<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, ref } from 'vue';
import { formatValue, pctChange, changeColor, badgeClass } from '@/composables/useFormatKpi';
import KpiCommentButton from '@/components/comments/KpiCommentButton.vue';

const props = defineProps({
  metricName: { type: String, default: '' },
  currentValue: { type: [Number, null], default: null },
  previousValue: { type: [Number, null], default: null },
  lastYearValue: { type: [Number, null], default: null },
  dataType: { type: String, default: 'int' },
  apiColor: { type: String, default: null },
  breadcrumbs: { type: Array, default: () => [] },
  periodLabel: { type: String, default: '' },
  chatOpen: { type: Boolean, default: false },
  dailyTrend: { type: Object, default: null },
  loadingDaily: { type: Boolean, default: false },
  commentCount: { type: Number, default: 0 },
});

const emit = defineEmits(['close', 'breadcrumbClick', 'toggleChat', 'openThread']);

const trendPct = computed(() => pctChange(props.currentValue, props.previousValue));
const trendColorVal = computed(() => {
  if (props.apiColor === 'green') return 'positive';
  if (props.apiColor === 'red') return 'negative';
  return changeColor(trendPct.value);
});
const trendBadge = computed(() => badgeClass(trendPct.value));
const trendArrow = computed(() => {
  if (trendPct.value === null) return '';
  return trendPct.value > 0.5 ? '\u2191' : trendPct.value < -0.5 ? '\u2193' : '';
});

// --- Daily trend bars ---
function toNumbers(arr) {
  if (!arr || !arr.length) return [];
  return arr.map(v => typeof v === 'object' ? Number(v?.value || v?.y || 0) : Number(v) || 0);
}

const hoveredBar = ref(null);

// Determine today's index from the period label (MM/YYYY)
const todayIndex = computed(() => {
  if (!props.periodLabel) return -1;
  const parts = props.periodLabel.split('/');
  if (parts.length < 2) return -1;
  const month = parseInt(parts[0]);
  const year = parseInt(parts[1]);
  const now = new Date();
  if (year === now.getFullYear() && month === (now.getMonth() + 1)) {
    return now.getDate() - 1; // 0-indexed
  }
  return -1; // not current month — no future days
});

const barData = computed(() => {
  if (!props.dailyTrend) return null;
  const values = toNumbers(props.dailyTrend.dailyValues);
  const labels = props.dailyTrend.labels || values.map((_, i) => `${i + 1}`);
  if (!values.length) return null;

  // Use DOW-weighted predictions from the overlay when available
  const dowPred = props.dailyTrend.dowPredictions;
  let predictions = new Array(values.length).fill(null);
  const ti = todayIndex.value;
  if (ti >= 0 && dowPred && dowPred.length > 0) {
    // Use pre-computed DOW predictions (varies by day of week)
    for (let i = ti; i < values.length; i++) {
      if (values[i] === 0 && dowPred[i] != null) {
        predictions[i] = dowPred[i];
      }
    }
  } else if (ti >= 0 && props.dailyTrend.projectedValue > 0) {
    // Fallback: flat daily pace
    const pastNonZero = values.slice(0, ti).filter(v => v > 0);
    const dailyPace = pastNonZero.length > 0
      ? pastNonZero.reduce((a, b) => a + b, 0) / pastNonZero.length
      : 0;
    for (let i = ti; i < values.length; i++) {
      if (values[i] === 0) {
        predictions[i] = Math.round(dailyPace);
      }
    }
  }

  const allVals = values.map((v, i) => predictions[i] != null && v === 0 ? predictions[i] : v);
  const max = Math.max(...allVals, 1);
  return { values, labels, max, predictions };
});

function barColor(val, i) {
  const ti = todayIndex.value;
  const pred = barData.value?.predictions;
  if (ti >= 0 && i >= ti && pred && pred[i] != null) return '#f59e0b'; // orange for today/future
  if (val === 0) return '#ef4444'; // red for past zero
  return '#6366f1'; // indigo
}

function barOpacity(val, i) {
  const ti = todayIndex.value;
  const pred = barData.value?.predictions;
  if (ti >= 0 && i >= ti && pred && pred[i] != null && val === 0) return 0.55;
  if (hoveredBar.value != null && hoveredBar.value !== i) return 0.4;
  if (hoveredBar.value === i) return 1;
  return 1;
}

function barHeight(val, i) {
  const ti = todayIndex.value;
  const pred = barData.value?.predictions;
  const displayVal = (ti >= 0 && i >= ti && pred && pred[i] != null && val === 0) ? pred[i] : val;
  return Math.max(2, (displayVal / barData.value.max) * 28) + 'px';
}

function tooltipText(i) {
  if (!barData.value) return '';
  const val = barData.value.values[i];
  const ti = todayIndex.value;
  const pred = barData.value?.predictions;
  if (ti >= 0 && i >= ti && pred && pred[i] != null && val === 0) {
    return `~${formatValue(pred[i], props.dataType)} (est.)`;
  }
  return formatValue(val, props.dataType);
}
</script>

<template>
  <div class="sticky top-0 z-10 backdrop-blur-sm bg-surface-0/90 dark:bg-surface-950/90 border-b border-surface px-3 sm:px-6 py-2 sm:py-3">
    <div class="max-w-[1400px] mx-auto">
      <div class="flex items-start justify-between gap-2 sm:gap-4">
        <!-- Left: KPI info + daily trend inline -->
        <div class="flex-1 min-w-0">
          <h1 class="text-base sm:text-2xl font-bold text-surface-950 dark:text-surface-0 truncate">{{ metricName }}</h1>
          <div class="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 flex-wrap">
            <span v-if="currentValue != null" class="text-base sm:text-lg font-bold text-surface-950 dark:text-surface-0">
              {{ formatValue(currentValue, dataType) }}
            </span>
            <span v-if="trendPct != null" :class="[trendBadge, 'px-1.5 sm:px-2 py-0.5 rounded-lg text-xs sm:text-sm font-semibold']">
              {{ trendArrow }}{{ trendPct > 0 ? '+' : '' }}{{ trendPct.toFixed(1) }}%
            </span>
            <span v-if="currentValue != null && previousValue != null && (currentValue - previousValue) !== 0"
              class="text-xs sm:text-sm tabular-nums font-medium"
              :class="trendColorVal === 'positive' ? 'text-green-600 dark:text-green-400' : trendColorVal === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-surface-400'"
            >{{ (currentValue - previousValue) > 0 ? '+' : '' }}{{ formatValue(currentValue - previousValue, dataType) }}</span>
            <span v-if="previousValue != null" class="text-xs sm:text-sm text-surface-500">
              Prev: {{ formatValue(previousValue, dataType) }}
            </span>
            <span v-if="lastYearValue != null" class="text-xs sm:text-sm text-surface-500">
              LY: {{ formatValue(lastYearValue, dataType) }}
            </span>
            <span v-if="periodLabel" class="text-[10px] sm:text-xs text-surface-400">{{ periodLabel }}</span>

            <!-- Daily trend bar chart — right after the KPI stats, same row -->
            <div v-if="barData && !loadingDaily" class="hidden sm:flex items-end gap-px ml-2 rounded-lg border border-surface-100 dark:border-surface-700/40 px-2 py-1.5 relative" @mouseleave="hoveredBar = null">
              <div class="flex items-center gap-1.5 mr-2 self-center">
                <i class="pi pi-chart-bar text-[10px] text-amber-400"></i>
                <span class="text-[9px] font-semibold text-surface-500 dark:text-surface-400 whitespace-nowrap">Daily</span>
              </div>
              <!-- Tooltip -->
              <div
                v-if="hoveredBar != null"
                class="absolute bottom-full mb-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 whitespace-nowrap pointer-events-none z-20 shadow-lg"
                :style="{ left: 'calc(42px + ' + hoveredBar + ' * 9.5px)', transform: 'translateX(-50%)' }"
              >
                <div class="text-[10px] opacity-70">Day {{ barData.labels[hoveredBar] }}</div>
                <div>{{ tooltipText(hoveredBar) }}</div>
              </div>
              <div class="flex gap-0.5">
                <div
                  v-for="(val, i) in barData.values"
                  :key="i"
                  class="flex flex-col items-center"
                >
                  <div
                    class="w-[7px] rounded-sm transition-all duration-75 cursor-pointer"
                    :style="{
                      height: barHeight(val, i),
                      backgroundColor: hoveredBar === i && barColor(val, i) === '#6366f1' ? '#4f46e5' : barColor(val, i),
                      opacity: barOpacity(val, i),
                    }"
                    @mouseenter="hoveredBar = i"
                  ></div>
                  <span
                    class="text-[6px] leading-none mt-0.5"
                    :class="todayIndex === i ? 'text-amber-500 font-bold' : 'text-surface-400'"
                  >{{ barData.labels[i] }}</span>
                </div>
              </div>
            </div>
            <!-- Loading skeleton for daily trend -->
            <div v-else-if="loadingDaily" class="hidden sm:flex items-center gap-0.5 ml-2 rounded-lg border border-surface-100 dark:border-surface-700/40 px-2 py-1.5">
              <div class="flex gap-0.5">
                <div v-for="i in 28" :key="i" class="w-[7px] rounded-sm animate-pulse bg-surface-200 dark:bg-surface-700" :style="{ height: (6 + Math.random() * 18) + 'px' }"></div>
              </div>
            </div>
          </div>
          <!-- Breadcrumbs -->
          <div v-if="breadcrumbs.length > 1" class="flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-xs flex-wrap">
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <span v-if="i > 0" class="text-surface-400">&rsaquo;</span>
              <button
                @click="emit('breadcrumbClick', crumb.index)"
                class="px-1 sm:px-1.5 py-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-300 transition-colors cursor-pointer"
                :class="{ 'font-semibold text-primary-500': i === breadcrumbs.length - 1 }"
              >
                {{ crumb.label }}
                <i v-if="i > 0 && i < breadcrumbs.length - 1" class="pi pi-times text-[8px] ml-0.5 text-surface-400 hover:text-red-400"></i>
              </button>
            </template>
          </div>
        </div>
        <!-- Action buttons -->
        <div class="flex items-center gap-1 shrink-0">
          <KpiCommentButton :commentCount="commentCount" @click="emit('openThread')" />
          <button
            @click="emit('toggleChat')"
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer shrink-0"
            :class="chatOpen ? 'bg-primary-500/10' : ''"
            title="Ask AI about this metric"
          >
            <i class="pi pi-sparkles text-sm" :class="chatOpen ? 'text-primary-500' : 'text-surface-500'"></i>
          </button>
          <button
            @click="emit('close')"
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer shrink-0"
          >
            <i class="pi pi-times text-surface-500 text-base sm:text-lg"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
