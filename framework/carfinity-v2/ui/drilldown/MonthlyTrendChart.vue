<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed } from 'vue';
import Chart from 'primevue/chart';

const props = defineProps({
  trendData: { type: Object, default: null }, // { labels: [], current: [], lastYear: [], projectedValue: N }
  loading: { type: Boolean, default: false },
  dataType: { type: String, default: 'int' },
  metricName: { type: String, default: '' },
});

const chartData = computed(() => {
  if (!props.trendData || !props.trendData.current?.length) return null;

  const datasets = [
    {
      label: 'This Year',
      data: props.trendData.current,
      borderColor: '#818cf8',
      backgroundColor: 'rgba(129,140,248,0.1)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#818cf8',
    },
  ];

  if (props.trendData.lastYear?.length) {
    datasets.push({
      label: 'Last Year',
      data: props.trendData.lastYear,
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      borderDash: [4, 4],
      tension: 0.4,
      borderWidth: 1.5,
      pointRadius: 2,
      pointHoverRadius: 4,
      pointBackgroundColor: '#94a3b8',
    });
  }

  // Projected/estimated line for current month (dashed orange, like MiniLineChart)
  const projected = props.trendData.projectedValue;
  if (projected != null && projected > 0 && props.trendData.current.length >= 2) {
    const len = props.trendData.current.length;
    const projData = new Array(len).fill(null);
    projData[len - 2] = props.trendData.current[len - 2]; // previous month (anchor)
    projData[len - 1] = projected; // projected at current month
    datasets.push({
      label: 'Projected',
      data: projData,
      borderColor: '#f59e0b',
      backgroundColor: 'transparent',
      borderDash: [4, 3],
      tension: 0,
      borderWidth: 1.5,
      pointRadius: (ctx) => ctx.dataIndex === len - 1 ? 4 : 0,
      pointHoverRadius: 5,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: '#f59e0b',
      spanGaps: false,
    });
  }

  return { labels: props.trendData.labels || [], datasets };
});

const chartOptions = computed(() => {
  const hasProjection = props.trendData?.projectedValue != null && props.trendData.projectedValue > 0;
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'end',
        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, padding: 12, font: { size: 10 }, color: '#94a3b8' },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#e2e8f0', bodyColor: '#e2e8f0',
        borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, padding: 8, cornerRadius: 6,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.raw).toLocaleString();
            if (ctx.dataset.label === 'Projected') {
              return `${ctx.dataset.label}: ${val} (est.)`;
            }
            return `${ctx.dataset.label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v } },
    },
  };
});
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4">
    <h4 class="text-[10px] sm:text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 sm:mb-3">Monthly Trend</h4>

    <!-- Loading -->
    <div v-if="loading" class="h-[160px] sm:h-[200px] flex items-center justify-center">
      <ProgressSpinner style="width: 24px; height: 24px" />
    </div>

    <!-- No data -->
    <div v-else-if="!chartData" class="h-[160px] sm:h-[200px] flex items-center justify-center text-xs sm:text-sm text-surface-400">
      No monthly trend data available
    </div>

    <!-- Chart -->
    <div v-else class="h-[160px] sm:h-[200px]">
      <Chart type="line" :data="chartData" :options="chartOptions" class="h-full w-full" />
    </div>
  </div>
</template>
