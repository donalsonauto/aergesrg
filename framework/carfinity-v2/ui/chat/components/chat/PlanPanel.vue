<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  planItems: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
})

const emit = defineEmits(['execute', 'toggle', 'remove', 'close'])

const enabledCount = computed(() => props.planItems.filter(i => i.enabled).length)

const vizIcons = {
  kpi_tiles: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
  table: 'M3 10h18M3 14h18M3 18h18M3 6h18M7 3v18M17 3v18',
  bar_chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  line_chart: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16',
  drilldown: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7',
  health_check: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  comparison: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
}

const vizLabels = {
  kpi_tiles: 'KPI Tiles',
  table: 'Table',
  bar_chart: 'Bar Chart',
  line_chart: 'Line Chart',
  drilldown: 'Deep Drilldown',
  health_check: 'Health Check',
  comparison: 'Comparison',
}

const vizColors = {
  kpi_tiles: 'text-blue-400 bg-blue-400/10',
  table: 'text-emerald-400 bg-emerald-400/10',
  bar_chart: 'text-purple-400 bg-purple-400/10',
  line_chart: 'text-cyan-400 bg-cyan-400/10',
  drilldown: 'text-amber-400 bg-amber-400/10',
  health_check: 'text-green-400 bg-green-400/10',
  comparison: 'text-pink-400 bg-pink-400/10',
}
</script>

<template>
  <div class="h-full flex flex-col bg-brand-dark border-l border-white/10">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div>
        <h3 class="text-sm font-semibold text-white tracking-tight">Analysis Plan</h3>
        <p class="text-[10px] text-white/40 mt-0.5">{{ enabledCount }} of {{ planItems.length }} steps enabled</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="enabledCount > 0 && !isStreaming"
          @click="emit('execute')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-sick-gradient text-white hover:opacity-90 transition-opacity cursor-pointer shadow-brand-glow"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Execute Plan
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Plan Items -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      <!-- Empty state -->
      <div v-if="!planItems.length" class="flex flex-col items-center justify-center h-full text-center px-4">
        <svg class="w-10 h-10 text-white/10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <p class="text-sm text-white/30 max-w-[240px]">Switch to Plan Mode and ask the AI to build an analysis plan. Plan items will appear here.</p>
      </div>

      <!-- Plan item cards -->
      <div
        v-for="(item, idx) in planItems"
        :key="item.id"
        class="group rounded-xl border overflow-hidden transition-all"
        :class="item.enabled
          ? 'bg-white/5 border-white/10 hover:border-white/20'
          : 'bg-white/[0.02] border-white/5 opacity-50'"
      >
        <!-- Item header -->
        <div class="flex items-start gap-3 px-3 py-2.5">
          <!-- Step number + toggle -->
          <button
            @click="emit('toggle', item.id)"
            class="mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer"
            :class="item.enabled
              ? 'bg-brand-purple/20 text-brand-purple'
              : 'bg-white/5 text-white/20'"
          >
            <span class="text-[10px] font-bold">{{ idx + 1 }}</span>
          </button>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-semibold text-white truncate">{{ item.title }}</h4>
            </div>
            <p class="text-[11px] text-white/40 mt-0.5 line-clamp-2">{{ item.description }}</p>

            <!-- Tags row -->
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <!-- Visualization badge -->
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                :class="vizColors[item.visualization] || 'text-white/40 bg-white/5'"
              >
                <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="vizIcons[item.visualization] || vizIcons.table" />
                </svg>
                {{ vizLabels[item.visualization] || item.visualization }}
              </span>

              <!-- Date range badge -->
              <span v-if="item.date_range" class="px-1.5 py-0.5 rounded text-[9px] font-medium text-white/30 bg-white/5">
                {{ item.date_range }}
              </span>

              <!-- Metrics badges -->
              <span
                v-for="m in (item.metrics || []).slice(0, 2)"
                :key="m"
                class="px-1.5 py-0.5 rounded text-[9px] font-medium text-white/30 bg-white/5"
              >
                {{ m }}
              </span>
              <span v-if="(item.metrics || []).length > 2" class="text-[9px] text-white/20">
                +{{ item.metrics.length - 2 }}
              </span>

              <!-- Dimensions badges -->
              <span
                v-for="d in (item.dimensions || []).slice(0, 2)"
                :key="d"
                class="px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-400/50 bg-amber-400/5"
              >
                {{ d }}
              </span>

              <!-- Filters -->
              <span
                v-if="item.filters && Object.keys(item.filters).length"
                class="px-1.5 py-0.5 rounded text-[9px] font-medium text-cyan-400/50 bg-cyan-400/5"
              >
                {{ Object.entries(item.filters).map(([k,v]) => `${k}=${v}`).join(', ') }}
              </span>
            </div>
          </div>

          <!-- Remove button -->
          <button
            @click="emit('remove', item.id)"
            class="opacity-0 group-hover:opacity-100 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Streaming indicator -->
      <div v-if="isStreaming" class="flex items-center gap-2 px-3 py-2">
        <svg class="w-3.5 h-3.5 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-xs text-amber-400/60">Building plan...</span>
      </div>
    </div>

    <!-- Execute footer -->
    <div v-if="planItems.length > 0 && !isStreaming" class="shrink-0 px-3 pb-3 pt-1">
      <button
        @click="emit('execute')"
        :disabled="enabledCount === 0"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
        :class="enabledCount > 0
          ? 'bg-sick-gradient text-white hover:opacity-90 shadow-brand-glow'
          : 'bg-white/5 text-white/20 cursor-not-allowed'"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Execute Plan ({{ enabledCount }} steps)
      </button>
    </div>
  </div>
</template>
