<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps({
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['send']);
const message = ref('');
const textareaRef = ref(null);
const focused = ref(false);

function send() {
  if (!message.value.trim() || props.disabled) return;
  emit('send', message.value.trim());
  message.value = '';
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  });
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function handleInput() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}
</script>

<template>
  <div class="pb-1">
    <div
      class="flex items-end gap-2 rounded-2xl px-4 py-2 border transition-colors"
      :class="[
        focused ? 'border-primary-500' : 'border-surface-300 dark:border-surface-700',
        'bg-surface-0 dark:bg-surface-800'
      ]"
    >
      <textarea
        ref="textareaRef"
        v-model="message"
        @keydown="handleKeydown"
        @input="handleInput"
        @focus="focused = true"
        @blur="focused = false"
        :disabled="disabled"
        placeholder="Message AI Analytics..."
        rows="1"
        class="flex-1 resize-none border-none outline-none bg-transparent text-surface-900 dark:text-surface-50 text-[15px] leading-6 py-1 max-h-[200px] font-[inherit] placeholder:text-surface-400 disabled:opacity-50 disabled:cursor-not-allowed"
      ></textarea>
      <button
        @click="send"
        :disabled="disabled || !message.trim()"
        class="shrink-0 w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Send message"
      >
        <i class="pi pi-arrow-up text-sm"></i>
      </button>
    </div>
  </div>
</template>
