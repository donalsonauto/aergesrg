<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  reportSections: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  propertyName: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const reportContainer = ref(null)
const deletedSections = ref(new Set())
const deletedItems = ref(new Set())
const exporting = ref(false)

function sanitizeText(text) {
  if (!text) return ''
  return text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/[\u00D8\u00DE\u00A8\u00E4]/g, '')
    .replace(/\u00AE/g, '')
    .replace(/  +/g, ' ')
    .trim()
}

function sanitizeForPdf(text) {
  if (!text) return ''
  return text
    // Remove the 'Want me to dig deeper?' follow-up block. Those live in the chat as clickable buttons; they should not appear in the printable PDF.
    .replace(/---\s*\n\*\*Want me to dig deeper\?\*\*\n[\s\S]*$/, '')
    .replace(/\*\*Want me to dig deeper\?\*\*\n[\s\S]*$/, '')
    .replace(/📉/g, '[-]').replace(/📈/g, '[+]').replace(/⚠️/g, '[!]').replace(/🚨/g, '[!!]')
    .replace(/[^\x00-\x7F]/g, ch => { const c = ch.charCodeAt(0); return (c >= 0xC0 && c <= 0xFF) ? ch : '' })
    .replace(/#{1,6}\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/  +/g, ' ').trim()
}

function stripDigDeeper(text) {
  if (!text) return ''
  // Drop the trailing "Want me to dig deeper?" block — those follow-ups are
  // rendered as clickable buttons in the chat, not in the report.
  return text.replace(/\n?\s*(?:---\s*\n)?\s*\*{0,2}Want me to dig deeper\??\*{0,2}\s*\n[\s\S]*$/i, '').trim()
}

function renderNarrative(text) {
  if (!text) return ''
  let html = marked.parse(sanitizeText(stripDigDeeper(text)))
  html = html.replace(/([-][\d,.]+%)/g, '<span style="color:#ef4444;font-weight:600">$1</span>')
  html = html.replace(/(\+[\d,.]+%)/g, '<span style="color:#22c55e;font-weight:600">$1</span>')
  return html
}

const visibleSections = computed(() =>
  props.reportSections.filter(s => !deletedSections.value.has(s.id))
)
const hasContent = computed(() => visibleSections.value.length > 0)

function deleteSection(id) { deletedSections.value.add(id) }
function deleteItem(id) { deletedItems.value.add(id) }

function formatNum(val) {
  if (val == null) return '--'
  if (typeof val === 'object') val = val.value
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function rawNum(val) {
  if (val == null) return null
  if (typeof val === 'object') val = val.value
  const n = Number(val)
  return isNaN(n) ? null : n
}

function pctChange(cur, prev) {
  const c = typeof cur === 'object' ? cur?.value : cur
  const p = typeof prev === 'object' ? prev?.value : prev
  if (c == null || p == null || p === 0) return null
  return ((c - p) / Math.abs(p)) * 100
}

function varianceColor(pct) {
  if (pct == null) return ''
  if (pct < -3) return 'text-red-500'
  if (pct > 3) return 'text-green-500'
  return 'text-yellow-500'
}

function formatPct(pct) {
  if (pct == null) return ''
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
}

function processSectionTools(toolCalls, sectionId) {
  const metrics = []
  const events = []
  const drilldowns = []
  const eventDetails = []
  const monthlyTrends = []
  const searchConsole = []
  const knowledge = []

  for (const tc of toolCalls) {
    if (!tc.result || tc.result.error) continue
    if (deletedItems.value.has(tc.id)) continue

    switch (tc.name) {
      case 'get_ga4_metrics': {
        const r = tc.result
        if (r.metrics) {
          for (const [key, val] of Object.entries(r.metrics)) {
            metrics.push({
              id: tc.id + ':' + key,
              name: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
              property: r.property_name || '',
              current: val.current,
              previous: val.previous,
              lastYear: val.lastYear,
            })
          }
        }
        break
      }
      case 'get_asc_events': {
        const r = tc.result
        if (r.events && r.events.length) {
          events.push({ id: tc.id, property: r.property_name || '', period: r.period, data: r.events })
        }
        break
      }
      case 'get_asc_drilldown':
      case 'get_ga4_drilldown': {
        const r = tc.result
        if (r.data && r.data.length) {
          const dim = r.dimension || tc.args?.dimension || tc.args?.drilldown_dimension || ''
          const normalizedData = r.data.map(row => {
            if (row.label !== undefined || row.current !== undefined) return row
            const metricKey = Object.keys(row).find(k => k !== dim && typeof row[k] === 'object' && row[k]?.current !== undefined)
            if (metricKey) return { label: row[dim] || 'unknown', current: row[metricKey].current, previous: row[metricKey].previous, change: row[metricKey].change }
            return { label: row[dim] || 'unknown', current: 0, previous: 0, change: null }
          })
          drilldowns.push({
            id: tc.id,
            event: r.event_name || tc.args?.event_name || tc.args?.metrics?.[0] || '',
            dimension: dim,
            property: r.property_name || '',
            data: normalizedData,
          })
        }
        break
      }
      case 'get_asc_event_detail': {
        const r = tc.result
        if (r.data && r.data.length) {
          eventDetails.push({
            id: tc.id, event: r.event_name || '', dimensions: r.dimensions || [],
            property: r.property_name || '', filter: r.filter, data: r.data,
          })
        }
        break
      }
      case 'get_ga4_monthly_trend': {
        const r = tc.result
        if (r.months && r.months.length) {
          monthlyTrends.push({ id: tc.id, metric: r.metric || tc.args?.metric || '', property: r.property_name || '', months: r.months })
        }
        break
      }
      case 'get_search_console':
      case 'get_search_queries':
      case 'get_page_performance': {
        const r = tc.result
        if (r.data && r.data.length) {
          searchConsole.push({ id: tc.id, type: tc.name, property: r.site_url || '', data: r.data.slice(0, 10) })
        }
        break
      }
      case 'search_knowledge': {
        const r = tc.result
        if (r.documents && r.documents.length) {
          for (const doc of r.documents) knowledge.push({ id: doc.id, title: doc.title })
        }
        break
      }
    }
  }

  return { metrics, events, drilldowns, eventDetails, monthlyTrends, searchConsole, knowledge }
}

function getSectionTitle(section, index) {
  if (section.isFinalAnalysis) return 'Summary & Recommendations'
  const tools = section.toolCalls || []
  if (!tools.length && section.narrative) return 'Analysis'
  if (!tools.length) return `Step ${index + 1}`
  const names = [...new Set(tools.map(t => t.name))]
  if (names.includes('list_ga_properties')) return `Step ${index + 1}: Discovering Properties`
  if (names.includes('get_ga4_monthly_trend')) return `Step ${index + 1}: Monthly Trends`
  if (names.includes('get_asc_event_detail')) return `Step ${index + 1}: ASC Deep Drill`
  if (names.includes('get_asc_drilldown') || names.includes('get_ga4_drilldown')) return `Step ${index + 1}: Drill-Down Analysis`
  if (names.includes('get_asc_events')) return `Step ${index + 1}: ASC Event Scan`
  if (names.includes('get_ga4_metrics')) return `Step ${index + 1}: KPI Metrics`
  if (names.includes('get_search_console') || names.includes('get_search_queries')) return `Step ${index + 1}: Search Console`
  if (names.includes('get_page_performance')) return `Step ${index + 1}: Page Performance`
  if (names.includes('search_knowledge')) return `Step ${index + 1}: Expert Knowledge`
  if (names.includes('check_asc_health')) return `Step ${index + 1}: ASC Health Check`
  return `Step ${index + 1}: Investigation`
}

function getSectionIcon(section) {
  const tools = section.toolCalls || []
  const names = [...new Set(tools.map(t => t.name))]
  if (names.includes('get_ga4_monthly_trend')) return 'chart-line'
  if (names.includes('get_asc_drilldown') || names.includes('get_ga4_drilldown') || names.includes('get_asc_event_detail')) return 'table'
  if (names.includes('get_asc_events') || names.includes('get_ga4_metrics')) return 'chart-bar'
  if (names.includes('get_search_console') || names.includes('get_search_queries')) return 'search'
  if (names.includes('search_knowledge')) return 'book'
  if (section.isFinalAnalysis) return 'flag'
  return 'circle'
}

watch(() => props.reportSections, () => {
  nextTick(() => {
    if (reportContainer.value) reportContainer.value.scrollTop = reportContainer.value.scrollHeight
  })
}, { deep: true })

// Parse narrative text into text blocks and markdown table blocks
function parseNarrativeBlocks(narrative) {
  if (!narrative) return []
  const lines = narrative.split('\n')
  const blocks = []
  let currentText = []
  let tableHeaders = null
  let tableRows = []
  let inTable = false

  function flushText() {
    const text = currentText.join('\n').trim()
    if (text) {
      // Split into bold headers and normal text
      const parts = text.split(/\n/)
      let buf = []
      for (const part of parts) {
        const trimmed = part.trim()
        if (/^#{1,4}\s+/.test(trimmed) || /^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
          if (buf.length) { blocks.push({ type: 'text', text: buf.join('\n'), bold: false }); buf = [] }
          blocks.push({ type: 'text', text: trimmed.replace(/^#{1,4}\s+/, '').replace(/\*\*/g, ''), bold: true })
        } else {
          buf.push(part)
        }
      }
      if (buf.length) blocks.push({ type: 'text', text: buf.join('\n'), bold: false })
    }
    currentText = []
  }

  function flushTable() {
    if (tableHeaders && tableRows.length) {
      blocks.push({ type: 'table', headers: tableHeaders, rows: tableRows })
    }
    tableHeaders = null
    tableRows = []
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Detect table row: starts and ends with |
    if (/^\|(.+)\|$/.test(line)) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      // Check if this is a separator row like |---|---|
      if (cells.every(c => /^[-:]+$/.test(c))) {
        continue // skip separator
      }
      if (!inTable) {
        flushText()
        inTable = true
        tableHeaders = cells
      } else {
        tableRows.push(cells)
      }
    } else {
      if (inTable) flushTable()
      currentText.push(lines[i])
    }
  }
  if (inTable) flushTable()
  flushText()
  return blocks
}

// ==================== PDF EXPORT ====================
async function exportPDF() {
  exporting.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentW = pageW - margin * 2
    let y = 0

    const C = {
      primary: [112, 0, 255],
      accent: [0, 194, 255],
      dark: [3, 0, 20],
      headerBg: [20, 10, 50],
      mid: [100, 116, 139],
      light: [203, 213, 225],
      bg: [248, 250, 252],
      green: [34, 197, 94],
      red: [239, 68, 68],
      yellow: [234, 179, 8],
      white: [255, 255, 255],
      tableBg: [241, 245, 249],
      tableAlt: [248, 250, 252],
    }

    function checkPageBreak(needed) {
      if (y + needed > pageH - 20) {
        doc.addPage()
        y = margin
        return true
      }
      return false
    }

    function varianceColorPdf(pct) {
      if (pct == null) return C.mid
      if (pct < -3) return C.red
      if (pct > 3) return C.green
      return C.yellow
    }

    // Header bar
    doc.setFillColor(...C.headerBg)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFillColor(...C.primary)
    doc.rect(0, 28, pageW / 2, 1.5, 'F')
    doc.setFillColor(...C.accent)
    doc.rect(pageW / 2, 28, pageW / 2, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...C.white)
    doc.text('RankMatic Analytics Report', margin, 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(180, 180, 220)
    const now = new Date()
    doc.text(`Generated ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, margin, 21)
    if (props.propertyName) {
      doc.setFontSize(8)
      doc.setTextColor(140, 140, 180)
      doc.text(props.propertyName, margin, 26)
    }
    y = 36

    // Each section
    for (let si = 0; si < visibleSections.value.length; si++) {
      const section = visibleSections.value[si]
      const title = getSectionTitle(section, si)
      const tools = processSectionTools(section.toolCalls || [], section.id)

      checkPageBreak(20)

      // Section header bar
      doc.setFillColor(...(section.isFinalAnalysis ? C.accent : C.primary))
      doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...C.white)
      doc.text(title, margin + 4, y + 5.5)
      const callCount = (section.toolCalls || []).length
      if (callCount > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`${callCount} tool calls`, pageW - margin - 4, y + 5.5, { align: 'right' })
      }
      y += 12

      // Narrative (with markdown table support)
      if (section.narrative) {
        checkPageBreak(10)
        // Split narrative into text blocks and markdown table blocks
        const narrativeBlocks = parseNarrativeBlocks(section.narrative)
        for (const block of narrativeBlocks) {
          if (block.type === 'table') {
            // Render markdown table with autoTable
            checkPageBreak(15)
            autoTable(doc, {
              startY: y,
              margin: { left: margin + 2, right: margin + 2 },
              head: [block.headers],
              body: block.rows,
              styles: { fontSize: 7, cellPadding: 1.8, textColor: C.dark, lineColor: [220, 225, 235], lineWidth: 0.2 },
              headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
              alternateRowStyles: { fillColor: C.tableAlt },
              bodyStyles: { fillColor: C.tableBg },
              didParseCell: (data) => {
                // Color variance values in table cells
                const val = String(data.cell.raw || '')
                if (/^[-]\d/.test(val) && val.includes('%')) {
                  data.cell.styles.textColor = C.red
                  data.cell.styles.fontStyle = 'bold'
                } else if (/^\+\d/.test(val) && val.includes('%')) {
                  data.cell.styles.textColor = C.green
                  data.cell.styles.fontStyle = 'bold'
                }
              },
            })
            y = doc.lastAutoTable.finalY + 4
          } else {
            // Render text block
            doc.setFont('helvetica', block.bold ? 'bold' : 'normal')
            doc.setFontSize(block.bold ? 9 : 8.5)
            doc.setTextColor(...(block.bold ? C.dark : C.mid))
            const pdfText = sanitizeForPdf(block.text)
            const lines = doc.splitTextToSize(pdfText, contentW - 8)
            for (const line of lines) {
              checkPageBreak(5)
              doc.text(line, margin + 4, y + 3)
              y += 3.8
            }
            y += 2
          }
        }
        y += 2
      }

      // KPI Metrics - 2 column grid
      if (tools.metrics.length) {
        checkPageBreak(12)
        const cols = 2
        const cellW = (contentW - 4) / cols
        const cellH = 14
        for (let mi = 0; mi < tools.metrics.length; mi++) {
          const m = tools.metrics[mi]
          const col = mi % cols
          const x = margin + col * (cellW + 2)
          if (col === 0 && mi > 0) { y += cellH + 2; checkPageBreak(cellH + 4) }
          if (col === 0 && mi === 0) checkPageBreak(cellH + 4)

          // Cell background
          doc.setFillColor(...C.tableBg)
          doc.roundedRect(x, y, cellW, cellH, 1, 1, 'F')
          doc.setDrawColor(220, 225, 235)
          doc.roundedRect(x, y, cellW, cellH, 1, 1, 'S')

          // Metric name
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...C.mid)
          doc.text(m.name, x + 3, y + 4.5)

          // Current value
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.setTextColor(...C.dark)
          doc.text(formatNum(m.current), x + 3, y + 10)

          // Variance
          const pct = pctChange(m.current, m.previous)
          if (pct != null) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.setTextColor(...varianceColorPdf(pct))
            doc.text(formatPct(pct), x + cellW - 3, y + 10, { align: 'right' })
          }

          // Previous / LY
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.setTextColor(160, 170, 185)
          let subtext = `Prev: ${formatNum(m.previous)}`
          if (m.lastYear != null) subtext += ` | LY: ${formatNum(m.lastYear)}`
          doc.text(subtext, x + 3, y + 13)
        }
        y += cellH + 4
      }

      // ASC Events table
      if (tools.events.length) {
        for (const ev of tools.events) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dark)
          doc.text(`ASC Events${ev.property ? ' - ' + ev.property : ''}`, margin + 2, y + 3)
          y += 5

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Event', 'Current', 'Previous', 'Change']],
            body: ev.data.slice(0, 15).map(row => [
              row.event_name || '',
              formatNum(row.current),
              formatNum(row.previous),
              row.change != null ? formatPct(row.change) : '',
            ]),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [230, 230, 240], lineWidth: 0.2 },
            headStyles: { fillColor: C.headerBg, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: C.tableAlt },
            columnStyles: {
              0: { cellWidth: 'auto', textColor: C.dark },
              1: { halign: 'right', fontStyle: 'bold', textColor: C.dark },
              2: { halign: 'right', textColor: C.mid },
              3: { halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
              if (data.column.index === 3 && data.section === 'body') {
                const val = parseFloat(data.cell.raw)
                if (!isNaN(val)) data.cell.styles.textColor = val < -3 ? C.red : val > 3 ? C.green : C.yellow
              }
            },
          })
          y = doc.lastAutoTable.finalY + 4
        }
      }

      // Drilldown tables
      if (tools.drilldowns.length) {
        for (const dd of tools.drilldowns) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dark)
          doc.text(`${dd.event} by ${dd.dimension}${dd.property ? ' - ' + dd.property : ''}`, margin + 2, y + 3)
          y += 5

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [[dd.dimension || 'Name', 'Current', 'Previous', 'Change']],
            body: dd.data.slice(0, 10).map(row => [
              sanitizeForPdf(row.label || row[dd.dimension] || 'unknown'),
              formatNum(row.current),
              formatNum(row.previous),
              row.change != null ? formatPct(row.change) : '',
            ]),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [230, 230, 240], lineWidth: 0.2 },
            headStyles: { fillColor: C.headerBg, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: C.tableAlt },
            columnStyles: {
              0: { cellWidth: 'auto', textColor: C.dark },
              1: { halign: 'right', fontStyle: 'bold', textColor: C.dark },
              2: { halign: 'right', textColor: C.mid },
              3: { halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
              if (data.column.index === 3 && data.section === 'body') {
                const val = parseFloat(data.cell.raw)
                if (!isNaN(val)) data.cell.styles.textColor = val < -3 ? C.red : val > 3 ? C.green : C.yellow
              }
            },
          })
          y = doc.lastAutoTable.finalY + 4
        }
      }

      // Event detail tables
      if (tools.eventDetails.length) {
        for (const ed of tools.eventDetails) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dark)
          let label = `${ed.event} by ${ed.dimensions.join(' x ')}`
          if (ed.filter) label += ` [${ed.filter.dimension}=${ed.filter.value}]`
          if (ed.property) label += ` - ${ed.property}`
          doc.text(sanitizeForPdf(label), margin + 2, y + 3)
          y += 5

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [[...ed.dimensions, 'Current', 'Previous', 'Change']],
            body: ed.data.slice(0, 15).map(row => [
              ...ed.dimensions.map(d => sanitizeForPdf(String(row[d] || 'unknown'))),
              formatNum(row.current),
              formatNum(row.previous),
              row.change != null ? formatPct(row.change) : '',
            ]),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [230, 230, 240], lineWidth: 0.2 },
            headStyles: { fillColor: C.headerBg, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: C.tableAlt },
            didParseCell: (data) => {
              const lastIdx = ed.dimensions.length + 2
              if (data.column.index === lastIdx && data.section === 'body') {
                const val = parseFloat(data.cell.raw)
                if (!isNaN(val)) data.cell.styles.textColor = val < -3 ? C.red : val > 3 ? C.green : C.yellow
              }
            },
          })
          y = doc.lastAutoTable.finalY + 4
        }
      }

      // Monthly trends
      if (tools.monthlyTrends.length) {
        for (const trend of tools.monthlyTrends) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dark)
          const metricName = trend.metric.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
          doc.text(`${metricName} - 6 Month Trend${trend.property ? ' - ' + trend.property : ''}`, margin + 2, y + 3)
          y += 5

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Month', 'Value', 'Last Year', 'YoY']],
            body: trend.months.map(m => {
              const yoy = m.lastYearValue != null && m.lastYearValue !== 0 ? ((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100 : null
              return [
                m.label || (String(m.month).padStart(2, '0') + '/' + String(m.year).slice(-2)),
                formatNum(m.value),
                m.lastYearValue != null ? formatNum(m.lastYearValue) : '--',
                yoy != null ? formatPct(yoy) : '',
              ]
            }),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [230, 230, 240], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 80, 60], textColor: C.white, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: C.tableAlt },
            columnStyles: {
              0: { textColor: C.dark },
              1: { halign: 'right', fontStyle: 'bold', textColor: C.dark },
              2: { halign: 'right', textColor: C.mid },
              3: { halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
              if (data.column.index === 3 && data.section === 'body') {
                const val = parseFloat(data.cell.raw)
                if (!isNaN(val)) data.cell.styles.textColor = val < -3 ? C.red : val > 3 ? C.green : C.yellow
              }
            },
          })
          y = doc.lastAutoTable.finalY + 4
        }
      }

      // Search Console
      if (tools.searchConsole.length) {
        for (const sc of tools.searchConsole) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.dark)
          doc.text(`Search Console${sc.property ? ' - ' + sc.property : ''}`, margin + 2, y + 3)
          y += 5

          const isPages = sc.type === 'get_page_performance'
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [[isPages ? 'Page' : 'Query', 'Clicks', 'Impressions', 'CTR', 'Position']],
            body: sc.data.map(row => [
              sanitizeForPdf(row.query || row.page || row.keys?.[0] || ''),
              formatNum(row.clicks),
              formatNum(row.impressions),
              row.ctr != null ? (row.ctr * 100).toFixed(1) + '%' : '',
              row.position != null ? row.position.toFixed(1) : '',
            ]),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [230, 230, 240], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 60, 120], textColor: C.white, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: C.tableAlt },
            columnStyles: {
              0: { cellWidth: 'auto', textColor: C.dark },
              1: { halign: 'right', fontStyle: 'bold', textColor: C.dark },
              2: { halign: 'right', textColor: C.mid },
              3: { halign: 'right', textColor: C.mid },
              4: { halign: 'right', textColor: C.mid },
            },
          })
          y = doc.lastAutoTable.finalY + 4
        }
      }

      // Knowledge references
      if (tools.knowledge.length) {
        checkPageBreak(8)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(140, 140, 170)
        doc.text('Expert Knowledge Referenced:', margin + 4, y + 3)
        y += 4.5
        for (const kb of tools.knowledge) {
          checkPageBreak(4)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.text('  - ' + sanitizeForPdf(kb.title), margin + 6, y + 3)
          y += 3.5
        }
        y += 2
      }

      y += 2
    }

    // Footer on all pages
    const totalPages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setTextColor(...C.mid)
      doc.text('RankMatic Analytics', margin, pageH - 8)
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin - 20, pageH - 8)
    }

    doc.save(`rankmatic-report-${now.toISOString().split('T')[0]}.pdf`)
  } catch (err) {
    console.error('PDF export error:', err)
  } finally {
    exporting.value = false
  }
}

// ==================== EXCEL EXPORT ====================
async function exportExcel() {
  exporting.value = true
  try {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'RankMatic'
    wb.created = new Date()

    const brandPurple = '6366F1'
    const brandCyan = '38BDF8'
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '140A32' } }
    const headerFont = { color: { argb: 'FFFFFF' }, bold: true, size: 10 }
    const altFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }
    const borderStyle = { style: 'thin', color: { argb: 'E2E8F0' } }
    const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle }

    function styleHeader(row) {
      row.eachCell(cell => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.border = borders
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      row.height = 22
    }

    function styleDataRows(ws, startRow, endRow) {
      for (let r = startRow; r <= endRow; r++) {
        const row = ws.getRow(r)
        row.eachCell(cell => {
          cell.border = borders
          cell.alignment = { vertical: 'middle' }
          cell.font = { size: 10 }
        })
        if ((r - startRow) % 2 === 1) {
          row.eachCell(cell => { cell.fill = altFill })
        }
      }
    }

    function addVarianceCell(cell, pct) {
      if (pct == null) return
      cell.font = { bold: true, size: 10, color: { argb: pct < -3 ? 'EF4444' : pct > 3 ? '22C55E' : 'EAB308' } }
    }

    // === SUMMARY SHEET ===
    const summary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: brandPurple } } })
    summary.mergeCells('A1:F1')
    const titleCell = summary.getCell('A1')
    titleCell.value = 'RankMatic Analytics Report'
    titleCell.font = { bold: true, size: 16, color: { argb: brandPurple } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    summary.getRow(1).height = 30

    summary.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    summary.getCell('A2').font = { size: 10, color: { argb: '64748B' } }
    if (props.propertyName) {
      summary.getCell('A3').value = props.propertyName
      summary.getCell('A3').font = { size: 10, color: { argb: '64748B' } }
    }

    let summaryRow = 5

    // Collect all metrics across sections for summary
    const allMetrics = []
    for (const section of visibleSections.value) {
      const tools = processSectionTools(section.toolCalls || [], section.id)
      allMetrics.push(...tools.metrics)
    }

    if (allMetrics.length) {
      summary.getCell(`A${summaryRow}`).value = 'Key Performance Indicators'
      summary.getCell(`A${summaryRow}`).font = { bold: true, size: 12, color: { argb: brandPurple } }
      summaryRow++

      const hdr = summary.addRow(['Metric', 'Property', 'Current', 'Previous', 'Change %', 'Last Year'])
      styleHeader(hdr)
      summary.columns = [
        { width: 28 }, { width: 24 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 },
      ]
      summaryRow++

      const dataStart = summaryRow
      for (const m of allMetrics) {
        const pct = pctChange(m.current, m.previous)
        const row = summary.addRow([
          m.name, m.property, rawNum(m.current), rawNum(m.previous),
          pct != null ? Math.round(pct * 10) / 10 : null, rawNum(m.lastYear),
        ])
        row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '+0.0%;-0.0%'
        if (row.getCell(5).value != null) row.getCell(5).value = pct / 100
        row.getCell(6).numFmt = '#,##0'
        addVarianceCell(row.getCell(5), pct)
        summaryRow++
      }
      styleDataRows(summary, dataStart, summaryRow - 1)
      summaryRow += 2
    }

    // Add narratives to summary
    for (let si = 0; si < visibleSections.value.length; si++) {
      const section = visibleSections.value[si]
      if (!section.narrative) continue
      const title = getSectionTitle(section, si)
      summary.getCell(`A${summaryRow}`).value = title
      summary.getCell(`A${summaryRow}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
      summaryRow++
      summary.mergeCells(`A${summaryRow}:F${summaryRow}`)
      const narrativeCell = summary.getCell(`A${summaryRow}`)
      narrativeCell.value = sanitizeForPdf(section.narrative)
      narrativeCell.font = { size: 9, color: { argb: '64748B' } }
      narrativeCell.alignment = { wrapText: true, vertical: 'top' }
      summary.getRow(summaryRow).height = 60
      summaryRow += 2
    }

    // === DATA SHEETS per section ===
    let sheetIdx = 0
    for (let si = 0; si < visibleSections.value.length; si++) {
      const section = visibleSections.value[si]
      const tools = processSectionTools(section.toolCalls || [], section.id)
      const hasData = tools.events.length || tools.drilldowns.length || tools.eventDetails.length || tools.monthlyTrends.length || tools.searchConsole.length

      if (!hasData) continue
      sheetIdx++
      const sheetName = `Step ${si + 1}`.substring(0, 31)
      const ws = wb.addWorksheet(sheetName)

      let row = 1

      // Events
      for (const ev of tools.events) {
        ws.getCell(`A${row}`).value = `ASC Events${ev.property ? ' - ' + ev.property : ''}`
        ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
        row++

        const hdr = ws.getRow(row)
        hdr.values = ['Event', 'Current', 'Previous', 'Change %']
        styleHeader(hdr)
        ws.getColumn(1).width = 32
        ws.getColumn(2).width = 14
        ws.getColumn(3).width = 14
        ws.getColumn(4).width = 12
        row++

        const dataStart = row
        for (const r of ev.data.slice(0, 30)) {
          const pct = r.change
          const dataRow = ws.getRow(row)
          dataRow.values = [r.event_name, rawNum(r.current), rawNum(r.previous), pct != null ? pct / 100 : null]
          dataRow.getCell(2).numFmt = '#,##0'
          dataRow.getCell(3).numFmt = '#,##0'
          dataRow.getCell(4).numFmt = '+0.0%;-0.0%'
          addVarianceCell(dataRow.getCell(4), pct)
          row++
        }
        styleDataRows(ws, dataStart, row - 1)
        row += 2
      }

      // Drilldowns
      for (const dd of tools.drilldowns) {
        ws.getCell(`A${row}`).value = `${dd.event} by ${dd.dimension}${dd.property ? ' - ' + dd.property : ''}`
        ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
        row++

        const hdr = ws.getRow(row)
        hdr.values = [dd.dimension || 'Name', 'Current', 'Previous', 'Change %']
        styleHeader(hdr)
        row++

        const dataStart = row
        for (const r of dd.data.slice(0, 20)) {
          const dataRow = ws.getRow(row)
          dataRow.values = [r.label || r[dd.dimension] || 'unknown', rawNum(r.current), rawNum(r.previous), r.change != null ? r.change / 100 : null]
          dataRow.getCell(2).numFmt = '#,##0'
          dataRow.getCell(3).numFmt = '#,##0'
          dataRow.getCell(4).numFmt = '+0.0%;-0.0%'
          addVarianceCell(dataRow.getCell(4), r.change)
          row++
        }
        styleDataRows(ws, dataStart, row - 1)
        row += 2
      }

      // Event details
      for (const ed of tools.eventDetails) {
        let label = `${ed.event} by ${ed.dimensions.join(' x ')}`
        if (ed.property) label += ` - ${ed.property}`
        ws.getCell(`A${row}`).value = label
        ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
        row++

        const hdr = ws.getRow(row)
        hdr.values = [...ed.dimensions, 'Current', 'Previous', 'Change %']
        styleHeader(hdr)
        row++

        const dataStart = row
        for (const r of ed.data.slice(0, 20)) {
          const dataRow = ws.getRow(row)
          dataRow.values = [...ed.dimensions.map(d => String(r[d] || 'unknown')), rawNum(r.current), rawNum(r.previous), r.change != null ? r.change / 100 : null]
          const lastNumCol = ed.dimensions.length + 1
          dataRow.getCell(lastNumCol).numFmt = '#,##0'
          dataRow.getCell(lastNumCol + 1).numFmt = '#,##0'
          dataRow.getCell(lastNumCol + 2).numFmt = '+0.0%;-0.0%'
          addVarianceCell(dataRow.getCell(lastNumCol + 2), r.change)
          row++
        }
        styleDataRows(ws, dataStart, row - 1)
        row += 2
      }

      // Monthly trends
      for (const trend of tools.monthlyTrends) {
        const metricName = trend.metric.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
        ws.getCell(`A${row}`).value = `${metricName} Trend${trend.property ? ' - ' + trend.property : ''}`
        ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
        row++

        const hdr = ws.getRow(row)
        hdr.values = ['Month', 'Value', 'Last Year', 'YoY %']
        styleHeader(hdr)
        row++

        const dataStart = row
        for (const m of trend.months) {
          const yoy = m.lastYearValue != null && m.lastYearValue !== 0 ? ((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100 : null
          const dataRow = ws.getRow(row)
          dataRow.values = [
            m.label || (String(m.month).padStart(2, '0') + '/' + String(m.year).slice(-2)),
            m.value, m.lastYearValue != null ? m.lastYearValue : null,
            yoy != null ? yoy / 100 : null,
          ]
          dataRow.getCell(2).numFmt = '#,##0'
          dataRow.getCell(3).numFmt = '#,##0'
          dataRow.getCell(4).numFmt = '+0.0%;-0.0%'
          addVarianceCell(dataRow.getCell(4), yoy)
          row++
        }
        styleDataRows(ws, dataStart, row - 1)
        row += 2
      }

      // Search Console
      for (const sc of tools.searchConsole) {
        ws.getCell(`A${row}`).value = `Search Console${sc.property ? ' - ' + sc.property : ''}`
        ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: brandPurple } }
        row++

        const isPages = sc.type === 'get_page_performance'
        const hdr = ws.getRow(row)
        hdr.values = [isPages ? 'Page' : 'Query', 'Clicks', 'Impressions', 'CTR', 'Position']
        styleHeader(hdr)
        ws.getColumn(1).width = 40
        row++

        const dataStart = row
        for (const r of sc.data) {
          const dataRow = ws.getRow(row)
          dataRow.values = [
            r.query || r.page || r.keys?.[0] || '',
            r.clicks, r.impressions,
            r.ctr != null ? r.ctr : null,
            r.position != null ? r.position : null,
          ]
          dataRow.getCell(2).numFmt = '#,##0'
          dataRow.getCell(3).numFmt = '#,##0'
          dataRow.getCell(4).numFmt = '0.0%'
          dataRow.getCell(5).numFmt = '0.0'
          row++
        }
        styleDataRows(ws, dataStart, row - 1)
        row += 2
      }
    }

    // Download
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rankmatic-report-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Excel export error:', err)
  } finally {
    exporting.value = false
  }
}

// Auto-scroll to bottom when new sections arrive
</script>

<template>
  <div class="h-full flex flex-col bg-brand-dark border-l border-white/10">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-sm font-semibold text-white tracking-tight">Investigation Report</h3>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="hasContent && !isStreaming"
          @click="exportPDF"
          :disabled="exporting"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-colors cursor-pointer disabled:opacity-30"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </button>
        <button
          v-if="hasContent && !isStreaming"
          @click="exportExcel"
          :disabled="exporting"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-colors cursor-pointer disabled:opacity-30"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Excel
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div ref="reportContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 report-scroll">
      <!-- Empty state -->
      <div v-if="!hasContent && !isStreaming" class="flex flex-col items-center justify-center h-full text-center">
        <svg class="w-10 h-10 text-white/10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm text-white/30 max-w-[240px]">Report sections will appear here as the AI analyzes your data.</p>
      </div>

      <!-- Loading state -->
      <div v-if="!hasContent && isStreaming" class="flex flex-col items-center justify-center h-full text-center">
        <svg class="w-8 h-8 text-brand-purple animate-spin mb-3" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-sm text-white/40">Investigating...</p>
      </div>

      <!-- Investigation sections -->
      <template v-if="hasContent">
        <div
          v-for="(section, si) in visibleSections"
          :key="section.id"
          class="group/section rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
        >
          <!-- Section header -->
          <div class="px-3 py-2 bg-white/[0.04] border-b border-white/5 flex items-center gap-2">
            <div class="w-5 h-5 rounded-md bg-brand-purple/20 flex items-center justify-center shrink-0">
              <span class="text-[10px] font-bold text-brand-purple">{{ si + 1 }}</span>
            </div>
            <span class="text-xs font-semibold text-white/80 flex-1">{{ getSectionTitle(section, si) }}</span>
            <span class="text-[10px] text-white/30">{{ (section.toolCalls || []).length }} calls</span>
            <button
              @click="deleteSection(section.id)"
              class="opacity-0 group-hover/section:opacity-100 w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Narrative -->
          <div
            v-if="section.narrative"
            class="report-narrative px-3 py-2 text-[12px] text-white/60 leading-relaxed border-b border-white/5"
            v-html="renderNarrative(section.narrative)"
          ></div>

          <!-- Structured data from tool calls -->
          <div class="p-3 space-y-3" v-if="(section.toolCalls || []).length > 0">

            <!-- KPI Metrics cards -->
            <template v-if="processSectionTools(section.toolCalls, section.id).metrics.length">
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="m in processSectionTools(section.toolCalls, section.id).metrics"
                  :key="m.id"
                  class="group/m relative rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
                >
                  <button @click="deleteItem(m.id)" class="absolute top-1 right-1 opacity-0 group-hover/m:opacity-100 w-4 h-4 rounded flex items-center justify-center text-white/30 hover:text-red-400 transition-all cursor-pointer">
                    <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <div class="text-[10px] text-white/40 truncate pr-4">{{ m.name }}</div>
                  <div class="flex items-baseline gap-1.5 mt-0.5">
                    <span class="text-sm font-bold text-white">{{ formatNum(m.current) }}</span>
                    <span
                      v-if="pctChange(m.current, m.previous) !== null"
                      class="text-[11px] font-semibold"
                      :class="varianceColor(pctChange(m.current, m.previous))"
                    >{{ formatPct(pctChange(m.current, m.previous)) }}</span>
                  </div>
                  <div class="text-[9px] text-white/30 mt-0.5">
                    Prev: {{ formatNum(m.previous) }}
                    <span v-if="m.lastYear"> | LY: {{ formatNum(m.lastYear) }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ASC Events table -->
            <template v-if="processSectionTools(section.toolCalls, section.id).events.length">
              <div
                v-for="ev in processSectionTools(section.toolCalls, section.id).events"
                :key="ev.id"
                class="rounded-lg border border-white/10 overflow-hidden"
              >
                <div class="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/5 flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-brand-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span class="text-[10px] font-semibold text-white/70">ASC Events <span class="font-normal text-white/40">{{ ev.property }}</span></span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-white/40">
                        <th class="text-left px-2 py-1 font-medium">Event</th>
                        <th class="text-right px-2 py-1 font-medium">Current</th>
                        <th class="text-right px-2 py-1 font-medium">Previous</th>
                        <th class="text-right px-2 py-1 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in ev.data.slice(0, 15)"
                        :key="ri"
                        class="border-t border-white/5"
                        :class="row.change != null && Math.abs(row.change) > 20 ? (row.change < 0 ? 'bg-red-500/5' : 'bg-green-500/5') : ''"
                      >
                        <td class="px-2 py-0.5 text-white/70 font-mono text-[9px]">{{ row.event_name }}</td>
                        <td class="px-2 py-0.5 text-right text-white/80 font-medium tabular-nums">{{ formatNum(row.current) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/40 tabular-nums">{{ formatNum(row.previous) }}</td>
                        <td class="px-2 py-0.5 text-right font-semibold tabular-nums" :class="varianceColor(row.change)">{{ formatPct(row.change) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Drilldown tables -->
            <template v-if="processSectionTools(section.toolCalls, section.id).drilldowns.length">
              <div
                v-for="dd in processSectionTools(section.toolCalls, section.id).drilldowns"
                :key="dd.id"
                class="rounded-lg border border-white/10 overflow-hidden"
              >
                <div class="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/5">
                  <span class="text-[10px] font-semibold text-white/70">
                    {{ dd.event }} <span class="font-normal text-white/40">by {{ dd.dimension }}</span>
                    <span v-if="dd.property" class="font-normal text-white/30"> - {{ dd.property }}</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-white/40">
                        <th class="text-left px-2 py-1 font-medium">{{ dd.dimension }}</th>
                        <th class="text-right px-2 py-1 font-medium">Current</th>
                        <th class="text-right px-2 py-1 font-medium">Previous</th>
                        <th class="text-right px-2 py-1 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in dd.data.slice(0, 10)"
                        :key="ri"
                        class="border-t border-white/5"
                      >
                        <td class="px-2 py-0.5 text-white/70 truncate max-w-[140px]">{{ sanitizeText(row.label || row[dd.dimension] || 'unknown') }}</td>
                        <td class="px-2 py-0.5 text-right text-white/80 font-medium tabular-nums">{{ formatNum(row.current) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/40 tabular-nums">{{ formatNum(row.previous) }}</td>
                        <td class="px-2 py-0.5 text-right font-semibold tabular-nums" :class="varianceColor(row.change)">{{ formatPct(row.change) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- ASC Event Detail tables -->
            <template v-if="processSectionTools(section.toolCalls, section.id).eventDetails.length">
              <div
                v-for="ed in processSectionTools(section.toolCalls, section.id).eventDetails"
                :key="ed.id"
                class="rounded-lg border border-white/10 overflow-hidden"
              >
                <div class="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/5 flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span class="text-[10px] font-semibold text-white/70">
                    {{ ed.event }}
                    <span class="font-normal text-white/40">by {{ ed.dimensions.join(' x ') }}</span>
                    <span v-if="ed.filter" class="font-normal text-cyan-400/60"> [{{ ed.filter.dimension }}={{ ed.filter.value }}]</span>
                    <span v-if="ed.property" class="font-normal text-white/30"> - {{ ed.property }}</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-white/40">
                        <th v-for="dim in ed.dimensions" :key="dim" class="text-left px-2 py-1 font-medium">{{ dim }}</th>
                        <th class="text-right px-2 py-1 font-medium">Current</th>
                        <th class="text-right px-2 py-1 font-medium">Previous</th>
                        <th class="text-right px-2 py-1 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in ed.data.slice(0, 15)"
                        :key="ri"
                        class="border-t border-white/5"
                        :class="row.change != null && Math.abs(row.change) > 20 ? (row.change < 0 ? 'bg-red-500/5' : 'bg-green-500/5') : ''"
                      >
                        <td v-for="dim in ed.dimensions" :key="dim" class="px-2 py-0.5 text-white/70 truncate max-w-[120px]">{{ sanitizeText(String(row[dim] || 'unknown')) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/80 font-medium tabular-nums">{{ formatNum(row.current) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/40 tabular-nums">{{ formatNum(row.previous) }}</td>
                        <td class="px-2 py-0.5 text-right font-semibold tabular-nums" :class="varianceColor(row.change)">{{ formatPct(row.change) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Monthly Trends -->
            <template v-if="processSectionTools(section.toolCalls, section.id).monthlyTrends.length">
              <div
                v-for="trend in processSectionTools(section.toolCalls, section.id).monthlyTrends"
                :key="trend.id"
                class="rounded-lg border border-white/10 overflow-hidden"
              >
                <div class="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/5 flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-green-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  <span class="text-[10px] font-semibold text-white/70">
                    {{ trend.metric.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) }}
                    <span class="font-normal text-white/40"> - 6 Month Trend</span>
                    <span v-if="trend.property" class="font-normal text-white/30"> - {{ trend.property }}</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-white/40">
                        <th class="text-left px-2 py-1 font-medium">Month</th>
                        <th class="text-right px-2 py-1 font-medium">Value</th>
                        <th class="text-right px-2 py-1 font-medium">Last Year</th>
                        <th class="text-right px-2 py-1 font-medium">YoY</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(m, mi) in trend.months"
                        :key="mi"
                        class="border-t border-white/5"
                      >
                        <td class="px-2 py-0.5 text-white/70">{{ m.label || (String(m.month).padStart(2,'0') + '/' + String(m.year).slice(-2)) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/80 font-medium tabular-nums">{{ formatNum(m.value) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/40 tabular-nums">{{ m.lastYearValue != null ? formatNum(m.lastYearValue) : '--' }}</td>
                        <td class="px-2 py-0.5 text-right font-semibold tabular-nums"
                            :class="m.lastYearValue != null && m.lastYearValue !== 0 ? varianceColor(((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100) : ''">
                          {{ m.lastYearValue != null && m.lastYearValue !== 0 ? formatPct(((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100) : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Search Console data -->
            <template v-if="processSectionTools(section.toolCalls, section.id).searchConsole.length">
              <div
                v-for="sc in processSectionTools(section.toolCalls, section.id).searchConsole"
                :key="sc.id"
                class="rounded-lg border border-white/10 overflow-hidden"
              >
                <div class="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/5 flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <span class="text-[10px] font-semibold text-white/70">Search Console</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-white/40">
                        <th class="text-left px-2 py-1 font-medium">{{ sc.type === 'get_page_performance' ? 'Page' : 'Query' }}</th>
                        <th class="text-right px-2 py-1 font-medium">Clicks</th>
                        <th class="text-right px-2 py-1 font-medium">Impr</th>
                        <th class="text-right px-2 py-1 font-medium">CTR</th>
                        <th class="text-right px-2 py-1 font-medium">Pos</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, ri) in sc.data" :key="ri" class="border-t border-white/5">
                        <td class="px-2 py-0.5 text-white/70 truncate max-w-[160px]">{{ row.query || row.page || row.keys?.[0] || '' }}</td>
                        <td class="px-2 py-0.5 text-right text-white/80 font-medium tabular-nums">{{ formatNum(row.clicks) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/40 tabular-nums">{{ formatNum(row.impressions) }}</td>
                        <td class="px-2 py-0.5 text-right text-white/60 tabular-nums">{{ row.ctr != null ? (row.ctr * 100).toFixed(1) + '%' : '' }}</td>
                        <td class="px-2 py-0.5 text-right text-white/60 tabular-nums">{{ row.position != null ? row.position.toFixed(1) : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Knowledge references -->
            <template v-if="processSectionTools(section.toolCalls, section.id).knowledge.length">
              <div class="space-y-1">
                <div
                  v-for="kb in processSectionTools(section.toolCalls, section.id).knowledge"
                  :key="kb.id"
                  class="flex items-center gap-1.5 text-[10px] text-white/40 px-1"
                >
                  <svg class="w-3 h-3 text-brand-purple/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span>{{ kb.title }}</span>
                </div>
              </div>
            </template>

            <!-- Fallback -->
            <div
              v-if="!processSectionTools(section.toolCalls, section.id).metrics.length && !processSectionTools(section.toolCalls, section.id).events.length && !processSectionTools(section.toolCalls, section.id).drilldowns.length && !processSectionTools(section.toolCalls, section.id).eventDetails.length && !processSectionTools(section.toolCalls, section.id).monthlyTrends.length && !processSectionTools(section.toolCalls, section.id).searchConsole.length && !processSectionTools(section.toolCalls, section.id).knowledge.length && !section.isFinalAnalysis"
              class="text-[10px] text-white/30 italic"
            >
              {{ (section.toolCalls || []).map(t => t.name.replace(/_/g, ' ')).join(', ') }}
            </div>
          </div>
        </div>

        <!-- Streaming indicator -->
        <div v-if="isStreaming" class="flex items-center gap-2 px-3 py-2">
          <svg class="w-3.5 h-3.5 text-brand-purple animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-xs text-white/40">Still investigating...</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.report-scroll::-webkit-scrollbar { width: 4px; }
.report-scroll::-webkit-scrollbar-track { background: transparent; }
.report-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
.report-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
</style>

<style>
.report-narrative { word-break: break-word; overflow-wrap: anywhere; }
.report-narrative p { margin: 0.25rem 0; }
.report-narrative p:first-child { margin-top: 0; }
.report-narrative p:last-child { margin-bottom: 0; }
.report-narrative strong { font-weight: 600; color: rgba(255,255,255,0.8); }
.report-narrative em { font-style: italic; }
.report-narrative ul, .report-narrative ol { margin: 0.25rem 0; padding-left: 1.25rem; }
.report-narrative li { margin: 0.125rem 0; }
.report-narrative h1, .report-narrative h2, .report-narrative h3 {
  font-weight: 700; color: rgba(255,255,255,0.85); margin: 0.5rem 0 0.25rem;
}
.report-narrative h1 { font-size: 14px; }
.report-narrative h2 { font-size: 13px; }
.report-narrative h3 { font-size: 12px; }
.report-narrative table { width: 100%; font-size: 10px; border-collapse: collapse; margin: 0.5rem 0; }
.report-narrative table th,
.report-narrative table td { padding: 3px 8px; border: 1px solid rgba(255,255,255,0.08); }
.report-narrative table th { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); font-weight: 600; text-align: left; }
.report-narrative table td { color: rgba(255,255,255,0.5); }
.report-narrative table tr:nth-child(even) { background: rgba(255,255,255,0.02); }
</style>
