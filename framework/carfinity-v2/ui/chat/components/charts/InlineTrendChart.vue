<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  data: { type: Object, required: true },
})

const canvas = ref(null)
let chartInstance = null

function buildChart() {
  if (!canvas.value || !props.data?.dailyValues?.length) return
  if (chartInstance) chartInstance.destroy()

  const values = props.data.dailyValues
  const labels = values.map(v => {
    const d = new Date(v.date)
    return (d.getMonth() + 1) + '/' + d.getDate()
  })
  const dataPoints = values.map(v => v.value)

  const hasAnomaly = dataPoints.some((v, i) => i > 2 && v === 0 && dataPoints[i - 1] > 0 && dataPoints[i - 2] > 0)
  const first3Avg = dataPoints.slice(0, 3).reduce((a, b) => a + b, 0) / 3
  const last3Avg = dataPoints.slice(-3).reduce((a, b) => a + b, 0) / 3
  const trendColor = hasAnomaly ? '#ef4444' : (last3Avg >= first3Avg ? '#22c55e' : '#f59e0b')

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
          backgroundColor: 'rgba(3, 0, 20, 0.95)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
          callbacks: { label: (ctx) => ` ${ctx.parsed.y.toLocaleString()}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: 'rgba(255,255,255,0.3)', maxRotation: 0, maxTicksLimit: 10 },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: {
            font: { size: 9 },
            color: 'rgba(255,255,255,0.3)',
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v,
          },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  })
}

onMounted(buildChart)
watch(() => props.data, buildChart, { deep: true })
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
    <div class="px-3 py-2 border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <svg class="w-3 h-3 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <span class="text-[11px] font-semibold text-white/60">
          {{ data.kpiName || data.metric }} -- Daily Trend
        </span>
      </div>
      <span class="text-[10px] text-white/30">
        {{ data.dailyValues?.length || 0 }} days
      </span>
    </div>
    <div class="px-3 py-2" style="height: 160px;">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>
