<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed } from 'vue';
import { formatValue, pctChange, changeColor } from '@/composables/useFormatKpi';
import KpiCommentMini from '@/components/comments/KpiCommentMini.vue';

const props = defineProps({
  impactData: { type: Object, default: () => ({}) }, // { dimensionName: { data: [], dataType: '' } }
  loading: { type: Boolean, default: false },
  dataType: { type: String, default: 'int' },
  metricKey: { type: String, default: '' },
  commentCounts: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['filterClick', 'openThread']);

const LEAD_COLORS = ['#818cf8', '#34d399', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa', '#22d3ee', '#facc15'];

const dimensions = computed(() => Object.keys(props.impactData));

function formatDimLabel(dim) {
  return 'By ' + dim
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/^Sale Person$/, 'Salesperson')
    .trim();
}

function barColorForDim(dim) {
  const d = dim.toLowerCase();
  if (d === 'dealership' || d === 'saleperson') return 'bg-primary-500';
  if (d === 'revenue' || d === 'gross') return 'bg-green-500';
  // Lead sources, tags, categories — use cycling colors (handled inline)
  return null;
}

function maxCurrentValue(data) {
  if (!data || !data.length) return 1;
  return Math.max(...data.map(d => Math.abs(d.current || 0)), 1);
}
</script>

<template>
  <div>
    <h3 class="text-xs sm:text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 sm:mb-3">What's Driving This Change</h3>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      <div v-for="i in 3" :key="i" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4 animate-pulse">
        <div class="h-4 bg-surface-200 dark:bg-surface-700 rounded w-24 mb-3 sm:mb-4"></div>
        <div v-for="j in 3" :key="j" class="flex items-center gap-2 mb-2 sm:mb-3">
          <div class="h-3 bg-surface-200 dark:bg-surface-700 rounded flex-1"></div>
          <div class="h-3 bg-surface-200 dark:bg-surface-700 rounded w-12"></div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="dimensions.length === 0" class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-6 text-center">
      <p class="text-sm text-surface-400">No impact data available</p>
    </div>

    <!-- Dimension cards grid — leaderboard style -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      <div
        v-for="dim in dimensions"
        :key="dim"
        class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-3 sm:p-4"
      >
        <div class="flex items-center justify-between mb-2 sm:mb-3">
          <h4 class="text-[10px] sm:text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{{ formatDimLabel(dim) }}</h4>
          <KpiCommentMini
            v-if="metricKey"
            :count="commentCounts[dim] || 0"
            @click="emit('openThread', { kpiKey: metricKey + '#by' + dim.charAt(0).toUpperCase() + dim.slice(1), metricName: formatDimLabel(dim), dimensionRows: impactData[dim]?.data || [], dimensionDataType: impactData[dim]?.dataType || dataType })"
          />
        </div>

        <div v-if="impactData[dim]?.data?.length" class="flex flex-col gap-2">
          <div
            v-for="(row, i) in impactData[dim].data"
            :key="i"
            class="group flex items-center gap-2 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 -mx-1.5 sm:-mx-2 transition-colors"
            @click="emit('filterClick', dim, row)"
          >
            <!-- Rank number -->
            <span class="w-4 text-[10px] font-bold text-right shrink-0"
              :class="i < 3 ? 'text-primary-500' : 'text-surface-400'">{{ i + 1 }}</span>

            <!-- Label + value + bar -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <span class="text-[11px] sm:text-xs font-medium text-surface-700 dark:text-surface-300 truncate pr-2">{{ row.label }}</span>
                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-[11px] sm:text-xs font-semibold tabular-nums text-surface-950 dark:text-surface-0">{{ formatValue(row.current, impactData[dim].dataType || dataType) }}</span>
                  <span class="text-[9px] sm:text-[10px] font-semibold tabular-nums"
                    :class="{
                      'text-green-600 dark:text-green-400': row.variance > 0,
                      'text-red-600 dark:text-red-400': row.variance < 0,
                      'text-surface-400': !row.variance,
                    }">{{ row.variance > 0 ? '+' : '' }}{{ formatValue(row.variance, impactData[dim].dataType || dataType) }}</span>
                  <span v-if="row.variancePct != null"
                    class="text-[8px] font-semibold px-1 py-0.5 rounded"
                    :class="{
                      'text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-400': row.variancePct > 0,
                      'text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400': row.variancePct < 0,
                    }">{{ row.variancePct > 0 ? '+' : '' }}{{ row.variancePct.toFixed(0) }}%</span>
                </div>
              </div>
              <!-- Progress bar scaled to max current value -->
              <div class="h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :class="barColorForDim(dim) || ''"
                  :style="{
                    width: ((Math.abs(row.current || 0) / maxCurrentValue(impactData[dim].data)) * 100) + '%',
                    opacity: 1 - (i * 0.07),
                    ...(!barColorForDim(dim) ? { backgroundColor: LEAD_COLORS[i % LEAD_COLORS.length] } : {})
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-surface-400 py-2">No data</div>
      </div>
    </div>
  </div>
</template>
