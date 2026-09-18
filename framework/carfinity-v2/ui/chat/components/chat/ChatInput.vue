<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['send'])
const message = ref('')
const textareaRef = ref(null)
const focused = ref(false)

function send() {
  if (!message.value.trim() || props.disabled) return
  emit('send', message.value.trim())
  message.value = ''
  nextTick(() => {
    if (textareaRef.value) textareaRef.value.style.height = 'auto'
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function handleInput() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
</script>

<template>
  <div class="pb-1">
    <div
      class="flex items-end gap-2 rounded-2xl px-4 py-2 border transition-colors"
      :class="focused ? 'border-brand-purple' : 'border-white/10'"
      style="background: rgba(255,255,255,0.03);"
    >
      <textarea
        ref="textareaRef"
        v-model="message"
        @keydown="handleKeydown"
        @input="handleInput"
        @focus="focused = true"
        @blur="focused = false"
        :disabled="disabled"
        placeholder="Ask about your GA4 data, ASC events, or website performance..."
        rows="1"
        class="flex-1 resize-none border-none outline-none bg-transparent text-white text-[15px] leading-6 py-1 max-h-[200px] font-[inherit] placeholder:text-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
      ></textarea>
      <button
        @click="send"
        :disabled="disabled || !message.trim()"
        class="shrink-0 w-8 h-8 rounded-full bg-sick-gradient hover:opacity-90 text-white flex items-center justify-center cursor-pointer transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
        aria-label="Send message"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </div>
  </div>
</template>
