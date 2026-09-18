<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import ToolExecutionCard from './ToolExecutionCard.vue'
import InlineTrendChart from '../charts/InlineTrendChart.vue'
import InlineMonthlyTrendChart from '../charts/InlineMonthlyTrendChart.vue'
import InlineComparisonChart from '../charts/InlineComparisonChart.vue'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  messages: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  activeToolCalls: { type: Array, default: () => [] },
  highlights: { type: Array, default: () => [] },
  highlightsLoading: { type: Boolean, default: false },
  propertyName: { type: String, default: '' },
  planMode: { type: Boolean, default: false },
})

const emit = defineEmits(['suggestion', 'feedback', 'drilldown', 'fork'])

const container = ref(null)
const userScrolledUp = ref(false)
const feedbackMsgId = ref(null)
const feedbackText = ref('')

// Selection-based feedback
const selectedText = ref('')
const selectionMsgId = ref(null)
const selectionPos = ref({ x: 0, y: 0 })
const showImproveBtn = ref(false)
const showImprovePopup = ref(false)
const popupFeedbackText = ref('')
const popupTextarea = ref(null)
const popupSaved = ref(false)

// Smart suggestions from API
const currentSuggestions = ref([])
const suggestionsLoading = ref(false)
const suggestionsFetched = ref(false)

// Proactive findings (cold-start panel — preferred over generic suggestions)
const proactiveFindings = ref([])
const proactiveLoading = ref(false)
const proactiveFetched = ref(false)
const proactiveLastRun = ref(null)
const proactiveRefreshing = ref(false)

async function fetchProactive(force = false) {
  if (proactiveFetched.value && !force) return
  proactiveLoading.value = !force
  proactiveRefreshing.value = force
  try {
    const url = force ? '/api/ai/proactive?refresh=1' : '/api/ai/proactive'
    const res = await fetch(url, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      proactiveFindings.value = Array.isArray(data?.findings) ? data.findings : []
      proactiveLastRun.value = data?.last_run || null
    }
  } catch { proactiveFindings.value = [] }
  proactiveLoading.value = false
  proactiveRefreshing.value = false
  proactiveFetched.value = true
}

const FALLBACK_SUGGESTIONS = [
  "Analyze why my website traffic is down and which channels are losing ground",
  "Drill into ASC conversion events - which form types and departments are underperforming?",
  "Compare VDP views across my properties - new vs used",
  "Run a full ASC event health check across all my properties",
  "Which traffic sources have the best conversion rates?",
  "Break down my organic search performance - top queries and trends",
]

async function fetchSmartSuggestions() {
  if (suggestionsFetched.value) return
  suggestionsLoading.value = true
  try {
    const res = await fetch('/api/ai/suggestions', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        currentSuggestions.value = data
        suggestionsFetched.value = true
        suggestionsLoading.value = false
        return
      }
    }
  } catch { /* fall through to fallback */ }
  currentSuggestions.value = FALLBACK_SUGGESTIONS
  suggestionsFetched.value = true
  suggestionsLoading.value = false
}

watch(() => props.messages.length, (len) => {
  if (len === 0 && !suggestionsFetched.value) fetchSmartSuggestions()
})

const effectiveSuggestions = computed(() => {
  if (props.highlightsLoading || suggestionsLoading.value) return []
  if (props.highlights.length > 0) return props.highlights
  return currentSuggestions.value
})

onMounted(() => { fetchSmartSuggestions(); fetchProactive() })

const displayMessages = computed(() => props.messages.filter(m => m.role !== 'tool'))

// Tool status labels
const TOOL_STATUS_LABELS = {
  list_ga_properties: 'Loading your properties',
  get_ga4_metrics: 'Pulling GA4 metrics',
  get_ga4_realtime: 'Checking real-time users',
  get_ga4_comparison: 'Comparing date ranges',
  get_ga4_drilldown: 'Drilling into the data',
  get_ga4_funnel: 'Analyzing conversion funnel',
  get_ga4_daily_trend: 'Analyzing daily trends',
  get_ga4_monthly_trend: 'Pulling monthly history',
  get_asc_events: 'Fetching ASC events',
  get_asc_drilldown: 'Drilling ASC events',
  get_search_console: 'Loading Search Console data',
  get_search_queries: 'Fetching search queries',
  get_page_performance: 'Analyzing page performance',
  compare_properties: 'Comparing properties',
  search_knowledge: 'Consulting knowledge base',
  think: 'Analyzing findings',
}

const streamingStatusMessage = computed(() => {
  const running = props.activeToolCalls.filter(tc => tc.status === 'running')
  const completed = props.activeToolCalls.filter(tc => tc.status === 'completed')
  const total = props.activeToolCalls.length

  if (running.length > 0) {
    const last = running[running.length - 1]
    const action = TOOL_STATUS_LABELS[last.name] || 'Working'
    let detail = ''
    if (last.args?.metric) detail = last.args.metric
    else if (last.args?.query) detail = `"${last.args.query.substring(0, 30)}"`
    const suffix = detail ? ` -- ${detail}` : ''
    const count = total > 1 ? ` (${completed.length + 1}/${total})` : ''
    return `${action}${suffix}${count}`
  }

  if (total > 0 && completed.length === total) {
    return 'Analyzing results and writing findings...'
  }
  return 'Thinking...'
})

// Scroll management
function isNearBottom() {
  if (!container.value) return true
  const { scrollTop, scrollHeight, clientHeight } = container.value
  return scrollHeight - scrollTop - clientHeight < 80
}

function scrollToBottom(force = false) {
  if (!force && userScrolledUp.value) return
  nextTick(() => {
    if (container.value) container.value.scrollTop = container.value.scrollHeight
  })
}

function handleScroll() {
  userScrolledUp.value = !isNearBottom()
}

watch(() => props.messages, () => {
  if (isNearBottom()) scrollToBottom()
}, { deep: true })
watch(() => props.activeToolCalls, () => {
  if (isNearBottom()) scrollToBottom()
}, { deep: true })
watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    const last = props.messages[newLen - 1]
    if (last?.role === 'user') {
      userScrolledUp.value = false
      scrollToBottom(true)
    }
  }
})

// Markdown rendering
function sanitizeText(text) {
  if (!text) return ''
  return text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').replace(/  +/g, ' ')
}

function colorizeVariances(html) {
  if (!html) return ''
  // Render percent deltas as magnitude pills.
  // Bar fills proportionally to magnitude (50% delta = full bar).
  return html.replace(/(?<![\d.\-])([+\-])(\d{1,4}(?:\.\d+)?)%/g, (full, sign, num) => {
    const n = parseFloat(num)
    if (!Number.isFinite(n)) return full
    const mag = Math.min(1, n / 50)
    const cls = sign === '+' ? 'up' : 'down'
    const arrow = sign === '+' ? '\u25B2' : '\u25BC'
    return `<span class="mag-pill ${cls}" style="--mag: ${mag.toFixed(2)}"><span class="arrow">${arrow}</span>${sign}${num}%<span class="bar"></span></span>`
  })
}

function stripPlanDump(text) {
  // Remove plan dumps that the AI echoes into chat text
  const lines = text.split('\n')
  const out = []
  let inPlanBlock = false
  let skipBlankLines = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect start of plan dump - various phrasings
    if (!inPlanBlock && (
      /^execute this analysis plan/i.test(trimmed) ||
      /^(?:here'?s|i'?ve (?:created|built|designed|put together|prepared)).*(?:plan|analysis plan|investigation plan)/i.test(trimmed) ||
      /^(?:let me|i'll)\s+(?:create|build|design|prepare|put together).*(?:plan|analysis)/i.test(trimmed) ||
      /^(?:analysis|investigation|research) plan:?\s*$/i.test(trimmed)
    )) {
      inPlanBlock = true
      skipBlankLines = true
      continue
    }

    if (inPlanBlock) {
      // Skip numbered items that look like plan steps (bold title + metadata or just bold title with description)
      if (/^\d+\.\s+\*\*/.test(trimmed)) {
        skipBlankLines = true
        continue
      }
      // Skip continuation lines with plan metadata
      if (/^\s*(?:[-•]\s+)?(?:Metrics|Period|Properties|Dimensions|Visualization|Date|KPIs?|Tools?):/i.test(trimmed)) {
        continue
      }
      // Skip blank lines between items
      if (trimmed === '' && skipBlankLines) continue
      // Skip boilerplate closing lines
      if (/^for each step|^work through each|^i'll (?:work|go) through|^let me (?:work|go) through/i.test(trimmed)) continue
      if (/^(?:shall|should|want me to|ready to)\s+/i.test(trimmed) && /(?:execute|start|proceed|begin|run)/i.test(trimmed)) continue
      // Non-plan content - exit plan block
      inPlanBlock = false
      skipBlankLines = false
    }
    out.push(line)
  }
  let result = out.join('\n').trim()
  // Catch any remaining boilerplate
  result = result.replace(/For each step,?\s+fetch the data.*$/gim, '').trim()
  result = result.replace(/Work through each step systematically\.?\s*$/gim, '').trim()
  return result
}

function renderMarkdown(text) {
  if (!text) return ''
  // Strip the "Want me to dig deeper?" tail from the rendered prose — those
  // questions are surfaced separately as clickable buttons below the message.
  // Match with or without the bold markers, optional leading "---" separator,
  // and either "?" or no terminator.
  let cleaned = text.replace(/\n?\s*(?:---\s*\n)?\s*\*{0,2}Want me to dig deeper\??\*{0,2}\s*\n[\s\S]*$/i, '').trim()
  cleaned = stripPlanDump(cleaned)
  if (!cleaned || cleaned.length < 10) {
    cleaned = 'Analysis plan ready - check the Plan panel to review and execute.'
  }
  cleaned = sanitizeText(cleaned)
  // Force all ASC event identifiers to lowercase (asc_form_submission, etc.) regardless of how the model wrote them
  cleaned = cleaned.replace(/[Aa][Ss][Cc]_[a-zA-Z][a-zA-Z0-9_]*/g, (m) => m.toLowerCase())
  let html = marked.parse(cleaned)
  html = applyMagicLayout(html)
  return colorizeVariances(html)
}

// ── Magic layout: transforms convention markers into styled components ──
function applyMagicLayout(html) {
  if (typeof DOMParser === 'undefined') return html
  try {
    const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
    const root = doc.getElementById('root')
    if (!root) return html

    // Thinking trace (lighter weight, comes BEFORE hypothesis)
    transformSection(root, /^thinking$/i, (h, contentNodes) => {
      const wrap = doc.createElement('div')
      wrap.className = 'magic-thinking'
      contentNodes.forEach(n => wrap.appendChild(n))
      h.replaceWith(wrap)
    })

    // Hypothesis
    transformSection(root, /^hypothesis$/i, (h, contentNodes) => {
      const wrap = doc.createElement('div')
      wrap.className = 'magic-hypothesis'
      contentNodes.forEach(n => wrap.appendChild(n))
      h.replaceWith(wrap)
    })

    // Bottom Line
    transformSection(root, /^bottom\s*line$/i, (h, contentNodes) => {
      const wrap = doc.createElement('div')
      wrap.className = 'magic-bottom-line'
      contentNodes.forEach(n => wrap.appendChild(n))
      h.replaceWith(wrap)
    })

    // Phase headers (Phase N — Title)
    Array.from(root.querySelectorAll('h2, h3, h4')).forEach(h => {
      const txt = (h.textContent || '').trim()
      const m = txt.match(/^Phase\s+(\d+[a-z]?)\s*[—\-:·]\s*(.+)$/i)
      if (m) {
        const wrap = doc.createElement('div')
        wrap.className = 'magic-phase'
        wrap.innerHTML = `<span class="phase-num">PHASE ${m[1].toUpperCase()}</span><span class="phase-title">${escapeHtml(m[2])}</span>`
        h.replaceWith(wrap)
      }
    })

    // Findings (Finding: Topic)
    Array.from(root.querySelectorAll('h2, h3, h4')).forEach(h => {
      const txt = (h.textContent || '').trim()
      const m = txt.match(/^Finding\s*[:·]\s*(.+)$/i)
      if (!m) return
      const wrap = doc.createElement('div')
      wrap.className = 'magic-finding'
      const title = doc.createElement('div')
      title.className = 'finding-title'
      title.textContent = m[1]
      wrap.appendChild(title)
      let n = h.nextElementSibling
      const grab = []
      while (n && !/^H[1-6]$/.test(n.tagName) && !n.classList?.contains('magic-phase') && !n.classList?.contains('magic-bottom-line') && !n.classList?.contains('magic-recs-header')) {
        const next = n.nextElementSibling
        grab.push(n)
        n = next
      }
      grab.forEach(c => wrap.appendChild(c))
      h.replaceWith(wrap)
    })

    // Recommendations
    transformSection(root, /^recommendations$/i, (h, contentNodes) => {
      const header = doc.createElement('div')
      header.className = 'magic-recs-header'
      header.textContent = 'RECOMMENDATIONS'
      const list = doc.createElement('div')
      list.className = 'magic-recs'

      const items = []
      for (const node of contentNodes) {
        if (node.tagName === 'UL' || node.tagName === 'OL') {
          for (const li of Array.from(node.children)) items.push(li.innerHTML)
        } else if (node.tagName === 'P') {
          const parts = node.innerHTML.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean)
          parts.forEach(p => items.push(p))
        }
      }

      let matched = 0
      for (const itemHtml of items) {
        const pm = itemHtml.match(/^\s*<strong>\s*P([0-3])\s*<\/strong>\s*(.*)$/is)
        if (pm) {
          const card = doc.createElement('div')
          card.className = `magic-rec p${pm[1]}`
          const badge = doc.createElement('span')
          badge.className = 'rec-badge'
          badge.textContent = `P${pm[1]}`
          const body = doc.createElement('div')
          body.className = 'rec-body'
          body.innerHTML = pm[2].trim()
          card.appendChild(badge)
          card.appendChild(body)
          list.appendChild(card)
          matched++
        }
      }

      if (matched > 0) {
        h.replaceWith(header)
        header.after(list)
      }
    })

    // Copy affordance: wrap every code / email block with a copy button.
    // The click is handled by delegation on the messages container.
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.parentElement && pre.parentElement.classList.contains('code-block')) return
      const wrap = doc.createElement('div')
      wrap.className = 'code-block'
      pre.replaceWith(wrap)
      wrap.appendChild(pre)
      const btn = doc.createElement('button')
      btn.className = 'code-copy-btn'
      btn.type = 'button'
      btn.setAttribute('aria-label', 'Copy to clipboard')
      btn.textContent = 'Copy'
      wrap.appendChild(btn)
    })

    return root.innerHTML
  } catch (e) {
    return html
  }
}

// Copy a code / email block to the clipboard. Delegated from the messages
// container since the message HTML is injected via v-html.
function handleCopyClick(e) {
  const btn = e.target.closest('.code-copy-btn')
  if (!btn) return
  const pre = btn.parentElement?.querySelector('pre')
  if (!pre) return
  const text = pre.innerText
  const done = () => {
    btn.textContent = 'Copied'
    btn.classList.add('copied')
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 2000)
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {})
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); done() } catch { /* ignore */ }
    ta.remove()
  }
}

function transformSection(root, headingPattern, fn) {
  const headings = Array.from(root.querySelectorAll('h2, h3, h4'))
  for (const h of headings) {
    const txt = (h.textContent || '').trim()
    if (!headingPattern.test(txt)) continue
    const contentNodes = []
    let n = h.nextElementSibling
    while (n && !/^H[1-6]$/.test(n.tagName)) {
      const next = n.nextElementSibling
      contentNodes.push(n)
      n = next
    }
    fn(h, contentNodes)
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Block type detection
function isMetricCard(block) {
  return block.type === 'tool' && block.status === 'completed' && block.result && block.result.current !== undefined
}

function isGA4Metrics(block) {
  return block.type === 'tool' && block.name === 'get_ga4_metrics' && block.status === 'completed' && block.result?.metrics && typeof block.result.metrics === 'object'
}

function isGA4Drilldown(block) {
  return block.type === 'tool' && block.name === 'get_ga4_drilldown' && block.status === 'completed' && block.result?.data?.length > 0
}

function isASCEvents(block) {
  return block.type === 'tool' && block.name === 'get_asc_events' && block.status === 'completed' && block.result?.events?.length > 0
}

function isPagePerformance(block) {
  return block.type === 'tool' && block.name === 'get_page_performance' && block.status === 'completed' && block.result?.pages?.length > 0
}

function isDailyTrend(block) {
  return block.type === 'tool' && block.name === 'get_ga4_daily_trend' && block.status === 'completed' && block.result?.dailyValues?.length > 1
}

function isMonthlyTrend(block) {
  return block.type === 'tool' && block.name === 'get_ga4_monthly_trend' && block.status === 'completed' && block.result?.months?.length > 1
}

function isComparison(block) {
  return block.type === 'tool' && block.name === 'compare_properties' && block.status === 'completed' && block.result?.properties?.length > 1
}

// Extract KPI tiles from get_ga4_metrics result
function extractMetricTiles(result) {
  if (!result?.metrics) return []
  return Object.entries(result.metrics).map(([key, data]) => ({
    key,
    name: humanizeMetricKey(key),
    current: data.current?.value,
    currentRaw: typeof data.current === 'object' ? data.current?.value : data.current,
    previous: data.previous?.value,
    previousRaw: typeof data.previous === 'object' ? data.previous?.value : data.previous,
    previousChange: data.previous?.change,
    lastYear: data.lastYear?.value,
    lastYearChange: data.lastYear?.change,
  }))
}

function humanizeMetricKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Get drilldown table columns from first data row
function getDrilldownMetricKeys(data) {
  if (!data?.length) return []
  const first = data[0]
  return Object.keys(first).filter(k => typeof first[k] === 'object' && first[k]?.current !== undefined)
}

function getDrilldownDimensionKey(data) {
  if (!data?.length) return null
  const first = data[0]
  return Object.keys(first).find(k => typeof first[k] !== 'object')
}

function changeClass(val) {
  if (val == null) return 'text-white/30'
  if (val > 3) return 'text-green-400 font-semibold'
  if (val < -3) return 'text-red-400 font-semibold'
  return 'text-yellow-400 font-semibold'
}

function rowHighlight(change) {
  if (change == null) return ''
  if (change >= 20) return 'bg-green-500/5'
  if (change <= -20) return 'bg-red-500/5'
  return ''
}

// Group consecutive metric cards
function groupBlocks(blocks) {
  if (!blocks?.length) return []
  const grouped = []
  let metricBuffer = []

  function flush() {
    if (metricBuffer.length) {
      grouped.push({ type: 'metric-group', cards: [...metricBuffer] })
      metricBuffer = []
    }
  }

  for (const block of blocks) {
    if (isMetricCard(block)) {
      metricBuffer.push(block)
    } else {
      flush()
      grouped.push(block)
    }
  }
  flush()
  return grouped
}

function formatMetricKey(key) {
  if (!key) return ''
  const part = key.includes('.') ? key.split('.').pop() : key
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function formatValue(val) {
  if (val == null) return '--'
  if (typeof val === 'object') val = val.value
  if (typeof val === 'number') {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M'
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K'
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 })
  }
  return String(val)
}

function metricVariance(result) {
  const curr = typeof result.current === 'object' ? result.current?.value : result.current
  const prev = typeof result.previous === 'object' ? result.previous?.value : result.previous
  if (curr == null || prev == null || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function varianceClass(v) {
  if (v < -3) return 'text-red-500'
  if (v > 3) return 'text-green-500'
  return 'text-yellow-500'
}

// Suggestions from AI response.
// Picks two formats and merges them:
//   1) Emoji-prefixed bullet/standalone lines anywhere in the body.
//   2) The "Want me to dig deeper?" tail block — any non-empty lines after that header
//      (bulleted or plain) up to a sensible cut-off. We surface these as clickable
//      buttons in the chat so they're never lost in the report-only view.
function extractSuggestions(content) {
  if (!content) return []
  const lines = content.split('\n')
  const emojiHits = []
  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s*/, '').trim()
    if (/^[\u{1F300}-\u{1FAD6}]/u.test(trimmed) && trimmed.length > 5) {
      emojiHits.push(trimmed.replace(/\*\*/g, '').trim())
    }
  }

  const tailHits = []
  // Find the dig-deeper marker (markdown bold or plain), case-insensitive.
  const markerIdx = lines.findIndex(l => /want me to dig deeper\??/i.test(l.replace(/\*/g, '').trim()))
  if (markerIdx >= 0) {
    for (let i = markerIdx + 1; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim()
      if (!trimmed) {
        // Allow a single blank line between bullets; stop on a second consecutive blank.
        if (tailHits.length && (!lines[i + 1] || !lines[i + 1].trim())) break
        continue
      }
      // Stop if we hit a horizontal rule or a new heading.
      if (/^-{3,}$/.test(trimmed) || /^#{1,6}\s/.test(raw)) break
      tailHits.push(trimmed)
      if (tailHits.length >= 6) break
    }
  }

  // De-dup while preserving order, tail-block first so it leads the UI.
  const seen = new Set()
  const out = []
  for (const s of [...tailHits, ...emojiHits]) {
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out.slice(0, 5)
}

function getMessageSuggestions(msg) {
  if (msg.role !== 'assistant' || msg.id === 'streaming' || !msg.content) return []
  const assistantMsgs = displayMessages.value.filter(m => m.role === 'assistant')
  if (assistantMsgs[assistantMsgs.length - 1] !== msg) return []
  return extractSuggestions(msg.content)
}

// Text selection feedback
function handleTextSelect(event, msgId) {
  setTimeout(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (text && text.length > 3) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const containerEl = container.value
      const containerRect = containerEl?.getBoundingClientRect()
      if (containerRect) {
        selectionPos.value = {
          x: Math.min(rect.right, containerRect.right - 140) - containerRect.left,
          y: rect.top - containerRect.top + containerEl.scrollTop - 36,
        }
      }
      selectedText.value = text
      selectionMsgId.value = msgId
      showImproveBtn.value = true
      showImprovePopup.value = false
    } else {
      showImproveBtn.value = false
    }
  }, 10)
}

function openImprovePopup() {
  showImproveBtn.value = false
  showImprovePopup.value = true
  popupFeedbackText.value = ''
  popupSaved.value = false
  selectionPos.value.y += 40
  nextTick(() => popupTextarea.value?.focus())
}

function submitPopupFeedback() {
  if (!popupFeedbackText.value.trim()) return
  const content = `Regarding: "${selectedText.value.substring(0, 500)}"\n\nFeedback: ${popupFeedbackText.value.trim()}`
  emit('feedback', { content, sourceMessageId: selectionMsgId.value })
  popupSaved.value = true
  setTimeout(() => {
    showImprovePopup.value = false
    popupFeedbackText.value = ''
    selectedText.value = ''
    popupSaved.value = false
    window.getSelection()?.removeAllRanges()
  }, 800)
}

function cancelPopup() {
  showImprovePopup.value = false
  popupFeedbackText.value = ''
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
}

function handleContainerMouseDown(event) {
  if (!event.target.closest('.selection-improve-ui')) showImproveBtn.value = false
}

function handleDocumentMouseUp(event) {
  if (showImprovePopup.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const anchorEl = sel.anchorNode?.parentElement
  const msgBlock = anchorEl?.closest?.('.ai-message')
  if (!msgBlock) return
  const responseBlock = msgBlock.closest('.ai-response-block')
  if (!responseBlock) return
  const msgId = responseBlock.dataset.msgId
  if (msgId) handleTextSelect(event, msgId)
}

onMounted(() => document.addEventListener('mouseup', handleDocumentMouseUp))
onUnmounted(() => document.removeEventListener('mouseup', handleDocumentMouseUp))

// Inline feedback
function openFeedback(msgId) { feedbackMsgId.value = msgId; feedbackText.value = '' }
function cancelFeedback() { feedbackMsgId.value = null; feedbackText.value = '' }
function submitFeedback() {
  if (!feedbackText.value.trim()) return
  emit('feedback', { content: feedbackText.value.trim(), sourceMessageId: feedbackMsgId.value })
  feedbackMsgId.value = null
  feedbackText.value = ''
}
</script>

<template>
  <div ref="container" class="flex-1 overflow-y-auto relative" @scroll="handleScroll" @mousedown="handleContainerMouseDown" @click="handleCopyClick">
    <!-- Plan Mode Banner -->
    <div v-if="planMode" class="mx-4 mt-3 mb-1 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
      <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <span class="text-xs text-amber-400/80">Plan Mode - AI will discuss strategy and help plan your analysis without fetching data</span>
    </div>

    <!-- Floating Improve button -->
    <div
      v-if="showImproveBtn"
      class="selection-improve-ui absolute z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-white text-xs font-medium shadow-lg cursor-pointer hover:bg-white/20 transition-all"
      :style="{ left: selectionPos.x + 'px', top: selectionPos.y + 'px' }"
      @click="openImprovePopup"
    >
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      Improve
    </div>

    <!-- Floating feedback popup -->
    <div
      v-if="showImprovePopup"
      class="selection-improve-ui absolute z-50 w-[320px] rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl"
      :style="{ left: Math.max(8, selectionPos.x - 140) + 'px', top: selectionPos.y + 'px' }"
    >
      <div v-if="popupSaved" class="px-4 py-5 text-center">
        <svg class="w-6 h-6 text-green-400 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <p class="text-sm font-medium text-white/80">Saved as instruction</p>
      </div>
      <template v-else>
        <div class="px-3 pt-3 pb-1.5">
          <div class="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1">Selected text</div>
          <div class="text-xs text-white/60 line-clamp-2 leading-relaxed">{{ selectedText.substring(0, 200) }}{{ selectedText.length > 200 ? '...' : '' }}</div>
        </div>
        <div class="px-3 py-2">
          <textarea
            ref="popupTextarea"
            v-model="popupFeedbackText"
            rows="2"
            class="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple placeholder:text-white/30"
            placeholder="What should the AI do differently?"
            @keydown.enter.ctrl="submitPopupFeedback"
            @keydown.escape="cancelPopup"
          ></textarea>
        </div>
        <div class="px-3 pb-3 flex items-center gap-2">
          <button
            @click="submitPopupFeedback"
            :disabled="!popupFeedbackText.trim()"
            class="flex-1 px-3 py-1.5 rounded-lg bg-sick-gradient text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >Save</button>
          <button @click="cancelPopup" class="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
        </div>
      </template>
    </div>

    <!-- Empty state with proactive findings cold-start panel -->
    <div v-if="!displayMessages.length" class="max-w-3xl mx-auto w-full px-4 py-10 sm:py-14">
      <!-- Header -->
      <div class="flex items-start gap-3 mb-1">
        <span class="size-1.5 rounded-full bg-brand mt-3 animate-pulse"></span>
        <div>
          <div class="font-mono text-[10px] tracking-[0.22em] uppercase text-fg-faint mb-1">SINCE YOU LAST CHECKED</div>
          <h3 class="font-display font-light text-[34px] sm:text-[40px] tracking-[-0.025em] leading-[1.04] text-fg">
            <span v-if="propertyName">What's happening at {{ propertyName }}.</span>
            <span v-else-if="proactiveFindings.length">{{ proactiveFindings.length }} {{ proactiveFindings.length === 1 ? 'thing' : 'things' }} I'd want you to see.</span>
            <span v-else-if="!proactiveLoading">Nothing meaningful shifted.</span>
            <span v-else>Scanning your portfolio.</span>
          </h3>
        </div>
      </div>

      <!-- Loading shimmer for proactive -->
      <div v-if="proactiveLoading" class="mt-8 space-y-3">
        <div v-for="i in 3" :key="'sh-' + i" class="h-24 rounded-xl bg-white/[0.03] border border-white/10 animate-pulse"></div>
        <p class="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-faint text-center mt-4">
          Reading the last 7 days across your active properties. Takes 10-30 seconds.
        </p>
      </div>

      <!-- Findings cards -->
      <div v-else-if="proactiveFindings.length" class="mt-8 space-y-3">
        <button
          v-for="(f, fi) in proactiveFindings"
          :key="f.id"
          @click="emit('suggestion', f.starter_question || f.headline)"
          class="group w-full text-left rounded-xl border bg-white/[0.03] hover:bg-white/[0.05] hover:border-amber-500/40 transition-all duration-200 cursor-pointer overflow-hidden"
          :class="f.severity === 'high' ? 'border-amber-500/30' : 'border-white/10'"
          :style="{ animationDelay: (fi * 80) + 'ms' }"
        >
          <div class="flex items-start gap-3 p-4">
            <!-- Severity dot -->
            <span class="shrink-0 mt-1.5 size-2 rounded-full"
              :class="f.severity === 'high' ? 'bg-amber-400 shadow-[0_0_8px_rgba(242,169,58,0.5)]' : f.severity === 'medium' ? 'bg-amber-500/60' : 'bg-white/30'"
            ></span>
            <div class="flex-1 min-w-0">
              <!-- Type + property tags -->
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span class="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded text-amber-400/90 bg-amber-500/10 border border-amber-500/20">
                  {{ (f.finding_type || '').replace(/_/g, ' ') }}
                </span>
                <span v-if="f.property_ids?.length > 1" class="font-mono text-[9px] tracking-[0.16em] uppercase text-fg-faint">{{ f.property_ids.length }} properties</span>
              </div>
              <!-- Headline -->
              <div class="text-[15px] font-medium text-white leading-snug mb-1.5">{{ f.headline }}</div>
              <!-- Body -->
              <div class="text-[13px] text-white/55 leading-relaxed">{{ f.body }}</div>
              <!-- Starter question prompt -->
              <div v-if="f.starter_question" class="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-amber-400 group-hover:text-amber-300 transition-colors">
                <span>{{ f.starter_question.length > 90 ? f.starter_question.slice(0, 90) + '…' : f.starter_question }}</span>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </div>
            </div>
          </div>
        </button>

        <!-- Refresh + meta -->
        <div class="flex items-center justify-between mt-5 px-1">
          <div class="font-mono text-[10px] tracking-[0.16em] uppercase text-fg-faint">
            <span v-if="proactiveLastRun">Scanned {{ proactiveLastRun.scanned }} {{ proactiveLastRun.scanned === 1 ? 'property' : 'properties' }} · cached 24h</span>
          </div>
          <button
            @click="fetchProactive(true)"
            :disabled="proactiveRefreshing"
            class="font-mono text-[10px] tracking-[0.16em] uppercase text-fg-faint hover:text-amber-400 transition cursor-pointer disabled:opacity-50"
          >{{ proactiveRefreshing ? 'Refreshing…' : 'Refresh →' }}</button>
        </div>
      </div>

      <!-- No proactive findings: fall back to suggestions -->
      <div v-else class="mt-8">
        <p class="text-white/40 text-sm leading-relaxed mb-5">No anomalies in your portfolio. Try one of these instead, or ask anything.</p>
        <div class="flex flex-col gap-2 max-w-2xl">
          <button
            v-for="(q, qi) in effectiveSuggestions"
            :key="qi"
            @click="emit('suggestion', q)"
            class="px-3.5 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors cursor-pointer text-left"
          >{{ q }}</button>
        </div>
      </div>

      <p class="text-xs text-fg-faint mt-6 text-center font-mono tracking-[0.14em] uppercase">or ask any question you like</p>
    </div>

    <!-- Messages -->
    <div v-else class="max-w-[700px] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <template v-for="msg in displayMessages" :key="msg.id">
        <!-- User message -->
        <div v-if="msg.role === 'user'" class="group/msg relative">
          <div class="flex justify-end">
            <div class="max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-brand-soft border border-brand-border text-fg text-sm leading-relaxed">
              <span style="white-space: pre-wrap;">{{ msg.content }}</span>
            </div>
          </div>
          <!-- Thread action (appears on hover) -->
          <button
            v-if="!String(msg.id).startsWith('temp-') && !isStreaming"
            @click="emit('fork', msg.id)"
            class="thread-action absolute -bottom-2 right-0 opacity-0 group-hover/msg:opacity-100 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.07] backdrop-blur border border-white/10 text-[11px] text-white/40 hover:text-white/80 hover:bg-white/[0.12] hover:border-white/20 transition-all cursor-pointer shadow-lg z-10"
            title="Start a new thread from here"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none">
              <path d="M3 4.5C3 3.67 3.67 3 4.5 3h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H8l-3.15 2.36A.75.75 0 013.5 14.8V13H4.5 3V4.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 8h6M7 5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Thread
          </button>
        </div>

        <!-- Assistant message -->
        <div v-else class="ai-response-block group/msg" :data-msg-id="msg.id">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-md bg-sick-gradient flex items-center justify-center shrink-0">
              <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 2 5.5-6L21 5M21 5h-5M21 5v5" />
              </svg>
            </div>
            <span class="text-xs font-semibold text-white/40 uppercase tracking-wide">RankMatic AI</span>
          </div>

          <!-- Blocks -->
          <template v-if="msg.blocks && msg.blocks.length">
            <template v-for="(block, idx) in groupBlocks(msg.blocks)" :key="'block-' + idx">
              <!-- Text block -->
              <div
                v-if="block.type === 'text' && block.content"
                class="ai-message pl-4 sm:pl-8 text-[14px] sm:text-[15px] leading-relaxed text-white/80"
                :class="{ 'mt-3': idx > 0 }"
                @mouseup="handleTextSelect($event, msg.id)"
              >
                <div v-html="renderMarkdown(block.content)"></div>
              </div>

              <!-- Metric cards row -->
              <div v-else-if="block.type === 'metric-group'" class="mb-2 pl-4 sm:pl-8">
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(card, ci) in block.cards"
                    :key="'metric-' + ci"
                    class="flex-1 min-w-[80px] sm:min-w-[100px] max-w-[140px] rounded-lg border border-white/10 bg-white/5 px-2 sm:px-2.5 py-2"
                  >
                    <div class="text-[10px] text-white/40 truncate mb-0.5">{{ card.result.name || formatMetricKey(card.args?.metric) }}</div>
                    <div class="flex items-baseline gap-1">
                      <span class="text-[13px] font-bold text-white">{{ formatValue(card.result.current) }}</span>
                      <span v-if="metricVariance(card.result) !== null" class="text-[10px] font-semibold" :class="varianceClass(metricVariance(card.result))">
                        {{ metricVariance(card.result) >= 0 ? '+' : '' }}{{ metricVariance(card.result).toFixed(1) }}%
                      </span>
                    </div>
                    <div class="flex gap-2 mt-0.5 text-[9px] text-white/40">
                      <span>prev: {{ formatValue(card.result.previous) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Daily trend chart -->
              <div v-else-if="isDailyTrend(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineTrendChart :data="block.result" />
                </div>
              </div>

              <!-- Monthly trend chart -->
              <div v-else-if="isMonthlyTrend(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineMonthlyTrendChart :data="block.result" />
                </div>
              </div>

              <!-- Comparison chart -->
              <div v-else-if="isComparison(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-1.5">
                  <InlineComparisonChart :data="block.result" />
                </div>
              </div>

              <!-- GA4 Metrics KPI tiles -->
              <div v-else-if="isGA4Metrics(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <!-- Prominent property attribution above the KPI grid so it's
                     unambiguous which property these tiles belong to when the
                     model fetches metrics for several properties back-to-back. -->
                <div
                  v-if="block.result?.property_name"
                  class="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-purple/15 border border-brand-purple/25"
                >
                  <svg class="w-3.5 h-3.5 text-brand-purple shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <span class="text-[12px] font-semibold text-brand-purple truncate">{{ block.result.property_name }}</span>
                  <span v-if="block.args?.start_date && block.args?.end_date" class="ml-auto text-[10px] text-white/40 font-mono tabular-nums shrink-0">
                    {{ block.args.start_date }} → {{ block.args.end_date }}
                  </span>
                </div>
                <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div
                    v-for="(tile, ti) in extractMetricTiles(block.result)"
                    :key="'kpi-' + ti"
                    class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer hover:bg-white/10 hover:border-brand-purple/30 transition-colors group"
                    @click="emit('drilldown', { metric: tile.key, metricName: tile.name, currentValue: tile.currentRaw, previousValue: tile.previousRaw, changeValue: tile.previousChange, propertyId: block.result.property_id, propertyName: block.result.property_name })"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[10px] text-white/40 truncate uppercase tracking-wide">{{ tile.name }}</span>
                      <svg class="w-3 h-3 text-white/0 group-hover:text-white/30 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    </div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-base font-bold text-white">{{ formatValue(tile.current) }}</span>
                      <span v-if="tile.previousChange != null" class="text-[11px]" :class="changeClass(tile.previousChange)">
                        {{ tile.previousChange >= 0 ? '+' : '' }}{{ tile.previousChange }}%
                      </span>
                    </div>
                    <div class="flex gap-3 mt-1 text-[10px] text-white/35">
                      <span>prev: {{ formatValue(tile.previous) }}</span>
                      <span v-if="tile.lastYear != null && tile.lastYear > 0">LY: {{ formatValue(tile.lastYear) }}
                        <span v-if="tile.lastYearChange != null" :class="changeClass(tile.lastYearChange)"> {{ tile.lastYearChange >= 0 ? '+' : '' }}{{ tile.lastYearChange }}%</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- GA4 Drilldown table -->
              <div v-else-if="isGA4Drilldown(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-2 rounded-lg border border-white/10 overflow-hidden">
                  <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="bg-white/5">
                          <th class="text-left px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">{{ humanizeMetricKey(getDrilldownDimensionKey(block.result.data) || 'Name') }}</th>
                          <template v-for="mk in getDrilldownMetricKeys(block.result.data)" :key="'th-' + mk">
                            <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">{{ humanizeMetricKey(mk) }}</th>
                            <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Prev</th>
                            <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Change</th>
                          </template>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(row, ri) in block.result.data.slice(0, 15)"
                          :key="'dr-' + ri"
                          class="border-t border-white/5"
                          :class="rowHighlight(row[getDrilldownMetricKeys(block.result.data)[0]]?.change)"
                        >
                          <td class="px-3 py-2 text-white/70 max-w-[200px] truncate">{{ row[getDrilldownDimensionKey(block.result.data)] }}</td>
                          <template v-for="mk in getDrilldownMetricKeys(block.result.data)" :key="'td-' + mk + ri">
                            <td class="px-3 py-2 text-right text-white/80 font-medium tabular-nums">{{ formatValue(row[mk]?.current) }}</td>
                            <td class="px-3 py-2 text-right text-white/40 tabular-nums">{{ formatValue(row[mk]?.previous) }}</td>
                            <td class="px-3 py-2 text-right tabular-nums" :class="changeClass(row[mk]?.change)">
                              {{ row[mk]?.change != null ? (row[mk].change >= 0 ? '+' : '') + row[mk].change + '%' : '-' }}
                            </td>
                          </template>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- ASC Events table -->
              <div v-else-if="isASCEvents(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-2 rounded-lg border border-white/10 overflow-hidden">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-white/5">
                        <th class="text-left px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Event</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Current</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Previous</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(evt, ei) in block.result.events.slice(0, 15)"
                        :key="'asc-' + ei"
                        class="border-t border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors"
                        :class="rowHighlight(evt.change)"
                        @click="emit('drilldown', { metric: evt.event_name, metricName: humanizeMetricKey(evt.event_name), currentValue: evt.current, previousValue: evt.previous, changeValue: evt.change, propertyId: block.result.property_id, propertyName: block.result.property_name })"
                      >
                        <td class="px-3 py-2 text-white/70 hover:text-white">{{ evt.event_name }}</td>
                        <td class="px-3 py-2 text-right text-white/80 font-medium tabular-nums">{{ formatValue(evt.current) }}</td>
                        <td class="px-3 py-2 text-right text-white/40 tabular-nums">{{ formatValue(evt.previous) }}</td>
                        <td class="px-3 py-2 text-right tabular-nums" :class="changeClass(evt.change)">
                          {{ evt.change != null ? (evt.change >= 0 ? '+' : '') + evt.change + '%' : '-' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Page Performance table -->
              <div v-else-if="isPagePerformance(block)" class="mb-2 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
                <div class="mt-2 rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-white/5">
                        <th class="text-left px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Page</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Sessions</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Views</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Bounce</th>
                        <th class="text-right px-3 py-2 font-semibold text-white/40 uppercase tracking-wide text-[10px]">Engage</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(pg, pi) in block.result.pages.slice(0, 15)"
                        :key="'pg-' + pi"
                        class="border-t border-white/5"
                      >
                        <td class="px-3 py-2 text-white/70 max-w-[220px] truncate">{{ pg.page }}</td>
                        <td class="px-3 py-2 text-right text-white/80 font-medium tabular-nums">{{ formatValue(pg.sessions) }}</td>
                        <td class="px-3 py-2 text-right text-white/80 tabular-nums">{{ formatValue(pg.page_views) }}</td>
                        <td class="px-3 py-2 text-right text-white/60 tabular-nums">{{ pg.bounce_rate }}%</td>
                        <td class="px-3 py-2 text-right text-white/60 tabular-nums">{{ pg.engagement_rate }}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Tool block (default) -->
              <div v-else-if="block.type === 'tool'" class="mb-1 pl-4 sm:pl-8">
                <ToolExecutionCard :toolCall="block" />
              </div>
            </template>
          </template>

          <!-- Fallback -->
          <template v-else>
            <div
              v-if="msg.content"
              class="ai-message pl-4 sm:pl-8 text-[14px] sm:text-[15px] leading-relaxed text-white/80"
              @mouseup="handleTextSelect($event, msg.id)"
            >
              <div v-html="renderMarkdown(msg.content)"></div>
            </div>
          </template>

          <!-- Follow-up suggestions -->
          <div v-if="getMessageSuggestions(msg).length && !isStreaming" class="pl-4 sm:pl-8 mt-4 space-y-2">
            <p class="text-xs font-semibold text-white/40 mb-2">Want me to dig deeper?</p>
            <button
              v-for="(suggestion, si) in getMessageSuggestions(msg)"
              :key="si"
              @click="emit('suggestion', suggestion)"
              class="block w-full text-left px-3.5 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors cursor-pointer"
            >{{ suggestion }}</button>
          </div>

          <!-- Time saved badge -->
          <div v-if="msg.timeSaved && msg.id !== 'streaming'" class="pl-4 sm:pl-8 mt-2 mb-1">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[11px] text-emerald-400 font-medium">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ~{{ msg.timeSaved }} min of manual analysis saved
            </span>
          </div>

          <!-- Feedback & Thread -->
          <div v-if="msg.role === 'assistant' && msg.id !== 'streaming' && msg.content" class="pl-4 sm:pl-8 mt-2 flex items-center gap-1">
            <button
              v-if="!isStreaming"
              @click="emit('fork', msg.id)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-transparent text-[11px] text-white/30 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/10 transition-all cursor-pointer"
              title="Start a new thread from here"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none">
                <path d="M3 4.5C3 3.67 3.67 3 4.5 3h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H8l-3.15 2.36A.75.75 0 013.5 14.8V13H4.5 3V4.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 8h6M7 5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              Thread
            </button>
            <button
              v-if="feedbackMsgId !== msg.id"
              @click="openFeedback(msg.id)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-transparent text-[11px] text-white/30 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/10 transition-all cursor-pointer"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
              Feedback
            </button>
            <div v-if="feedbackMsgId === msg.id" class="mt-1 flex flex-col gap-2">
              <textarea
                v-model="feedbackText"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple placeholder:text-white/30"
                placeholder="Tell the AI what it should do differently..."
                @keydown.enter.ctrl="submitFeedback"
              ></textarea>
              <div class="flex gap-2">
                <button
                  @click="submitFeedback"
                  :disabled="!feedbackText.trim()"
                  class="px-3 py-1.5 rounded-lg bg-sick-gradient text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >Save as instruction</button>
                <button @click="cancelFeedback" class="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>

          <!-- Streaming status -->
          <div v-if="msg.id === 'streaming' && isStreaming" class="pl-4 sm:pl-8 mt-2">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <svg class="w-3.5 h-3.5 text-brand-purple animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="text-xs text-white/80 font-medium truncate max-w-[200px] sm:max-w-[320px]">{{ streamingStatusMessage }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
.ai-message h1, .ai-message h2, .ai-message h3 { font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; line-height: 1.4; }
.ai-message h1 { font-size: 1.125rem; }
.ai-message h2 { font-size: 1.05rem; }
.ai-message h3 { font-size: 0.9375rem; }
.ai-message h1:first-child, .ai-message h2:first-child, .ai-message h3:first-child { margin-top: 0; }
.ai-message p { margin: 0.5rem 0; }
.ai-message p:first-child { margin-top: 0; }
.ai-message p:last-child { margin-bottom: 0; }
.ai-message ul, .ai-message ol { margin: 0.5rem 0; padding-left: 1.5rem; }
.ai-message li { margin: 0.25rem 0; }
.ai-message strong { font-weight: 600; }
.ai-message code { background: rgba(255,255,255,0.1); padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-size: 0.8125rem; }
.ai-message pre { background: rgba(255,255,255,0.06); border-radius: 0.5rem; padding: 0.75rem 1rem; overflow-x: auto; margin: 0; }
.ai-message pre code { background: none; padding: 0; }
/* Copy affordance on code / email blocks */
.code-block { position: relative; margin: 0.75rem 0; }
.code-block pre { white-space: pre-wrap; word-break: break-word; }
.code-copy-btn {
  position: absolute; top: 0.5rem; right: 0.5rem;
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.2rem 0.55rem; font-size: 0.6875rem; font-weight: 600;
  color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 0.375rem;
  cursor: pointer; transition: all 0.15s ease;
}
.code-copy-btn:hover { color: #fff; background: rgba(255,255,255,0.18); }
.code-copy-btn.copied { color: #34d399; background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.3); }
.ai-message table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.875rem; display: block; overflow-x: auto; }
.ai-message th, .ai-message td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
.ai-message th { font-weight: 600; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.025em; color: rgba(255,255,255,0.4); }
.ai-message blockquote { border-left: 3px solid var(--color-brand); padding-left: 1rem; margin: 0.75rem 0; color: rgba(255,255,255,0.5); }
.thread-action { transform: translateY(4px); }
.group\/msg:hover .thread-action { transform: translateY(0); }
</style>
