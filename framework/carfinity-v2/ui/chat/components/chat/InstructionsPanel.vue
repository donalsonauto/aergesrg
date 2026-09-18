<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted } from 'vue'
import { useAiStore } from '../../stores/ai'

const emit = defineEmits(['close'])
const aiStore = useAiStore()
const newContent = ref('')
const adding = ref(false)

onMounted(() => {
  aiStore.fetchInstructions()
})

async function addInstruction() {
  if (!newContent.value.trim()) return
  adding.value = true
  try {
    await aiStore.addInstruction(newContent.value.trim())
    newContent.value = ''
  } catch { /* ignore */ }
  adding.value = false
}

async function toggleActive(inst) {
  await aiStore.updateInstruction(inst.id, { active: !inst.active })
}

async function remove(id) {
  await aiStore.deleteInstruction(id)
}
</script>

<template>
  <div class="flex flex-col h-full w-[360px] bg-brand-dark border-l border-white/10">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <svg class="w-4 h-4 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span class="text-sm font-semibold text-white">Custom Instructions</span>
      </div>
      <button
        @click="emit('close')"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Description -->
    <div class="shrink-0 px-4 pt-3 pb-1">
      <p class="text-xs text-white/40 leading-relaxed">These instructions are included in every AI conversation to personalize responses.</p>
    </div>

    <!-- Add new instruction -->
    <div class="shrink-0 px-4 py-3 border-b border-white/10">
      <textarea
        v-model="newContent"
        rows="2"
        placeholder="e.g., Always compare to last year when discussing trends..."
        class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
        @keydown.ctrl.enter="addInstruction"
      ></textarea>
      <button
        @click="addInstruction"
        :disabled="!newContent.trim() || adding"
        class="mt-2 w-full px-3 py-2 rounded-lg bg-sick-gradient text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
      >{{ adding ? 'Adding...' : 'Add Instruction' }}</button>
    </div>

    <!-- Instructions list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <!-- Empty state -->
      <div v-if="!aiStore.instructions.length" class="text-center py-10">
        <svg class="w-8 h-8 text-white/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p class="text-sm text-white/30">No instructions yet</p>
        <p class="text-xs text-white/20 mt-1">Add one above to customize AI behavior</p>
      </div>

      <!-- Instruction cards -->
      <div
        v-for="inst in aiStore.instructions"
        :key="inst.id"
        class="group flex items-start gap-3 px-3 py-3 rounded-xl border transition-all"
        :class="inst.active !== false
          ? 'border-white/10 bg-white/5'
          : 'border-white/5 bg-white/[0.02] opacity-50'"
      >
        <!-- Toggle switch -->
        <button
          @click="toggleActive(inst)"
          class="relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 mt-0.5"
          :class="inst.active !== false ? 'bg-brand-purple' : 'bg-white/20'"
          :title="inst.active !== false ? 'Disable' : 'Enable'"
        >
          <div
            class="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform"
            :class="inst.active !== false ? 'translate-x-[18px]' : 'translate-x-[3px]'"
          ></div>
        </button>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white/70 leading-relaxed">{{ inst.content }}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span
              v-if="inst.source === 'feedback'"
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400"
            >From feedback</span>
            <span
              v-else
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/10 text-white/40"
            >Manual</span>
          </div>
        </div>

        <!-- Delete -->
        <button
          @click="remove(inst.id)"
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
</template>
