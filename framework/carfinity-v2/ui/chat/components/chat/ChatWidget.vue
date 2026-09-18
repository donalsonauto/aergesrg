<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAiStore } from '../../stores/ai'
import { useAuthStore } from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import ReportPanel from './ReportPanel.vue'
import PlanPanel from './PlanPanel.vue'
import DrillDownOverlay from './DrillDownOverlay.vue'
import KnowledgePanel from './KnowledgePanel.vue'

const props = defineProps({
  initialDrilldownMetric: { type: String, default: null },
  // When mounted inside the rankmatic-v2 AppLayout shell, the outer flex
  // shell + the chat-history left sidebar are owned by the host layout.
  // `embedded` lets us collapse to just the main chat column.
  embedded: { type: Boolean, default: false },
  // When false (the floating dock), in-chat navigations don't write the
  // URL — opening the chat over any page must not hijack the app route.
  routeSync: { type: Boolean, default: true },
})

// `close` — the host page (AiChat) closes the full-screen chat.
const emit = defineEmits(['close'])

const router = useRouter()
const route = useRoute()
const aiStore = useAiStore()
const auth = useAuthStore()
const settings = useSettingsStore()

// Route prefix for in-chat navigations (drilldown, conversation switch, etc.).
// Ported into rankmatic-v2: all chat URLs live under /ai-chat.
const chatBase = computed(() => '/ai-chat')

// In-chat navigations sync the URL so a chat is shareable — unless mounted
// in the floating dock (routeSync=false), where changing the app route
// would yank the user off whatever page they are on.
function syncRoute(path) {
  if (props.routeSync) router.replace(path)
}

const showReport = ref(false)
const showPlan = ref(false)
const showEvents = ref(false)
const showKnowledge = ref(false)
const showMemory = ref(false)

// Track viewport so we can suppress auto-opening side panels on mobile.
const isMobile = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false)
let _mobileMql = null
function _onMobileChange(e) { isMobile.value = e.matches }

// ─── Typed memory slide-out state ──────────────────────────────────
const memoryItems = ref([])
const memoryLoading = ref(false)
const memoryFilter = ref('all')        // all | active | resolved | archived
const memoryTypeFilter = ref('all')    // all | fact | alias | preference | heuristic | caveat | watch
const memoryAddText = ref('')
const memoryAdding = ref(false)
const memoryDupSuggestion = ref(null)
const memoryEditId = ref(null)
const memoryEditText = ref('')

const MEMORY_TYPE_LABELS = {
  fact: 'Fact', alias: 'Alias', preference: 'Preference',
  heuristic: 'Heuristic', caveat: 'Caveat', watch: 'Watch',
}

const filteredMemoryItems = computed(() => {
  return memoryItems.value.filter(m => {
    const status = m.status || 'active'
    if (memoryFilter.value === 'active' && (status !== 'active' || !m.active)) return false
    if (memoryFilter.value === 'resolved' && status !== 'resolved') return false
    if (memoryFilter.value === 'archived' && status !== 'archived' && m.active) return false
    if (memoryTypeFilter.value !== 'all' && (m.memory_type || 'fact') !== memoryTypeFilter.value) return false
    return true
  })
})

const memoryStats = computed(() => {
  const m = memoryItems.value
  return {
    total: m.length,
    active: m.filter(x => (x.status || 'active') === 'active' && x.active).length,
    resolved: m.filter(x => x.status === 'resolved').length,
    archived: m.filter(x => x.status === 'archived' || !x.active).length,
    byType: m.reduce((acc, x) => {
      const t = x.memory_type || 'fact'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {}),
  }
})

async function loadMemories() {
  memoryLoading.value = true
  try {
    const res = await fetch('/api/memories', { credentials: 'include' })
    memoryItems.value = res.ok ? await res.json() : []
  } catch { memoryItems.value = [] }
  memoryLoading.value = false
}

async function memoryAdd(force = false) {
  if (!memoryAddText.value.trim()) return
  memoryAdding.value = true
  memoryDupSuggestion.value = null
  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: memoryAddText.value.trim(), dedup: !force }),
    })
    const data = await res.json()
    if (data.duplicate) {
      memoryDupSuggestion.value = data.similar_to
    } else {
      memoryAddText.value = ''
      await loadMemories()
    }
  } catch {}
  memoryAdding.value = false
}

async function memorySetStatus(id, action) {
  await fetch(`/api/memories/${id}/${action}`, { method: 'POST', credentials: 'include' })
  await loadMemories()
}

async function memoryDelete(id) {
  if (!confirm('Delete this memory?')) return
  await fetch(`/api/memories/${id}`, { method: 'DELETE', credentials: 'include' })
  await loadMemories()
}

async function memorySetType(id, type) {
  await fetch(`/api/memories/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory_type: type }),
  })
  await loadMemories()
}

function memoryStartEdit(m) { memoryEditId.value = m.id; memoryEditText.value = m.content }
async function memorySaveEdit() {
  if (!memoryEditText.value.trim()) return
  await fetch(`/api/memories/${memoryEditId.value}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: memoryEditText.value.trim() }),
  })
  memoryEditId.value = null
  await loadMemories()
}

watch(showMemory, (val) => { if (val) loadMemories() })
const showMobileSidebar = ref(false)
const showTimeSavedTooltip = ref(false)
const showSettingsMenu = ref(false)
const drillDownConfig = ref(null)
const openKnowledgeDocId = ref(null)

// API Usage tracking
const apiUsage = ref(null)
const showApiUsageTooltip = ref(false)
let apiUsageInterval = null

// Property scope picker
const showScopePicker = ref(false)
const scopeSearch = ref('')
const scopeView = ref('list')           // 'list' | 'account' | 'groups'
const expandedAccounts = ref(new Set())  // account_id strings
const showNewGroupForm = ref(false)
const newGroupName = ref('')

const filteredScopeProps = computed(() => {
  const q = scopeSearch.value.trim().toLowerCase()
  const list = settings.activeProperties || []
  if (!q) return list
  return list.filter(p => {
    const name = (p.storeName || p.display_name || p.property_id || '').toLowerCase()
    const acct = (p.account_name || '').toLowerCase()
    return name.includes(q) || acct.includes(q)
  })
})

// Group filtered list by account_name
const filteredByAccount = computed(() => {
  const groups = new Map()
  for (const p of filteredScopeProps.value) {
    const key = p.account_id || '__none__'
    const label = p.account_name || 'Ungrouped'
    if (!groups.has(key)) groups.set(key, { account_id: key, account_name: label, props: [] })
    groups.get(key).props.push(p)
  }
  return [...groups.values()].sort((a, b) => a.account_name.localeCompare(b.account_name))
})

function toggleAccountGroup(accountId) {
  if (expandedAccounts.value.has(accountId)) expandedAccounts.value.delete(accountId)
  else expandedAccounts.value.add(accountId)
  // force reactivity on Set
  expandedAccounts.value = new Set(expandedAccounts.value)
}

function selectAllInAccount(accountGroup) {
  const next = [...aiStore.pinnedPropertyIds]
  for (const p of accountGroup.props) {
    if (!next.includes(p.property_id)) next.push(p.property_id)
  }
  aiStore.pinnedPropertyIds = next
}
function clearInAccount(accountGroup) {
  const ids = new Set(accountGroup.props.map(p => p.property_id))
  aiStore.pinnedPropertyIds = aiStore.pinnedPropertyIds.filter(id => !ids.has(id))
}
function isAccountFullySelected(accountGroup) {
  return accountGroup.props.length > 0 && accountGroup.props.every(p => aiStore.pinnedPropertyIds.includes(p.property_id))
}
function isAccountPartiallySelected(accountGroup) {
  return !isAccountFullySelected(accountGroup) && accountGroup.props.some(p => aiStore.pinnedPropertyIds.includes(p.property_id))
}

// ── Custom groups ──
async function applyGroup(g) {
  aiStore.pinnedPropertyIds = [...g.property_ids]
}
async function addGroupToSelection(g) {
  const next = new Set(aiStore.pinnedPropertyIds)
  for (const id of g.property_ids) next.add(id)
  aiStore.pinnedPropertyIds = [...next]
}
async function saveCurrentAsGroup() {
  const name = (newGroupName.value || '').trim()
  if (!name) return
  if (!aiStore.pinnedPropertyIds.length) return
  await settings.createPropertyGroup({
    name,
    property_ids: [...aiStore.pinnedPropertyIds],
  })
  newGroupName.value = ''
  showNewGroupForm.value = false
}
async function removeGroup(g) {
  if (!confirm(`Delete group "${g.name}"?`)) return
  await settings.deletePropertyGroup(g.id)
}
const scopeButtonLabel = computed(() => {
  const total = settings.activeProperties?.length || 0
  const pinned = aiStore.pinnedPropertyIds?.length || 0
  if (pinned === 0) return `All ${total} propert${total === 1 ? 'y' : 'ies'}`
  if (pinned === 1) {
    const p = settings.activeProperties.find(x => x.property_id === aiStore.pinnedPropertyIds[0])
    return p ? (p.storeName || p.display_name || p.property_id) : `1 of ${total}`
  }
  return `${pinned} of ${total} selected`
})
function closeScopePicker() {
  showScopePicker.value = false
  scopeSearch.value = ''
}
function selectAllVisible() {
  const next = [...aiStore.pinnedPropertyIds]
  for (const p of filteredScopeProps.value) {
    if (!next.includes(p.property_id)) next.push(p.property_id)
  }
  aiStore.pinnedPropertyIds = next
}
function clearVisible() {
  if (scopeSearch.value.trim()) {
    const visible = new Set(filteredScopeProps.value.map(p => p.property_id))
    aiStore.pinnedPropertyIds = aiStore.pinnedPropertyIds.filter(id => !visible.has(id))
  } else {
    aiStore.pinnedPropertyIds = []
  }
}

async function fetchApiUsage() {
  try {
    const { default: AiAPI } = await import('../../api/AiAPI')
    apiUsage.value = await AiAPI.getApiUsage()
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchApiUsage()
  apiUsageInterval = setInterval(fetchApiUsage, 60000)
  // Fetch counts for sidebar badges
  aiStore.fetchInstructions()
  aiStore.fetchEvents()
  aiStore.fetchKnowledgeCount()
  // Load custom property groups for the scope picker
  settings.fetchPropertyGroups?.()

  // Track viewport so report auto-open and sticky-layout rules stay in sync with the actual screen size.
  if (typeof window !== 'undefined') {
    _mobileMql = window.matchMedia('(max-width: 767px)')
    isMobile.value = _mobileMql.matches
    if (_mobileMql.addEventListener) _mobileMql.addEventListener('change', _onMobileChange)
    else _mobileMql.addListener(_onMobileChange)
  }

  // Restore drilldown from URL on page load
  if (props.initialDrilldownMetric) {
    const metric = decodeURIComponent(props.initialDrilldownMetric)
    drillDownConfig.value = {
      metric,
      metricName: metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      currentValue: null,
      previousValue: null,
      changeValue: null,
      propertyId: '',
      propertyName: '',
    }
  }
})
onUnmounted(() => {
  if (apiUsageInterval) clearInterval(apiUsageInterval)
  if (_mobileMql) {
    if (_mobileMql.removeEventListener) _mobileMql.removeEventListener('change', _onMobileChange)
    else _mobileMql.removeListener(_onMobileChange)
  }
})

// Instructions state (now inside settings menu overlay)
const showInstructionsPanel = ref(false)
const newInstruction = ref('')
const addingInstruction = ref(false)

// Events panel state
const showEventForm = ref(false)
const eventForm = ref({ title: '', description: '', date: '' })
const savingEvent = ref(false)

// Knowledge panel state (managed by KnowledgePanel component)

function togglePanel(panel) {
  const panels = { report: showReport, events: showEvents, knowledge: showKnowledge, memory: showMemory }
  const isActive = panels[panel].value
  showReport.value = false
  showEvents.value = false
  showKnowledge.value = false
  showMemory.value = false
  if (!isActive) {
    panels[panel].value = true
    if (panel === 'events') aiStore.fetchEvents()
    if (panel === 'memory') aiStore.fetchInstructions()
  }
}

function handleNewChat() {
  aiStore.activeConversationId = null
  aiStore.messages = []
  aiStore.pinnedPropertyIds = []
  syncRoute(chatBase.value)
}

async function handleSendMessage(text) {
  if (!aiStore.activeConversationId) {
    await aiStore.createConversation()
    // Immediately address the new chat — don't wait for the activeConversationId
    // watcher to fire. This guarantees a unique URL the moment a new chat starts
    // running, so the user can copy/share it before the first response streams in.
    if (aiStore.activeConversationId && route.params.conversationId !== String(aiStore.activeConversationId)) {
      syncRoute(`${chatBase.value}/${aiStore.activeConversationId}`)
    }
  }
  aiStore.sendMessage(text, {
    propertyId: settings.activePropertyId,
    propertyName: settings.activeProperty?.displayName || null,
    pinnedPropertyIds: aiStore.pinnedPropertyIds.length > 0 ? aiStore.pinnedPropertyIds : undefined,
  })
}

function togglePinnedProperty(propertyId) {
  const idx = aiStore.pinnedPropertyIds.indexOf(propertyId)
  if (idx >= 0) {
    aiStore.pinnedPropertyIds.splice(idx, 1)
  } else {
    aiStore.pinnedPropertyIds.push(propertyId)
  }
}

function clearPinnedProperties() {
  aiStore.pinnedPropertyIds = []
}

function selectConversation(id) {
  aiStore.loadConversation(id)
  syncRoute(`${chatBase.value}/${id}`)
  showMobileSidebar.value = false
}

function handleDeleteConversation(id) {
  aiStore.deleteConversation(id)
}

function openDrilldown(config) {
  drillDownConfig.value = config
  const convId = aiStore.activeConversationId
  if (convId && config.metric) {
    syncRoute(`${chatBase.value}/${convId}/drilldown/${encodeURIComponent(config.metric)}`)
  }
}

function closeDrilldown() {
  drillDownConfig.value = null
  const convId = aiStore.activeConversationId
  if (convId) {
    syncRoute(`${chatBase.value}/${convId}`)
  }
}

async function handleFeedback({ content, sourceMessageId }) {
  await aiStore.addInstruction(content, 'feedback', sourceMessageId)
}

async function handleFork(messageId) {
  const result = await aiStore.forkConversation(messageId)
  if (result?.id) {
    await aiStore.loadConversation(result.id)
    syncRoute(`${chatBase.value}/${result.id}`)
  }
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

// Instructions helpers
function openInstructions() {
  showSettingsMenu.value = false
  showInstructionsPanel.value = true
  aiStore.fetchInstructions()
}

async function addInstruction() {
  if (!newInstruction.value.trim()) return
  addingInstruction.value = true
  try {
    await aiStore.addInstruction(newInstruction.value.trim())
    newInstruction.value = ''
  } catch { /* ignore */ }
  addingInstruction.value = false
}

async function toggleInstructionActive(inst) {
  await aiStore.updateInstruction(inst.id, { active: !inst.active })
}

async function removeInstruction(id) {
  await aiStore.deleteInstruction(id)
}

// Annotations sync
const syncingAnnotations = ref(false)
const syncResult = ref(null)

async function syncAnnotations() {
  syncingAnnotations.value = true
  syncResult.value = null
  try {
    const { default: AiAPI } = await import('../../api/AiAPI')
    const result = await AiAPI.syncAnnotations()
    syncResult.value = result
    if (result.synced > 0) await aiStore.fetchEvents()
    setTimeout(() => { syncResult.value = null }, 5000)
  } catch (err) {
    syncResult.value = { error: err.message || 'Failed to sync' }
    setTimeout(() => { syncResult.value = null }, 5000)
  }
  syncingAnnotations.value = false
}

// Events helpers
async function addEvent() {
  if (!eventForm.value.title.trim() || !eventForm.value.date) return
  savingEvent.value = true
  try {
    await aiStore.addEvent({ ...eventForm.value })
    eventForm.value = { title: '', description: '', date: '' }
    showEventForm.value = false
  } catch { /* ignore */ }
  savingEvent.value = false
}

async function removeEvent(id) {
  await aiStore.deleteEvent(id)
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function cleanDescription(desc) {
  if (!desc) return ''
  // Remove property name in brackets like [Property Name - GA4]
  return desc.replace(/\s*\[.*?\]\s*$/, '').trim()
}

function extractProperty(evt) {
  // Try to get property name from description brackets
  if (evt.description) {
    const match = evt.description.match(/\[([^\]]+)\]\s*$/)
    if (match) return match[1].trim()
  }
  return null
}

const timeSavedFormatted = computed(() => {
  const mins = aiStore.timeSaved?.this_month || 0
  if (mins < 60) return `${Math.round(mins)} min`
  return `${(mins / 60).toFixed(1)} hrs`
})

const todayTimeSavedFormatted = computed(() => {
  const mins = aiStore.timeSaved?.today || 0
  if (mins < 1) return ''
  if (mins < 60) return `${Math.round(mins)} min`
  return `${(mins / 60).toFixed(1)} hrs`
})

const streamingTimeSavedFormatted = computed(() => {
  const mins = aiStore.streamingTimeSaved
  if (!mins || mins <= 0) return ''
  if (mins < 60) return `~${Math.round(mins)} min`
  return `~${(mins / 60).toFixed(1)} hrs`
})

const userInitials = computed(() => {
  const name = auth.user?.name || auth.user?.email || '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

// Auto-open report panel when streaming starts (and there are tool calls).
// On mobile we never auto-open — the user must tap the Report icon explicitly.
watch(() => aiStore.isStreaming, (streaming) => {
  if (isMobile.value) return
  if (streaming && aiStore.reportSections.length > 0) {
    showReport.value = true
  }
})

watch(() => aiStore.reportSections.length, (len) => {
  if (isMobile.value) return
  if (len > 0 && aiStore.isStreaming) {
    showReport.value = true
  }
})

watch(() => aiStore.planItems.length, (len) => {
  if (len > 0) showPlan.value = true
})

// Don't auto-open plan panel when toggling plan mode
// Only open when AI actually submits plan items

watch(() => aiStore.activeConversationId, (newId) => {
  showReport.value = false
  showEvents.value = false
  showKnowledge.value = false
  showMemory.value = false
  // Sync URL when conversation changes (e.g., after createConversation)
  if (newId && route.params.conversationId !== String(newId)) {
    syncRoute(`${chatBase.value}/${newId}`)
  }
})

watch(() => aiStore.pendingQuestion, async (pq) => {
  if (!pq) return
  const { text, context } = aiStore.consumePendingQuestion()
  if (!text) return
  await aiStore.createConversation()
  aiStore.sendMessage(text, context)
})

// Close settings menu on outside click
function closeSettingsMenu(e) {
  if (showSettingsMenu.value && !e.target.closest('.settings-menu-container')) {
    showSettingsMenu.value = false
  }
}
</script>

<template>
  <div
    :class="[
      'bg-brand-dark overflow-hidden',
      embedded
        ? 'flex flex-col min-w-0 min-h-0 h-full w-full'
        : 'flex h-screen h-[100svh] md:h-[100dvh]',
    ]"
    :style="!embedded ? { height: 'var(--app-vh, 100svh)' } : null"
    @click="closeSettingsMenu"
  >
    <!-- Mobile sidebar backdrop (standalone shell only) -->
    <Transition v-if="!embedded" name="fade">
      <div
        v-if="showMobileSidebar"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        @click="showMobileSidebar = false"
      ></div>
    </Transition>

    <!-- ==================== LEFT SIDEBAR (260px) ==================== -->
    <!-- Hidden in embedded mode — V2Shell owns the global nav, and chat
         history moves to the right-side ChatHistoryDrawer. -->
    <div
      v-if="!embedded"
      class="flex flex-col bg-brand-dark md:bg-white/[0.02] border-r border-white/10 transition-transform duration-200 z-50"
      :class="[
        'fixed inset-y-0 left-0 w-[260px] md:static md:translate-x-0',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <!-- Logo / Brand -->
      <div class="shrink-0 flex items-center px-4 py-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-sick-gradient flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 2 5.5-6L21 5M21 5h-5M21 5v5" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-white/90">RankMatic AI</span>
        </div>
      </div>

      <!-- New Chat button -->
      <div class="px-3 pb-3">
        <button
          @click="handleNewChat"
          class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      <!-- Conversation list -->
      <div class="flex-1 overflow-y-auto px-2 space-y-4">
        <template v-for="(group, key) in {
          'Today': aiStore.groupedConversations.today,
          'Yesterday': aiStore.groupedConversations.yesterday,
          'This Week': aiStore.groupedConversations.thisWeek,
          'Older': aiStore.groupedConversations.older
        }" :key="key">
          <div v-if="group.length">
            <div class="px-2 py-1.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">{{ key }}</div>
            <div class="space-y-0.5">
              <div
                v-for="conv in group"
                :key="conv.id"
                @click="selectConversation(conv.id)"
                class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                :class="aiStore.activeConversationId === conv.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'"
              >
                <svg v-if="conv.title && conv.title.includes('(thread)')" class="w-3.5 h-3.5 shrink-0 text-brand-purple/50" viewBox="0 0 20 20" fill="none">
                  <path d="M3 4.5C3 3.67 3.67 3 4.5 3h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H8l-3.15 2.36A.75.75 0 013.5 14.8V13H4.5 3V4.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 8h6M7 5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
                <button
                  @click.stop="handleDeleteConversation(conv.id)"
                  class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="!aiStore.conversations.length && !aiStore.loading" class="px-3 py-6 text-center">
          <p class="text-sm text-white/30">No conversations yet</p>
        </div>
      </div>

      <!-- ===== Sidebar Bottom ===== -->
      <div class="shrink-0 border-t border-white/10 px-3 py-3 space-y-1">
        <!-- Settings menu (popover) -->
        <div class="relative settings-menu-container">
          <button
            @click.stop="showSettingsMenu = !showSettingsMenu"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Menu
            <svg class="w-3 h-3 ml-auto transition-transform" :class="showSettingsMenu ? 'rotate-180' : ''" fill="none" viewBox="0 0 20 20" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </button>
          <!-- Popover menu -->
          <Transition name="fade">
            <div
              v-if="showSettingsMenu"
              class="absolute bottom-full left-0 right-0 mb-1 bg-brand-dark border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
            >
              <button
                @click="openInstructions"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Custom Instructions
              </button>
              <button
                @click="showSettingsMenu = false; router.push('/settings')"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93l.225.112c.38.19.83.175 1.193-.06l.753-.5a1.125 1.125 0 011.37.49l.547.946a1.125 1.125 0 01-.26 1.43l-.604.5c-.33.273-.483.684-.462 1.1l.013.26c.02.414.173.823.504 1.095l.605.5c.424.35.534.955.26 1.431l-.547.947a1.125 1.125 0 01-1.37.49l-.752-.5c-.364-.234-.814-.25-1.194-.06l-.225.112c-.396.166-.71.506-.78.93l-.15.893c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.893c-.071-.424-.384-.764-.781-.93l-.225-.113c-.38-.19-.83-.175-1.193.06l-.753.5a1.125 1.125 0 01-1.37-.49l-.546-.946a1.125 1.125 0 01.26-1.431l.604-.5c.33-.272.483-.683.462-1.1l-.013-.259c-.02-.415-.173-.824-.504-1.096l-.605-.5a1.125 1.125 0 01-.26-1.43l.547-.947a1.125 1.125 0 011.37-.49l.752.5c.364.234.814.25 1.194.06l.225-.113c.396-.166.71-.506.78-.93l.15-.893z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Properties & Settings
              </button>
              <div class="border-t border-white/5"></div>
              <button
                @click="showSettingsMenu = false; handleLogout()"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign Out
              </button>
            </div>
          </Transition>
        </div>

        <!-- User profile row -->
        <div class="flex items-center gap-2.5 px-3 py-2 mt-1 border-t border-white/5 pt-3">
          <div v-if="auth.user?.picture" class="w-8 h-8 rounded-full overflow-hidden shrink-0">
            <img :src="auth.user.picture" :alt="auth.user.name || 'User'" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-8 h-8 rounded-full bg-brand-purple/30 flex items-center justify-center shrink-0">
            <span class="text-xs font-bold text-brand-purple">{{ userInitials }}</span>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-white/80 truncate">{{ auth.user?.name || 'User' }}</div>
            <div class="text-[11px] text-white/30 truncate">{{ auth.user?.email || '' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== CENTER: CHAT AREA ==================== -->
    <div :class="embedded
      ? 'flex-1 flex flex-col min-w-0 min-h-0'
      : 'flex-1 flex flex-col min-w-0 min-h-0 h-full'">
      <!-- Chat header -->
      <div class="shrink-0 border-b border-white/10 bg-brand-dark z-30">
        <div class="flex items-center justify-between px-3 sm:px-6 py-3 gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <!-- Mobile hamburger (hidden in embedded mode — V2Header owns it) -->
            <button
              v-if="!embedded"
              @click="showMobileSidebar = !showMobileSidebar"
              class="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-semibold text-white leading-tight truncate">
                {{ aiStore.activeConversation?.title || 'New Chat' }}
              </span>
              <span class="text-[11px] text-white/40 leading-tight hidden sm:block">
                <template v-if="aiStore.pinnedPropertyIds.length > 0">
                  <span class="text-brand-purple font-medium">{{ aiStore.pinnedPropertyIds.length }} of {{ settings.activeProperties.length }}</span> properties scoped
                </template>
                <template v-else>
                  {{ settings.activeProperties.length }} properties connected
                </template>
                <template v-if="apiUsage?.today">
                  <span class="relative inline-block ml-1.5" @mouseenter="showApiUsageTooltip = true" @mouseleave="showApiUsageTooltip = false">
                    <span class="text-white/30 cursor-help">| API: {{ apiUsage.today.ga4_calls }} GA4<template v-if="apiUsage.today.search_console_calls">, {{ apiUsage.today.search_console_calls }} SC</template> today</span>
                    <div v-if="showApiUsageTooltip" class="absolute left-0 top-5 z-50 w-64 p-3 bg-brand-dark border border-white/10 rounded-xl shadow-xl text-left">
                      <div class="text-[11px] font-semibold text-white mb-2">API Usage</div>
                      <div class="space-y-1.5 text-[11px]">
                        <div class="flex justify-between"><span class="text-white/50">GA4 calls today</span><span class="text-white font-medium">{{ apiUsage.today.ga4_calls }}</span></div>
                        <div class="flex justify-between"><span class="text-white/50">SC calls today</span><span class="text-white font-medium">{{ apiUsage.today.search_console_calls }}</span></div>
                        <div class="flex justify-between"><span class="text-white/50">GA4 last 7 days</span><span class="text-white font-medium">{{ apiUsage.last_7_days?.ga4_calls || 0 }}</span></div>
                        <div class="flex justify-between"><span class="text-white/50">GA4 last 30 days</span><span class="text-white font-medium">{{ apiUsage.last_30_days?.ga4_calls || 0 }}</span></div>
                        <div v-if="apiUsage.today.by_property?.length" class="border-t border-white/5 pt-1.5 mt-1.5">
                          <div class="text-[10px] text-white/30 mb-1">Top properties today</div>
                          <div v-for="prop in apiUsage.today.by_property.slice(0, 5)" :key="prop.property_id" class="flex justify-between">
                            <span class="text-white/40 truncate max-w-[150px]">{{ prop.property_name }}</span>
                            <span class="text-white/70 font-medium ml-1">{{ prop.ga4_calls }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </span>
                </template>
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <!-- Plan toggle (only in plan mode or when plan has items) -->
            <button
              v-if="aiStore.planMode || aiStore.planItems.length > 0"
              @click="showPlan = !showPlan"
              class="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer"
              :class="showPlan ? 'text-amber-400 bg-amber-400/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'"
              title="Analysis Plan"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>

            <!-- Memory toggle (brain icon) -->
            <button
              @click="togglePanel('memory')"
              class="relative w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer"
              :class="showMemory ? 'text-purple-400 bg-purple-400/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'"
              title="AI Memory"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                <path d="M12 5v13M9.5 9h5M8 14h8" />
              </svg>
              <span
                v-if="aiStore.instructions.length > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-purple-500 text-[9px] font-bold text-white flex items-center justify-center leading-none"
              >{{ aiStore.instructions.length }}</span>
            </button>

            <!-- Events toggle (icon only) -->
            <button
              @click="togglePanel('events')"
              class="relative w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer"
              :class="showEvents ? 'text-amber-400 bg-amber-400/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'"
              title="Business Events"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span
                v-if="aiStore.events.length > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center leading-none"
              >{{ aiStore.events.length }}</span>
            </button>

            <!-- Knowledge toggle (icon only) -->
            <button
              @click="togglePanel('knowledge')"
              class="relative w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer"
              :class="showKnowledge ? 'text-brand-cyan bg-brand-cyan/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'"
              title="Knowledge Base"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <span
                v-if="aiStore.knowledgeCount > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[9px] font-bold text-white flex items-center justify-center leading-none"
              >{{ aiStore.knowledgeCount }}</span>
            </button>

            <!-- Report toggle -->
            <button
              @click="togglePanel('report')"
              class="w-8 h-8 sm:w-auto sm:h-auto inline-flex items-center justify-center sm:justify-start gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              :class="showReport ? 'text-brand-cyan bg-brand-cyan/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span class="hidden sm:inline">Report</span>
            </button>

            <!-- Close the full-screen chat -->
            <button
              @click="emit('close')"
              class="w-8 h-8 inline-flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-1"
              title="Close chat"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Property scope picker -->
      <div v-if="settings.activeProperties.length > 1" class="shrink-0 border-b border-white/5 bg-brand-dark/50 relative">
        <div class="flex items-center gap-2 px-3 sm:px-6 py-1.5">
          <span class="text-[10px] text-white/30 uppercase tracking-wide font-semibold shrink-0">Scope:</span>
          <button
            @click="showScopePicker = !showScopePicker"
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border"
            :class="aiStore.pinnedPropertyIds.length > 0
              ? 'bg-brand-purple/20 text-brand-purple border-brand-purple/30'
              : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'"
          >
            <span>{{ scopeButtonLabel }}</span>
            <svg class="w-3 h-3 opacity-60 transition-transform" :class="showScopePicker ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <button
            v-if="aiStore.pinnedPropertyIds.length > 0"
            @click="clearPinnedProperties"
            class="text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >clear</button>
          <span class="text-[10px] text-white/25 ml-auto">click to filter</span>
        </div>

        <!-- Popover -->
        <div
          v-if="showScopePicker"
          class="absolute left-3 sm:left-6 top-full mt-1 z-30 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0f1218] shadow-2xl overflow-hidden"
        >
          <!-- Search -->
          <div class="border-b border-white/5 p-2">
            <div class="relative">
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.2-5.2M16.5 11a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>
              <input
                v-model="scopeSearch"
                type="text"
                :placeholder="`Search ${settings.activeProperties.length} properties…`"
                class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple/50"
                autofocus
              />
            </div>
          </div>

          <!-- View toggle -->
          <div class="flex items-center gap-1 p-1.5 border-b border-white/5 bg-white/[0.02]">
            <button
              v-for="view in [{id:'list',label:'List'},{id:'account',label:'By Account'},{id:'groups',label:'Groups'}]"
              :key="view.id"
              @click="scopeView = view.id"
              class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              :class="scopeView === view.id ? 'bg-brand-purple/20 text-brand-purple' : 'text-white/40 hover:text-white/70 hover:bg-white/5'"
            >{{ view.label }}<span v-if="view.id === 'groups' && settings.propertyGroups?.length" class="ml-1 text-white/30">({{ settings.propertyGroups.length }})</span></button>
          </div>

          <!-- Bulk actions row (List + By Account views) -->
          <div v-if="scopeView !== 'groups'" class="flex items-center justify-between px-3 py-1.5 border-b border-white/5 text-[10px]">
            <span class="text-white/40">
              {{ filteredScopeProps.length }} shown
              <span v-if="aiStore.pinnedPropertyIds.length > 0" class="text-brand-purple ml-1">· {{ aiStore.pinnedPropertyIds.length }} selected</span>
            </span>
            <div class="flex gap-3">
              <button @click="selectAllVisible" class="text-brand-purple hover:underline cursor-pointer">{{ scopeSearch ? 'Select all matching' : 'Select all' }}</button>
              <button @click="clearVisible" class="text-white/50 hover:text-white/80 cursor-pointer">{{ scopeSearch ? 'Clear matching' : 'Clear all' }}</button>
            </div>
          </div>

          <!-- Content area -->
          <div class="max-h-[360px] overflow-y-auto">
            <!-- LIST VIEW -->
            <template v-if="scopeView === 'list'">
              <div v-if="!filteredScopeProps.length" class="px-3 py-6 text-center text-white/30 text-xs">
                No properties match "{{ scopeSearch }}"
              </div>
              <button
                v-for="prop in filteredScopeProps"
                :key="prop.property_id"
                @click="togglePinnedProperty(prop.property_id)"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors cursor-pointer border-b border-white/[0.03] last:border-0"
              >
                <span
                  class="w-3.5 h-3.5 rounded border flex-shrink-0 inline-flex items-center justify-center"
                  :class="aiStore.pinnedPropertyIds.includes(prop.property_id) ? 'bg-brand-purple border-brand-purple' : 'border-white/20'"
                >
                  <svg v-if="aiStore.pinnedPropertyIds.includes(prop.property_id)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="text-xs text-white/80 truncate flex-1">{{ prop.storeName || prop.display_name || prop.property_id }}</span>
                <span v-if="prop.asc_eligible" class="font-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 shrink-0" title="Property fires ASC events">ASC</span>
                <span v-if="prop.account_name" class="text-[10px] text-white/30 truncate max-w-[140px]">{{ prop.account_name }}</span>
              </button>
            </template>

            <!-- BY ACCOUNT VIEW -->
            <template v-else-if="scopeView === 'account'">
              <div v-if="!filteredByAccount.length" class="px-3 py-6 text-center text-white/30 text-xs">
                No accounts match "{{ scopeSearch }}"
              </div>
              <div v-for="acct in filteredByAccount" :key="acct.account_id" class="border-b border-white/[0.03] last:border-0">
                <!-- Account header row -->
                <div class="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <button
                    @click="isAccountFullySelected(acct) ? clearInAccount(acct) : selectAllInAccount(acct)"
                    class="w-3.5 h-3.5 rounded border flex-shrink-0 inline-flex items-center justify-center cursor-pointer"
                    :class="isAccountFullySelected(acct) ? 'bg-brand-purple border-brand-purple' : isAccountPartiallySelected(acct) ? 'bg-brand-purple/30 border-brand-purple/60' : 'border-white/20'"
                    :title="isAccountFullySelected(acct) ? 'Deselect all' : 'Select all'"
                  >
                    <svg v-if="isAccountFullySelected(acct)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <span v-else-if="isAccountPartiallySelected(acct)" class="w-1.5 h-0.5 bg-brand-purple rounded"></span>
                  </button>
                  <button
                    @click="toggleAccountGroup(acct.account_id)"
                    class="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                  >
                    <svg class="w-3 h-3 text-white/30 transition-transform" :class="(expandedAccounts.has(acct.account_id) || scopeSearch) ? 'rotate-90' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    <span class="text-xs font-medium text-white/80 truncate">{{ acct.account_name }}</span>
                    <span class="text-[10px] text-white/30 ml-auto">{{ acct.props.length }}</span>
                  </button>
                </div>
                <!-- Properties under account -->
                <div v-if="expandedAccounts.has(acct.account_id) || scopeSearch">
                  <button
                    v-for="prop in acct.props"
                    :key="prop.property_id"
                    @click="togglePinnedProperty(prop.property_id)"
                    class="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <span
                      class="w-3.5 h-3.5 rounded border flex-shrink-0 inline-flex items-center justify-center"
                      :class="aiStore.pinnedPropertyIds.includes(prop.property_id) ? 'bg-brand-purple border-brand-purple' : 'border-white/20'"
                    >
                      <svg v-if="aiStore.pinnedPropertyIds.includes(prop.property_id)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </span>
                    <span class="text-xs text-white/70 truncate flex-1">{{ prop.storeName || prop.display_name || prop.property_id }}</span>
                    <span v-if="prop.asc_eligible" class="font-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 shrink-0" title="Property fires ASC events">ASC</span>
                  </button>
                </div>
              </div>
            </template>

            <!-- GROUPS VIEW -->
            <template v-else>
              <div class="p-3 space-y-2">
                <!-- Save current as new group -->
                <div v-if="!showNewGroupForm" class="flex items-center justify-between rounded-lg border border-dashed border-white/10 px-3 py-2 hover:border-white/20 transition-colors">
                  <span class="text-[11px] text-white/50">
                    <span v-if="aiStore.pinnedPropertyIds.length === 0">Select properties first, then save as group</span>
                    <span v-else>{{ aiStore.pinnedPropertyIds.length }} properties selected</span>
                  </span>
                  <button
                    @click="showNewGroupForm = true"
                    :disabled="aiStore.pinnedPropertyIds.length === 0"
                    class="px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-purple/15 text-brand-purple hover:bg-brand-purple/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >+ New group</button>
                </div>
                <div v-else class="rounded-lg border border-brand-purple/30 bg-brand-purple/5 p-2 space-y-1.5">
                  <input
                    v-model="newGroupName"
                    type="text"
                    placeholder="Group name (e.g. My Kia stores)"
                    class="w-full px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple/50"
                    @keyup.enter="saveCurrentAsGroup"
                    autofocus
                  />
                  <div class="flex items-center gap-1.5">
                    <button @click="saveCurrentAsGroup" :disabled="!newGroupName.trim()" class="px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-purple text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Save {{ aiStore.pinnedPropertyIds.length }} properties</button>
                    <button @click="showNewGroupForm = false; newGroupName = ''" class="px-2 py-1 rounded-md text-[11px] text-white/50 hover:text-white/80 cursor-pointer">Cancel</button>
                  </div>
                </div>

                <!-- Saved groups list -->
                <div v-if="!settings.propertyGroups?.length" class="text-center text-white/30 text-xs py-6">
                  No saved groups yet. Select some properties from the List or By Account view, then come back here to save them as a named group.
                </div>
                <div
                  v-for="g in (settings.propertyGroups || [])"
                  :key="g.id"
                  class="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                >
                  <div class="flex items-center gap-2 px-3 py-2">
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium text-white/80 truncate">{{ g.name }}</div>
                      <div class="text-[10px] text-white/40">{{ g.property_ids.length }} {{ g.property_ids.length === 1 ? 'property' : 'properties' }}</div>
                    </div>
                    <button @click="applyGroup(g)" class="px-2 py-1 rounded-md text-[10px] font-medium bg-brand-purple/15 text-brand-purple hover:bg-brand-purple/25 cursor-pointer transition-colors">Use</button>
                    <button @click="addGroupToSelection(g)" class="px-2 py-1 rounded-md text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 cursor-pointer transition-colors" title="Add to current selection">+ Add</button>
                    <button @click="removeGroup(g)" class="px-2 py-1 rounded-md text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors" title="Delete group">✕</button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-white/[0.02]">
            <span class="text-[10px] text-white/40">
              <span v-if="aiStore.pinnedPropertyIds.length === 0">Empty selection = all properties in scope</span>
              <span v-else>Only selected properties will be analyzed</span>
            </span>
            <button @click="closeScopePicker" class="px-3 py-1 rounded-md text-xs font-medium bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors cursor-pointer">Done</button>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <ChatMessages
        :messages="aiStore.messages"
        :isStreaming="aiStore.isStreaming"
        :activeToolCalls="aiStore.activeToolCalls"
        :highlights="aiStore.highlights"
        :highlightsLoading="aiStore.highlightsLoading"
        :propertyName="settings.activeProperty?.storeName || settings.activeProperty?.displayName || ''"
        :planMode="aiStore.planMode"
        class="flex-1 overflow-hidden"
        @suggestion="handleSendMessage"
        @feedback="handleFeedback"
        @drilldown="openDrilldown($event)"
        @fork="handleFork"
      />

      <!-- Input + Time Saved bar -->
      <div class="shrink-0 max-w-[700px] w-full mx-auto px-2 sm:px-4 pt-3 sm:pt-4 pb-[env(safe-area-inset-bottom)]">
        <!-- Plan / Execute Mode Toggle -->
        <div class="flex flex-col items-center mb-2">
          <div class="flex items-center gap-1">
            <button
              @click="aiStore.planMode = false; showPlan = false"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
              :class="!aiStore.planMode
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-white/30 hover:text-white/50 hover:bg-white/5'"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Execute
            </button>
            <button
              @click="aiStore.planMode = true; showPlan = true"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
              :class="aiStore.planMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-white/30 hover:text-white/50 hover:bg-white/5'"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Plan
            </button>
          </div>
          <p v-if="aiStore.planMode" class="text-[10px] text-amber-400/60 mt-1">
            Plan Mode - AI will discuss strategy and help plan your analysis without fetching data
          </p>
        </div>

        <ChatInput
          :disabled="aiStore.isStreaming"
          @send="handleSendMessage"
        />

        <!-- Time saved bar -->
        <div class="flex items-center justify-center gap-2 sm:gap-3 pb-3 pt-1 flex-wrap px-2">
          <div v-if="aiStore.isStreaming && aiStore.streamingTimeSaved > 0" class="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span class="tabular-nums">{{ streamingTimeSavedFormatted }} saved so far</span>
          </div>
          <div v-else-if="aiStore.timeSaved?.this_month" class="flex items-center gap-1 text-[11px] text-emerald-400">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {{ timeSavedFormatted }} saved this month
              <template v-if="todayTimeSavedFormatted"> · {{ todayTimeSavedFormatted }} today</template>
            </span>
          </div>
          <span class="text-[11px] text-white/40 hidden sm:inline">Select text &amp; click Improve to train the model</span>
        </div>
      </div>
    </div>

    <!-- ==================== RIGHT PANELS ==================== -->

    <!-- Plan Panel -->
    <transition name="slide-panel">
      <div
        v-if="showPlan"
        class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] xl:w-[420px] shrink-0 z-50 md:z-auto"
      >
        <PlanPanel
          :planItems="aiStore.planItems"
          :isStreaming="aiStore.isStreaming"
          @toggle="(id) => {
            const item = aiStore.planItems.find(i => i.id === id)
            if (item) item.enabled = !item.enabled
          }"
          @remove="(id) => {
            aiStore.planItems = aiStore.planItems.filter(i => i.id !== id)
          }"
          @execute="() => {
            showPlan = false
            aiStore.executePlan()
          }"
          @close="showPlan = false"
        />
      </div>
    </transition>

    <!-- Report Panel -->
    <transition name="slide-panel">
      <div
        v-if="showReport"
        class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] xl:w-[420px] shrink-0 z-50 md:z-auto"
      >
        <ReportPanel
          :reportSections="aiStore.reportSections"
          :isStreaming="aiStore.isStreaming"
          :propertyName="settings.activeProperty?.storeName || settings.activeProperty?.displayName || ''"
          @close="showReport = false"
        />
      </div>
    </transition>

    <!-- Events Panel -->
    <transition name="slide-panel">
      <div
        v-if="showEvents"
        class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] xl:w-[420px] shrink-0 z-50 md:z-auto"
      >
        <div class="h-full flex flex-col bg-brand-dark border-l border-white/10">
          <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-semibold text-white">Business Events</h3>
            <div class="flex items-center gap-2">
              <button
                @click="syncAnnotations"
                :disabled="syncingAnnotations"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-40 cursor-pointer transition-colors"
                title="Import annotations from GA4"
              >
                <svg v-if="syncingAnnotations" class="w-3 h-3 animate-spin inline mr-1" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {{ syncingAnnotations ? 'Syncing...' : 'Sync GA4' }}
              </button>
              <button
                @click="showEventForm = !showEventForm"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-sick-gradient text-white cursor-pointer"
              >{{ showEventForm ? 'Cancel' : 'Add Event' }}</button>
              <button
                @click="showEvents = false"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <!-- Sync result message -->
            <div v-if="syncResult" class="px-3 py-2 rounded-lg text-xs" :class="syncResult.error ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'">
              <template v-if="syncResult.error">{{ syncResult.error }}</template>
              <template v-else>
                Synced {{ syncResult.synced }} annotation{{ syncResult.synced !== 1 ? 's' : '' }} from GA4
                <span v-if="syncResult.errors?.length" class="text-amber-400 ml-1">({{ syncResult.errors.length }} property errors)</span>
              </template>
            </div>
            <p class="text-xs text-white/40">Log business events so the AI can reference them in analysis.</p>
            <div v-if="showEventForm" class="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
              <div>
                <label class="text-xs text-white/50 mb-1 block">Date</label>
                <input v-model="eventForm.date" type="date" class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple" />
              </div>
              <div>
                <label class="text-xs text-white/50 mb-1 block">Title</label>
                <input v-model="eventForm.title" placeholder="e.g., Launched new VDP page design" class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple" />
              </div>
              <div>
                <label class="text-xs text-white/50 mb-1 block">Description (optional)</label>
                <textarea v-model="eventForm.description" rows="2" placeholder="Additional details..." class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-purple"></textarea>
              </div>
              <button @click="addEvent" :disabled="!eventForm.title.trim() || !eventForm.date || savingEvent" class="px-4 py-2 rounded-lg bg-sick-gradient text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">{{ savingEvent ? 'Saving...' : 'Save Event' }}</button>
            </div>
            <div class="space-y-2">
              <div v-for="evt in aiStore.events" :key="evt.id" class="group px-3 py-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <!-- Date + Type badge row -->
                    <div class="flex items-center gap-2 mb-1.5">
                      <span class="text-xs font-semibold text-brand-cyan whitespace-nowrap">{{ formatEventDate(evt.event_date) }}</span>
                      <span v-if="evt.event_type === 'annotation'" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">GA4</span>
                      <span v-else-if="evt.event_type === 'campaign'" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Campaign</span>
                      <span v-else-if="evt.event_type === 'vendor'" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">Vendor</span>
                      <span v-else-if="evt.event_type === 'budget'" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">Budget</span>
                      <span v-else-if="evt.event_type" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/50 border border-white/10">{{ evt.event_type }}</span>
                    </div>
                    <!-- Title -->
                    <p class="text-sm font-medium text-white leading-snug">{{ evt.title }}</p>
                    <!-- Description (cleaned of bracket tags) -->
                    <p v-if="cleanDescription(evt.description)" class="text-xs text-white/40 mt-1 leading-relaxed">{{ cleanDescription(evt.description) }}</p>
                    <!-- Property tag -->
                    <div v-if="extractProperty(evt)" class="mt-1.5">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.06]">
                        <svg class="w-2.5 h-2.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                        {{ extractProperty(evt) }}
                      </span>
                    </div>
                  </div>
                  <button @click="removeEvent(evt.id)" class="shrink-0 ml-2 text-white/0 group-hover:text-white/20 hover:!text-red-400 transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <p v-if="!aiStore.events.length" class="text-sm text-white/30 text-center py-4">No events yet. Add one to help the AI understand your business context.</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- Knowledge Panel -->
    <transition name="slide-panel">
      <div
        v-if="showKnowledge"
        class="fixed inset-0 md:static md:inset-auto w-full md:w-[380px] xl:w-[420px] shrink-0 z-50 md:z-auto"
      >
        <KnowledgePanel
          :openDocId="openKnowledgeDocId"
          @close="showKnowledge = false"
        />
      </div>
    </transition>

    <!-- Memory Panel -->
    <transition name="slide-panel">
      <div
        v-if="showMemory"
        class="fixed inset-0 md:static md:inset-auto w-full md:w-[520px] xl:w-[600px] shrink-0 z-50 md:z-auto"
      >
        <div class="h-full flex flex-col bg-bg border-l border-hairline">
          <!-- Header -->
          <div class="shrink-0 px-5 py-3 border-b border-hairline bg-bg-elev/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="size-1.5 rounded-full bg-brand"></span>
                <h3 class="font-display text-[15px] font-medium text-fg tracking-[-0.01em]">Memory</h3>
                <span class="font-mono text-[10px] tracking-[0.16em] uppercase text-fg-faint">{{ memoryStats.active }} active · {{ memoryStats.total }} total</span>
              </div>
              <div class="flex items-center gap-2">
                <a href="/memory" target="_blank" class="font-mono text-[10px] tracking-[0.14em] uppercase text-fg-faint hover:text-brand transition-colors">FULL PAGE →</a>
                <button @click="showMemory = false" class="w-7 h-7 rounded-md flex items-center justify-center text-fg-faint hover:text-fg hover:bg-bg-elev transition-colors cursor-pointer">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <!-- Add memory -->
            <div class="surface-raised p-3">
              <div class="font-mono text-[10px] tracking-[0.18em] uppercase text-brand mb-2">ADD MEMORY</div>
              <textarea
                v-model="memoryAddText"
                rows="2"
                placeholder="What should the AI remember?"
                class="w-full bg-bg-elev border border-hairline rounded-md px-3 py-2 text-[13.5px] text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand-border resize-none"
              ></textarea>
              <div class="flex items-center gap-2 mt-2">
                <button
                  @click="memoryAdd(false)"
                  :disabled="!memoryAddText.trim() || memoryAdding"
                  class="px-3 py-1.5 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand-deep disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                >{{ memoryAdding ? 'Saving…' : 'Save' }}</button>
                <span class="font-mono text-[10px] text-fg-faint">Auto-classified · dedup-checked</span>
              </div>
              <!-- Duplicate suggestion -->
              <div v-if="memoryDupSuggestion" class="mt-2 p-2.5 rounded-md border border-brand-border bg-brand-soft">
                <div class="font-mono text-[10px] tracking-[0.18em] uppercase text-brand mb-1">SIMILAR ({{ memoryDupSuggestion.score }}% MATCH)</div>
                <div class="text-[12.5px] text-fg mb-1">{{ memoryDupSuggestion.content }}</div>
                <div class="text-[10.5px] text-fg-muted mb-2">{{ memoryDupSuggestion.reason }}</div>
                <div class="flex gap-1.5">
                  <button @click="memoryAdd(true)" class="px-2 py-0.5 rounded text-[11px] font-medium bg-fg text-bg hover:bg-brand cursor-pointer transition">Save anyway</button>
                  <button @click="memoryDupSuggestion = null; memoryAddText = ''" class="px-2 py-0.5 rounded text-[11px] border border-hairline text-fg-muted hover:text-fg cursor-pointer">Discard new</button>
                </div>
              </div>
            </div>

            <!-- Filter chips -->
            <div class="flex items-center gap-1 flex-wrap">
              <span class="font-mono text-[10px] tracking-[0.16em] uppercase text-fg-faint mr-1">SHOW</span>
              <button v-for="f in ['all','active','resolved','archived']" :key="f"
                @click="memoryFilter = f"
                class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] transition cursor-pointer"
                :class="memoryFilter === f ? 'bg-brand-soft text-brand border border-brand-border' : 'border border-hairline text-fg-muted hover:text-fg'"
              >{{ f }}</button>
            </div>
            <div class="flex items-center gap-1 flex-wrap -mt-2">
              <span class="font-mono text-[10px] tracking-[0.16em] uppercase text-fg-faint mr-1">TYPE</span>
              <button @click="memoryTypeFilter = 'all'"
                class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] transition cursor-pointer"
                :class="memoryTypeFilter === 'all' ? 'bg-brand-soft text-brand border border-brand-border' : 'border border-hairline text-fg-muted hover:text-fg'"
              >ALL</button>
              <button v-for="(label, t) in MEMORY_TYPE_LABELS" :key="t"
                @click="memoryTypeFilter = t"
                class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] transition cursor-pointer"
                :class="memoryTypeFilter === t ? 'bg-brand-soft text-brand border border-brand-border' : 'border border-hairline text-fg-muted hover:text-fg'"
              >{{ label }} <span class="text-fg-faint ml-0.5">{{ memoryStats.byType[t] || 0 }}</span></button>
            </div>

            <!-- Memory items -->
            <div v-if="memoryLoading" class="text-center text-fg-faint py-8 text-[12px]">Loading…</div>
            <div v-else-if="!filteredMemoryItems.length" class="text-center text-fg-faint py-8 text-[12px]">No memories match these filters.</div>
            <div v-else class="space-y-2">
              <div v-for="m in filteredMemoryItems" :key="m.id"
                class="surface p-3 transition hover:border-hairline-bold"
                :class="{ 'opacity-60': (m.status === 'archived' || !m.active), 'opacity-80': m.status === 'resolved' }"
              >
                <div class="flex items-start gap-2 mb-1.5">
                  <span class="font-mono text-[9px] tracking-[0.16em] uppercase px-1.5 py-0.5 rounded border whitespace-nowrap"
                    :class="{
                      'text-brand border-brand-border bg-brand-soft': (m.memory_type || 'fact') === 'fact',
                      'text-positive border-positive bg-bg-elev': (m.memory_type || 'fact') === 'alias',
                      'text-fg-muted border-hairline-bold bg-bg-elev': (m.memory_type || 'fact') === 'preference',
                      'text-fg border-hairline-bold bg-bg-raised': (m.memory_type || 'fact') === 'heuristic',
                      'text-alert border-alert bg-bg-elev': ['caveat','watch'].includes(m.memory_type || 'fact'),
                    }"
                  >{{ MEMORY_TYPE_LABELS[m.memory_type || 'fact'] }}</span>
                  <span v-if="m.status && m.status !== 'active'" class="font-mono text-[9px] tracking-[0.16em] uppercase px-1.5 py-0.5 rounded text-fg-faint border border-hairline">{{ m.status }}</span>
                  <span v-if="m.source === 'ai'" class="font-mono text-[9px] text-fg-faint">· saved by AI</span>
                  <span class="ml-auto font-mono text-[9px] text-fg-faint" v-if="m.reference_count">USED {{ m.reference_count }}x</span>
                </div>

                <div v-if="memoryEditId === m.id" class="space-y-1.5">
                  <textarea v-model="memoryEditText" rows="2" class="w-full bg-bg-elev border border-hairline rounded px-2 py-1.5 text-[13px] text-fg focus:outline-none focus:border-brand-border resize-none"></textarea>
                  <div class="flex gap-1.5">
                    <button @click="memorySaveEdit" class="px-2 py-0.5 rounded text-[11px] bg-brand text-brand-fg font-medium cursor-pointer">Save</button>
                    <button @click="memoryEditId = null" class="px-2 py-0.5 rounded text-[11px] border border-hairline text-fg-muted cursor-pointer">Cancel</button>
                  </div>
                </div>
                <div v-else class="text-[13px] text-fg-muted leading-relaxed mb-2">{{ m.content }}</div>

                <div v-if="m.trigger_keywords?.length && memoryEditId !== m.id" class="mb-2 flex flex-wrap gap-1">
                  <span v-for="(k, i) in m.trigger_keywords" :key="i" class="font-mono text-[9px] px-1 py-0.5 rounded bg-bg-elev border border-hairline text-fg-faint">{{ k }}</span>
                </div>

                <div class="flex items-center gap-1 text-[10px]">
                  <button v-if="memoryEditId !== m.id" @click="memoryStartEdit(m)" class="text-fg-faint hover:text-fg px-1.5 py-0.5 cursor-pointer">Edit</button>
                  <select :value="m.memory_type || 'fact'" @change="memorySetType(m.id, $event.target.value)" class="bg-bg-elev border border-hairline rounded text-[10px] text-fg-muted px-1 py-0 cursor-pointer">
                    <option v-for="(label, t) in MEMORY_TYPE_LABELS" :key="t" :value="t">{{ label }}</option>
                  </select>
                  <span class="ml-auto flex gap-0.5">
                    <button v-if="(m.memory_type || 'fact') === 'watch' && (m.status || 'active') === 'active'" @click="memorySetStatus(m.id, 'resolve')" class="text-positive hover:underline px-1.5 py-0.5 cursor-pointer">Resolved</button>
                    <button v-if="(m.status || 'active') === 'active'" @click="memorySetStatus(m.id, 'archive')" class="text-fg-faint hover:text-fg px-1.5 py-0.5 cursor-pointer">Archive</button>
                    <button v-else @click="memorySetStatus(m.id, 'reactivate')" class="text-fg-faint hover:text-fg px-1.5 py-0.5 cursor-pointer">Reactivate</button>
                    <button @click="memoryDelete(m.id)" class="text-alert/70 hover:text-alert px-1.5 py-0.5 cursor-pointer">Delete</button>
                  </span>
                </div>
              </div>
            </div>

            <p v-if="!aiStore.instructions.length" class="text-sm text-white/30 text-center py-8">
              No memories yet. Tell the AI to "remember" something in chat, or add one above.
            </p>
          </div>
        </div>
      </div>
    </transition>

    <!-- Instructions overlay panel -->
    <Transition name="fade">
      <div v-if="showInstructionsPanel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showInstructionsPanel = false">
        <div class="w-full max-w-lg mx-4 max-h-[80vh] flex flex-col bg-brand-dark border border-white/10 rounded-2xl shadow-2xl">
          <div class="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 class="text-base font-semibold text-white">Custom Instructions</h3>
            <button @click="showInstructionsPanel = false" class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p class="text-xs text-white/40">These instructions are included in every AI conversation to personalize responses.</p>
            <div>
              <textarea v-model="newInstruction" rows="2" placeholder="e.g., Always compare to last year when discussing trends..." class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-purple"></textarea>
              <button @click="addInstruction" :disabled="!newInstruction.trim() || addingInstruction" class="mt-2 px-4 py-2 rounded-lg bg-sick-gradient text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">{{ addingInstruction ? 'Adding...' : 'Add Instruction' }}</button>
            </div>
            <div class="space-y-2">
              <div v-for="inst in aiStore.instructions" :key="inst.id" class="flex items-start gap-3 px-3 py-3 rounded-xl border transition-all" :class="inst.active !== false ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] opacity-50'">
                <button @click="toggleInstructionActive(inst)" class="relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0 mt-0.5" :class="inst.active !== false ? 'bg-brand-purple' : 'bg-white/20'">
                  <div class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" :class="inst.active !== false ? 'translate-x-4' : 'translate-x-0.5'"></div>
                </button>
                <p class="flex-1 text-sm text-white/70 leading-relaxed">{{ inst.content }}</p>
                <button @click="removeInstruction(inst.id)" class="shrink-0 text-white/20 hover:text-red-400 transition-colors cursor-pointer">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-if="!aiStore.instructions.length" class="text-sm text-white/30 text-center py-4">No instructions yet. Add one above to customize AI behavior.</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Drill-Down Overlay -->
    <DrillDownOverlay
      v-if="drillDownConfig"
      :metric="drillDownConfig.metric"
      :metricName="drillDownConfig.metricName"
      :currentValue="drillDownConfig.currentValue"
      :previousValue="drillDownConfig.previousValue"
      :changeValue="drillDownConfig.changeValue"
      :propertyId="drillDownConfig.propertyId || ''"
      :propertyName="drillDownConfig.propertyName || settings.activeProperty?.displayName || ''"
      @close="closeDrilldown"
    />
  </div>
</template>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: width 0.25s ease, opacity 0.25s ease;
  overflow: hidden;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
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
</style>
