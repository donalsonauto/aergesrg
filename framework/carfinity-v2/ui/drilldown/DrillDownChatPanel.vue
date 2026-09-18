<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { marked } from 'marked';
import { useRouter } from 'vue-router';
import { useAiStore } from '@/stores/ai';
import { formatValue } from '@/composables/useFormatKpi';
import ToolExecutionCard from '@/components/ai/ToolExecutionCard.vue';
import ChatInput from '@/components/ai/ChatInput.vue';

marked.setOptions({ breaks: true, gfm: true });

const props = defineProps({
  metricKey: { type: String, required: true },
  metricName: { type: String, default: '' },
  dataType: { type: String, default: 'int' },
  currentValue: { type: [Number, null], default: null },
  previousValue: { type: [Number, null], default: null },
  lastYearValue: { type: [Number, null], default: null },
  filters: { type: Array, default: () => [] },
  apiParams: { type: Object, default: () => ({}) },
  chat: { type: Object, required: true },
});

const emit = defineEmits(['close']);

const router = useRouter();
const chat = props.chat;
const scrollContainer = ref(null);
const userScrolledUp = ref(false);

// Context-aware suggestions
const suggestions = computed(() => {
  const isDown = (props.currentValue ?? 0) < (props.previousValue ?? 0);
  return [
    `Why is ${props.metricName} ${isDown ? 'down' : 'up'}?`,
    `Break down ${props.metricName} by dealership`,
    `What should I do to improve ${props.metricName}?`,
    `Which lead sources are driving ${props.metricName} the most?`,
    `How does ${props.metricName} compare to last year?`,
  ];
});

// Human-readable tool status
const TOOL_STATUS_LABELS = {
  get_kpi_data: 'Pulling KPI metrics',
  get_drilldown_data: 'Drilling into the data',
  get_dealerships: 'Loading stores',
  get_kpis_list: 'Scanning metrics',
  get_drilldown_options: 'Checking drill-downs',
  get_daily_trend: 'Analyzing daily trends',
  search_knowledge: 'Searching knowledge base',
  get_market_data: 'Comparing to market',
  get_market_trend: 'Loading market trend',
  get_monthly_trend: 'Pulling monthly history',
};

const streamingStatus = computed(() => {
  const running = chat.activeToolCalls.value.filter(tc => tc.status === 'running');
  const completed = chat.activeToolCalls.value.filter(tc => tc.status === 'completed');
  const total = chat.activeToolCalls.value.length;

  if (running.length > 0) {
    const last = running[running.length - 1];
    const action = TOOL_STATUS_LABELS[last.name] || 'Working';
    const count = total > 1 ? ` (${completed.length + 1}/${total})` : '';
    return `${action}${count}`;
  }
  if (total > 0 && completed.length === total) {
    return 'Analyzing results...';
  }
  return 'Thinking...';
});

function sendMessage(text) {
  chat.sendMessage(text, {
    metricName: props.metricName,
    metricKey: props.metricKey,
    currentValue: props.currentValue,
    previousValue: props.previousValue,
    lastYearValue: props.lastYearValue,
    filters: props.filters,
  });
}

function openInFullChat() {
  if (!chat.conversationId.value) return;
  const aiStore = useAiStore();
  aiStore.activeConversationId = chat.conversationId.value;
  aiStore.loadConversation(chat.conversationId.value);
  router.push('/ai-chat');
  emit('close');
}

function renderMarkdown(text) {
  if (!text) return '';
  return marked.parse(text);
}

// Auto-scroll
function isNearBottom() {
  if (!scrollContainer.value) return true;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  return scrollHeight - scrollTop - clientHeight < 60;
}

function scrollToBottom(force = false) {
  if (!force && userScrolledUp.value) return;
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  });
}

function handleScroll() {
  userScrolledUp.value = !isNearBottom();
}

watch(() => chat.messages.value, () => {
  if (isNearBottom()) scrollToBottom();
}, { deep: true });

watch(() => chat.messages.value.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    const last = chat.messages.value[newLen - 1];
    if (last?.role === 'user') {
      userScrolledUp.value = false;
      scrollToBottom(true);
    }
  }
});

// Scroll to bottom when panel opens with existing messages
onMounted(() => {
  if (chat.messages.value.length) {
    scrollToBottom(true);
  }
});
</script>

<template>
  <div class="flex flex-col bg-surface-0 dark:bg-surface-950 border-l border-surface-200 dark:border-surface-800">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-surface-200 dark:border-surface-800 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-5 h-5 rounded-md bg-primary-500 flex items-center justify-center shrink-0">
          <i class="pi pi-sparkles text-white text-[9px]"></i>
        </div>
        <span class="text-sm font-semibold text-surface-800 dark:text-surface-100 truncate">Ask AI</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="chat.conversationId.value"
          @click="openInFullChat"
          class="px-2 py-1 rounded-md text-[11px] font-medium text-primary-500 hover:bg-primary-500/10 transition-colors cursor-pointer whitespace-nowrap"
          title="Open in full chat"
        >
          Open in Chat
          <i class="pi pi-external-link text-[9px] ml-0.5"></i>
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <i class="pi pi-times text-surface-400 text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto"
      @scroll="handleScroll"
    >
      <!-- Empty state with suggestions -->
      <div v-if="!chat.messages.value.length" class="flex flex-col items-center justify-center h-full px-3 text-center">
        <div class="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center mb-3">
          <i class="pi pi-sparkles text-lg text-primary-500"></i>
        </div>
        <p class="text-xs text-surface-500 dark:text-surface-400 mb-4 leading-relaxed max-w-[260px]">
          Ask questions about <span class="font-medium text-surface-700 dark:text-surface-200">{{ metricName }}</span> and get AI-powered insights.
        </p>
        <div class="flex flex-col gap-1.5 w-full">
          <button
            v-for="(q, qi) in suggestions"
            :key="qi"
            @click="sendMessage(q)"
            class="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-xs text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer text-left leading-relaxed"
          >
            {{ q }}
          </button>
        </div>
        <p class="text-[11px] text-surface-400 dark:text-surface-500 mt-3">or ask any question you like</p>
      </div>

      <!-- Messages -->
      <div v-else class="px-3 py-3 space-y-3">
        <template v-for="msg in chat.messages.value" :key="msg.id">
          <!-- User message -->
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[85%] px-3 py-2 rounded-2xl bg-primary-500 text-white text-xs leading-relaxed">
              <span style="white-space: pre-wrap;">{{ msg.content }}</span>
            </div>
          </div>

          <!-- Assistant message -->
          <div v-else>
            <div class="flex items-center gap-1.5 mb-1.5">
              <div class="w-4 h-4 rounded bg-primary-500 flex items-center justify-center shrink-0">
                <i class="pi pi-sparkles text-white text-[7px]"></i>
              </div>
              <span class="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">AI</span>
            </div>

            <!-- Blocks -->
            <template v-if="msg.blocks && msg.blocks.length">
              <template v-for="(block, idx) in msg.blocks" :key="'block-' + idx">
                <!-- Text block -->
                <div
                  v-if="block.type === 'text' && block.content"
                  class="drilldown-ai-message pl-5 text-xs leading-relaxed text-surface-800 dark:text-surface-200"
                  :class="{ 'mt-2': idx > 0 }"
                >
                  <div v-html="renderMarkdown(block.content)"></div>
                </div>
                <!-- Tool block -->
                <div v-else-if="block.type === 'tool'" class="mb-1 pl-5">
                  <ToolExecutionCard :toolCall="block" />
                </div>
              </template>
            </template>

            <!-- Fallback: plain content -->
            <template v-else>
              <div
                v-if="msg.content"
                class="drilldown-ai-message pl-5 text-xs leading-relaxed text-surface-800 dark:text-surface-200"
              >
                <div v-html="renderMarkdown(msg.content)"></div>
              </div>
            </template>

            <!-- Streaming status -->
            <div
              v-if="msg.id === 'streaming' && chat.isStreaming.value"
              class="pl-5 mt-1.5"
            >
              <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary-500/5 dark:bg-primary-500/10 border border-primary-500/10">
                <svg class="w-3 h-3 text-primary-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span class="text-[10px] text-primary-400 font-medium truncate max-w-[220px]">{{ streamingStatus }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Input -->
    <div class="shrink-0 px-2 pb-2">
      <ChatInput :disabled="chat.isStreaming.value" @send="sendMessage" />
    </div>
  </div>
</template>

<style>
/* Scoped markdown styles for drill-down chat (smaller scale) */
.drilldown-ai-message h1,
.drilldown-ai-message h2,
.drilldown-ai-message h3 {
  font-weight: 600;
  margin-top: 0.6rem;
  margin-bottom: 0.3rem;
  line-height: 1.4;
}
.drilldown-ai-message h1 { font-size: 0.875rem; }
.drilldown-ai-message h2 { font-size: 0.8125rem; }
.drilldown-ai-message h3 { font-size: 0.75rem; }
.drilldown-ai-message h1:first-child,
.drilldown-ai-message h2:first-child,
.drilldown-ai-message h3:first-child {
  margin-top: 0;
}
.drilldown-ai-message p {
  margin: 0.35rem 0;
}
.drilldown-ai-message p:first-child { margin-top: 0; }
.drilldown-ai-message p:last-child { margin-bottom: 0; }
.drilldown-ai-message ul,
.drilldown-ai-message ol {
  margin: 0.35rem 0;
  padding-left: 1.25rem;
}
.drilldown-ai-message li {
  margin: 0.15rem 0;
}
.drilldown-ai-message strong {
  font-weight: 600;
}
.drilldown-ai-message code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  font-size: 0.6875rem;
}
.app-dark .drilldown-ai-message code {
  background: rgba(255, 255, 255, 0.1);
}
.drilldown-ai-message table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.6875rem;
  display: block;
  overflow-x: auto;
}
.drilldown-ai-message th,
.drilldown-ai-message td {
  padding: 0.3rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}
.app-dark .drilldown-ai-message th,
.app-dark .drilldown-ai-message td {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.drilldown-ai-message th {
  font-weight: 600;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: var(--p-surface-500);
}
.drilldown-ai-message blockquote {
  border-left: 2px solid var(--p-primary-500);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: var(--p-surface-600);
}
.app-dark .drilldown-ai-message blockquote {
  color: var(--p-surface-400);
}
</style>
