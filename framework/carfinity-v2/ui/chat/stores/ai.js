// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import AiAPI from '../api/AiAPI'

export const useAiStore = defineStore('chatAi', () => {
  const conversations = ref([])
  const activeConversationId = ref(null)
  const messages = ref([])
  const isStreaming = ref(false)
  const streamingText = ref('')
  const activeToolCalls = ref([])
  const reportSections = ref([])
  const usage = ref({ totalCost: 0, totalTokens: 0 })
  const loading = ref(false)
  const instructions = ref([])
  const events = ref([])
  const highlights = ref([])
  const highlightsLoading = ref(false)
  const pendingQuestion = ref(null)
  // Floating chat dock control. The dashboard's per-KPI chat icons request the
  // dock to open by bumping `dockOpenRequest`; ChatDock watches it. The
  // question is delivered separately via `setPendingQuestion` *after* the dock
  // has mounted ChatWidget, so the widget's pendingQuestion watcher fires.
  const dockOpenRequest = ref(0)
  const dockStarterQuestion = ref(null)
  const timeSaved = ref({ all_time: 0, this_month: 0, today: 0 })
  const streamingTimeSaved = ref(0)
  const planMode = ref(false)
  const planItems = ref([])
  const planExecuting = ref(false)
  const knowledgeCount = ref(0)
  const pinnedPropertyIds = ref([]) // empty = all properties (no filter)

  const activeConversation = computed(() =>
    conversations.value.find(c => c.id === activeConversationId.value)
  )

  const groupedConversations = computed(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const groups = { today: [], yesterday: [], thisWeek: [], older: [] }
    for (const conv of conversations.value) {
      const date = new Date(conv.created_at)
      if (date >= now) groups.today.push(conv)
      else if (date >= yesterday) groups.yesterday.push(conv)
      else if (date >= weekAgo) groups.thisWeek.push(conv)
      else groups.older.push(conv)
    }
    return groups
  })

  function setPendingQuestion(text, context = {}) {
    pendingQuestion.value = { text, context }
  }

  function consumePendingQuestion() {
    const q = pendingQuestion.value
    pendingQuestion.value = null
    return q
  }

  // Open the floating chat dock, optionally with a starter question. The
  // question is stashed in `dockStarterQuestion`; ChatDock delivers it via
  // `setPendingQuestion` once ChatWidget is mounted.
  function openDock({ question = null, text = null, context = {} } = {}) {
    // Accept either `question` or `text` for the starter question — callers
    // (dashboard tiles, Do This Now rows) pass `text`.
    const starter = question ?? text
    dockStarterQuestion.value = starter ? { text: starter, context } : null
    dockOpenRequest.value++
  }

  function consumeDockStarter() {
    const q = dockStarterQuestion.value
    dockStarterQuestion.value = null
    return q
  }

  async function fetchConversations() {
    loading.value = true
    try {
      conversations.value = await AiAPI.getConversations()
    } catch {
      conversations.value = []
    } finally {
      loading.value = false
    }
  }

  function processLoadedMessages(rawMessages) {
    const result = []
    let lastAssistant = null

    for (const m of rawMessages) {
      if (m.role === 'assistant') {
        const msg = { id: m.id, role: 'assistant', content: m.content || '', created_at: m.created_at, toolCalls: [] }
        if (m.tool_calls) {
          try {
            const parsed = JSON.parse(m.tool_calls)
            const calls = Array.isArray(parsed) ? parsed : [parsed]
            msg.toolCalls = calls.map(tc => ({
              id: tc.id || 'tool-' + Math.random().toString(36).slice(2, 8),
              name: tc.function?.name || tc.name || 'unknown',
              args: tc.function?.arguments
                ? (typeof tc.function.arguments === 'string' ? (() => { try { return JSON.parse(tc.function.arguments) } catch { return {} } })() : tc.function.arguments)
                : (tc.args || {}),
              status: 'completed',
              result: tc._result || null,
            }))
          } catch { /* ignore */ }
        }
        result.push(msg)
        lastAssistant = msg
      } else if (m.role === 'tool') {
        if (lastAssistant && lastAssistant.toolCalls.length > 0) {
          let toolCallId = null
          if (m.tool_calls) {
            try { toolCallId = JSON.parse(m.tool_calls).tool_call_id } catch {}
          }
          if (toolCallId) {
            const tc = lastAssistant.toolCalls.find(t => t.id === toolCallId)
            if (tc) {
              try { tc.result = JSON.parse(m.content) } catch { tc.result = m.content }
            }
          }
        }
      } else {
        result.push({ id: m.id, role: m.role, content: m.content || '', created_at: m.created_at })
        lastAssistant = null
      }
    }

    for (const msg of result) {
      if (msg.role !== 'assistant') continue
      if (msg.toolCalls && msg.toolCalls.length) {
        msg.blocks = [
          ...msg.toolCalls.map((tc, i) => { tc.type = 'tool'; tc.block_index = i; return tc }),
          ...(msg.content ? [{ type: 'text', content: msg.content, block_index: msg.toolCalls.length }] : []),
        ]
      } else {
        msg.blocks = msg.content ? [{ type: 'text', content: msg.content, block_index: 0 }] : []
      }
    }

    return result
  }

  function rebuildReportSections(processedMessages) {
    const sections = []
    let idx = 0
    for (const msg of processedMessages) {
      if (msg.role !== 'assistant' || !msg.toolCalls || !msg.toolCalls.length) continue
      const toolCalls = msg.toolCalls
        .filter(tc => tc.name !== 'think' && tc.status === 'completed')
        .map(tc => ({ id: tc.id, name: tc.name, args: tc.args, result: tc.result }))
      if (toolCalls.length > 0) {
        idx++
        sections.push({ id: 'section-' + idx, narrative: msg.content || '', toolCalls })
      }
    }
    // Add final assistant message (no tool calls) as final analysis section
    const lastMsg = processedMessages[processedMessages.length - 1]
    if (lastMsg?.role === 'assistant' && (!lastMsg.toolCalls || !lastMsg.toolCalls.length) && lastMsg.content) {
      idx++
      sections.push({ id: 'section-final', narrative: lastMsg.content, toolCalls: [], isFinalAnalysis: true })
    }
    return sections
  }

  async function loadConversation(id) {
    activeConversationId.value = id
    try {
      const data = await AiAPI.getConversation(id)
      const processed = processLoadedMessages(data.messages || [])
      messages.value = processed
      reportSections.value = rebuildReportSections(processed)
    } catch {
      messages.value = []
      reportSections.value = []
    }
  }

  async function createConversation() {
    const data = await AiAPI.createConversation('New Chat')
    activeConversationId.value = data.id
    messages.value = []
    reportSections.value = []
    await fetchConversations()
    return data.id
  }

  async function deleteConversation(id) {
    await AiAPI.deleteConversation(id)
    if (activeConversationId.value === id) {
      activeConversationId.value = null
      messages.value = []
      reportSections.value = []
    }
    await fetchConversations()
  }

  async function forkConversation(messageId) {
    const convId = activeConversationId.value
    if (!convId || !messageId) return null
    const result = await AiAPI.forkConversation(convId, messageId)
    await fetchConversations()
    return result
  }

  async function sendMessage(text, context = {}) {
    if (!text.trim() || isStreaming.value) return

    messages.value.push({
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    })

    isStreaming.value = true
    streamingText.value = ''
    activeToolCalls.value = []
    streamingTimeSaved.value = 0

    const assistantMsgIndex = messages.value.length
    messages.value.push({
      id: 'streaming',
      role: 'assistant',
      content: '',
      toolCalls: [],
      blocks: [],
      created_at: new Date().toISOString(),
    })

    try {
      // Carry the topbar's selected scope (set by AiChat.vue onMounted) into
      // every message, so the backend scopes the analysis to that group /
      // property instead of the user's entire portfolio.
      const sendContext = { ...context }
      if (pinnedPropertyIds.value && pinnedPropertyIds.value.length) {
        sendContext.pinnedPropertyIds = pinnedPropertyIds.value
      }
      const response = await AiAPI.sendMessage(text, activeConversationId.value, sendContext, planMode.value)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleSSEEvent(currentEventType, data, assistantMsgIndex)
            } catch { /* ignore */ }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error)
      messages.value[assistantMsgIndex].content += '\n\n[Error: Failed to get response]'
    } finally {
      isStreaming.value = false
      streamingText.value = ''
      activeToolCalls.value = []
      fetchConversations()
    }
  }

  function handleSSEEvent(eventType, data, msgIndex) {
    const msg = messages.value[msgIndex]
    if (!msg) return

    switch (eventType) {
      case 'message_start':
        if (data.conversationId) activeConversationId.value = data.conversationId
        break

      case 'text_delta': {
        const deltaText = data.text || data.delta
        if (deltaText) {
          if (!msg.blocks) msg.blocks = []
          const bi = data.blockIndex ?? data.block_index
          let block = (bi !== undefined && bi !== null)
            ? msg.blocks.find(b => b.type === 'text' && b.block_index === bi)
            : null
          if (!block) {
            block = { type: 'text', content: '', block_index: bi !== undefined && bi !== null ? bi : msg.blocks.length }
            msg.blocks.push(block)
          }
          block.content += deltaText
          msg.content = msg.blocks.filter(b => b.type === 'text').map(b => b.content).join('\n\n')
          streamingText.value = msg.content
        }
        break
      }

      case 'tool_start': {
        const toolCall = {
          id: data.id || 'tool-' + Date.now(),
          name: data.name || data.tool,
          args: data.args || {},
          status: 'running',
          result: null,
        }
        if (!msg.blocks) msg.blocks = []
        const bi = data.blockIndex ?? data.block_index
        msg.blocks.push({
          type: 'tool',
          block_index: bi !== undefined && bi !== null ? bi : msg.blocks.length,
          ...toolCall,
        })
        msg.toolCalls = msg.blocks.filter(b => b.type === 'tool')
        activeToolCalls.value.push(toolCall)
        break
      }

      case 'tool_result': {
        const toolId = data.id
        const toolName = data.name || data.tool
        const findTool = (list) => {
          if (toolId) {
            const byId = list.find(t => t.id === toolId)
            if (byId) return byId
          }
          return list.find(t => t.name === toolName && t.status === 'running')
        }
        const existing = findTool(activeToolCalls.value)
        if (existing) {
          existing.status = data.error ? 'failed' : 'completed'
          existing.result = data.error || data.result
        }
        if (msg.blocks) {
          const msgTool = findTool(msg.blocks.filter(b => b.type === 'tool'))
          if (msgTool) {
            msgTool.status = data.error ? 'failed' : 'completed'
            msgTool.result = data.error || data.result
          }
          msg.toolCalls = msg.blocks.filter(b => b.type === 'tool')
        }
        break
      }

      case 'report_section':
        reportSections.value.push({
          id: data.id,
          narrative: data.narrative || '',
          toolCalls: data.toolCalls || [],
          isFinalAnalysis: data.isFinalAnalysis || false,
        })
        break

      case 'thinking':
        break

      case 'usage':
        if (data.cost !== undefined) usage.value = data
        break

      case 'time_saved_update':
        streamingTimeSaved.value = data.minutesSaved || 0
        break

      case 'time_saved':
        if (msg && data.minutesSaved) {
          msg.timeSaved = Math.round(data.minutesSaved)
          // Optimistically add to local totals so the UI doesn't flash empty
          timeSaved.value = {
            ...timeSaved.value,
            today: (timeSaved.value.today || 0) + data.minutesSaved,
            this_month: (timeSaved.value.this_month || 0) + data.minutesSaved,
            all_time: (timeSaved.value.all_time || 0) + data.minutesSaved,
          }
        }
        streamingTimeSaved.value = 0
        // Also fetch from server to reconcile
        fetchTimeSaved()
        break

      case 'plan_items':
        planItems.value = (data.items || []).map((item, i) => ({
          ...item,
          id: `plan-${i}`,
          enabled: true,
        }))
        break

      case 'done':
        break

      case 'error':
        msg.content += `\n\n[Error: ${data.message || 'Unknown error'}]`
        break
    }
  }

  async function fetchUsage() {
    try { usage.value = await AiAPI.getUsage() } catch { /* ignore */ }
  }

  async function fetchInstructions() {
    try { instructions.value = await AiAPI.getInstructions() } catch { instructions.value = [] }
  }

  async function addInstruction(content, source = 'manual', sourceMessageId = null) {
    const inst = await AiAPI.addInstruction(content, source, sourceMessageId)
    instructions.value.unshift(inst)
    return inst
  }

  async function updateInstruction(id, data) {
    await AiAPI.updateInstruction(id, data)
    const idx = instructions.value.findIndex(i => i.id === id)
    if (idx !== -1) Object.assign(instructions.value[idx], data)
  }

  async function deleteInstruction(id) {
    await AiAPI.deleteInstruction(id)
    instructions.value = instructions.value.filter(i => i.id !== id)
  }

  async function fetchEvents() {
    try { events.value = await AiAPI.getEvents() } catch { events.value = [] }
  }

  async function addEvent(data) {
    const evt = await AiAPI.addEvent(data)
    events.value.unshift(evt)
    return evt
  }

  async function updateEvent(id, data) {
    await AiAPI.updateEvent(id, data)
    const idx = events.value.findIndex(e => e.id === id)
    if (idx !== -1) Object.assign(events.value[idx], data)
  }

  async function deleteEvent(id) {
    await AiAPI.deleteEvent(id)
    events.value = events.value.filter(e => e.id !== id)
  }

  async function fetchKnowledgeCount() {
    try {
      const docs = await AiAPI.getKnowledgeDocs()
      knowledgeCount.value = docs?.length || 0
    } catch { knowledgeCount.value = 0 }
  }

  async function fetchHighlights(propertyId, dateRange) {
    if (!propertyId) { highlights.value = []; return }
    highlightsLoading.value = true
    try {
      const data = await AiAPI.getHighlights(propertyId, dateRange)
      highlights.value = Array.isArray(data) ? data : []
    } catch {
      highlights.value = []
    } finally {
      highlightsLoading.value = false
    }
  }

  async function fetchTimeSaved() {
    try { timeSaved.value = await AiAPI.getTimeSaved() } catch { /* ignore */ }
  }

  function executePlan() {
    if (!planItems.value.length) return
    const enabledItems = planItems.value.filter(i => i.enabled)
    if (!enabledItems.length) return

    const planText = enabledItems.map((item, i) =>
      `${i + 1}. **${item.title}**: ${item.description} [Visualization: ${item.visualization}]` +
      (item.metrics?.length ? ` Metrics: ${item.metrics.join(', ')}` : '') +
      (item.dimensions?.length ? ` Dimensions: ${item.dimensions.join(', ')}` : '') +
      (item.date_range ? ` Period: ${item.date_range}` : '') +
      (item.properties ? ` Properties: ${item.properties}` : '') +
      (item.filters ? ` Filters: ${JSON.stringify(item.filters)}` : '')
    ).join('\n')

    const prompt = `Execute this analysis plan:\n\n${planText}\n\nFor each step, fetch the data using the appropriate tools and present the results in the specified visualization format. Work through each step systematically.`

    planMode.value = false
    planExecuting.value = true
    sendMessage(prompt)
  }

  function clear() {
    conversations.value = []
    activeConversationId.value = null
    messages.value = []
    reportSections.value = []
  }

  return {
    conversations, activeConversationId, messages, isStreaming, streamingText,
    activeToolCalls, reportSections, usage, loading, instructions, events,
    activeConversation, groupedConversations,
    fetchConversations, loadConversation, createConversation, deleteConversation, forkConversation, sendMessage,
    fetchUsage, fetchInstructions, addInstruction, updateInstruction, deleteInstruction,
    fetchEvents, addEvent, updateEvent, deleteEvent,
    highlights, highlightsLoading, pendingQuestion, setPendingQuestion, consumePendingQuestion,
    dockOpenRequest, dockStarterQuestion, openDock, consumeDockStarter,
    planMode, planItems, planExecuting, executePlan,
    knowledgeCount, fetchKnowledgeCount,
    pinnedPropertyIds,
    timeSaved, streamingTimeSaved, fetchHighlights, fetchTimeSaved, clear,
  }
})
