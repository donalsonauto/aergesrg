<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted } from 'vue';
import { useAiStore } from '@/stores/ai';

const emit = defineEmits(['close']);
const aiStore = useAiStore();

const EVENT_TYPES = [
  { value: 'personnel', label: 'Personnel' },
  { value: 'system', label: 'System' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'market', label: 'Market' },
  { value: 'general', label: 'General' },
];

const TYPE_COLORS = {
  personnel: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  system: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  marketing: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  inventory: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  market: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  general: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400',
};

const showForm = ref(false);
const editingId = ref(null);
const form = ref({ title: '', description: '', eventDate: '', endDate: '', eventType: 'general', dealershipIds: '' });

onMounted(() => {
  aiStore.fetchEvents();
});

function resetForm() {
  form.value = { title: '', description: '', eventDate: '', endDate: '', eventType: 'general', dealershipIds: '' };
  editingId.value = null;
  showForm.value = false;
}

function startEdit(evt) {
  editingId.value = evt.id;
  form.value = {
    title: evt.title,
    description: evt.description || '',
    eventDate: evt.event_date,
    endDate: evt.end_date || '',
    eventType: evt.event_type || 'general',
    dealershipIds: evt.dealership_ids ? (() => { try { return JSON.parse(evt.dealership_ids).join(', '); } catch { return ''; } })() : '',
  };
  showForm.value = true;
}

function parseDealerIds(str) {
  if (!str.trim()) return null;
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

async function saveEvent() {
  if (!form.value.title.trim() || !form.value.eventDate) return;
  const data = {
    title: form.value.title.trim(),
    description: form.value.description.trim() || null,
    eventDate: form.value.eventDate,
    endDate: form.value.endDate || null,
    eventType: form.value.eventType,
    dealershipIds: parseDealerIds(form.value.dealershipIds),
  };
  if (editingId.value) {
    await aiStore.updateEvent(editingId.value, data);
    // Re-fetch to get updated data
    await aiStore.fetchEvents();
  } else {
    await aiStore.addEvent(data);
  }
  resetForm();
}

async function remove(id) {
  await aiStore.deleteEvent(id);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface-0 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700/50">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
      <div class="flex items-center gap-2">
        <i class="pi pi-calendar text-primary-500 text-sm"></i>
        <span class="text-sm font-semibold text-surface-800 dark:text-surface-100">Business Events</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="!showForm"
          @click="showForm = true"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer"
          title="Add event"
        >
          <i class="pi pi-plus text-xs"></i>
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <i class="pi pi-times text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="shrink-0 px-4 py-3 border-b border-surface-200 dark:border-surface-700/50 space-y-2">
      <input
        v-model="form.title"
        type="text"
        class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="Event title *"
      />
      <textarea
        v-model="form.description"
        rows="2"
        class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="Description (optional)"
      ></textarea>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] text-surface-500 font-medium mb-0.5 block">Start Date *</label>
          <input
            v-model="form.eventDate"
            type="date"
            class="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-surface-500 font-medium mb-0.5 block">End Date</label>
          <input
            v-model="form.endDate"
            type="date"
            class="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] text-surface-500 font-medium mb-0.5 block">Type</label>
          <select
            v-model="form.eventType"
            class="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option v-for="t in EVENT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-surface-500 font-medium mb-0.5 block">Store IDs (comma-sep)</label>
          <input
            v-model="form.dealershipIds"
            type="text"
            class="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="All stores"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="saveEvent"
          :disabled="!form.title.trim() || !form.eventDate"
          class="flex-1 px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {{ editingId ? 'Update' : 'Add Event' }}
        </button>
        <button
          @click="resetForm"
          class="px-3 py-2 rounded-lg text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Events list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <div v-if="!aiStore.events.length" class="text-center py-8">
        <i class="pi pi-calendar text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
        <p class="text-sm text-surface-400 dark:text-surface-500">No business events yet</p>
        <p class="text-xs text-surface-400 dark:text-surface-500 mt-1">Add events to give the AI business context</p>
      </div>

      <div
        v-for="evt in aiStore.events"
        :key="evt.id"
        class="group p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 hover:border-surface-300 dark:hover:border-surface-600 transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-surface-800 dark:text-surface-200">{{ evt.title }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="TYPE_COLORS[evt.event_type] || TYPE_COLORS.general"
              >
                {{ evt.event_type }}
              </span>
            </div>
            <p class="text-xs text-surface-500 mt-0.5">
              {{ formatDate(evt.event_date) }}
              <template v-if="evt.end_date"> - {{ formatDate(evt.end_date) }}</template>
            </p>
            <p v-if="evt.description" class="text-xs text-surface-500 dark:text-surface-400 mt-1 leading-relaxed">{{ evt.description }}</p>
            <p v-if="evt.dealership_ids" class="text-[10px] text-surface-400 mt-1">
              Stores: {{ (() => { try { return JSON.parse(evt.dealership_ids).join(', '); } catch { return evt.dealership_ids; } })() }}
            </p>
          </div>
          <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="startEdit(evt)"
              class="w-6 h-6 rounded flex items-center justify-center text-surface-400 hover:text-primary-500 transition-colors cursor-pointer"
              title="Edit"
            >
              <i class="pi pi-pencil text-[10px]"></i>
            </button>
            <button
              @click="remove(evt.id)"
              class="w-6 h-6 rounded flex items-center justify-center text-surface-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Delete"
            >
              <i class="pi pi-trash text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
