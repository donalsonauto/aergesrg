<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed } from 'vue';
import Chart from 'primevue/chart';

const props = defineProps({
  trendData: {
    type: Object,
    default: null,
    // { dailyValues: [], previousDailyValues: [], lastYearDailyValues: [], labels: [], projectedValue: N }
  },
  loading: { type: Boolean, default: false },
  dataType: { type: String, default: 'int' },
  metricName: { type: String, default: '' },
});

function toNumbers(arr) {
  if (!arr || !arr.length) return [];
  return arr.map(v => typeof v === 'object' ? Number(v?.value || v?.y || 0) : Number(v) || 0);
}

const chartData = computed(() => {
  if (!props.trendData) return null;

  const daily = toNumbers(props.trendData.dailyValues);
  const prev = toNumbers(props.trendData.previousDailyValues);
  const ly = toNumbers(props.trendData.lastYearDailyValues);
  const labels = props.trendData.labels || daily.map((_, i) => `${i + 1}`);

  if (!daily.length) return null;

  const datasets = [
    {
      label: 'Current',
      data: daily,
      borderColor: '#818cf8',
      backgroundColor: 'rgba(129,140,248,0.08)',
      fill: true,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#818cf8',
    },
  ];

  // Previous period — dashed gray
  if (prev.length > 0 && prev.some(v => v > 0)) {
    // Pad/trim to match current length
    let prevData = [...prev];
    if (prevData.length < daily.length) {
      prevData = [...prevData, ...new Array(daily.length - prevData.length).fill(null)];
    } else if (prevData.length > daily.length) {
      prevData = prevData.slice(0, daily.length);
    }
    datasets.push({
      label: 'Prev Period',
      data: prevData,
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      borderDash: [4, 4],
      tension: 0.3,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: '#94a3b8',
    });
  }

  // Last year — dashed teal
  if (ly.length > 0 && ly.some(v => v > 0)) {
    let lyData = [...ly];
    if (lyData.length < daily.length) {
      lyData = [...lyData, ...new Array(daily.length - lyData.length).fill(null)];
    } else if (lyData.length > daily.length) {
      lyData = lyData.slice(0, daily.length);
    }
    datasets.push({
      label: 'Last Year',
      data: lyData,
      borderColor: 'rgba(45,212,191,0.6)',
      backgroundColor: 'transparent',
      borderDash: [6, 3],
      tension: 0.3,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: 'rgba(45,212,191,0.8)',
    });
  }

  // Projected — dashed orange line using DOW-weighted predictions when available
  const projected = props.trendData.projectedValue;
  const dowPred = props.trendData.dowPredictions;
  if (projected != null && projected > 0 && daily.length >= 2) {
    // Find last non-zero day index (the "today" point)
    let lastIdx = daily.length - 1;
    while (lastIdx > 0 && !daily[lastIdx]) lastIdx--;

    const daysLeft = daily.length - lastIdx - 1;
    if (daysLeft > 0) {
      const projData = new Array(daily.length).fill(null);
      projData[lastIdx] = daily[lastIdx]; // anchor at last actual day

      if (dowPred && dowPred.length > 0) {
        // Use DOW-weighted predictions (varies by day of week)
        for (let i = lastIdx + 1; i < daily.length; i++) {
          projData[i] = dowPred[i] != null ? dowPred[i] : null;
        }
      } else {
        // Fallback: flat daily pace
        let sum = 0;
        for (let i = 0; i <= lastIdx; i++) sum += daily[i] || 0;
        const dailyPace = sum / (lastIdx + 1);
        for (let i = lastIdx + 1; i < daily.length; i++) {
          projData[i] = Math.round(dailyPace);
        }
      }

      datasets.push({
        label: 'Projected',
        data: projData,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderDash: [4, 3],
        tension: 0.3,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: '#f59e0b',
        spanGaps: false,
      });
    }
  }

  return { labels, datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: true, position: 'top', align: 'end',
      labels: {
        usePointStyle: true, pointStyle: 'circle', boxWidth: 6, padding: 10,
        font: { size: 10 }, color: '#94a3b8',
        filter: (item) => item.text !== 'Projected' || true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#e2e8f0', bodyColor: '#e2e8f0',
      borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, padding: 8, cornerRadius: 6,
      callbacks: {
        title: (items) => items[0]?.label ? `Day ${items[0].label}` : '',
        label: (ctx) => {
          if (ctx.raw == null) return null;
          const val = Number(ctx.raw).toLocaleString();
          if (ctx.dataset.label === 'Projected') return `${ctx.dataset.label}: ${val} (est.)`;
          return `${ctx.dataset.label}: ${val}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(148,163,184,0.06)' },
      ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 },
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.06)' },
      ticks: {
        color: '#64748b', font: { size: 10 },
        callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v,
      },
    },
  },
}));

// Summary line below chart
const projectedSummary = computed(() => {
  if (!props.trendData?.projectedValue) return null;
  const p = props.trendData.projectedValue;
  return p >= 1000 ? (p / 1000).toFixed(1) + 'K' : p.toLocaleString();
});
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
    <div class="flex items-center justify-between mb-2 sm:mb-3">
      <h4 class="text-[10px] sm:text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Daily Trend</h4>
      <span v-if="projectedSummary" class="text-[10px] font-semibold text-amber-500">
        Est. {{ projectedSummary }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="h-[160px] sm:h-[200px] flex items-center justify-center">
      <ProgressSpinner style="width: 24px; height: 24px" />
    </div>

    <!-- No data -->
    <div v-else-if="!chartData" class="h-[160px] sm:h-[200px] flex items-center justify-center text-xs sm:text-sm text-surface-400">
      No daily trend data available
    </div>

    <!-- Chart -->
    <div v-else class="h-[160px] sm:h-[200px]">
      <Chart type="line" :data="chartData" :options="chartOptions" class="h-full w-full" />
    </div>
  </div>
</template>
