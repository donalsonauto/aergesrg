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
  if (!canvas.value || !props.data?.months?.length) return;
  if (chartInstance) chartInstance.destroy();

  const months = props.data.months;
  const labels = months.map(m => m.label);
  const values = months.map(m => m.value);
  const lyValues = months.map(m => m.lastYearValue);
  const hasLY = lyValues.some(v => v != null);

  // Detect trend direction from first half vs second half
  const validValues = values.filter(v => v != null);
  const midpoint = Math.floor(validValues.length / 2);
  const firstHalfAvg = validValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const secondHalfAvg = validValues.slice(midpoint).reduce((a, b) => a + b, 0) / (validValues.length - midpoint);
  const trendColor = secondHalfAvg >= firstHalfAvg ? '#22c55e' : '#ef4444';

  const datasets = [
    {
      label: props.data.kpiName || props.data.metric || 'Current',
      data: values,
      borderColor: trendColor,
      backgroundColor: trendColor + '15',
      borderWidth: 2.5,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: trendColor,
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
    }
  ];

  if (hasLY) {
    datasets.push({
      label: 'Last Year',
      data: lyValues,
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 3],
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#94a3b8',
      pointBorderColor: '#fff',
      pointBorderWidth: 1,
    });
  }

  // Format values for tooltip/axis based on dataType
  const dataType = props.data.dataType || 'number';
  function formatVal(v) {
    if (v == null) return '';
    if (dataType === 'dollar' || dataType === 'currency' || dataType === 'money') {
      const abs = Math.abs(v);
      if (abs >= 1000000) return (v < 0 ? '-' : '') + '$' + (abs / 1000000).toFixed(1) + 'M';
      if (abs >= 1000) return (v < 0 ? '-' : '') + '$' + (abs / 1000).toFixed(1) + 'K';
      return '$' + v.toLocaleString();
    }
    if (dataType === 'percent' || dataType === 'percentage' || dataType === 'pcnt' || dataType === 'double') {
      return v.toFixed(1) + '%';
    }
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  chartInstance = new Chart(canvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: hasLY,
          position: 'top',
          labels: { boxWidth: 12, padding: 8, font: { size: 10 }, color: '#64748b' }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatVal(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: '500' }, color: '#64748b' },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
          ticks: {
            font: { size: 9 },
            color: '#64748b',
            callback: (v) => formatVal(v),
          },
          border: { display: false },
          beginAtZero: false,
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
          {{ data.kpiName || data.metric }} — {{ data.months?.length || 0 }}-Month Trend
        </span>
      </div>
      <span v-if="data.dealerShipId && data.dealerShipId !== '0'" class="text-[10px] text-primary-400">
        Store {{ data.dealerShipId }}
      </span>
    </div>
    <div class="px-3 py-2" style="height: 180px;">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>
