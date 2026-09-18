<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed } from 'vue';
import TasksAPI from '@/api/TasksAPI';

// Confirmation card for the `propose_task` chat tool.
// The tool result is a draft envelope:
//   { draft, kind:'task_definition_draft', source_request,
//     task:{ name, description, task_key, frequency, severity, params, scope },
//     create_endpoint, note }
// This card shows the proposed task and lets the user create it with one
// click — it POSTs the `task` payload to /api/tasks via TasksAPI.
const props = defineProps({
  // The raw tool result object (toolCall.result).
  result: { type: Object, required: true },
});

const draft = computed(() => props.result || {});
const task = computed(() => draft.value.task || {});

const state = ref('idle'); // idle | creating | created | dismissed | error
const errorMsg = ref('');

function frequencyLabel(f) {
  const map = { hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  return map[f] || (f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Manual');
}

const severityMeta = computed(() => {
  const s = task.value.severity;
  if (s === 'critical') return { label: 'Critical', cls: 'text-red-400 bg-red-500/15 border-red-500/25' };
  if (s === 'warn' || s === 'warning') return { label: 'Warning', cls: 'text-amber-400 bg-amber-500/15 border-amber-500/25' };
  return { label: 'Info', cls: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25' };
});

// Render the params object as readable rows.
const paramRows = computed(() => {
  const p = task.value.params;
  if (!p || typeof p !== 'object') return [];
  return Object.entries(p)
    .filter(([, v]) => typeof v !== 'object')
    .map(([k, v]) => ({
      key: k.replace(/[._]/g, ' ').replace(/^./, (s) => s.toUpperCase()),
      value: String(v),
    }));
});

async function createTask() {
  state.value = 'creating';
  errorMsg.value = '';
  try {
    // Build the create payload from the draft's task. The endpoint may not
    // accept `scope`, so drop it defensively.
    const { scope, ...payload } = task.value;
    void scope;
    await TasksAPI.createTask(payload);
    state.value = 'created';
  } catch (e) {
    state.value = 'error';
    errorMsg.value = e?.response?.data?.error || e.message || 'Failed to create task.';
  }
}

function dismiss() {
  state.value = 'dismissed';
}
</script>

<template>
  <div class="rounded-lg border border-brand-purple/25 bg-brand-purple/[0.06] overflow-hidden">
    <!-- header -->
    <div class="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/[0.06]">
      <span class="flex h-5 w-5 items-center justify-center rounded-md bg-brand-purple/20 shrink-0">
        <svg class="w-3 h-3 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </span>
      <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-purple">Proposed monitoring task</span>
    </div>

    <!-- created state -->
    <div v-if="state === 'created'" class="px-3.5 py-4 flex items-start gap-2.5">
      <svg class="w-4 h-4 text-green-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
      <div>
        <div class="text-[13px] font-semibold text-white/85">Task created</div>
        <div class="text-[12px] text-white/45 mt-0.5">
          “{{ task.name }}” is now monitoring your data. Manage it on the
          <a href="/tasks" class="text-brand-purple hover:underline">Tasks page</a>.
        </div>
      </div>
    </div>

    <!-- dismissed state -->
    <div v-else-if="state === 'dismissed'" class="px-3.5 py-3.5 text-[12px] text-white/40">
      Proposal dismissed — no task was created.
    </div>

    <!-- draft / creating / error -->
    <div v-else class="px-3.5 py-3.5">
      <h4 class="text-[14px] font-semibold text-white/90 leading-snug">{{ task.name || 'Untitled task' }}</h4>
      <p v-if="task.description" class="text-[12.5px] text-white/55 leading-relaxed mt-1">{{ task.description }}</p>

      <!-- meta chips -->
      <div class="flex items-center gap-2 flex-wrap mt-2.5">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-[10.5px] text-white/55">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {{ frequencyLabel(task.frequency) }}
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold" :class="severityMeta.cls">
          {{ severityMeta.label }}
        </span>
        <span v-if="task.task_key" class="inline-flex items-center px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-[10.5px] font-mono text-white/40">
          {{ task.task_key }}
        </span>
      </div>

      <!-- what it checks -->
      <div v-if="paramRows.length" class="mt-3">
        <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 mb-1.5">What it checks</div>
        <div class="grid grid-cols-2 gap-1.5">
          <div v-for="row in paramRows" :key="row.key"
            class="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1.5">
            <div class="text-[9.5px] text-white/35 uppercase tracking-wide truncate">{{ row.key }}</div>
            <div class="text-[12px] font-medium text-white/70 tabular-nums truncate">{{ row.value }}</div>
          </div>
        </div>
      </div>

      <!-- source request -->
      <p v-if="draft.source_request" class="text-[11px] text-white/35 italic mt-3">
        Based on your request: “{{ draft.source_request }}”
      </p>
      <p v-if="draft.note" class="text-[11px] text-white/40 mt-1.5">{{ draft.note }}</p>

      <!-- error -->
      <div v-if="state === 'error'" class="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-red-400">
        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
        {{ errorMsg }}
      </div>

      <!-- actions -->
      <div class="flex items-center gap-2 mt-3.5">
        <button
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-semibold bg-brand-purple text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="state === 'creating'"
          @click="createTask"
        >
          <svg v-if="state === 'creating'" class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          {{ state === 'creating' ? 'Creating…' : (state === 'error' ? 'Retry' : 'Create task') }}
        </button>
        <button
          class="inline-flex items-center px-3 py-1.5 rounded-md text-[12px] font-medium border border-white/10 text-white/55 hover:bg-white/5 transition-colors disabled:opacity-50"
          :disabled="state === 'creating'"
          @click="dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>
