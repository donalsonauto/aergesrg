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
  if (!canvas.value || !props.data?.weeks?.length) return;
  if (chartInstance) chartInstance.destroy();

  const weeks = props.data.weeks;
  const labels = weeks.map(w => {
    const d = new Date(w.date);
    return (d.getMonth() + 1) + '/' + d.getDate();
  });

  const datasets = [
    {
      label: 'Sales (Current Year)',
      data: weeks.map(w => w.sales),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#6366f1',
    },
    {
      label: 'Sales (Prior Year)',
      data: weeks.map(w => w.py_sales),
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 3],
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 4,
      pointBackgroundColor: '#94a3b8',
    },
  ];

  chartInstance = new Chart(canvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 20,
            boxHeight: 0,
            padding: 12,
            font: { size: 10 },
            color: '#94a3b8',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: '#64748b', maxRotation: 0 },
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
          {{ data.make || 'Market' }} Weekly Sales Trend
        </span>
      </div>
      <span class="text-[10px] text-surface-400 dark:text-surface-500">
        {{ data.market }} · {{ data.weeks?.length || 0 }} weeks
      </span>
    </div>
    <div class="px-3 py-2" style="height: 180px;">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>
