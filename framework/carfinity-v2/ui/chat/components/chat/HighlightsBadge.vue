<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref } from 'vue'

const props = defineProps({
  highlights: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])
const expanded = ref(false)
</script>

<template>
  <!-- FAB badge (only if highlights available) -->
  <div v-if="highlights.length > 0" class="fixed bottom-6 right-6 z-40">
    <!-- Expanded list -->
    <Transition name="highlights">
      <div
        v-if="expanded"
        class="absolute bottom-16 right-0 w-80 max-h-[400px] overflow-y-auto bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-3 space-y-1.5"
      >
        <p class="text-xs font-semibold text-white/50 px-2 pt-1 pb-2">Data-driven insights</p>
        <button
          v-for="(h, i) in highlights"
          :key="i"
          @click="emit('select', h); expanded = false"
          class="block w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
        >{{ h }}</button>
      </div>
    </Transition>

    <!-- FAB button -->
    <button
      @click="expanded = !expanded"
      class="w-12 h-12 rounded-full bg-sick-gradient shadow-brand-glow flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
    >
      <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 2 5.5-6L21 5M21 5h-5M21 5v5" />
      </svg>
      <!-- Count badge -->
      <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
        {{ highlights.length }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.highlights-enter-active { transition: all 0.2s ease; }
.highlights-leave-active { transition: all 0.15s ease; }
.highlights-enter-from, .highlights-leave-to { opacity: 0; transform: translateY(10px) scale(0.95); }
</style>
