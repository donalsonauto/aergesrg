<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted, watch } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const props = defineProps({
  data: { type: Object, required: true }
});

const canvas = ref(null);
let chartInstance = null;

function buildChart() {
  if (!canvas.value || !props.data?.dailyValues?.length) return;
  if (chartInstance) chartInstance.destroy();

  const values = props.data.dailyValues;
  const labels = values.map(v => {
    const d = new Date(v.date);
    return (d.getMonth() + 1) + '/' + d.getDate();
  });
  const dataPoints = values.map(v => v.value);

  // Detect anomalies (zeros after non-zero values)
  const hasAnomaly = dataPoints.some((v, i) => i > 2 && v === 0 && dataPoints[i - 1] > 0 && dataPoints[i - 2] > 0);

  // Color based on trend direction
  const first3Avg = dataPoints.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const last3Avg = dataPoints.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const trendColor = hasAnomaly ? '#ef4444' : (last3Avg >= first3Avg ? '#22c55e' : '#f59e0b');

  chartInstance = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: props.data.kpiName || props.data.metric,
        data: dataPoints,
        borderColor: trendColor,
        backgroundColor: trendColor + '12',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: trendColor,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return ` ${v.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: '#64748b', maxRotation: 0, maxTicksLimit: 10 },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
          ticks: {
            font: { size: 9 },
            color: '#64748b',
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v,
          },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });
}

onMounted(buildChart);
watch(() => props.data, buildChart, { deep: true });
</script>

<template>
  <div class="rounded-lg border border-surface-200 dark:border-surface-700/50 bg-surface-50/30 dark:bg-surface-800/40 overflow-hidden">
    <div class="px-3 py-2 border-b border-surface-200 dark:border-surface-700/30 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <i class="pi pi-chart-line text-[11px] text-primary-400"></i>
        <span class="text-[11px] font-semibold text-surface-600 dark:text-surface-300">
          {{ data.kpiName || data.metric }} — Daily Trend
        </span>
      </div>
      <span class="text-[10px] text-surface-400 dark:text-surface-500">
        {{ data.month }}/{{ data.year }} · {{ data.dailyValues?.length || 0 }} days
      </span>
    </div>
    <div class="px-3 py-2" style="height: 160px;">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>
