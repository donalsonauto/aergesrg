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

const COLORS = ['#6366f1', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']

function buildChart() {
  if (!canvas.value || !props.data?.properties?.length) return
  if (chartInstance) chartInstance.destroy()

  const properties = props.data.properties
  const labels = properties.map(p => p.name || p.propertyId)
  const metrics = Object.keys(properties[0]?.metrics || {})

  const datasets = metrics.map((metric, i) => ({
    label: metric.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
    data: properties.map(p => p.metrics[metric] ?? 0),
    backgroundColor: COLORS[i % COLORS.length] + '80',
    borderColor: COLORS[i % COLORS.length],
    borderWidth: 1,
    borderRadius: 4,
  }))

  chartInstance = new Chart(canvas.value, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 8, font: { size: 10 }, color: 'rgba(255,255,255,0.4)' },
        },
        tooltip: {
          backgroundColor: 'rgba(3, 0, 20, 0.95)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: 'rgba(255,255,255,0.3)' },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: { font: { size: 9 }, color: 'rgba(255,255,255,0.3)' },
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
    <div class="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
      <svg class="w-3 h-3 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span class="text-[11px] font-semibold text-white/60">Property Comparison</span>
    </div>
    <div class="px-3 py-2" style="height: 200px;">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>
