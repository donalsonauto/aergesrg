<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
const props = defineProps({
  dimensions: { type: Array, default: () => [] },
  selected: { type: String, default: null },
});

const emit = defineEmits(['select']);

function formatLabel(dim) {
  if (!dim) return '';
  return dim
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/^Sale Person$/, 'Salesperson')
    .trim();
}
</script>

<template>
  <div v-if="dimensions.length > 0" class="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
    <span class="text-[10px] sm:text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mr-0.5 sm:mr-1">Break down by</span>
    <button
      v-for="dim in dimensions"
      :key="dim"
      @click="emit('select', dim)"
      class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all cursor-pointer"
      :class="selected === dim
        ? 'bg-primary-500 text-white shadow-sm'
        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'"
    >
      {{ formatLabel(dim) }}
    </button>
  </div>
</template>
