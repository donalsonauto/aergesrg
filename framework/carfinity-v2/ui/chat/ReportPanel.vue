<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatValue } from '@/composables/useFormatKpi';

marked.setOptions({ breaks: true, gfm: true });

// Strip problematic Unicode characters that cause rendering issues in chat and PDF
function sanitizeText(text) {
  if (!text) return '';
  return text
    // Remove zero-width and invisible Unicode
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    // Replace common problematic characters
    .replace(/[\u00D8\u00DE\u00A8\u00E4]/g, '') // Ø, Þ, ¨, ä when used decoratively
    .replace(/\u00AE/g, '') // ® symbol
    // Clean up any resulting double spaces
    .replace(/  +/g, ' ')
    .trim();
}

function renderNarrative(text) {
  if (!text) return '';
  let cleaned = sanitizeText(text);
  let html = marked.parse(cleaned);
  // Colorize variances
  html = html.replace(/(📉\s*)([-−][\d,.]+%)/g, '$1<span style="color:#ef4444;font-weight:600">$2</span>');
  html = html.replace(/(📈\s*)(\+?[\d,.]+%)/g, '$1<span style="color:#22c55e;font-weight:600">$2</span>');
  html = html.replace(/(⚠️\s*)([-−+]?[\d,.]+%)/g, '$1<span style="color:#eab308;font-weight:600">$2</span>');
  html = html.replace(/(🚨\s*)([^<\n]{3,60})/g, '$1<span style="color:#ef4444;font-weight:600">$2</span>');
  return html;
}

const props = defineProps({
  reportSections: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  analysisYear: { type: Number, default: null },
  analysisMonth: { type: Number, default: null } // 1-indexed
});

// Compute month labels like "02/26" for current and "01/26" for previous
const currentMonthLabel = computed(() => {
  const m = props.analysisMonth || (new Date().getMonth() + 1);
  const y = props.analysisYear || new Date().getFullYear();
  return String(m).padStart(2, '0') + '/' + String(y).slice(-2);
});

const prevMonthLabel = computed(() => {
  let m = (props.analysisMonth || (new Date().getMonth() + 1)) - 1;
  let y = props.analysisYear || new Date().getFullYear();
  if (m < 1) { m = 12; y -= 1; }
  return String(m).padStart(2, '0') + '/' + String(y).slice(-2);
});

const lastYearLabel = computed(() => {
  const m = props.analysisMonth || (new Date().getMonth() + 1);
  const y = (props.analysisYear || new Date().getFullYear()) - 1;
  return String(m).padStart(2, '0') + '/' + String(y).slice(-2);
});

const emit = defineEmits(['suggestion', 'openKnowledgeDoc', 'close']);

const reportContainer = ref(null);

// ── Editable state ──
// Track deletions and edits locally so export uses the edited version
const deletedSections = ref(new Set());     // section IDs
const deletedMetrics = ref(new Set());      // metric tool IDs
const deletedDrilldowns = ref(new Set());   // drilldown tool IDs
const deletedKnowledge = ref(new Set());    // knowledge doc IDs within sections
const editedNarratives = ref({});           // sectionId → edited text
const editingNarrativeId = ref(null);       // which section narrative is being edited
const editNarrativeText = ref('');          // textarea content
const hoveredDailyBar = ref(null);         // { trendId, index } for daily trend tooltip

function deleteSection(sectionId) {
  deletedSections.value.add(sectionId);
}
function deleteMetric(metricId) {
  deletedMetrics.value.add(metricId);
}
function deleteDrilldown(drilldownId) {
  deletedDrilldowns.value.add(drilldownId);
}
function deleteKnowledgeItem(sectionId, docId) {
  deletedKnowledge.value.add(`${sectionId}:${docId}`);
}
function startEditNarrative(sectionId, currentText) {
  editingNarrativeId.value = sectionId;
  editNarrativeText.value = editedNarratives.value[sectionId] ?? currentText;
  nextTick(() => {
    const ta = document.querySelector('.narrative-editor');
    if (ta) ta.focus();
  });
}
function saveNarrative(sectionId) {
  editedNarratives.value[sectionId] = editNarrativeText.value;
  editingNarrativeId.value = null;
}
function cancelEditNarrative() {
  editingNarrativeId.value = null;
}
function getNarrative(section) {
  return editedNarratives.value[section.id] ?? section.narrative;
}

// Visible sections (not deleted)
const visibleSections = computed(() =>
  props.reportSections.filter(s => !deletedSections.value.has(s.id))
);

const hasContent = computed(() => visibleSections.value.length > 0 || props.reportSections.length > 0);

// Build dealership ID -> name map from get_dealerships tool results
const dealershipMap = computed(() => {
  const map = {};
  for (const section of props.reportSections) {
    for (const tc of (section.toolCalls || [])) {
      if (tc.name === 'get_dealerships' && tc.result) {
        const dealerships = tc.result.dealerships || [];
        for (const d of dealerships) {
          map[String(d.id)] = d.name;
        }
      }
    }
  }
  return map;
});

// Process each section's tool calls into displayable data (respects deletions)
function processSectionTools(toolCalls, sectionId) {
  const metrics = [];
  const drilldowns = [];
  const knowledge = [];
  const monthlyTrends = [];
  const marketData = [];
  const dailyTrends = [];

  for (const tc of toolCalls) {
    if (!tc.result || tc.result.error) continue;

    switch (tc.name) {
      case 'get_kpi_data': {
        if (deletedMetrics.value.has(tc.id)) break;
        const r = tc.result;
        if (r.current !== undefined) {
          metrics.push({
            id: tc.id,
            key: tc.args?.metricKey || '',
            name: r.fullName || r.name || formatMetricKey(tc.args?.metricKey || ''),
            current: r.current,
            previous: r.previous,
            lastYear: r.lastYear,
            color: r.color || 'gray',
            dataType: r.dataType || 'number',
            dealerShipId: tc.args?.dealerShipId
          });
        }
        break;
      }
      case 'get_drilldown_data': {
        if (deletedDrilldowns.value.has(tc.id)) break;
        const r = tc.result;
        if (r.data && r.data.length) {
          const mKey = tc.args?.metricKey || '';
          drilldowns.push({
            id: tc.id,
            metricKey: mKey,
            metricName: r.name || r.fullName || formatMetricKey(mKey),
            dimension: r.drillDownName || r.drillDown || tc.args?.drillDownType || '',
            dataType: r.dataType || 'number',
            data: r.data
          });
        }
        break;
      }
      case 'search_knowledge': {
        const r = tc.result;
        if (r.documents && r.documents.length) {
          for (const doc of r.documents) {
            if (deletedKnowledge.value.has(`${sectionId}:${doc.id}`)) continue;
            knowledge.push({
              id: doc.id,
              title: doc.title,
              type: doc.type,
              kpiName: doc.kpiName
            });
          }
        }
        break;
      }
      case 'get_monthly_trend': {
        if (deletedMetrics.value.has(tc.id)) break;
        const r = tc.result;
        if (r.months && r.months.length) {
          monthlyTrends.push({
            id: tc.id,
            metric: r.metric || tc.args?.metricKey || '',
            kpiName: r.kpiName || formatMetricKey(r.metric || tc.args?.metricKey || ''),
            dataType: r.dataType || 'number',
            dealerShipId: r.dealerShipId || tc.args?.dealerShipId || '0',
            months: r.months
          });
        }
        break;
      }
      case 'get_market_data': {
        if (deletedMetrics.value.has(tc.id)) break;
        const r = tc.result;
        if (r.data && r.data.length) {
          marketData.push({
            id: tc.id,
            market: r.market || 'Market',
            scope: r.scope || tc.args?.scope || 'local',
            period: r.period || tc.args?.period || '',
            data: r.data.slice(0, 8),
            summary: r.summary || {}
          });
        }
        break;
      }
      case 'get_daily_trend': {
        if (deletedMetrics.value.has(tc.id)) break;
        const r = tc.result;
        if (r.dailyValues && r.dailyValues.length > 1) {
          dailyTrends.push({
            id: tc.id,
            metric: r.metric || tc.args?.metricKey || '',
            kpiName: r.kpiName || formatMetricKey(r.metric || tc.args?.metricKey || ''),
            dataType: r.dataType || 'number',
            values: r.dailyValues
          });
        }
        break;
      }
    }
  }

  return { metrics, drilldowns, knowledge, monthlyTrends, marketData, dailyTrends };
}

// Generate a section title based on what tools were called
function getSectionTitle(section, index) {
  // Final analysis section (no tools)
  if (section.isFinalAnalysis) {
    return 'Summary & Recommendations';
  }

  const tools = section.toolCalls || [];
  if (!tools.length) return `Step ${index + 1}`;

  const names = [...new Set(tools.map(t => t.name))];

  if (names.includes('get_market_data') || names.includes('get_market_trend')) {
    return `Step ${index + 1}: Market Benchmarking`;
  }
  if (names.includes('get_monthly_trend')) {
    const hasOther = names.some(n => n !== 'get_monthly_trend' && n !== 'think');
    if (!hasOther) return `Step ${index + 1}: Historical Trends`;
  }
  if (names.includes('get_kpi_data') && !names.includes('get_drilldown_data')) {
    return `Step ${index + 1}: Scanning KPIs`;
  }
  if (names.includes('get_drilldown_data')) {
    const dims = [...new Set(tools.filter(t => t.name === 'get_drilldown_data').map(t => t.args?.drillDownType).filter(Boolean))];
    if (dims.length) {
      return `Step ${index + 1}: Drilling by ${dims.join(', ')}`;
    }
    return `Step ${index + 1}: Drill-Down Analysis`;
  }
  if (names.includes('search_knowledge')) {
    return `Step ${index + 1}: Expert Knowledge`;
  }
  if (names.includes('get_dealerships')) {
    return `Step ${index + 1}: Dealership Info`;
  }
  if (names.includes('get_kpis_list')) {
    return `Step ${index + 1}: Discovering Metrics`;
  }
  if (names.includes('get_daily_trend')) {
    return `Step ${index + 1}: Daily Trends`;
  }
  return `Step ${index + 1}: Investigation`;
}

// NOTE: Local formatValue had hours/minutes handling for 'time' type (e.g. 2h 30m).
// The shared useFormatKpi.formatValue uses days format (e.g. 45d) instead.

function formatMetricKey(key) {
  if (!key) return '';
  const part = key.includes('.') ? key.split('.').pop() : key;
  return part
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function getVariance(metric) {
  const curr = typeof metric.current === 'object' ? metric.current?.value : metric.current;
  const prev = typeof metric.previous === 'object' ? metric.previous?.value : metric.previous;
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function varianceClass(metric) {
  const color = metric.color;
  if (color === 'red') return 'text-red-500';
  if (color === 'green') return 'text-green-500';
  if (color === 'yellow') return 'text-yellow-500';
  const v = getVariance(metric);
  if (v !== null) {
    if (v < -3) return 'text-red-500';
    if (v > 3) return 'text-green-500';
    return 'text-yellow-500';
  }
  return 'text-surface-300';
}

function formatVariance(val) {
  if (val === null || val === undefined) return '';
  const sign = val >= 0 ? '+' : '';
  return sign + val.toFixed(1) + '%';
}

function toNum(v) {
  if (v == null) return NaN;
  if (typeof v === 'object') return Number(v.value ?? v);
  return Number(v);
}

function pctChange(current, previous) {
  const c = toNum(current);
  const p = toNum(previous);
  if (isNaN(c) || isNaN(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

function rowPct(row) {
  if (row.variancePct != null) return row.variancePct;
  return pctChange(row.current, row.previous);
}

function drilldownVarianceColor(pct) {
  if (pct == null) return '';
  if (pct < -5) return 'color: #ef4444';
  if (pct > 5) return 'color: #22c55e';
  return 'color: #eab308';
}

// Auto-scroll
watch(() => props.reportSections, () => {
  nextTick(() => {
    if (reportContainer.value) {
      reportContainer.value.scrollTop = reportContainer.value.scrollHeight;
    }
  });
}, { deep: true });

function handleExport() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  const COLORS = {
    primary: [99, 102, 241],    // indigo-500
    dark: [15, 23, 42],         // slate-900
    mid: [100, 116, 139],       // slate-500
    light: [203, 213, 225],     // slate-300
    bg: [248, 250, 252],        // slate-50
    green: [34, 197, 94],
    red: [239, 68, 68],
    yellow: [234, 179, 8],
    white: [255, 255, 255],
  };

  function checkPageBreak(needed) {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  }

  // ── HEADER BAR ─────────────────
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageW, 28, 'F');

  // Accent line
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 28, pageW, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text('Dealership Analytics Report', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 220);
  const now = new Date();
  doc.text(`Generated ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, margin, 21);

  y = 36;

  // ── ANALYSIS PERIOD BOX ─────────────────
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const am = props.analysisMonth || (now.getMonth() + 1);
  const ay = props.analysisYear || now.getFullYear();
  const periodText = `Analysis Period: ${monthNames[am - 1]} ${ay}`;
  const compText = `Comparing to ${prevMonthLabel.value} (prev month) and ${lastYearLabel.value} (last year)`;

  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'F');
  doc.setDrawColor(...COLORS.light);
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text(periodText, margin + 5, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mid);
  doc.text(compText, margin + 5, y + 12.5);

  y += 22;

  // ── SECTIONS (uses edited/filtered view) ─────────────────
  const exportSections = visibleSections.value;
  for (let i = 0; i < exportSections.length; i++) {
    const section = exportSections[i];
    const data = processSectionTools(section.toolCalls || [], section.id);
    const title = getSectionTitle(section, i);
    const hasMetrics = data.metrics.length > 0;
    const hasDrilldowns = data.drilldowns.length > 0;
    const hasKnowledge = data.knowledge.length > 0;

    // Estimate needed space for section header
    checkPageBreak(20);

    // Section header bar
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(title, margin + 4, y + 5.5);

    // Calls count on right
    const callsText = `${section.toolCalls?.length || 0} calls`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const callsW = doc.getTextWidth(callsText);
    doc.text(callsText, margin + contentW - callsW - 4, y + 5.5);

    y += 11;

    // Narrative (use edited version if available)
    const narrative = getNarrative(section);
    if (narrative) {
      checkPageBreak(10);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mid);
      // Sanitize narrative for PDF: strip emoji and problematic Unicode, replace with text equivalents
      let pdfNarrative = narrative
        .replace(/📉/g, '[-]').replace(/📈/g, '[+]').replace(/⚠️/g, '[!]').replace(/🚨/g, '[!!]')
        .replace(/📊/g, '').replace(/🔍/g, '').replace(/💡/g, '').replace(/✅/g, '').replace(/❌/g, '')
        .replace(/[\u00D8\u00DE\u00A8\u00E4\u00AE]/g, '')
        .replace(/[^\x00-\x7F]/g, (ch) => {
          // Keep basic accented characters, strip everything else
          const code = ch.charCodeAt(0);
          return (code >= 0xC0 && code <= 0xFF) ? ch : '';
        })
        .replace(/  +/g, ' ').trim();
      const lines = doc.splitTextToSize(pdfNarrative, contentW - 8);
      doc.text(lines, margin + 4, y + 3);
      y += lines.length * 3.5 + 4;
    }

    // ── METRICS GRID ─────────
    if (hasMetrics) {
      const colW = (contentW - 4) / 2;
      for (let mi = 0; mi < data.metrics.length; mi += 2) {
        checkPageBreak(20);
        for (let col = 0; col < 2; col++) {
          const m = data.metrics[mi + col];
          if (!m) continue;

          const cx = margin + col * (colW + 4);
          const cw = colW;

          // Card bg
          doc.setFillColor(...COLORS.bg);
          doc.setDrawColor(...COLORS.light);
          doc.roundedRect(cx, y, cw, 16, 1.5, 1.5, 'FD');

          // Metric name
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.mid);
          let nameText = (m.name || formatMetricKey(m.key));
          if (m.dealerShipId && m.dealerShipId !== '0') {
            const storeName = dealershipMap.value?.[m.dealerShipId];
            if (storeName) nameText += ` (${storeName})`;
          }
          nameText = nameText.substring(0, 40);
          doc.text(nameText, cx + 3, y + 4.5);

          // Current value
          const currVal = typeof m.current === 'object' ? m.current?.value : m.current;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(...COLORS.dark);
          doc.text(formatValue(currVal, m.dataType), cx + 3, y + 10.5);

          // Variance
          const v = getVariance(m);
          if (v !== null) {
            const vText = formatVariance(v);
            const vColor = v < -3 ? COLORS.red : (v > 3 ? COLORS.green : COLORS.yellow);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...vColor);
            doc.text(vText, cx + 3 + doc.getTextWidth(formatValue(currVal, m.dataType)) + 3, y + 10.5);
          }

          // Previous / LY
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...COLORS.mid);
          const prevVal = typeof m.previous === 'object' ? m.previous?.value : m.previous;
          const lyVal = m.lastYear ? (typeof m.lastYear === 'object' ? m.lastYear?.value : m.lastYear) : null;
          let subText = `${prevMonthLabel.value}: ${formatValue(prevVal, m.dataType)}`;
          if (lyVal != null) subText += `   ${lastYearLabel.value}: ${formatValue(lyVal, m.dataType)}`;
          doc.text(subText, cx + 3, y + 14.5);
        }
        y += 19;
      }
    }

    // ── DRILLDOWN TABLES ─────────
    for (const dd of data.drilldowns) {
      checkPageBreak(25);

      // Table title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.dark);
      const ddTitle = `${dd.metricName || formatMetricKey(dd.metricKey)} by ${dd.dimension}`;
      doc.text(ddTitle, margin + 2, y + 4);
      y += 6;

      const tableRows = dd.data.slice(0, 10).map(row => {
        const pct = rowPct(row);
        const vText = pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '';
        // Sanitize label: strip emoji, special chars, registered trademark
        const cleanLabel = (row.label || '')
          .replace(/[^\x20-\x7E]/g, (ch) => {
            const code = ch.charCodeAt(0);
            return (code >= 0xC0 && code <= 0xFF) ? ch : '';
          })
          .trim()
          .substring(0, 30);
        return [
          cleanLabel,
          formatValue(row.current, dd.dataType),
          formatValue(row.previous, dd.dataType),
          vText
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Name', currentMonthLabel.value, prevMonthLabel.value, 'Change']],
        body: tableRows,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          lineWidth: 0.2,
          lineColor: [226, 232, 240],
          textColor: COLORS.dark,
          font: 'helvetica'
        },
        headStyles: {
          fillColor: COLORS.dark,
          textColor: COLORS.white,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right', textColor: COLORS.mid },
          3: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (hookData) => {
          // Color variance column
          if (hookData.column.index === 3 && hookData.section === 'body') {
            const text = hookData.cell.text[0] || '';
            if (text.startsWith('-')) hookData.cell.styles.textColor = COLORS.red;
            else if (text.startsWith('+')) hookData.cell.styles.textColor = COLORS.green;
            else hookData.cell.styles.textColor = COLORS.yellow;
          }
        }
      });

      y = (doc.lastAutoTable?.finalY || y) + 4;
    }

    // ── MONTHLY TRENDS ─────────
    for (const trend of data.monthlyTrends) {
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.dark);
      let trendTitle = trend.kpiName + ' — 6-Month Trend';
      if (trend.dealerShipId && trend.dealerShipId !== '0') {
        const storeName = dealershipMap.value?.[trend.dealerShipId];
        if (storeName) trendTitle += ` (${storeName})`;
      }
      doc.text(trendTitle, margin + 2, y + 4);
      y += 6;

      const trendRows = trend.months.map(m => {
        const yoy = m.lastYearValue != null && m.lastYearValue !== 0
          ? (((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100)
          : null;
        return [
          String(m.month).padStart(2, '0') + '/' + String(m.year).slice(-2),
          formatValue(m.value, trend.dataType),
          m.lastYearValue != null ? formatValue(m.lastYearValue, trend.dataType) : '—',
          yoy != null ? `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%` : ''
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Month', 'Value', 'Last Year', 'YoY']],
        body: trendRows,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, lineWidth: 0.2, lineColor: [226, 232, 240], textColor: COLORS.dark, font: 'helvetica' },
        headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right', textColor: COLORS.mid }, 3: { halign: 'right', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (hookData) => {
          if (hookData.column.index === 3 && hookData.section === 'body') {
            const text = hookData.cell.text[0] || '';
            if (text.startsWith('-')) hookData.cell.styles.textColor = COLORS.red;
            else if (text.startsWith('+')) hookData.cell.styles.textColor = COLORS.green;
          }
        }
      });
      y = (doc.lastAutoTable?.finalY || y) + 4;
    }

    // ── MARKET DATA ─────────
    for (const md of data.marketData) {
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.dark);
      doc.text(`${md.market}${md.scope === 'national' ? ' (National)' : ' (Local)'} Market Data`, margin + 2, y + 4);
      y += 6;

      const mdRows = md.data.map(row => {
        const label = row.make + (row.model ? ' ' + row.model : '');
        return [
          label,
          (row.market_sales || 0).toLocaleString(),
          (row.market_py_sales || 0).toLocaleString(),
          row.yoy_pchg != null ? `${row.yoy_pchg >= 0 ? '+' : ''}${row.yoy_pchg.toFixed(1)}%` : ''
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Make', 'Sales', 'PY Sales', 'YoY']],
        body: mdRows,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, lineWidth: 0.2, lineColor: [226, 232, 240], textColor: COLORS.dark, font: 'helvetica' },
        headStyles: { fillColor: [59, 130, 246], textColor: COLORS.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right', textColor: COLORS.mid }, 3: { halign: 'right', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (hookData) => {
          if (hookData.column.index === 3 && hookData.section === 'body') {
            const text = hookData.cell.text[0] || '';
            if (text.startsWith('-')) hookData.cell.styles.textColor = COLORS.red;
            else if (text.startsWith('+')) hookData.cell.styles.textColor = COLORS.green;
          }
        }
      });
      y = (doc.lastAutoTable?.finalY || y) + 4;
    }

    // ── KNOWLEDGE REFERENCES ─────────
    if (hasKnowledge) {
      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.primary);
      doc.text('Expert References', margin + 2, y + 3);
      y += 5;

      for (const kb of data.knowledge) {
        checkPageBreak(5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.mid);
        doc.text(`  •  ${kb.title}`, margin + 2, y + 3);
        y += 4;
      }
      y += 2;
    }

    y += 4; // gap between sections
  }

  // ── FOOTER on every page ─────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLORS.light);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.mid);
    doc.text('AI Analytics Report', margin, pageH - 7);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin - doc.getTextWidth(`Page ${p} of ${totalPages}`), pageH - 7);
  }

  doc.save(`analytics-report-${now.toISOString().split('T')[0]}.pdf`);
}
</script>

<template>
  <div class="flex flex-col h-full border-l border-surface-200 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-900">
    <!-- Header -->
    <div class="shrink-0 px-4 py-3 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <i class="pi pi-file-edit text-sm text-primary-500"></i>
        <span class="text-sm font-semibold text-surface-700 dark:text-surface-200">Investigation Report</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="hasContent"
          @click="handleExport"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <i class="pi pi-file-pdf text-xs"></i>
          Export PDF
        </button>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-700 dark:hover:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <i class="pi pi-times text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div ref="reportContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-4 report-scroll">
      <!-- Empty state -->
      <div v-if="!hasContent && !isStreaming" class="flex flex-col items-center justify-center h-full text-center">
        <i class="pi pi-chart-bar text-4xl text-surface-300 dark:text-surface-600 mb-3"></i>
        <p class="text-sm text-surface-400 dark:text-surface-500">
          Investigation steps and data will appear here as the AI works.
        </p>
      </div>

      <!-- Loading state -->
      <div v-if="!hasContent && isStreaming" class="flex flex-col items-center justify-center h-full text-center">
        <svg class="animate-spin h-8 w-8 text-primary-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-sm text-surface-400 dark:text-surface-500">Investigating...</p>
      </div>

      <!-- Investigation sections -->
      <template v-if="hasContent">
        <div
          v-for="(section, si) in visibleSections"
          :key="section.id"
          class="group/section rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-800/80 overflow-hidden relative"
        >
          <!-- Section header -->
          <div class="px-3 py-2 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700/40 flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
              <span class="text-[10px] font-bold text-primary-400">{{ si + 1 }}</span>
            </div>
            <span class="text-xs font-semibold text-surface-700 dark:text-surface-200 flex-1">
              {{ getSectionTitle(section, si) }}
            </span>
            <span class="text-[10px] text-surface-400 dark:text-surface-500">
              {{ section.toolCalls?.length || 0 }} calls
            </span>
            <!-- Delete section button -->
            <button
              @click="deleteSection(section.id)"
              class="opacity-0 group-hover/section:opacity-100 w-5 h-5 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
              title="Remove this section"
            >
              <i class="pi pi-times text-[9px]"></i>
            </button>
          </div>

          <!-- Section narrative (editable on click) -->
          <div v-if="getNarrative(section)" class="group/narrative relative border-b border-surface-100 dark:border-surface-700/30">
            <!-- Edit mode -->
            <div v-if="editingNarrativeId === section.id" class="px-3 py-2">
              <textarea
                v-model="editNarrativeText"
                class="narrative-editor w-full bg-surface-50 dark:bg-surface-900 border border-primary-300 dark:border-primary-600 rounded-md px-2 py-1.5 text-[12px] text-surface-700 dark:text-surface-200 resize-y focus:outline-none focus:ring-1 focus:ring-primary-500"
                rows="4"
                @keydown.escape="cancelEditNarrative"
              ></textarea>
              <div class="flex gap-1.5 mt-1.5">
                <button @click="saveNarrative(section.id)" class="px-2 py-1 rounded text-[10px] font-medium bg-primary-500 text-white hover:bg-primary-600 cursor-pointer">Save</button>
                <button @click="cancelEditNarrative" class="px-2 py-1 rounded text-[10px] font-medium text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer">Cancel</button>
              </div>
            </div>
            <!-- View mode -->
            <div
              v-else
              class="report-narrative px-3 py-2 text-[12px] text-surface-600 dark:text-surface-300 overflow-hidden break-words cursor-text hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors"
              v-html="renderNarrative(getNarrative(section))"
              @click="startEditNarrative(section.id, getNarrative(section))"
            ></div>
            <i
              v-if="editingNarrativeId !== section.id"
              class="pi pi-pencil absolute top-2 right-2 text-[9px] text-surface-300 dark:text-surface-600 opacity-0 group-hover/narrative:opacity-100 transition-opacity pointer-events-none"
            ></i>
          </div>

          <!-- Section data -->
          <div class="p-3 space-y-3">
            <!-- Metrics from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).metrics.length">
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="m in processSectionTools(section.toolCalls, section.id).metrics"
                  :key="m.id"
                  class="group/metric relative rounded-lg border border-surface-100 dark:border-surface-700/40 bg-surface-50/50 dark:bg-surface-900/50 p-2"
                >
                  <button
                    @click="deleteMetric(m.id)"
                    class="absolute top-1 right-1 opacity-0 group-hover/metric:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                    title="Remove"
                  >
                    <i class="pi pi-times text-[8px]"></i>
                  </button>
                  <div class="text-[10px] text-surface-400 dark:text-surface-400 truncate mb-0.5 pr-4" :title="m.name || m.key">
                    {{ m.name || formatMetricKey(m.key) }}
                    <span v-if="m.dealerShipId && m.dealerShipId !== '0'" class="text-primary-400">({{ dealershipMap[m.dealerShipId] || 'Store' }})</span>
                  </div>
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-sm font-bold text-surface-800 dark:text-surface-100">
                      {{ formatValue(typeof m.current === 'object' ? m.current?.value : m.current, m.dataType) }}
                    </span>
                    <span
                      v-if="getVariance(m) !== null"
                      class="text-[11px] font-semibold"
                      :class="varianceClass(m)"
                    >
                      {{ formatVariance(getVariance(m)) }}
                    </span>
                  </div>
                  <div class="flex gap-3 mt-0.5 text-[10px] text-surface-500 dark:text-surface-400">
                    <span>{{ prevMonthLabel }}: {{ formatValue(typeof m.previous === 'object' ? m.previous?.value : m.previous, m.dataType) }}</span>
                    <span v-if="m.lastYear">{{ lastYearLabel }}: {{ formatValue(typeof m.lastYear === 'object' ? m.lastYear?.value : m.lastYear, m.dataType) }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Drilldowns from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).drilldowns.length">
              <div
                v-for="dd in processSectionTools(section.toolCalls, section.id).drilldowns"
                :key="dd.id"
                class="group/dd relative rounded-lg border border-surface-100 dark:border-surface-700/40 overflow-hidden"
              >
                <button
                  @click="deleteDrilldown(dd.id)"
                  class="absolute top-1 right-1 z-10 opacity-0 group-hover/dd:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                  title="Remove"
                >
                  <i class="pi pi-times text-[8px]"></i>
                </button>
                <div class="px-2.5 py-1.5 bg-surface-50/50 dark:bg-surface-900/50 border-b border-surface-100 dark:border-surface-700/30">
                  <span class="text-[10px] font-semibold text-surface-700 dark:text-surface-200">
                    {{ dd.metricName || formatMetricKey(dd.metricKey) }}
                    <span class="font-normal text-surface-400 dark:text-surface-400">by {{ dd.dimension }}</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-surface-500 dark:text-surface-400">
                        <th class="text-left px-2 py-1 font-medium">Name</th>
                        <th class="text-right px-2 py-1 font-medium whitespace-nowrap">{{ currentMonthLabel }}</th>
                        <th class="text-right px-2 py-1 font-medium whitespace-nowrap">{{ prevMonthLabel }}</th>
                        <th class="text-right px-2 py-1 font-medium">Chg</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in dd.data.slice(0, 8)"
                        :key="ri"
                        class="border-t border-surface-100 dark:border-surface-700/20"
                        :class="[
                          rowPct(row) != null && Math.abs(rowPct(row)) > 20
                            ? (rowPct(row) < 0 ? 'bg-red-500/5 dark:bg-red-500/8' : 'bg-green-500/5 dark:bg-green-500/8')
                            : ''
                        ]"
                      >
                        <td class="px-2 py-0.5 text-surface-700 dark:text-surface-200 truncate max-w-[120px]" :title="row.label">{{ sanitizeText(row.label) }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-700 dark:text-surface-200 font-medium tabular-nums whitespace-nowrap">{{ formatValue(row.current, dd.dataType) }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-400 dark:text-surface-400 tabular-nums whitespace-nowrap">{{ formatValue(row.previous, dd.dataType) }}</td>
                        <td class="px-2 py-0.5 text-right font-semibold tabular-nums whitespace-nowrap" :style="drilldownVarianceColor(rowPct(row))">
                          {{ rowPct(row) != null ? (rowPct(row) >= 0 ? '+' : '') + rowPct(row).toFixed(1) + '%' : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Monthly Trends from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).monthlyTrends.length">
              <div
                v-for="trend in processSectionTools(section.toolCalls, section.id).monthlyTrends"
                :key="trend.id"
                class="group/trend relative rounded-lg border border-surface-100 dark:border-surface-700/40 overflow-hidden"
              >
                <button
                  @click="deleteMetric(trend.id)"
                  class="absolute top-1 right-1 z-10 opacity-0 group-hover/trend:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                  title="Remove"
                >
                  <i class="pi pi-times text-[8px]"></i>
                </button>
                <div class="px-2.5 py-1.5 bg-surface-50/50 dark:bg-surface-900/50 border-b border-surface-100 dark:border-surface-700/30 flex items-center gap-1.5">
                  <i class="pi pi-chart-line text-[10px] text-primary-400"></i>
                  <span class="text-[10px] font-semibold text-surface-700 dark:text-surface-200">
                    {{ trend.kpiName }}
                    <span v-if="trend.dealerShipId && trend.dealerShipId !== '0'" class="font-normal text-surface-400">({{ dealershipMap[trend.dealerShipId] || 'Store' }})</span>
                    <span class="font-normal text-surface-400"> — 6-Month Trend</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-surface-500 dark:text-surface-400">
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
                        class="border-t border-surface-100 dark:border-surface-700/20"
                      >
                        <td class="px-2 py-0.5 text-surface-700 dark:text-surface-300">{{ String(m.month).padStart(2,'0') }}/{{ String(m.year).slice(-2) }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-700 dark:text-surface-200 font-medium tabular-nums">{{ formatValue(m.value, trend.dataType) }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-400 tabular-nums">{{ m.lastYearValue != null ? formatValue(m.lastYearValue, trend.dataType) : '—' }}</td>
                        <td class="px-2 py-0.5 text-right tabular-nums font-semibold" :style="m.lastYearValue != null && m.value != null && m.lastYearValue !== 0 ? drilldownVarianceColor(((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100) : ''">
                          {{ m.lastYearValue != null && m.value != null && m.lastYearValue !== 0 ? ((((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100) >= 0 ? '+' : '') + (((m.value - m.lastYearValue) / Math.abs(m.lastYearValue)) * 100).toFixed(1) + '%' : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Market Data from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).marketData.length">
              <div
                v-for="md in processSectionTools(section.toolCalls, section.id).marketData"
                :key="md.id"
                class="group/md relative rounded-lg border border-surface-100 dark:border-surface-700/40 overflow-hidden"
              >
                <button
                  @click="deleteMetric(md.id)"
                  class="absolute top-1 right-1 z-10 opacity-0 group-hover/md:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                  title="Remove"
                >
                  <i class="pi pi-times text-[8px]"></i>
                </button>
                <div class="px-2.5 py-1.5 bg-surface-50/50 dark:bg-surface-900/50 border-b border-surface-100 dark:border-surface-700/30 flex items-center gap-1.5">
                  <i class="pi pi-globe text-[10px] text-blue-400"></i>
                  <span class="text-[10px] font-semibold text-surface-700 dark:text-surface-200">
                    {{ md.market }}
                    <span class="font-normal text-surface-400">{{ md.scope === 'national' ? ' (National)' : ' (Local)' }}</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-[10px]">
                    <thead>
                      <tr class="text-surface-500 dark:text-surface-400">
                        <th class="text-left px-2 py-1 font-medium">Make</th>
                        <th class="text-right px-2 py-1 font-medium">Sales</th>
                        <th class="text-right px-2 py-1 font-medium">PY Sales</th>
                        <th class="text-right px-2 py-1 font-medium">YoY</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in md.data"
                        :key="ri"
                        class="border-t border-surface-100 dark:border-surface-700/20"
                      >
                        <td class="px-2 py-0.5 text-surface-700 dark:text-surface-300">{{ row.make }}{{ row.model ? ' ' + row.model : '' }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-700 dark:text-surface-200 font-medium tabular-nums">{{ (row.market_sales || 0).toLocaleString() }}</td>
                        <td class="px-2 py-0.5 text-right text-surface-400 tabular-nums">{{ (row.market_py_sales || 0).toLocaleString() }}</td>
                        <td class="px-2 py-0.5 text-right tabular-nums font-semibold" :style="row.yoy_pchg != null ? drilldownVarianceColor(row.yoy_pchg) : ''">
                          {{ row.yoy_pchg != null ? (row.yoy_pchg >= 0 ? '+' : '') + row.yoy_pchg.toFixed(1) + '%' : '' }}
                        </td>
                      </tr>
                    </tbody>
                    <!-- Summary row -->
                    <tfoot v-if="md.summary.total_market_sales">
                      <tr class="border-t-2 border-surface-200 dark:border-surface-600 font-semibold">
                        <td class="px-2 py-1 text-surface-700 dark:text-surface-200">Total Market</td>
                        <td class="px-2 py-1 text-right text-surface-700 dark:text-surface-200 tabular-nums">{{ (md.summary.total_market_sales || 0).toLocaleString() }}</td>
                        <td class="px-2 py-1 text-right text-surface-400 tabular-nums"></td>
                        <td class="px-2 py-1 text-right tabular-nums" :style="md.summary.total_yoy_pchg != null ? drilldownVarianceColor(md.summary.total_yoy_pchg) : ''">
                          {{ md.summary.total_yoy_pchg != null ? (md.summary.total_yoy_pchg >= 0 ? '+' : '') + md.summary.total_yoy_pchg.toFixed(1) + '%' : '' }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </template>

            <!-- Daily Trends from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).dailyTrends.length">
              <div
                v-for="dt in processSectionTools(section.toolCalls, section.id).dailyTrends"
                :key="dt.id"
                class="group/dt relative rounded-lg border border-surface-100 dark:border-surface-700/40 p-2"
              >
                <button
                  @click="deleteMetric(dt.id)"
                  class="absolute top-1 right-1 z-10 opacity-0 group-hover/dt:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                  title="Remove"
                >
                  <i class="pi pi-times text-[8px]"></i>
                </button>
                <div class="flex items-center gap-1.5 mb-1">
                  <i class="pi pi-chart-bar text-[10px] text-amber-400"></i>
                  <span class="text-[10px] font-semibold text-surface-700 dark:text-surface-200">{{ dt.kpiName }} — Daily Trend</span>
                </div>
                <div class="relative flex flex-wrap gap-0.5" @mouseleave="hoveredDailyBar = null">
                  <!-- Tooltip -->
                  <div
                    v-if="hoveredDailyBar && hoveredDailyBar.trendId === dt.id"
                    class="absolute bottom-full mb-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 whitespace-nowrap pointer-events-none z-20 shadow-lg"
                    :style="{ left: (hoveredDailyBar.index * 14.5) + 'px', transform: 'translateX(-50%)' }"
                  >
                    <div class="text-[10px] opacity-70">{{ dt.values.slice(-14)[hoveredDailyBar.index]?.date }}</div>
                    <div>{{ formatValue(dt.values.slice(-14)[hoveredDailyBar.index]?.value, dt.dataType) }}</div>
                  </div>
                  <div
                    v-for="(dv, di) in dt.values.slice(-14)"
                    :key="di"
                    class="flex flex-col items-center"
                  >
                    <div
                      class="w-3 rounded-sm transition-all duration-75 cursor-pointer"
                      :style="{
                        height: Math.max(2, (dv.value / Math.max(...dt.values.map(v => v.value || 1))) * 24) + 'px',
                        backgroundColor: dv.value === 0 ? '#ef4444' : (hoveredDailyBar && hoveredDailyBar.trendId === dt.id && hoveredDailyBar.index === di ? '#4f46e5' : '#6366f1'),
                        opacity: hoveredDailyBar && hoveredDailyBar.trendId === dt.id && hoveredDailyBar.index !== di ? 0.4 : 1,
                      }"
                      @mouseenter="hoveredDailyBar = { trendId: dt.id, index: di }"
                    ></div>
                    <span class="text-[7px] text-surface-400 mt-0.5">{{ dv.date?.slice(-2) }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Knowledge from this section -->
            <template v-if="processSectionTools(section.toolCalls, section.id).knowledge.length">
              <div class="space-y-1">
                <div
                  v-for="(kb, ki) in processSectionTools(section.toolCalls, section.id).knowledge"
                  :key="ki"
                  class="group/kb flex items-start gap-2 text-[10px] text-surface-400 dark:text-surface-400 rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
                  :class="kb.id ? 'hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-300 cursor-pointer' : ''"
                >
                  <i class="pi pi-book text-[10px] mt-0.5 text-primary-400"></i>
                  <span class="flex-1 hover:underline" @click="kb.id && emit('openKnowledgeDoc', kb.id)">{{ kb.title }}</span>
                  <button
                    @click.stop="deleteKnowledgeItem(section.id, kb.id)"
                    class="opacity-0 group-hover/kb:opacity-100 w-4 h-4 rounded flex items-center justify-center text-surface-400 hover:text-red-500 transition-all cursor-pointer shrink-0"
                    title="Remove"
                  >
                    <i class="pi pi-times text-[8px]"></i>
                  </button>
                </div>
              </div>
            </template>

            <!-- If section had no displayable data (and not a final analysis section) -->
            <div
              v-if="!section.isFinalAnalysis && !processSectionTools(section.toolCalls, section.id).metrics.length && !processSectionTools(section.toolCalls, section.id).drilldowns.length && !processSectionTools(section.toolCalls, section.id).knowledge.length && !processSectionTools(section.toolCalls, section.id).monthlyTrends.length && !processSectionTools(section.toolCalls, section.id).marketData.length && !processSectionTools(section.toolCalls, section.id).dailyTrends.length"
              class="text-[11px] text-surface-400 dark:text-surface-500 italic"
            >
              {{ section.toolCalls.map(t => t.name.replace(/_/g, ' ')).join(', ') }}
            </div>
          </div>
        </div>

        <!-- Streaming indicator at the bottom -->
        <div v-if="isStreaming" class="flex items-center gap-2 px-3 py-2">
          <svg class="animate-spin h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-xs text-surface-400 dark:text-surface-500">Still investigating...</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.report-scroll::-webkit-scrollbar {
  width: 4px;
}
.report-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.report-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.report-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

<style>
/* Narrative markdown styling in report panel */
.report-narrative {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.report-narrative p {
  margin: 0.25rem 0;
}
.report-narrative p:first-child {
  margin-top: 0;
}
.report-narrative p:last-child {
  margin-bottom: 0;
}
.report-narrative strong {
  font-weight: 600;
}
.report-narrative em {
  font-style: italic;
}
.report-narrative ul, .report-narrative ol {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
}
.report-narrative li {
  margin: 0.125rem 0;
}
.report-narrative table {
  width: 100%;
  font-size: 10px;
  border-collapse: collapse;
}
.report-narrative table th,
.report-narrative table td {
  padding: 2px 6px;
  text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}
.report-narrative table th {
  font-weight: 600;
  opacity: 0.6;
}
.report-narrative code {
  font-size: 0.85em;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
}
</style>
