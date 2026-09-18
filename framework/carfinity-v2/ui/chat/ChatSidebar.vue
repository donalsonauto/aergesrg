<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref } from 'vue';

const props = defineProps({
  conversations: { type: Object, default: () => ({}) },
  activeId: { type: String, default: null },
  usage: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['select', 'create', 'delete']);

const hoveredId = ref(null);

function formatCost(cost) {
  if (cost == null) return '$0.00';
  return '$' + Number(cost).toFixed(2);
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface-50 dark:bg-surface-900">
    <!-- New Chat button -->
    <div class="p-3">
      <Button
        @click="emit('create')"
        label="New Chat"
        icon="pi pi-plus"
        outlined
        class="w-full"
      />
    </div>

    <!-- Conversation list -->
    <div class="flex-1 overflow-y-auto px-2">
      <!-- Today -->
      <template v-if="conversations.today?.length">
        <div class="px-2 py-1.5 text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
          Today
        </div>
        <div
          v-for="conv in conversations.today"
          :key="conv.id"
          @click="emit('select', conv.id)"
          @mouseenter="hoveredId = conv.id"
          @mouseleave="hoveredId = null"
          class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors"
          :class="conv.id === activeId
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
        >
          <span class="flex-1 truncate">{{ conv.title || 'New Chat' }}</span>
          <button
            v-show="hoveredId === conv.id"
            @click.stop="emit('delete', conv.id)"
            class="shrink-0 p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-red-500 transition-colors"
            title="Delete conversation"
          >
            <i class="pi pi-trash text-xs"></i>
          </button>
        </div>
      </template>

      <!-- Yesterday -->
      <template v-if="conversations.yesterday?.length">
        <div class="px-2 py-1.5 mt-2 text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
          Yesterday
        </div>
        <div
          v-for="conv in conversations.yesterday"
          :key="conv.id"
          @click="emit('select', conv.id)"
          @mouseenter="hoveredId = conv.id"
          @mouseleave="hoveredId = null"
          class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors"
          :class="conv.id === activeId
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
        >
          <span class="flex-1 truncate">{{ conv.title || 'New Chat' }}</span>
          <button
            v-show="hoveredId === conv.id"
            @click.stop="emit('delete', conv.id)"
            class="shrink-0 p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-red-500 transition-colors"
            title="Delete conversation"
          >
            <i class="pi pi-trash text-xs"></i>
          </button>
        </div>
      </template>

      <!-- This Week -->
      <template v-if="conversations.thisWeek?.length">
        <div class="px-2 py-1.5 mt-2 text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
          This Week
        </div>
        <div
          v-for="conv in conversations.thisWeek"
          :key="conv.id"
          @click="emit('select', conv.id)"
          @mouseenter="hoveredId = conv.id"
          @mouseleave="hoveredId = null"
          class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors"
          :class="conv.id === activeId
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
        >
          <span class="flex-1 truncate">{{ conv.title || 'New Chat' }}</span>
          <button
            v-show="hoveredId === conv.id"
            @click.stop="emit('delete', conv.id)"
            class="shrink-0 p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-red-500 transition-colors"
            title="Delete conversation"
          >
            <i class="pi pi-trash text-xs"></i>
          </button>
        </div>
      </template>

      <!-- Older -->
      <template v-if="conversations.older?.length">
        <div class="px-2 py-1.5 mt-2 text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
          Older
        </div>
        <div
          v-for="conv in conversations.older"
          :key="conv.id"
          @click="emit('select', conv.id)"
          @mouseenter="hoveredId = conv.id"
          @mouseleave="hoveredId = null"
          class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors"
          :class="conv.id === activeId
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
        >
          <span class="flex-1 truncate">{{ conv.title || 'New Chat' }}</span>
          <button
            v-show="hoveredId === conv.id"
            @click.stop="emit('delete', conv.id)"
            class="shrink-0 p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-red-500 transition-colors"
            title="Delete conversation"
          >
            <i class="pi pi-trash text-xs"></i>
          </button>
        </div>
      </template>

      <!-- Empty state -->
      <div
        v-if="!conversations.today?.length && !conversations.yesterday?.length && !conversations.thisWeek?.length && !conversations.older?.length"
        class="px-3 py-6 text-center text-sm text-surface-400 dark:text-surface-500"
      >
        No conversations yet
      </div>
    </div>

    <!-- Usage summary -->
    <div class="p-3 border-t border-surface-200 dark:border-surface-700">
      <div class="text-xs text-surface-500 dark:text-surface-400 text-center">
        Usage: {{ formatCost(usage.totalCost) }}
      </div>
    </div>
  </div>
</template>
