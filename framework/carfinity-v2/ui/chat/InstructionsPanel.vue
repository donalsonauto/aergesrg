<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, onMounted } from 'vue';
import { useAiStore } from '@/stores/ai';

const emit = defineEmits(['close']);
const aiStore = useAiStore();
const newContent = ref('');
const adding = ref(false);

onMounted(() => {
  aiStore.fetchInstructions();
});

async function addInstruction() {
  if (!newContent.value.trim()) return;
  adding.value = true;
  await aiStore.addInstruction(newContent.value.trim(), 'manual');
  newContent.value = '';
  adding.value = false;
}

async function toggleActive(inst) {
  await aiStore.updateInstruction(inst.id, { active: inst.active ? false : true });
}

async function remove(id) {
  await aiStore.deleteInstruction(id);
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface-0 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700/50">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
      <div class="flex items-center gap-2">
        <i class="pi pi-brain text-primary-500 text-sm"></i>
        <span class="text-sm font-semibold text-surface-800 dark:text-surface-100">Custom Instructions</span>
      </div>
      <button
        @click="emit('close')"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
      >
        <i class="pi pi-times text-xs"></i>
      </button>
    </div>

    <!-- Add new -->
    <div class="shrink-0 px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
      <textarea
        v-model="newContent"
        rows="2"
        class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="Add an instruction for the AI..."
        @keydown.enter.ctrl="addInstruction"
      ></textarea>
      <button
        @click="addInstruction"
        :disabled="!newContent.trim() || adding"
        class="mt-2 w-full px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        Add Instruction
      </button>
    </div>

    <!-- Instructions list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <div v-if="!aiStore.instructions.length" class="text-center py-8">
        <i class="pi pi-info-circle text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
        <p class="text-sm text-surface-400 dark:text-surface-500">No instructions yet</p>
        <p class="text-xs text-surface-400 dark:text-surface-500 mt-1">Add instructions to customize AI behavior</p>
      </div>

      <div
        v-for="inst in aiStore.instructions"
        :key="inst.id"
        class="group flex items-start gap-2 p-3 rounded-lg border transition-colors"
        :class="inst.active
          ? 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50'
          : 'border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20 opacity-50'"
      >
        <!-- Toggle -->
        <button
          @click="toggleActive(inst)"
          class="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
          :class="inst.active
            ? 'bg-primary-500 text-white'
            : 'bg-surface-200 dark:bg-surface-700 text-surface-400'"
          :title="inst.active ? 'Disable' : 'Enable'"
        >
          <i class="pi pi-check text-[8px]" v-if="inst.active"></i>
        </button>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{{ inst.content }}</p>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :class="inst.source === 'feedback'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400'"
            >
              {{ inst.source === 'feedback' ? 'From feedback' : 'Manual' }}
            </span>
          </div>
        </div>

        <!-- Delete -->
        <button
          @click="remove(inst.id)"
          class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-surface-300 dark:text-surface-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Delete"
        >
          <i class="pi pi-trash text-[10px]"></i>
        </button>
      </div>
    </div>
  </div>
</template>
