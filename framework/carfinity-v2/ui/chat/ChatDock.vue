<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAiStore } from '@/chat/stores/ai';

// App-wide AI chat launcher. The chat itself is the routed /ai-chat page —
// it owns a real URL, and one unique URL per conversation (/ai-chat/:id), so
// any chat is linkable and referenceable. This component is just the floating
// button plus a handler for external "open chat" requests (e.g. the
// dashboard's per-KPI chat icons); both navigate to /ai-chat.

const route = useRoute();
const router = useRouter();
const aiStore = useAiStore();

// No floating button while already on the chat page.
const onChatPage = computed(() => route.path.startsWith('/ai-chat'));

function openChat() {
  if (!onChatPage.value) router.push('/ai-chat');
}

// External open requests carry an optional starter question (KPI chat icons).
// Navigate to /ai-chat, then hand the starter to the chat widget once it has
// mounted its pendingQuestion watcher.
watch(() => aiStore.dockOpenRequest, async () => {
  const starter = aiStore.consumeDockStarter();
  const alreadyThere = onChatPage.value;
  if (!alreadyThere) await router.push('/ai-chat');
  if (starter?.text) {
    setTimeout(
      () => aiStore.setPendingQuestion(starter.text, starter.context || {}),
      alreadyThere ? 0 : 120,
    );
  }
});
</script>

<template>
  <button
    v-if="!onChatPage"
    class="chat-dock-fab"
    aria-label="Open AI chat"
    @click="openChat"
  >
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  </button>
</template>

<style scoped>
.chat-dock-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.6);
  border: none;
  cursor: pointer;
  z-index: 900;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.chat-dock-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px rgba(99, 102, 241, 0.7);
}
</style>
