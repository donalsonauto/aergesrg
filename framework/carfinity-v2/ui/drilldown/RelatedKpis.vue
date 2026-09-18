<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted, watch } from 'vue';
import { formatValue, pctChange, changeColor, badgeClass } from '@/composables/useFormatKpi';
import KpiCommentMini from '@/components/comments/KpiCommentMini.vue';

const props = defineProps({
  metricKey: { type: String, required: true },
  apiParams: { type: Object, default: () => ({}) },
  commentCounts: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['click', 'openThread']);

const relatedKpis = ref([]);
const loading = ref(false);

onMounted(() => loadRelated());
watch(() => props.metricKey, () => loadRelated());

async function loadRelated() {
  if (!props.metricKey) return;
  loading.value = true;
  try {
    // Dynamic import to avoid circular dependency issues
    const mod = await import('@/api/KpiRelationshipsAPI');
    const KpiRelationshipsAPI = mod.default;
    const data = await KpiRelationshipsAPI.getRelated(props.metricKey, props.apiParams.dealerGroupId, {
      year: props.apiParams.year,
      month: props.apiParams.month,
      view: props.apiParams.view,
    });
    relatedKpis.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to load related KPIs:', e);
    relatedKpis.value = [];
  } finally {
    loading.value = false;
  }
}

function getKpiName(rel) {
  if (rel.kpiData?.fullName) return rel.kpiData.fullName;
  if (rel.kpiData?.name) return rel.kpiData.name;
  const key = rel.related_kpi || '';
  const part = key.includes('.') ? key.split('.').pop() : key;
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function getDataType(rel) {
  return rel.kpiData?.dataType || 'int';
}

function getCurrent(rel) {
  return rel.kpiData?.current?.value ?? rel.kpiData?.current ?? null;
}

function getPrevious(rel) {
  return rel.kpiData?.previous?.value ?? rel.kpiData?.previous ?? null;
}

const TYPE_BADGES = {
  driver: { label: 'Driver', class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  correlated: { label: 'Correlated', class: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  upstream: { label: 'Upstream', class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  downstream: { label: 'Downstream', class: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400' },
  component: { label: 'Component', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
};
</script>

<template>
  <div v-if="loading || relatedKpis.length > 0">
    <h3 class="text-xs sm:text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 sm:mb-3">Related KPIs Across Data Sets</h3>

    <!-- Loading -->
    <div v-if="loading" class="flex gap-2 sm:gap-3 overflow-hidden">
      <div v-for="i in 4" :key="i" class="min-w-[130px] sm:min-w-[160px] h-20 sm:h-24 bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface animate-pulse"></div>
    </div>

    <!-- Cards -->
    <div v-else class="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      <div
        v-for="rel in relatedKpis"
        :key="rel.related_kpi"
        class="min-w-[130px] sm:min-w-[160px] max-w-[170px] sm:max-w-[200px] bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface p-2.5 sm:p-3 cursor-pointer hover:shadow-md hover:border-primary-500/30 transition-all shrink-0"
        @click="emit('click', { key: rel.related_kpi, name: getKpiName(rel), dataType: getDataType(rel), current: rel.kpiData?.current, previous: rel.kpiData?.previous, lastYear: rel.kpiData?.lastYear })"
      >
        <div class="flex items-center gap-1.5 mb-1 sm:mb-1.5">
          <span class="text-[9px] sm:text-[10px] font-medium text-surface-500 dark:text-surface-400 truncate flex-1">{{ getKpiName(rel) }}</span>
          <KpiCommentMini
            :count="commentCounts[rel.related_kpi] || 0"
            @click="emit('openThread', { kpiKey: rel.related_kpi, metricName: getKpiName(rel), currentValue: getCurrent(rel), previousValue: getPrevious(rel), dataType: getDataType(rel) })"
          />
        </div>
        <div class="flex items-baseline gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
          <span class="text-xs sm:text-sm font-bold text-surface-800 dark:text-surface-100">{{ getCurrent(rel) != null ? formatValue(getCurrent(rel), getDataType(rel)) : '\u2014' }}</span>
          <span
            v-if="pctChange(getCurrent(rel), getPrevious(rel)) != null"
            class="text-[9px] sm:text-[10px] font-semibold"
            :class="{
              'text-green-600 dark:text-green-400': changeColor(pctChange(getCurrent(rel), getPrevious(rel))) === 'positive',
              'text-red-600 dark:text-red-400': changeColor(pctChange(getCurrent(rel), getPrevious(rel))) === 'negative',
              'text-surface-400': changeColor(pctChange(getCurrent(rel), getPrevious(rel))) === 'neutral',
            }"
          >{{ pctChange(getCurrent(rel), getPrevious(rel)) > 0 ? '+' : '' }}{{ pctChange(getCurrent(rel), getPrevious(rel)).toFixed(1) }}%</span>
        </div>
        <span
          v-if="TYPE_BADGES[rel.relationship_type]"
          class="inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold"
          :class="TYPE_BADGES[rel.relationship_type].class"
        >{{ TYPE_BADGES[rel.relationship_type].label }}</span>
      </div>
    </div>
  </div>
</template>
