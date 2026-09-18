<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import ToolExecutionCard from './ToolExecutionCard.vue';
import InlineMarketChart from './InlineMarketChart.vue';
import InlineTrendChart from './InlineTrendChart.vue';
import InlineMonthlyTrendChart from './InlineMonthlyTrendChart.vue';
import KpiDrillDownOverlay from '@/components/drilldown/KpiDrillDownOverlay.vue';
import { useSettingsStore } from '@/stores/settings';
import { useTTS } from '@/composables/useTTS.js';
import { formatValue } from '@/composables/useFormatKpi';
// Configure marked for safe output
marked.setOptions({
  breaks: true,
  gfm: true,
});

const props = defineProps({
  messages: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  activeToolCalls: { type: Array, default: () => [] },
  highlights: { type: Array, default: () => [] },
  highlightsLoading: { type: Boolean, default: false },
  dealerGroupName: { type: String, default: '' }
});

const emit = defineEmits(['suggestion', 'feedback', 'openKnowledgeDoc']);

const tts = useTTS();
const settingsStore = useSettingsStore();

// Drill-down state for KPI card clicks
const chatDrillDownMetric = ref(null);

function openChatDrillDown(card) {
  const result = card.result || card;
  chatDrillDownMetric.value = {
    key: result.fullUid || result.metricKey || card.args?.metricKey || '',
    name: result.fullName || result.name || formatKpiKey(card.args?.metricKey),
    dataType: result.dataType || 'int',
    currentValue: typeof result.current === 'object' ? result.current?.value : result.current,
    previousValue: typeof result.previous === 'object' ? result.previous?.value : result.previous,
    lastYearValue: typeof result.lastYear === 'object' ? result.lastYear?.value : result.lastYear,
    apiColor: result.previous?.color || null,
  };
}

function closeChatDrillDown() {
  chatDrillDownMetric.value = null;
}

function handleChatDrillDownNav(kpi) {
  closeChatDrillDown();
  nextTick(() => {
    chatDrillDownMetric.value = {
      key: kpi.key || kpi.fullUid || '',
      name: kpi.name || kpi.fullName || '',
      dataType: kpi.dataType || 'int',
      currentValue: kpi.current?.value ?? kpi.current ?? null,
      previousValue: kpi.previous?.value ?? kpi.previous ?? null,
      lastYearValue: kpi.lastYear?.value ?? kpi.lastYear ?? null,
    };
  });
}

const container = ref(null);
const userScrolledUp = ref(false);
const feedbackMsgId = ref(null);
const feedbackText = ref('');

// Randomized suggestion questions pool
const SUGGESTION_POOL = [
  "Why are my sales down this month?",
  "Which store has the lowest closing ratio?",
  "Compare leads by source across all stores",
  "How is our F&I back gross trending?",
  "Which salesperson is performing best?",
  "Are we getting enough website leads?",
  "What's our best performing lead source?",
  "How do used car sales compare to last year?",
  "Which store needs the most attention?",
  "What's driving the change in gross profit?",
  "How are internet leads converting to sales?",
  "Compare this month's performance to last year",
  "Which lead sources have the best ROI?",
  "Show me the daily sales trend",
  "Are we pacing ahead or behind last month?",
  "Which store improved the most this month?",
  "Break down sales by new vs used",
  "What happened to our front gross per unit?",
  "Analyze our appointment show rate",
  "How is walk-in traffic trending?",
  "Which stores are losing the most leads?",
  "What's our cost per sale by lead source?",
  "How does our service revenue compare to last month?",
  "Show me closing ratios by salesperson",
  "Are there any data gaps at our stores?",
  "Compare new car vs used car gross profit",
  "Which lead type converts best?",
  "How are our third-party leads performing?",
];

const currentSuggestions = ref([]);

function shuffleSuggestions() {
  const pool = [...SUGGESTION_POOL];
  const picks = [];
  for (let i = 0; i < 5 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  currentSuggestions.value = picks;
}

// Reshuffle when messages go empty (new chat)
watch(() => props.messages.length, (len) => {
  if (len === 0) shuffleSuggestions();
});

// Effective suggestions: prefer data-driven highlights, fall back to random pool
const effectiveSuggestions = computed(() => {
  if (props.highlights.length > 0) return props.highlights;
  return currentSuggestions.value;
});

onMounted(() => {
  shuffleSuggestions();
});

// Selection-based feedback (floating popup)
const selectedText = ref('');
const selectionMsgId = ref(null);
const selectionPos = ref({ x: 0, y: 0 });
const showImproveBtn = ref(false);
const showImprovePopup = ref(false);
const popupFeedbackText = ref('');
const popupTextarea = ref(null);
const popupSaved = ref(false);

function openFeedback(msgId) {
  feedbackMsgId.value = msgId;
  feedbackText.value = '';
}

function cancelFeedback() {
  feedbackMsgId.value = null;
  feedbackText.value = '';
}

function submitFeedback() {
  if (!feedbackText.value.trim()) return;
  emit('feedback', { content: feedbackText.value.trim(), sourceMessageId: feedbackMsgId.value });
  feedbackMsgId.value = null;
  feedbackText.value = '';
}

function handleTextSelect(event, msgId) {
  // Small delay to let the browser finalize the selection
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 3) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerEl = container.value;
      const containerRect = containerEl?.getBoundingClientRect();
      if (containerRect) {
        selectionPos.value = {
          x: Math.min(rect.right, containerRect.right - 140) - containerRect.left,
          y: rect.top - containerRect.top + containerEl.scrollTop - 36
        };
      }
      selectedText.value = text;
      selectionMsgId.value = msgId;
      showImproveBtn.value = true;
      showImprovePopup.value = false;
    } else {
      showImproveBtn.value = false;
    }
  }, 10);
}

function openImprovePopup() {
  showImproveBtn.value = false;
  showImprovePopup.value = true;
  popupFeedbackText.value = '';
  popupSaved.value = false;
  // Reposition popup slightly below the button position
  selectionPos.value.y += 40;
  nextTick(() => {
    popupTextarea.value?.focus();
  });
}

function submitPopupFeedback() {
  if (!popupFeedbackText.value.trim()) return;
  const content = `Regarding: "${selectedText.value.substring(0, 500)}"\n\nFeedback: ${popupFeedbackText.value.trim()}`;
  emit('feedback', { content, sourceMessageId: selectionMsgId.value });
  popupSaved.value = true;
  // Auto-close after brief flash
  setTimeout(() => {
    showImprovePopup.value = false;
    popupFeedbackText.value = '';
    selectedText.value = '';
    popupSaved.value = false;
    window.getSelection()?.removeAllRanges();
  }, 800);
}

function cancelPopup() {
  showImprovePopup.value = false;
  popupFeedbackText.value = '';
  selectedText.value = '';
  window.getSelection()?.removeAllRanges();
}

// Hide button when clicking elsewhere
function handleContainerMouseDown(event) {
  if (!event.target.closest('.selection-improve-ui')) {
    showImproveBtn.value = false;
    if (showImprovePopup.value && !event.target.closest('.selection-improve-ui')) {
      // Don't close popup on mousedown inside container - let explicit cancel handle it
    }
  }
}

// Document-level mouseup to catch selections that end outside the message div
function handleDocumentMouseUp(event) {
  if (showImprovePopup.value) return; // Don't override while popup is open
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const anchorEl = sel.anchorNode?.parentElement;
  const msgBlock = anchorEl?.closest?.('.ai-message');
  if (!msgBlock) return;
  const responseBlock = msgBlock.closest('.ai-response-block');
  if (!responseBlock) return;
  const msgId = responseBlock.dataset.msgId;
  if (msgId) {
    handleTextSelect(event, msgId);
  }
}

onMounted(() => {
  document.addEventListener('mouseup', handleDocumentMouseUp);
});
onUnmounted(() => {
  document.removeEventListener('mouseup', handleDocumentMouseUp);
});

// Filter out tool role messages - they are displayed as ToolExecutionCards on assistant messages
const displayMessages = computed(() =>
  props.messages.filter(m => m.role !== 'tool')
);

// Human-readable status messages based on active tool calls
const TOOL_STATUS_LABELS = {
  get_kpi_data: 'Pulling KPI metrics',
  get_drilldown_data: 'Drilling into the data',
  get_dealerships: 'Loading your stores',
  get_kpis_list: 'Scanning available metrics',
  get_drilldown_options: 'Checking drill-down options',
  get_daily_trend: 'Analyzing daily trends',
  search_knowledge: 'Consulting expert knowledge base',
  get_market_data: 'Comparing to market trends',
  get_market_trend: 'Loading market trend data',
  get_monthly_trend: 'Pulling monthly history',
  think: 'Thinking through the findings',
};

const streamingStatusMessage = computed(() => {
  // Find the currently running tool call (last one with status 'running')
  const running = props.activeToolCalls.filter(tc => tc.status === 'running');
  const completed = props.activeToolCalls.filter(tc => tc.status === 'completed');
  const total = props.activeToolCalls.length;

  if (running.length > 0) {
    const lastRunning = running[running.length - 1];
    const action = TOOL_STATUS_LABELS[lastRunning.name] || 'Working';

    // Add context from args if available
    let detail = '';
    if (lastRunning.args?.metricKey) {
      const parts = lastRunning.args.metricKey.split('.');
      detail = parts[parts.length - 1].replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    } else if (lastRunning.args?.drillDownType) {
      detail = `by ${lastRunning.args.drillDownType}`;
    } else if (lastRunning.args?.query) {
      detail = `"${lastRunning.args.query.substring(0, 30)}"`;
    }

    const suffix = detail ? ` — ${detail}` : '';
    const count = total > 1 ? ` (${completed.length + 1}/${total})` : '';
    return `${action}${suffix}${count}`;
  }

  if (total > 0 && completed.length === total) {
    return 'Analyzing results and writing findings...';
  }

  return 'Thinking...';
});

function isNearBottom() {
  if (!container.value) return true;
  const { scrollTop, scrollHeight, clientHeight } = container.value;
  return scrollHeight - scrollTop - clientHeight < 80;
}

function scrollToBottom(force = false) {
  if (!force && userScrolledUp.value) return;
  nextTick(() => {
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight;
    }
  });
}

function handleScroll() {
  userScrolledUp.value = !isNearBottom();
}

// Extract follow-up suggestion lines from the AI's response (lines starting with emoji bullets like 📊, 🔍, 📈)
function extractSuggestions(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const suggestions = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s*/, '').trim();
    // Match lines starting with emoji (📊, 🔍, 📈, etc.) followed by text
    if (/^[\u{1F300}-\u{1FAD6}]/u.test(trimmed) && trimmed.length > 5) {
      // Strip markdown bold markers and clean up
      const clean = trimmed.replace(/\*\*/g, '').trim();
      suggestions.push(clean);
    }
  }
  return suggestions.slice(0, 5); // max 5
}

function colorizeVariances(html) {
  // Color negative variances (📉 -XX% or just -XX% near 📉)
  html = html.replace(/(📉\s*)([-−][\d,.]+%)/g, '$1<span class="variance-red">$2</span>');
  // Color positive variances (📈 +XX%)
  html = html.replace(/(📈\s*)(\+?[\d,.]+%)/g, '$1<span class="variance-green">$2</span>');
  // Color warnings (⚠️ followed by number)
  html = html.replace(/(⚠️\s*)([-−+]?[\d,.]+%)/g, '$1<span class="variance-yellow">$2</span>');
  // Color red flags
  html = html.replace(/(🚨\s*)([^<\n]{3,60})/g, '$1<span class="variance-red">$2</span>');
  // Color standalone negative percentages in table cells (between <td> tags)
  html = html.replace(/(<td[^>]*>(?:[^<]*?))([-−]\d[\d,.]*%)/g, '$1<span class="variance-red">$2</span>');
  // Color standalone positive percentages in table cells
  html = html.replace(/(<td[^>]*>(?:[^<]*?))(\+\d[\d,.]*%)/g, '$1<span class="variance-green">$2</span>');
  // Highlight entire table rows with large variances (>20% change)
  html = html.replace(/<tr>([\s\S]*?)<\/tr>/g, (match, inner) => {
    // Check for large positive variance in the row
    if (/\+\d{2,}[\d,.]*%/.test(inner) || /📈/.test(inner)) {
      return `<tr class="row-highlight-green">${inner}</tr>`;
    }
    // Check for large negative variance
    const negMatch = inner.match(/[-−](\d+)[\d,.]*%/);
    if (negMatch && parseInt(negMatch[1]) >= 20) {
      return `<tr class="row-highlight-red">${inner}</tr>`;
    }
    return match;
  });
  return html;
}

function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/  +/g, ' ');
}

// Find the index of the last text block in a message's blocks array
function lastTextBlockIndex(msg) {
  if (!msg.blocks) return -1;
  for (let i = msg.blocks.length - 1; i >= 0; i--) {
    if (msg.blocks[i].type === 'text') return i;
  }
  return -1;
}

// KPI card helpers
function formatKpiKey(key) {
  if (!key) return '';
  const part = key.includes('.') ? key.split('.').pop() : key;
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function formatKpiValue(val, dataType) {
  return formatValue(val, dataType);
}

function kpiVariance(result) {
  const curr = typeof result.current === 'object' ? result.current?.value : result.current;
  const prev = typeof result.previous === 'object' ? result.previous?.value : result.previous;
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function kpiVarianceClass(v) {
  if (v < -3) return 'text-red-500';
  if (v > 3) return 'text-green-500';
  return 'text-yellow-500';
}

// Check if a block is a completed KPI card
function isKpiCard(block) {
  return block.type === 'tool' && block.name === 'get_kpi_data' && block.status === 'completed' && block.result && block.result.current !== undefined;
}

// Check if a block is a completed drilldown with data
function isDrilldown(block) {
  return block.type === 'tool' && block.name === 'get_drilldown_data' && block.status === 'completed' && block.result && Array.isArray(block.result.data) && block.result.data.length > 0;
}

// Check if a block is a completed knowledge search with results
function isKnowledgeSearch(block) {
  return block.type === 'tool' && block.name === 'search_knowledge' && block.status === 'completed' && block.result && Array.isArray(block.result.documents) && block.result.documents.length > 0;
}

// Check if a block is a completed market trend with chart data
function isMarketTrend(block) {
  return block.type === 'tool' && block.name === 'get_market_trend' && block.status === 'completed' && block.result && Array.isArray(block.result.weeks) && block.result.weeks.length > 1;
}

// Check if a block is a completed daily trend with chart data
function isDailyTrend(block) {
  return block.type === 'tool' && block.name === 'get_daily_trend' && block.status === 'completed' && block.result && Array.isArray(block.result.dailyValues) && block.result.dailyValues.length > 1;
}

// Check if a block is a completed monthly trend with chart data
function isMonthlyTrend(block) {
  return block.type === 'tool' && block.name === 'get_monthly_trend' && block.status === 'completed' && block.result && Array.isArray(block.result.months) && block.result.months.length > 1;
}

// Format drilldown cell value (handles object {value:N} or plain number)
function drilldownVal(val, dataType) {
  return formatValue(val, dataType);
}

// Determine if a drilldown row stands out (large variance)
function drilldownRowClass(entry) {
  const pct = entry.variancePct;
  if (pct == null) return '';
  if (pct >= 15) return 'row-highlight-green';
  if (pct <= -15) return 'row-highlight-red';
  return '';
}

// Format variance percentage for drilldown
function drilldownVarClass(pct) {
  if (pct == null) return 'text-surface-400';
  if (pct > 3) return 'text-green-500 font-semibold';
  if (pct < -3) return 'text-red-500 font-semibold';
  return 'text-yellow-500 font-semibold';
}

// Group consecutive KPI cards into { type: 'kpi-group', cards: [...] } entries
// Tracks raw block indices for TTS glow mapping
function groupBlocks(blocks) {
  if (!blocks || !blocks.length) return [];
  const grouped = [];
  let kpiBuffer = [];
  let kpiStart = -1;

  function flushKpi() {
    if (kpiBuffer.length) {
      grouped.push({ type: 'kpi-group', cards: kpiBuffer, _rawStart: kpiStart, _rawEnd: kpiStart + kpiBuffer.length - 1 });
      kpiBuffer = [];
      kpiStart = -1;
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (isKpiCard(block)) {
      if (!kpiBuffer.length) kpiStart = i;
      kpiBuffer.push(block);
    } else {
      flushKpi();
      grouped.push({ ...block, _rawIdx: i });
    }
  }
  flushKpi();
  return grouped;
}

// Check if this grouped block is the one currently being read aloud (for glow)
function isActiveReadBlock(msg, block) {
  if (!tts.isPlaying.value || tts.currentBlockIndex.value == null) return false;
  // Only glow on the last assistant message
  const isLastAssistant = msg === [...props.messages].reverse().find(m => m.role === 'assistant');
  if (!isLastAssistant) return false;

  const idx = tts.currentBlockIndex.value;
  if (block.type === 'kpi-group') {
    return idx >= block._rawStart && idx <= block._rawEnd;
  }
  return block._rawIdx === idx;
}

function renderMarkdown(text) {
  if (!text) return '';
  // Remove the suggestion lines from the rendered markdown (we render them as buttons)
  let cleaned = text.replace(/---\s*\n\*\*Want me to dig deeper\?\*\*\n[\s\S]*$/, '').trim();
  // Sanitize problematic characters
  cleaned = sanitizeText(cleaned);
  const html = marked.parse(cleaned);
  return colorizeVariances(html);
}

// Get suggestions from the LAST completed assistant message
function getMessageSuggestions(msg, index) {
  if (msg.role !== 'assistant' || msg.id === 'streaming' || !msg.content) return [];
  // Only show suggestions on the last message
  const assistantMsgs = displayMessages.value.filter(m => m.role === 'assistant');
  if (assistantMsgs[assistantMsgs.length - 1] !== msg) return [];
  return extractSuggestions(msg.content);
}

// Auto-scroll only when user is near the bottom (not scrolled up reading)
// Check isNearBottom() directly to avoid race conditions with scroll events on mobile
watch(() => props.messages, () => {
  if (isNearBottom()) scrollToBottom();
}, { deep: true });
watch(() => props.activeToolCalls, () => {
  if (isNearBottom()) scrollToBottom();
}, { deep: true });
// When user sends a new message, always snap to bottom
watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    const last = props.messages[newLen - 1];
    if (last?.role === 'user') {
      userScrolledUp.value = false;
      scrollToBottom(true);
    }
  }
});
</script>

<template>
  <div ref="container" class="flex-1 overflow-y-auto relative" @scroll="handleScroll" @mousedown="handleContainerMouseDown">
    <!-- Floating "Improve" button (appears on text selection) -->
    <div
      v-if="showImproveBtn"
      class="selection-improve-ui absolute z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 dark:bg-surface-100 text-white dark:text-surface-800 text-xs font-medium shadow-lg cursor-pointer hover:bg-surface-700 dark:hover:bg-surface-200 transition-all"
      :style="{ left: selectionPos.x + 'px', top: selectionPos.y + 'px' }"
      @click="openImprovePopup"
    >
      <i class="pi pi-pencil text-[10px]"></i>
      Improve
    </div>

    <!-- Floating feedback popup (appears after clicking Improve) -->
    <div
      v-if="showImprovePopup"
      class="selection-improve-ui absolute z-50 w-[320px] rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 shadow-xl"
      :style="{ left: Math.max(8, selectionPos.x - 140) + 'px', top: selectionPos.y + 'px' }"
    >
      <!-- Success state -->
      <div v-if="popupSaved" class="px-4 py-5 text-center">
        <i class="pi pi-check-circle text-green-500 text-xl mb-1"></i>
        <p class="text-sm font-medium text-surface-700 dark:text-surface-200">Saved as instruction</p>
      </div>
      <!-- Form state -->
      <template v-else>
        <!-- Selected text preview -->
        <div class="px-3 pt-3 pb-1.5">
          <div class="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">Selected text</div>
          <div class="text-xs text-surface-600 dark:text-surface-300 line-clamp-2 leading-relaxed">{{ selectedText.substring(0, 200) }}{{ selectedText.length > 200 ? '...' : '' }}</div>
        </div>
        <!-- Textarea -->
        <div class="px-3 py-2">
          <textarea
            ref="popupTextarea"
            v-model="popupFeedbackText"
            rows="2"
            class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 text-sm text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400"
            placeholder="What should the AI do differently?"
            @keydown.enter.ctrl="submitPopupFeedback"
            @keydown.escape="cancelPopup"
          ></textarea>
        </div>
        <!-- Buttons -->
        <div class="px-3 pb-3 flex items-center gap-2">
          <button
            @click="submitPopupFeedback"
            :disabled="!popupFeedbackText.trim()"
            class="flex-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Save
          </button>
          <button
            @click="cancelPopup"
            class="px-3 py-1.5 rounded-lg text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </template>
    </div>

    <!-- Empty state - centered like ChatGPT -->
    <div v-if="!displayMessages.length" class="flex flex-col items-center justify-center h-full text-center px-4">
      <div class="w-16 h-16 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center mb-5">
        <i class="pi pi-sparkles text-3xl text-primary-500"></i>
      </div>
      <h3 class="text-xl font-semibold text-surface-800 dark:text-surface-100 mb-2">
        {{ dealerGroupName ? `What's happening at ${dealerGroupName}?` : 'How can I help you today?' }}
      </h3>
      <p class="text-surface-500 dark:text-surface-400 max-w-md text-sm leading-relaxed">
        {{ highlights.length > 0
          ? 'I noticed some significant changes in your KPIs. Click a finding below or ask your own question.'
          : 'Ask questions about your dealership KPIs, sales trends, inventory metrics, or drill down into specific data points.'
        }}
      </p>
      <!-- Suggestion chips: shimmer → highlights → fallback random -->
      <div class="flex flex-col gap-2 mt-6 w-full max-w-lg">
        <!-- Shimmer placeholders while loading highlights -->
        <template v-if="highlightsLoading">
          <div v-for="i in 3" :key="'shimmer-' + i" class="h-10 rounded-xl bg-surface-200/60 dark:bg-surface-700/40 animate-pulse"></div>
        </template>
        <!-- Actual suggestions -->
        <template v-else>
          <button
            v-for="(q, qi) in effectiveSuggestions"
            :key="qi"
            @click="emit('suggestion', q)"
            class="px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer text-left"
          >
            {{ q }}
          </button>
        </template>
      </div>
      <p class="text-xs text-surface-400 dark:text-surface-500 mt-3">or ask any question you like</p>
    </div>

    <!-- Messages - centered column -->
    <div v-else class="max-w-[700px] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <template v-for="msg in displayMessages" :key="msg.id">
        <!-- User message -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div class="max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-primary-500 text-white text-sm leading-relaxed">
            <span style="white-space: pre-wrap;">{{ msg.content }}</span>
          </div>
        </div>

        <!-- Assistant message - full width in column, no bubble -->
        <div v-else class="ai-response-block" :data-msg-id="msg.id">
          <!-- AI avatar + label -->
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-md bg-primary-500 flex items-center justify-center shrink-0">
              <i class="pi pi-sparkles text-white text-[10px]"></i>
            </div>
            <span class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">AI Analytics</span>
          </div>

          <!-- Blocks rendered in chronological order (KPI cards grouped into rows) -->
          <template v-if="msg.blocks && msg.blocks.length">
            <template v-for="(block, idx) in groupBlocks(msg.blocks)" :key="'block-' + idx">
              <!-- Text block -->
              <div
                v-if="block.type === 'text' && block.content"
                class="ai-message pl-4 sm:pl-8 text-[14px] sm:text-[15px] leading-relaxed text-surface-800 dark:text-surface-200 transition-all duration-500"
                :class="[
                  { 'mt-3': idx > 0 },
                  isActiveReadBlock(msg, block) ? 'tts-glow' : ''
                ]"
                @mouseup="handleTextSelect($event, msg.id)"
              >
                <div v-html="renderMarkdown(block.content)"></div>
              </div>
              <!-- KPI cards row (grouped consecutive KPI results) -->
              <div v-else-if="block.type === 'kpi-group'" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(card, ci) in block.cards"
                    :key="'kpi-' + ci"
                    class="flex-1 min-w-[80px] sm:min-w-[100px] max-w-[140px] rounded-lg border border-surface-200 dark:border-surface-700/50 bg-surface-50/50 dark:bg-surface-800/60 px-2 sm:px-2.5 py-2 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors"
                    @click="openChatDrillDown(card)"
                  >
                    <div class="text-[10px] text-surface-400 truncate mb-0.5">{{ card.result.fullName || card.result.name || formatKpiKey(card.args?.metricKey) }}</div>
                    <div class="flex items-baseline gap-1">
                      <span class="text-[13px] font-bold text-surface-800 dark:text-surface-100">{{ formatKpiValue(card.result.current, card.result.dataType) }}</span>
                      <span v-if="kpiVariance(card.result) !== null" class="text-[10px] font-semibold" :class="kpiVarianceClass(kpiVariance(card.result))">
                        {{ kpiVariance(card.result) >= 0 ? '+' : '' }}{{ kpiVariance(card.result).toFixed(1) }}%
                      </span>
                    </div>
                    <div class="flex gap-2 mt-0.5 text-[9px] text-surface-500 dark:text-surface-400">
                      <span>prev: {{ formatKpiValue(card.result.previous, card.result.dataType) }}</span>
                      <span v-if="card.result.lastYear">LY: {{ formatKpiValue(card.result.lastYear, card.result.dataType) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Drilldown table (inline) -->
              <div v-else-if="isDrilldown(block)" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1 rounded-lg border border-surface-200 dark:border-surface-700/50 overflow-hidden">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-surface-100 dark:bg-surface-800/80">
                        <th class="text-left px-2.5 py-1.5 font-semibold text-surface-500 dark:text-surface-400">{{ block.result.drillDownName || 'Name' }}</th>
                        <th class="text-right px-2.5 py-1.5 font-semibold text-surface-500 dark:text-surface-400">Current</th>
                        <th class="text-right px-2.5 py-1.5 font-semibold text-surface-500 dark:text-surface-400">Prev</th>
                        <th class="text-right px-2.5 py-1.5 font-semibold text-surface-500 dark:text-surface-400">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(entry, ei) in block.result.data.slice(0, 10)"
                        :key="'dd-' + ei"
                        class="border-t border-surface-100 dark:border-surface-800"
                        :class="drilldownRowClass(entry)"
                      >
                        <td class="px-2.5 py-1.5 text-surface-700 dark:text-surface-300 max-w-[180px] truncate">{{ entry.label }}</td>
                        <td class="px-2.5 py-1.5 text-right text-surface-700 dark:text-surface-200 font-medium tabular-nums">{{ drilldownVal(entry.current, block.result.dataType) }}</td>
                        <td class="px-2.5 py-1.5 text-right text-surface-500 dark:text-surface-400 tabular-nums">{{ drilldownVal(entry.previous, block.result.dataType) }}</td>
                        <td class="px-2.5 py-1.5 text-right tabular-nums" :class="drilldownVarClass(entry.variancePct)">
                          {{ entry.variancePct != null ? (entry.variancePct >= 0 ? '+' : '') + entry.variancePct.toFixed(1) + '%' : '\u2014' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Knowledge search results (clickable document list — matches report sidebar style) -->
              <div v-else-if="isKnowledgeSearch(block)" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5 rounded-lg border border-surface-200 dark:border-surface-700/50 bg-surface-50/30 dark:bg-surface-800/40 overflow-hidden">
                  <div class="px-2.5 py-1.5 border-b border-surface-200 dark:border-surface-700/30 flex items-center gap-1.5">
                    <i class="pi pi-book text-[10px] text-primary-400"></i>
                    <span class="text-[10px] font-semibold text-surface-500 dark:text-surface-400">Expert References</span>
                  </div>
                  <div class="divide-y divide-surface-100 dark:divide-surface-700/20">
                    <div
                      v-for="(doc, di) in block.result.documents"
                      :key="'kb-' + di"
                      @click="doc.id && emit('openKnowledgeDoc', doc.id)"
                      class="group flex items-center gap-2 px-2.5 py-2 transition-colors"
                      :class="doc.id ? 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20' : ''"
                    >
                      <i
                        class="pi pi-book text-[10px] shrink-0 text-primary-400"
                      ></i>
                      <span class="flex-1 text-[11px] text-surface-600 dark:text-surface-300 group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors">
                        {{ doc.title }}
                      </span>
                      <i v-if="doc.id" class="pi pi-external-link text-[9px] text-surface-300 dark:text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Market trend chart (inline) -->
              <div v-else-if="isMarketTrend(block)" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineMarketChart :data="block.result" />
                </div>
              </div>

              <!-- Daily trend chart (inline) -->
              <div v-else-if="isDailyTrend(block)" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineTrendChart :data="block.result" />
                </div>
              </div>

              <!-- Monthly trend chart (6-month history) -->
              <div v-else-if="isMonthlyTrend(block)" class="mb-2 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineMonthlyTrendChart :data="block.result" />
                </div>
              </div>

              <!-- Tool block (default) -->
              <div v-else-if="block.type === 'tool'" class="mb-1 pl-4 sm:pl-8 transition-all duration-500" :class="isActiveReadBlock(msg, block) ? 'tts-glow' : ''">
                <ToolExecutionCard :toolCall="block" />
              </div>
            </template>
          </template>
          <!-- Fallback for messages without blocks (shouldn't happen, but safe) -->
          <template v-else>
            <div
              v-if="msg.content"
              class="ai-message pl-4 sm:pl-8 text-[14px] sm:text-[15px] leading-relaxed text-surface-800 dark:text-surface-200"
              @mouseup="handleTextSelect($event, msg.id)"
            >
              <div v-html="renderMarkdown(msg.content)"></div>
            </div>
          </template>

          <!-- Clickable follow-up suggestions -->
          <div
            v-if="getMessageSuggestions(msg).length && !isStreaming"
            class="pl-4 sm:pl-8 mt-4 space-y-2"
          >
            <p class="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2">Want me to dig deeper?</p>
            <button
              v-for="(suggestion, si) in getMessageSuggestions(msg)"
              :key="si"
              @click="emit('suggestion', suggestion)"
              class="block w-full text-left px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            >
              {{ suggestion }}
            </button>
          </div>

          <!-- Per-message time saved badge -->
          <div
            v-if="msg.timeSaved && msg.id !== 'streaming'"
            class="pl-4 sm:pl-8 mt-2 mb-1"
          >
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[11px] text-emerald-400 font-medium">
              <i class="pi pi-clock text-[9px]"></i>
              ~{{ msg.timeSaved }} min of manual analysis saved
            </span>
          </div>

          <!-- Feedback button (not on streaming messages) -->
          <div v-if="msg.role === 'assistant' && msg.id !== 'streaming' && msg.content" class="pl-4 sm:pl-8 mt-2">
            <button
              v-if="feedbackMsgId !== msg.id"
              @click="openFeedback(msg.id)"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              title="Train the AI"
            >
              <i class="pi pi-thumbs-down text-[10px]"></i>
              <span>Feedback</span>
            </button>

            <!-- Inline feedback form (for general feedback without text selection) -->
            <div v-if="feedbackMsgId === msg.id" class="mt-1 flex flex-col gap-2">
              <textarea
                v-model="feedbackText"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-sm text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tell the AI what it should do differently..."
                @keydown.enter.ctrl="submitFeedback"
              ></textarea>
              <div class="flex gap-2">
                <button
                  @click="submitFeedback"
                  :disabled="!feedbackText.trim()"
                  class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Save as instruction
                </button>
                <button
                  @click="cancelFeedback"
                  class="px-3 py-1.5 rounded-lg text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- Live status indicator during streaming -->
          <div
            v-if="msg.id === 'streaming' && isStreaming"
            class="pl-4 sm:pl-8 mt-2"
          >
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/5 dark:bg-primary-500/10 border border-primary-500/10 dark:border-primary-500/15">
              <svg class="w-3.5 h-3.5 text-primary-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="text-xs text-primary-400 dark:text-primary-300 font-medium truncate max-w-[200px] sm:max-w-[320px]">{{ streamingStatusMessage }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- KPI Drill-Down Overlay (above chat z-index) -->
    <KpiDrillDownOverlay
      v-if="chatDrillDownMetric"
      :metricKey="chatDrillDownMetric.key"
      :metricName="chatDrillDownMetric.name"
      :dataType="chatDrillDownMetric.dataType"
      :currentValue="chatDrillDownMetric.currentValue"
      :previousValue="chatDrillDownMetric.previousValue"
      :lastYearValue="chatDrillDownMetric.lastYearValue"
      :apiColor="chatDrillDownMetric.apiColor"
      :apiParams="settingsStore.apiParams"
      :zIndex="10000"
      @close="closeChatDrillDown"
      @drillDown="handleChatDrillDownNav"
    />
  </div>
</template>

<style>
/* Markdown styling for AI messages */
.ai-message h1,
.ai-message h2,
.ai-message h3 {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}
.ai-message h1 { font-size: 1.125rem; }
.ai-message h2 { font-size: 1.05rem; }
.ai-message h3 { font-size: 0.9375rem; }
.ai-message h1:first-child,
.ai-message h2:first-child,
.ai-message h3:first-child {
  margin-top: 0;
}
.ai-message p {
  margin: 0.5rem 0;
}
.ai-message p:first-child {
  margin-top: 0;
}
.ai-message p:last-child {
  margin-bottom: 0;
}
.ai-message ul,
.ai-message ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.ai-message li {
  margin: 0.25rem 0;
}
.ai-message strong {
  font-weight: 600;
}
.ai-message code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
.app-dark .ai-message code {
  background: rgba(255, 255, 255, 0.1);
}
.ai-message pre {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.app-dark .ai-message pre {
  background: rgba(255, 255, 255, 0.06);
}
.ai-message pre code {
  background: none;
  padding: 0;
}
.ai-message table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
  display: block;
  overflow-x: auto;
}
.ai-message th,
.ai-message td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}
.app-dark .ai-message th,
.app-dark .ai-message td {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.ai-message th {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: var(--p-surface-500);
}
.ai-message td:first-child,
.ai-message th:first-child {
  white-space: normal;
  min-width: 120px;
}
.ai-message blockquote {
  border-left: 3px solid var(--p-primary-500);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--p-surface-600);
}
.app-dark .ai-message blockquote {
  color: var(--p-surface-400);
}
/* Variance color coding */
.ai-message .variance-red {
  color: #ef4444;
  font-weight: 600;
}
.ai-message .variance-green {
  color: #22c55e;
  font-weight: 600;
}
.ai-message .variance-yellow {
  color: #eab308;
  font-weight: 600;
}
/* Row-level highlighting for standout table rows */
.ai-message tr.row-highlight-green {
  background: rgba(34, 197, 94, 0.08);
}
.app-dark .ai-message tr.row-highlight-green {
  background: rgba(34, 197, 94, 0.12);
}
.ai-message tr.row-highlight-red {
  background: rgba(239, 68, 68, 0.08);
}
.app-dark .ai-message tr.row-highlight-red {
  background: rgba(239, 68, 68, 0.12);
}

/* TTS read-along glow — animated outer glow on the currently-read block */
.tts-glow {
  border-radius: 12px;
  padding: 8px;
  margin-left: -8px;
  margin-right: -8px;
  background: rgba(99, 102, 241, 0.04);
  box-shadow:
    0 0 8px 2px rgba(99, 102, 241, 0.15),
    0 0 20px 4px rgba(99, 102, 241, 0.08);
  animation: tts-pulse 2s ease-in-out infinite;
}
.app-dark .tts-glow {
  background: rgba(99, 102, 241, 0.08);
  box-shadow:
    0 0 10px 3px rgba(129, 140, 248, 0.2),
    0 0 25px 6px rgba(129, 140, 248, 0.1);
}
@keyframes tts-pulse {
  0%, 100% {
    box-shadow:
      0 0 8px 2px rgba(99, 102, 241, 0.15),
      0 0 20px 4px rgba(99, 102, 241, 0.08);
  }
  50% {
    box-shadow:
      0 0 12px 4px rgba(99, 102, 241, 0.25),
      0 0 30px 8px rgba(99, 102, 241, 0.12);
  }
}
@media (prefers-color-scheme: dark) {
  @keyframes tts-pulse {
    0%, 100% {
      box-shadow:
        0 0 10px 3px rgba(129, 140, 248, 0.2),
        0 0 25px 6px rgba(129, 140, 248, 0.1);
    }
    50% {
      box-shadow:
        0 0 16px 5px rgba(129, 140, 248, 0.3),
        0 0 35px 10px rgba(129, 140, 248, 0.15);
    }
  }
}
</style>
