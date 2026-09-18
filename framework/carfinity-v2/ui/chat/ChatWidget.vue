<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAiStore } from '@/stores/ai';
import { useSettingsStore } from '@/stores/settings';
import { useDealerStore } from '@/stores/dealer';
import ChatMessages from './ChatMessages.vue';
import ChatInput from './ChatInput.vue';
import ReportPanel from './ReportPanel.vue';
import InstructionsPanel from './InstructionsPanel.vue';
import EventsPanel from './EventsPanel.vue';
import KnowledgePanel from './KnowledgePanel.vue';
import { useTTS } from '@/composables/useTTS.js';

const router = useRouter();
const aiStore = useAiStore();
const tts = useTTS();
const chatMessagesRef = ref(null);
const settings = useSettingsStore();
const dealerStore = useDealerStore();
const isOpen = ref(false);
const showReport = ref(false);
const showInstructions = ref(false);
const showEvents = ref(false);
const showKnowledge = ref(false);
const knowledgeOpenDocId = ref(null);
const hoverConvId = ref(null);
const showMobileSidebar = ref(false);

// Pre-fetch highlights when the component mounts so the FAB badge can show alerts
onMounted(() => {
  const dgId = settings.dealerGroupId;
  if (dgId) {
    aiStore.fetchHighlights(dgId, settings.year, settings.month + 1);
  }
});

const hasAlerts = computed(() => {
  // Show alert badge if highlights contain decline-related content
  return aiStore.highlights.some(h =>
    h.includes('down') || h.includes('dropped') || h.includes('decline') || h.includes('rose to')
  );
});

function openChat() {
  // Save where we came from so we can navigate back on close
  if (!aiStore.originRoute) {
    aiStore.originRoute = router.currentRoute.value.fullPath;
  }
  isOpen.value = true;
  aiStore.fetchConversations();
  aiStore.fetchUsage();
  aiStore.fetchTimeSaved();
  // Fetch data-driven highlights for the current dealer context
  const dgId = settings.dealerGroupId;
  if (dgId) {
    aiStore.fetchHighlights(dgId, settings.year, settings.month + 1);
  }
}

function closeChat() {
  isOpen.value = false;
  // If we're on /ai-chat and came from somewhere else, go back
  const origin = aiStore.originRoute;
  if (router.currentRoute.value.path === '/ai-chat' && origin && origin !== '/ai-chat') {
    router.push(origin);
  }
  aiStore.originRoute = null;
}

function handleNewChat() {
  aiStore.activeConversationId = null;
  aiStore.messages = [];
}

async function handleSendMessage(text) {
  if (!aiStore.activeConversationId) {
    await aiStore.createConversation();
  }
  // Pass dealer context so AI knows which dealer group the user is viewing
  const dealerGroupId = settings.dealerGroupId;
  const dealer = dealerGroupId ? dealerStore.getDealer(dealerGroupId) : null;
  aiStore.sendMessage(text, {
    dealerGroupId,
    dealerGroupName: dealer?.name || null,
    dealerShipId: settings.dealerShipId || '0',
    year: settings.year,
    month: settings.month + 1, // convert 0-indexed to 1-indexed
  });
}

function selectConversation(id) {
  aiStore.loadConversation(id);
  showMobileSidebar.value = false;
}

function handleDeleteConversation(id, event) {
  event.stopPropagation();
  aiStore.deleteConversation(id);
}

function toggleInstructions() {
  showInstructions.value = !showInstructions.value;
  if (showInstructions.value) { showEvents.value = false; showKnowledge.value = false; }
}

function toggleEvents() {
  showEvents.value = !showEvents.value;
  if (showEvents.value) { showInstructions.value = false; showKnowledge.value = false; }
}

function toggleKnowledge() {
  showKnowledge.value = !showKnowledge.value;
  knowledgeOpenDocId.value = null;
  if (showKnowledge.value) { showInstructions.value = false; showEvents.value = false; }
}

function handleTTSToggle() {
  if (tts.isPlaying.value) {
    tts.stop();
    return;
  }
  const container = chatMessagesRef.value?.$el?.querySelector('.overflow-y-auto') || chatMessagesRef.value?.$el;
  if (aiStore.isStreaming) {
    tts.startLive(() => aiStore.streamingText, container);
  } else {
    const lastMsg = [...aiStore.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (lastMsg) {
      tts.playCompleted(lastMsg.content, container, () => lastMsg.blocks || []);
    }
  }
}

// When streaming ends, flush remaining TTS text
watch(() => aiStore.isStreaming, (val) => {
  if (!val && tts.isPlaying.value) {
    tts.onStreamEnd();
  }
});

function openKnowledgeDoc(docId) {
  showKnowledge.value = true;
  knowledgeOpenDocId.value = docId;
  showInstructions.value = false;
  showEvents.value = false;
}

async function handleFeedback({ content, sourceMessageId }) {
  await aiStore.addInstruction(content, 'feedback', sourceMessageId);
}

const currentDealerName = computed(() => {
  const dgId = settings.dealerGroupId;
  if (!dgId) return '';
  const dealer = dealerStore.getDealer(dgId);
  return dealer?.name || '';
});

const timeSavedFormatted = computed(() => {
  const mins = aiStore.timeSaved?.this_month || 0;
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} hrs`;
});

const todayTimeSavedFormatted = computed(() => {
  const mins = aiStore.timeSaved?.today || 0;
  const monthMins = aiStore.timeSaved?.this_month || 0;
  // Only show today if it's different from monthly (otherwise it's redundant)
  if (mins <= 0 || mins >= monthMins) return '';
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} hrs`;
});

const streamingTimeSavedFormatted = computed(() => {
  const mins = aiStore.streamingTimeSaved;
  if (!mins || mins <= 0) return '';
  if (mins < 60) return `~${Math.round(mins)} min`;
  return `~${(mins / 60).toFixed(1)} hrs`;
});

const showTimeSavedInfo = ref(false);

// Close report panel when switching conversations (hide by default)
watch(() => aiStore.activeConversationId, () => {
  showReport.value = false;
});

// Watch for pending questions (e.g. from "Do This Now" highlights or DailyPulse)
watch(() => aiStore.pendingQuestion, async (pq) => {
  if (!pq) return;
  // Save origin route before opening chat
  if (!aiStore.originRoute) {
    aiStore.originRoute = router.currentRoute.value.fullPath;
  }
  const { text, context } = aiStore.consumePendingQuestion();
  if (!text) return;
  // Open widget, start new conversation, send
  isOpen.value = true;
  aiStore.fetchConversations();
  await aiStore.createConversation();
  aiStore.sendMessage(text, context);
});

function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (showTimeSavedInfo.value) {
      showTimeSavedInfo.value = false;
    } else if (isOpen.value) {
      closeChat();
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- FAB button -->
  <Transition name="fab">
    <button
      v-if="!isOpen"
      @click="openChat"
      class="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer group"
      aria-label="AI Chat"
    >
      <span class="text-sm font-extrabold tracking-tight leading-none">AI<span class="text-white/80">+</span></span>
      <!-- Alert badge when there are significant KPI changes -->
      <span
        v-if="hasAlerts"
        class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-surface-950 animate-pulse"
      ></span>
    </button>
  </Transition>

  <!-- Full-screen overlay -->
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex bg-surface-950"
      >
        <!-- Mobile sidebar backdrop -->
        <Transition name="fade">
          <div
            v-if="showMobileSidebar"
            class="fixed inset-0 bg-black/50 z-[10000] md:hidden"
            @click="showMobileSidebar = false"
          ></div>
        </Transition>

        <!-- Left sidebar: conversations -->
        <div
          class="shrink-0 flex flex-col bg-surface-900 border-r border-surface-700/50 transition-transform duration-200 z-[10001]"
          :class="[
            'fixed inset-y-0 left-0 w-[260px] md:static md:translate-x-0',
            showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
          ]"
        >
          <!-- Sidebar header -->
          <div class="shrink-0 flex items-center px-4 py-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <i class="pi pi-sparkles text-white text-sm"></i>
              </div>
              <span class="text-sm font-semibold text-surface-100">AI Analytics</span>
            </div>
          </div>

          <!-- New chat button -->
          <div class="px-3 pb-3">
            <button
              @click="handleNewChat"
              class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-surface-700/50 text-sm font-medium text-surface-200 hover:bg-surface-800 transition-colors cursor-pointer"
            >
              <i class="pi pi-plus text-xs"></i>
              New chat
            </button>
          </div>

          <!-- Conversations list -->
          <div class="flex-1 overflow-y-auto px-2 space-y-4 chat-sidebar-scroll">
            <!-- Today -->
            <div v-if="aiStore.groupedConversations.today.length">
              <div class="px-2 py-1.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Today</div>
              <div class="space-y-0.5">
                <div
                  v-for="conv in aiStore.groupedConversations.today"
                  :key="conv.id"
                  @click="selectConversation(conv.id)"
                  @mouseenter="hoverConvId = conv.id"
                  @mouseleave="hoverConvId = null"
                  class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="aiStore.activeConversationId === conv.id ? 'bg-surface-700/60 text-surface-50' : 'text-surface-300 hover:bg-surface-800'"
                >
                  <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
                  <button
                    v-show="hoverConvId === conv.id"
                    @click="handleDeleteConversation(conv.id, $event)"
                    class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors cursor-pointer"
                  >
                    <i class="pi pi-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Yesterday -->
            <div v-if="aiStore.groupedConversations.yesterday.length">
              <div class="px-2 py-1.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Yesterday</div>
              <div class="space-y-0.5">
                <div
                  v-for="conv in aiStore.groupedConversations.yesterday"
                  :key="conv.id"
                  @click="selectConversation(conv.id)"
                  @mouseenter="hoverConvId = conv.id"
                  @mouseleave="hoverConvId = null"
                  class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="aiStore.activeConversationId === conv.id ? 'bg-surface-700/60 text-surface-50' : 'text-surface-300 hover:bg-surface-800'"
                >
                  <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
                  <button
                    v-show="hoverConvId === conv.id"
                    @click="handleDeleteConversation(conv.id, $event)"
                    class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors cursor-pointer"
                  >
                    <i class="pi pi-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- This Week -->
            <div v-if="aiStore.groupedConversations.thisWeek.length">
              <div class="px-2 py-1.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">This Week</div>
              <div class="space-y-0.5">
                <div
                  v-for="conv in aiStore.groupedConversations.thisWeek"
                  :key="conv.id"
                  @click="selectConversation(conv.id)"
                  @mouseenter="hoverConvId = conv.id"
                  @mouseleave="hoverConvId = null"
                  class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="aiStore.activeConversationId === conv.id ? 'bg-surface-700/60 text-surface-50' : 'text-surface-300 hover:bg-surface-800'"
                >
                  <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
                  <button
                    v-show="hoverConvId === conv.id"
                    @click="handleDeleteConversation(conv.id, $event)"
                    class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors cursor-pointer"
                  >
                    <i class="pi pi-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Older -->
            <div v-if="aiStore.groupedConversations.older.length">
              <div class="px-2 py-1.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Older</div>
              <div class="space-y-0.5">
                <div
                  v-for="conv in aiStore.groupedConversations.older"
                  :key="conv.id"
                  @click="selectConversation(conv.id)"
                  @mouseenter="hoverConvId = conv.id"
                  @mouseleave="hoverConvId = null"
                  class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="aiStore.activeConversationId === conv.id ? 'bg-surface-700/60 text-surface-50' : 'text-surface-300 hover:bg-surface-800'"
                >
                  <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
                  <button
                    v-show="hoverConvId === conv.id"
                    @click="handleDeleteConversation(conv.id, $event)"
                    class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors cursor-pointer"
                  >
                    <i class="pi pi-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="!aiStore.conversations.length && !aiStore.loading"
              class="px-3 py-6 text-center"
            >
              <p class="text-sm text-surface-500">No conversations yet</p>
            </div>
          </div>

          <!-- Usage footer -->
          <div v-if="aiStore.usage.totalCost" class="shrink-0 px-4 py-3 border-t border-surface-700/50">
            <div class="text-[11px] text-surface-500">
              Usage: ${{ aiStore.usage.totalCost?.toFixed(2) || '0.00' }}
            </div>
          </div>
        </div>

        <!-- Center: chat area -->
        <div class="flex-1 flex flex-col bg-surface-950 min-w-0">
          <!-- Chat header -->
          <div class="shrink-0 border-b border-surface-800 bg-surface-950">
            <div class="flex items-center justify-between px-3 sm:px-6 py-3 gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <!-- Mobile sidebar toggle -->
                <button
                  @click="showMobileSidebar = !showMobileSidebar"
                  class="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors cursor-pointer shrink-0"
                >
                  <i class="pi pi-bars text-sm"></i>
                </button>
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-semibold text-surface-100 leading-tight truncate">
                    {{ aiStore.activeConversation?.title || 'New Chat' }}
                  </span>
                  <span class="text-[11px] text-surface-500 leading-tight hidden sm:block">
                    Ask anything about your dealership data
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <!-- Instructions toggle -->
                <button
                  @click="toggleInstructions"
                  class="w-8 h-8 sm:w-auto sm:h-auto inline-flex items-center justify-center sm:justify-start gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  :class="showInstructions
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'"
                  title="Custom Instructions"
                >
                  <i class="pi pi-brain text-xs"></i>
                </button>
                <!-- Events toggle -->
                <button
                  @click="toggleEvents"
                  class="w-8 h-8 sm:w-auto sm:h-auto inline-flex items-center justify-center sm:justify-start gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  :class="showEvents
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'"
                  title="Business Events"
                >
                  <i class="pi pi-calendar text-xs"></i>
                </button>
                <!-- Knowledge Base toggle (hide on very small screens) -->
                <button
                  @click="toggleKnowledge"
                  class="hidden sm:inline-flex w-8 h-8 sm:w-auto sm:h-auto items-center justify-center sm:justify-start gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  :class="showKnowledge
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'"
                  title="Knowledge Base (RAG)"
                >
                  <i class="pi pi-book text-xs"></i>
                </button>
                <!-- Report toggle -->
                <button
                  @click="showReport = !showReport"
                  class="w-8 h-8 sm:w-auto sm:h-auto inline-flex items-center justify-center sm:justify-start gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  :class="showReport
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'"
                >
                  <i class="pi pi-file-edit text-xs"></i>
                  <span class="hidden sm:inline">Report</span>
                </button>
                <!-- TTS Play/Stop -->
                <button
                  @click="handleTTSToggle"
                  class="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  :class="tts.isPlaying.value || tts.isLoading.value
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'"
                  :title="tts.isPlaying.value ? 'Stop reading' : 'Read aloud'"
                >
                  <svg v-if="tts.isLoading.value && !tts.isPlaying.value" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <i v-else :class="tts.isPlaying.value ? 'pi pi-stop' : 'pi pi-volume-up'" class="text-xs"></i>
                </button>
                <!-- Close -->
                <button
                  @click="closeChat"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <i class="pi pi-times text-sm"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Messages area -->
          <ChatMessages
            ref="chatMessagesRef"
            :messages="aiStore.messages"
            :isStreaming="aiStore.isStreaming"
            :activeToolCalls="aiStore.activeToolCalls"
            :highlights="aiStore.highlights"
            :highlightsLoading="aiStore.highlightsLoading"
            :dealerGroupName="currentDealerName"
            class="flex-1 overflow-hidden"
            @suggestion="handleSendMessage"
            @feedback="handleFeedback"
            @openKnowledgeDoc="openKnowledgeDoc"
          />

          <!-- Input area -->
          <div class="shrink-0 max-w-[700px] w-full mx-auto px-2 sm:px-4">
            <ChatInput
              :disabled="aiStore.isStreaming"
              @send="handleSendMessage"
            />
            <div class="flex items-center justify-center gap-2 sm:gap-3 pb-3 pt-1 flex-wrap px-2">
              <!-- Time saved (real-time during streaming, or cumulative) -->
              <div v-if="aiStore.isStreaming && aiStore.streamingTimeSaved > 0" class="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <i class="pi pi-spin pi-spinner text-[9px]"></i>
                <span class="tabular-nums">{{ streamingTimeSavedFormatted }} saved so far</span>
              </div>
              <div v-else-if="aiStore.timeSaved?.this_month" class="flex items-center gap-1 text-[11px] text-emerald-400 relative">
                <i class="pi pi-clock text-[9px]"></i>
                <span>{{ timeSavedFormatted }} saved this month</span>
                <span v-if="todayTimeSavedFormatted" class="text-emerald-400/50">·</span>
                <span v-if="todayTimeSavedFormatted">{{ todayTimeSavedFormatted }} today</span>
                <button
                  @click.stop="showTimeSavedInfo = !showTimeSavedInfo"
                  class="ml-0.5 cursor-pointer"
                  title="How is this calculated?"
                >
                  <i class="pi pi-info-circle text-[11px] text-emerald-400/60 hover:text-emerald-400 transition-colors"></i>
                </button>
                <!-- Info tooltip -->
                <div
                  v-if="showTimeSavedInfo"
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg bg-surface-800 border border-surface-600 text-[10px] text-surface-300 shadow-xl z-50 leading-relaxed"
                >
                  <p class="font-semibold text-surface-100 mb-1.5">How time saved is calculated</p>
                  <p class="mb-1">Each AI tool call estimates how long a human analyst would take manually:</p>
                  <div class="space-y-0.5 text-surface-400">
                    <div class="flex justify-between"><span>KPI lookup</span><span>3 min</span></div>
                    <div class="flex justify-between"><span>Drilldown analysis</span><span>8 min</span></div>
                    <div class="flex justify-between"><span>Daily trend check</span><span>5 min</span></div>
                    <div class="flex justify-between"><span>Knowledge search</span><span>10 min</span></div>
                    <div class="flex justify-between"><span>Base per analysis</span><span>5 min</span></div>
                  </div>
                  <p class="mt-1.5 text-surface-500 italic">Multi-store analyses add extra time per store.</p>
                </div>
              </div>
              <span v-if="aiStore.timeSaved?.this_month || (aiStore.isStreaming && aiStore.streamingTimeSaved > 0)" class="text-surface-700">·</span>
              <span class="text-[11px] text-surface-500">
                AI can make mistakes. Verify important information.
              </span>
              <span class="text-surface-600 hidden sm:inline">·</span>
              <span class="text-[11px] text-surface-600 hidden sm:inline">
                Select text &amp; click <span class="text-primary-400 font-medium">Improve</span> to help train the model
              </span>
            </div>
          </div>
        </div>

        <!-- Instructions panel -->
        <transition name="slide-report">
          <div v-if="showInstructions" class="fixed inset-0 md:static md:inset-auto w-full md:w-[340px] shrink-0 z-[10002] md:z-auto">
            <InstructionsPanel @close="showInstructions = false" class="h-full" />
          </div>
        </transition>

        <!-- Events panel -->
        <transition name="slide-report">
          <div v-if="showEvents" class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] shrink-0 z-[10002] md:z-auto">
            <EventsPanel @close="showEvents = false" class="h-full" />
          </div>
        </transition>

        <!-- Knowledge Base panel -->
        <transition name="slide-report">
          <div v-if="showKnowledge" class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] shrink-0 z-[10002] md:z-auto">
            <KnowledgePanel :openDocId="knowledgeOpenDocId" @close="showKnowledge = false" class="h-full" />
          </div>
        </transition>

        <!-- Right: Report panel -->
        <transition name="slide-report">
          <div
            v-if="showReport"
            class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] xl:w-[420px] shrink-0 z-[10002] md:z-auto"
          >
            <ReportPanel
              :reportSections="aiStore.reportSections"
              :isStreaming="aiStore.isStreaming"
              :analysisYear="settings.year"
              :analysisMonth="settings.month + 1"
              @openKnowledgeDoc="openKnowledgeDoc"
              @close="showReport = false"
            />
          </div>
        </transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fab-enter-active,
.fab-leave-active {
  transition: all 0.2s ease;
}
.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: scale(0);
}

.overlay-enter-active {
  transition: opacity 0.2s ease;
}
.overlay-leave-active {
  transition: opacity 0.15s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.slide-report-enter-active,
.slide-report-leave-active {
  transition: width 0.25s ease, opacity 0.25s ease;
  overflow: hidden;
}
.slide-report-enter-from,
.slide-report-leave-to {
  width: 0 !important;
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.chat-sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.chat-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.chat-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.chat-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
