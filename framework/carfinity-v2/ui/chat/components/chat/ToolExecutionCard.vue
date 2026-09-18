<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, ref } from 'vue'
import ProposeTaskCard from './ProposeTaskCard.vue'

const props = defineProps({
  toolCall: { type: Object, required: true },
})

// `propose_task` returns a task-definition draft envelope. When the tool has
// completed and produced one, ToolExecutionCard hands rendering off to the
// dedicated confirmation card instead of the default tool-chip.
const isProposeTaskDraft = computed(() => {
  const r = props.toolCall.result
  return (
    props.toolCall.status === 'completed' &&
    r && typeof r === 'object' &&
    (r.kind === 'task_definition_draft' || (r.draft === true && r.task))
  )
})

const expanded = ref(false)
const openDocs = ref(new Set())
const showRawResult = ref(false)
function toggleDoc(id) {
  if (openDocs.value.has(id)) openDocs.value.delete(id)
  else openDocs.value.add(id)
  openDocs.value = new Set(openDocs.value)
}

const runningLabels = {
  list_ga_properties: 'Loading Properties',
  get_ga4_metrics: 'Fetching GA4 Metrics',
  get_ga4_realtime: 'Checking Real-Time',
  get_ga4_comparison: 'Comparing Ranges',
  get_ga4_drilldown: 'Drilling Down',
  get_ga4_funnel: 'Analyzing Funnel',
  get_ga4_daily_trend: 'Loading Daily Trend',
  get_ga4_monthly_trend: 'Loading Monthly History',
  get_asc_events: 'Fetching ASC Events',
  get_asc_drilldown: 'Drilling ASC Events',
  get_search_console: 'Loading Search Console',
  get_search_queries: 'Fetching Search Queries',
  get_page_performance: 'Analyzing Pages',
  compare_properties: 'Comparing Properties',
  search_knowledge: 'Searching Knowledge Base',
  think: 'Thinking',
}

const completedLabels = {
  list_ga_properties: 'Properties',
  get_ga4_metrics: 'GA4 Metrics',
  get_ga4_realtime: 'Real-Time Data',
  get_ga4_comparison: 'Range Comparison',
  get_ga4_drilldown: 'Drill-Down',
  get_ga4_funnel: 'Funnel Analysis',
  get_ga4_daily_trend: 'Daily Trend',
  get_ga4_monthly_trend: 'Monthly History',
  get_asc_events: 'ASC Events',
  get_asc_drilldown: 'ASC Drill-Down',
  get_search_console: 'Search Console',
  get_search_queries: 'Search Queries',
  get_page_performance: 'Page Performance',
  compare_properties: 'Property Comparison',
  search_knowledge: 'Knowledge Base',
  think: 'Analysis',
}

const isRunning = computed(() => props.toolCall.status === 'running')
const isCompleted = computed(() => props.toolCall.status === 'completed')
const isFailed = computed(() => props.toolCall.status === 'failed')

const label = computed(() => {
  const name = props.toolCall.name
  if (isCompleted.value || isFailed.value) return completedLabels[name] || name
  return runningLabels[name] || name
})

function humanizeKey(key) {
  if (!key) return ''
  const part = key.includes('.') ? key.split('.').pop() : key
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

const argsDescription = computed(() => {
  const args = props.toolCall.args
  if (!args || !Object.keys(args).length) return ''
  const parts = []
  if (args.metric) parts.push(humanizeKey(args.metric))
  if (args.metrics && Array.isArray(args.metrics)) parts.push(args.metrics.map(humanizeKey).join(', '))
  if (args.dimension) parts.push(`by ${args.dimension}`)
  if (args.event_name) parts.push(humanizeKey(args.event_name))
  if (args.query) parts.push(`"${args.query}"`)
  // Show property name from result if available, otherwise from args
  const propName = props.toolCall.result?.property_name
  if (propName) {
    parts.push(propName)
  } else if (args.property_id && args.property_id !== 'all') {
    parts.push(args.property_id)
  }
  if (args.start_date && args.end_date) parts.push(`${args.start_date} to ${args.end_date}`)
  return parts.join(' ')
})

const resultSummary = computed(() => {
  if (!props.toolCall.result) return ''
  const r = props.toolCall.result
  if (typeof r === 'string') return r.length > 80 ? r.substring(0, 77) + '...' : r
  if (r.error) return r.error
  if (Array.isArray(r)) return `${r.length} items`
  if (r.data && Array.isArray(r.data)) return `${r.data.length} entries`
  if (r.documents) return `${r.documents.length} docs`
  if (r.properties) return `${r.properties.length} properties`
  if (r.current !== undefined) return r.name || ''
  return ''
})

const hasDetails = computed(() => {
  if (!props.toolCall.result || isRunning.value) return false
  const r = props.toolCall.result
  if (typeof r === 'string') return r.length > 0
  return Object.keys(r).length > 0
})

const formattedResult = computed(() => {
  if (!props.toolCall.result) return ''
  try { return JSON.stringify(props.toolCall.result, null, 2) } catch { return String(props.toolCall.result) }
})

function toggle() { if (hasDetails.value) expanded.value = !expanded.value }
</script>

<template>
  <!-- propose_task → dedicated confirmation card -->
  <ProposeTaskCard v-if="isProposeTaskDraft" :result="toolCall.result" />

  <!-- default tool-chip rendering -->
  <div
    v-else
    class="rounded-lg transition-all duration-300 overflow-hidden"
    :class="{
      'bg-white/[0.06] border border-white/10': isRunning,
      'bg-white/[0.03]': isCompleted && !expanded,
      'bg-white/[0.03] border border-white/10': isCompleted && expanded,
      'bg-red-500/10 border border-red-500/20': isFailed,
    }"
  >
    <div
      class="flex items-center gap-2 px-3 py-1.5 text-xs"
      :class="{ 'cursor-pointer hover:bg-white/5 rounded-lg': hasDetails }"
      @click="toggle"
    >
      <!-- Running spinner -->
      <span v-if="isRunning" class="relative flex h-3.5 w-3.5 shrink-0">
        <svg class="animate-spin h-3.5 w-3.5 text-brand-purple" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </span>
      <!-- Completed check -->
      <span v-else-if="isCompleted" class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg class="h-3.5 w-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </span>
      <!-- Failed X -->
      <span v-else-if="isFailed" class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg class="h-3.5 w-3.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>

      <div class="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
        <span
          class="font-medium whitespace-nowrap"
          :class="{
            'text-white/70': isRunning,
            'text-white/40': isCompleted,
            'text-red-400': isFailed,
          }"
        >{{ label }}</span>
        <span v-if="argsDescription" class="truncate" :class="{ 'text-white/40': isRunning, 'text-white/30': isCompleted, 'text-red-300': isFailed }">{{ argsDescription }}</span>
        <span v-if="isCompleted && resultSummary" class="text-white/30 shrink-0">&middot; {{ resultSummary }}</span>
        <span v-if="isFailed && resultSummary" class="text-red-400 truncate">&middot; {{ resultSummary }}</span>
      </div>

      <span v-if="hasDetails" class="shrink-0 text-white/30 transition-transform duration-200" :class="{ 'rotate-180': expanded }">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>

    <!-- Special: search_knowledge — render docs as readable cards -->
    <div v-if="expanded && toolCall.name === 'search_knowledge' && toolCall.result?.documents?.length" class="px-3 pb-3">
      <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40 mb-2">
        {{ toolCall.result.documents.length }} doc{{ toolCall.result.documents.length === 1 ? '' : 's' }} for "{{ toolCall.result.query || toolCall.args?.query }}"
      </div>
      <div class="space-y-2">
        <div
          v-for="doc in toolCall.result.documents"
          :key="doc.id"
          class="rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
        >
          <button
            @click.stop="toggleDoc(doc.id)"
            class="w-full flex items-start gap-3 px-3 py-2 text-left cursor-pointer"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-white/85 truncate">{{ doc.title }}</div>
              <div class="text-[10px] mt-0.5 flex items-center gap-2">
                <span class="font-mono uppercase tracking-[0.14em] text-amber-400/80">{{ doc.category || 'general' }}</span>
                <span v-if="doc.kpiName" class="text-white/30">· {{ doc.kpiName }}</span>
              </div>
            </div>
            <a
              :href="`/knowledge?doc=${doc.id}`"
              target="_blank"
              @click.stop
              class="shrink-0 text-[10px] font-mono uppercase tracking-[0.14em] text-white/30 hover:text-amber-300 transition-colors"
              title="Open in knowledge base to edit"
            >EDIT →</a>
            <svg class="w-3 h-3 text-white/30 mt-1 transition-transform" :class="{ 'rotate-180': openDocs.has(doc.id) }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" clip-rule="evenodd" />
            </svg>
          </button>
          <div v-if="openDocs.has(doc.id)" class="px-3 pb-3 pt-0">
            <div class="text-[12.5px] leading-[1.55] text-white/70 whitespace-pre-wrap font-sans">{{ doc.content }}</div>
          </div>
        </div>
      </div>
      <button
        @click.stop="showRawResult = !showRawResult"
        class="mt-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white/30 hover:text-white/60 cursor-pointer transition-colors"
      >{{ showRawResult ? 'Hide' : 'Show' }} raw JSON</button>
      <pre v-if="showRawResult" class="mt-2 text-[10px] leading-relaxed text-white/30 bg-white/[0.02] rounded-md p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono">{{ formattedResult }}</pre>
    </div>

    <!-- Default: raw JSON for everything else -->
    <div v-else-if="expanded" class="px-3 pb-2">
      <pre class="text-[11px] leading-relaxed text-white/40 bg-white/[0.03] rounded-md p-2.5 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-mono">{{ formattedResult }}</pre>
    </div>
  </div>
</template>
