<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted } from 'vue'
import { useAiStore } from '../../stores/ai'

const emit = defineEmits(['close'])
const aiStore = useAiStore()

const IMPACT_TYPES = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'neutral', label: 'Neutral' },
]

const EVENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'system', label: 'System' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'market', label: 'Market' },
]

const TYPE_COLORS = {
  marketing: 'bg-green-500/20 text-green-400',
  personnel: 'bg-blue-500/20 text-blue-400',
  system: 'bg-purple-500/20 text-purple-400',
  inventory: 'bg-orange-500/20 text-orange-400',
  market: 'bg-red-500/20 text-red-400',
  general: 'bg-white/10 text-white/50',
}

const IMPACT_COLORS = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-white/40',
}

const showForm = ref(false)
const saving = ref(false)
const form = ref(defaultForm())

function defaultForm() {
  return { title: '', description: '', eventDate: '', endDate: '', eventType: 'general', impact: 'neutral' }
}

onMounted(() => {
  aiStore.fetchEvents()
})

function resetForm() {
  form.value = defaultForm()
  showForm.value = false
}

async function saveEvent() {
  if (!form.value.title.trim() || !form.value.eventDate) return
  saving.value = true
  try {
    await aiStore.addEvent({
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      eventDate: form.value.eventDate,
      endDate: form.value.endDate || null,
      eventType: form.value.eventType,
      impact: form.value.impact,
    })
    resetForm()
  } catch { /* ignore */ }
  saving.value = false
}

async function remove(id) {
  await aiStore.deleteEvent(id)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col h-full w-[360px] bg-brand-dark border-l border-white/10">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <svg class="w-4 h-4 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-sm font-semibold text-white">Business Events</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="!showForm"
          @click="showForm = true"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-brand-purple hover:bg-white/10 transition-colors cursor-pointer"
          title="Add event"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Description -->
    <div class="shrink-0 px-4 pt-3 pb-1">
      <p class="text-xs text-white/40 leading-relaxed">Log business events so the AI can consider them when analyzing your data.</p>
    </div>

    <!-- Add form -->
    <div v-if="showForm" class="shrink-0 px-4 py-3 border-b border-white/10 space-y-2.5">
      <div>
        <input
          v-model="form.title"
          type="text"
          placeholder="Event title *"
          class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
        />
      </div>
      <div>
        <textarea
          v-model="form.description"
          rows="2"
          placeholder="Description (optional)"
          class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
        ></textarea>
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] text-white/40 font-medium mb-1 block">Start Date *</label>
          <input
            v-model="form.eventDate"
            type="date"
            class="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors [color-scheme:dark]"
          />
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-white/40 font-medium mb-1 block">End Date</label>
          <input
            v-model="form.endDate"
            type="date"
            class="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors [color-scheme:dark]"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] text-white/40 font-medium mb-1 block">Type</label>
          <select
            v-model="form.eventType"
            class="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors appearance-none"
          >
            <option v-for="t in EVENT_TYPES" :key="t.value" :value="t.value" class="bg-brand-dark">{{ t.label }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-white/40 font-medium mb-1 block">Impact</label>
          <select
            v-model="form.impact"
            class="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors appearance-none"
          >
            <option v-for="i in IMPACT_TYPES" :key="i.value" :value="i.value" class="bg-brand-dark">{{ i.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="saveEvent"
          :disabled="!form.title.trim() || !form.eventDate || saving"
          class="flex-1 px-3 py-2 rounded-lg bg-sick-gradient text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >{{ saving ? 'Saving...' : 'Add Event' }}</button>
        <button
          @click="resetForm"
          class="px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/10 transition-colors cursor-pointer"
        >Cancel</button>
      </div>
    </div>

    <!-- Events list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <!-- Empty state -->
      <div v-if="!aiStore.events.length" class="text-center py-10">
        <svg class="w-8 h-8 text-white/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm text-white/30">No business events yet</p>
        <p class="text-xs text-white/20 mt-1">Add events to give the AI business context</p>
      </div>

      <!-- Event cards -->
      <div
        v-for="evt in aiStore.events"
        :key="evt.id"
        class="group p-3 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <!-- Title + type badge -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-white">{{ evt.title }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="TYPE_COLORS[evt.event_type || evt.eventType] || TYPE_COLORS.general"
              >{{ evt.event_type || evt.eventType || 'general' }}</span>
            </div>

            <!-- Date -->
            <p class="text-xs text-brand-cyan mt-1">
              {{ formatDate(evt.event_date || evt.eventDate || evt.date) }}
              <template v-if="evt.end_date || evt.endDate">
                <span class="text-white/30 mx-1">-</span>
                {{ formatDate(evt.end_date || evt.endDate) }}
              </template>
            </p>

            <!-- Description -->
            <p v-if="evt.description" class="text-xs text-white/40 mt-1.5 leading-relaxed">{{ evt.description }}</p>

            <!-- Impact indicator -->
            <div v-if="evt.impact && evt.impact !== 'neutral'" class="mt-1.5">
              <span
                class="text-[10px] font-medium"
                :class="IMPACT_COLORS[evt.impact] || IMPACT_COLORS.neutral"
              >
                <template v-if="evt.impact === 'positive'">+ Positive impact</template>
                <template v-else-if="evt.impact === 'negative'">- Negative impact</template>
              </span>
            </div>
          </div>

          <!-- Delete -->
          <button
            @click="remove(evt.id)"
            class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-white/15 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Delete"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
