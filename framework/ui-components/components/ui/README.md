# Carfinity v2 UI kit

Dark, dense, calm dealer-dashboard components ported from the v2 Vue app to React +
TypeScript + Tailwind, matched to the real screens in `reference/v2-ui/` and the
recovery math in `reference/METRICS.md`. Charts use Recharts. No PrimeVue.

Every component is a plain function component with typed props. **Data comes in as
props; actions go out as callbacks.** Nothing fetches. Import from `components/ui`:

```tsx
import { AppShell, SESSION_MENU, RecoveryList } from "@/components/ui";
```

## Matching the real app

Two facts in `app/globals.css` carry the whole look, both taken from the v2 SCSS:

1. **`html { font-size: 14px }`** (`scss/_main.scss`). Every Tailwind rem utility is
   scaled by 0.875, which is why the live page measures `text-xs` at 10.5px, `text-3xl`
   at 26.25px, `rounded-xl` at 10.5px and `p-5` at 17.5px. A class string copied out of a
   `.vue` file lands on the measured pixel value, so copy rather than re-derive.
2. **The palette is PrimeVue Aura, `primary: 'indigo'`, dark surface ramp**
   (`layout/composables/layout.js`). `surface-*` is Tailwind zinc, `primary-*` is Tailwind
   indigo, and `border-surface` is surface-700. The body is InterDisplay 14px on
   `surface-950`, self-hosted from `public/fonts` via `@font-face`.

Legacy kit tokens (`bg-card`, `text-muted`, `border-line`, `text-accent`) are remapped
onto that palette in `globals.css`, so every component resolves to the same colors.
Formatting helpers are in `lib/format.ts` (`formatValue`, `compactMoney`, `pct`,
`formatMonth`, ...).

`app/revenue-recovery/page.tsx` is the reference screen, assembled whole inside
`AppShell`. The gallery in `app/page.tsx` renders every component with demo data derived
from `reference/leads_monthly.csv` by `scripts/gen-demo.mjs` (`node scripts/gen-demo.mjs`
regenerates `lib/demo-data.ts`).

## Components

Each row: the component, its key props, and a plain-English ask you could hand Claude Code.

### App shell

- **AppShell** — `sidebar: SidebarProps`, `topbar: TopbarProps`, `children`. The whole layout: the 17rem rail, the top bar, and a scrolling `max-w-[1540px]` content column that carries `.layout-content`'s 2rem padding. Handles the mobile off-canvas rail itself; everything else is passed through.
  _"Build the screen inside AppShell from components/ui, with SESSION_MENU in the sidebar and Revenue Recovery as the active item."_
- **Sidebar** — `sections: SidebarSection[]`, `activePath`, `onNavigate(to,item)`, `appName`, `appNameAccent`, `mobileOpen`. The near-black left rail: logo, uppercase section labels, items with lucide icons, active state, optional red count badge.
  _"Put a Sidebar from components/ui on the left with my own sections and highlight the current route."_
- **Topbar** — `title`, `onBack`, `stores`/`selectedStore`/`onSelectStore`, `groups`/`selectedGroup`/`onSelectGroup`, `monthLabel`/`onPrevMonth`/`onNextMonth`/`nextMonthDisabled`, `onSearch`, `onBell`, `notificationCount`, `userName`, `userPicture`, `onAvatar`. Back arrow, page title, the All Stores and dealer-group dropdowns, the month stepper, search, bell and avatar.
  _"Add a Topbar from components/ui with an All Stores dropdown and month prev/next, and call my handler when the month changes."_
- **SESSION_MENU** — the sidebar for what you build here: the home dashboard and Revenue Recovery, nothing else. **Use this one.** A menu full of links that 404 makes a real build look like a mockup. Add an entry when you add a screen.
- **FULL_MENU** — the whole product's eight sections, kept as a reference for what a finished version looks like. Do not ship it in an app that has two screens.

### KPIs

- **KpiCard** — `label`, `value`, `prior`, `dataType`, `sparkline`, `accent`, `costMetric`, `hero`, `onDrillDown`. One metric: label above, big value below, delta vs prior month, 12-month sparkline. The hero card takes the accent wash; cost metrics invert the delta color.
  _"Add a KpiCard from components/ui for total gross, accent violet, hero style, with a 12-month sparkline."_
- **KpiGrid** — `items: KpiGridItem[]`, `heroFirst`, `onDrillDown(key)`. Responsive 4/2/1-up grid of KpiCards; first card is the hero by default.
  _"Lay out my six KPIs in a KpiGrid from components/ui and open the drill-down when one is clicked."_

### Filters & navigation

- **FilterBar** — `value: {store,dateRange,leadType}`, `stores`, `leadTypes`, `onChange`. Global scope selectors.
  _"Put a FilterBar from components/ui above the dashboard for store, date range and lead type."_
- **Breadcrumb** — `crumbs: Crumb[]`, `onNavigate(index)`. Click-to-climb trail; index -1 is root.
  _"Show a Breadcrumb from components/ui for the current drill path and let me click back to any level."_
- **HighlightsChips** — `highlights: Highlight[]`, `fallback`, `onSelect(question)`. The rule-engine anomaly questions as clickable chips.
  _"Render the monthly highlights as HighlightsChips from components/ui and send the one I click to the analyst."_

### Drill-down (one generic metric + dimension mechanism)

- **DrillDownOverlay** — `model: DrillDownModel`, `onClose`, `chat?`, `onSelectRelated?`. The full-screen drill: composes the header, related KPIs, impact, monthly trend, dimension selector and breakdown table. Holds only the filter-path + selected-dimension UI state; every level of data comes from `model.resolve(path)`.
  _"Add the drill-down overlay from components/ui to the gross card, driven by a metric model that resolves each level."_
- **DrillDownHeader** — `metricName`, `scope`, `currentValue`, `previousValue`, `lastYearValue`, `dataType`, `crumbs`, `onNavigate`, `onClose`, `onToggleChat?`, `invert?`. Sticky header with value, delta, and breadcrumb.
- **DimensionSelector** — `dimensions`, `selected`, `onSelect(key)`. Pill row to pick the breakdown dimension.
- **BreakdownTable** — `data: BreakdownRow[]`, `dataType`, `dimensionLabel?`, `onRowClick(row)`. Sortable children of the current level; click a row to drill deeper.
  _"Drop a BreakdownTable from components/ui showing gross by source, sortable, and drill in when a row is clicked."_
- **MonthlyTrendChart** — `trend: {labels, current, lastYear?}`, `dataType`, `title?`. 12-month line with soft area fill and optional dashed last-year line.
- **RelatedKpis** — `items: RelatedKpi[]`, `onSelect?`. Horizontal strip of related metrics with a relationship badge.
- **ImpactAnalysis** — `impact: Record<dim, BreakdownRow[]>`, `dimensionLabels`, `dataType`, `onFilter(dim,row)`. "What moved the number": biggest movers per dimension as leaderboards.

### Home dashboard (v2's "/" page)

`app/dashboard/page.tsx` assembles these into the page the real product opens on; in the dealer's
app it lives at `/`. The recipe is `recipes/home-dashboard.md`; the two new formulas (Lead Health,
Do This Now) are in `reference/METRICS.md`.

- **HomePageHeader** — `title?`, `scopeLabel`, `rangeLabel`, `right?`. "Dashboard" with the scope in the accent color and the month range under it.
- **HeroKpiCard** — `label`, `value`, `prior?`, `lastYear?`, `dataType`, `color`, `spark?`, `sparkLabels?`, `sparkLastYear?`, `invert?`, `onClick?`, `onAsk?`. The v2 hero tile: label row with the ask button, 2xl value with the MoM badge and absolute change, `Prev:` / `LY:` line, and a full-width area sparkline in the tile's own color with last year dashed.
  _"Four HeroKpiCards from components/ui for leads, sales, closing ratio and gross, each with its twelve-month trend."_
- **SecondaryKpiTile** — `label`, `value`, `prior?`, `dataType`, `invert?`, `onClick?`, `onAsk?`. The small six-up tile: uppercase micro label, lg value, MoM percent and change.
- **TrendCard** — `labels`, `leads`, `sales`, `title?`, `rangeLabel?`, `onAsk?`. "Leads vs Sales" over six months, two lines on their own hidden axes, horizontal grid only, chip legend.
- **HealthGauge** — `score`, `subScores: HealthSubScore[]`, `ownRank?`, `best?`, `worst?`, `title?`, `onAsk?`. The half-donut with the red-to-green gradient, the score in the middle, one bar per sub-score, two rank boxes.
- **DoThisNow** — `actions: HomeAction[]` (`priority: critical|warning|info`, `text`), `onSelect?`. The action list with a severity stripe per item; click sends the text to the analyst. Empty state: "All clear."
- **RankedList** — `title`, `items: RankedItem[]` (`id`, `label`, `value`, `raw`, `change?`), `subtitle?`, `bars?`, `toggle?`, `onSelect?`, `onAsk?`. Top Lead Sources (plain rows) and Rankings by Store (bars plus a leads / sales / gross toggle) are both this.
- **LeadTypeMix** — `leadTypes: HomeLeadType[]`, `monthLabel?`, `onSelect?`, `onAsk?`. One row per lead type: color dot, leads, share bar, closing ratio.
- **SectionCard**, **AskButton** — the rounded-2xl section panel with the header row, and the small chat-bubble button every tile carries.
- **DealershipHealth** — `score` (0..100, shown times ten), `rows: [{label, current, previous, invert?}]`, `caption?`, `onAsk?`. The live page's credit-score gauge: thick red-to-green arc with a tick ring, the score in the middle, Sales / Leads / Gross versus prior as pills underneath.
- **StatStrip** / **MiniStatTile** — `title`, `items: [{label, value, prior?, dataType, invert?}]`, `columns: 6 | 8`, `onSelect?`. The Financial Focus and Digital & Marketing strips of small tiles.
- **StorePerformance** — `stores: HomeStorePerformance[]`, `onAsk?(panel)`. Sales by Store (ranked bars), New vs Used per store (stacked blue / amber), Gross by Store (ranked green bars).
- **HealthScores** — `scores: HomeHealthScore[]`. One ringed score tile per metric, each against its own twelve-month best.
- **HealthByStore** — `data: HomeHealthByStore`, `onAsk?`. Twelve-month health lines per store with the group average dashed and store chips to toggle lines.

### Traffic channels (the GA4 side of Revenue Recovery)

Fed by the optional traffic file (`DATA-SPEC.md`); `demo.traffic` is null without one. Units are
sessions and conversions, never dollars (`reference/METRICS.md`, "Traffic channels").

- **TrafficList** — `channels: TrafficChannel[]`, `expandedChannel?`/`onExpandChange?`, `months?`. The info line, then one `TrafficRow` per channel, biggest loss first, with an all-clear state.
  _"Show the Traffic Channels side with a TrafficList from components/ui, dormant and declining first."_
- **TrafficRow** — `channel: TrafficChannel`, `expanded`, `onToggle`. Head: chevron, source / medium, status chip, Peak sess/mo, Conv (rate), VDPs, Inactive, lost sessions per month. Body: six tiles (sessions, VDP views, form submissions, click-to-call, conversion rate, active months), the Peak and Last active lines, the timeline.
- **TrafficTimeline** — `data: TrafficTimelinePoint[]`, `height?`. Sessions (orange area), VDP views (green), conversions (purple), each on its own axis with ticks, circle legend on top.

### Revenue Recovery

- **RecoveryPageHeader** — `title?`, `monthLabel`, `windowLabel`, `scope`/`onScopeChange`, `yearOptions`/`selectedYears`/`onYearsChange`, `leadTypes`/`selectedLeadType`/`onLeadTypeChange`. Title, subtitle with the analysis month, then a stacked control block on the right: a compact lookback dropdown ("3 Years", 32px tall) beside the CRM Sources / Traffic Channels toggle, with the All Types / Internet / Phone / Campaign / Showroom / Service segmented pill group underneath.
  _"Add a RecoveryPageHeader from components/ui with lead-type tabs and tell me which one is selected."_
- **RecoveryKpiCards** — `items: RecoveryKpi[]` (`label`, `value`, `sub?`, `icon`, `accent?`, `onClick?`). Four cards: uppercase 10.5px label, 26.25px bold white value, 10px surface-400 sub-line. Only the **first** carries the indigo gradient wash, indigo/20 border and indigo label (`accent` defaults to `index === 0`); the rest are `bg-surface-900` with a 1px `border-surface` and a surface-400 label. Values arrive pre-formatted, so formatting stays in the page.
  _"Show recoverable per month, annual opportunity, dormant and declining as RecoveryKpiCards from components/ui."_
- **HowItWorks** — `title?`, `children?`. The tinted info box that states what the estimate assumes, as METRICS.md requires. Defaults to the dormant/declining rules and the run-rate assumption.
  _"Put a HowItWorks box from components/ui under the KPI cards explaining the recovery estimate."_
- **RecoveryRow** — `source: RecoverySource`, `expanded`, `onToggle`, `onView?`, `tag?`. One source, collapsed and expanded. Collapsed: chevron, name, TAG label (10px uppercase, surface-400 on a surface-700 border), lead-type chips in their colors, status chip, and on the right Peak / Total / Close / Inactive / $ per month plus an eye icon. **Steady** sources get a neutral chip and read "steady, not in total" instead of a figure. Expanded, the live layout: KEY METRICS (total sales, total leads, total gross, avg gross/sale), NEW VS USED SPLIT tiles with bars, the Peak / Last active / Closing ratio and active-months lines, STORES AFFECTED as rows (store, sales, N, U, gross), and PERFORMANCE TIMELINE with lead-type tabs and a Compare button (`onCompare`).
  _"Render each dormant source as a RecoveryRow from components/ui and open a detail panel when I click the eye."_
- **RecoveryList** — `sources: RecoverySource[]`, `expandedSource?`/`onExpandChange?`, `onView?`, `tagFor?`, `loading?`, `emptyTitle?`, `emptyDetail?`. The ranked stack of rows, 8px apart, with loading skeletons and an all-clear empty state. Pass dormant and declining first and steady after; the list renders the order it is given. The open row can be controlled or left to the component.
  _"List this month's dormant and declining sources with a RecoveryList from components/ui, one row open at a time."_
- **ThreeAxisTimeline** — `data: RecoveryTimelinePoint[]`, `height?`, `legend?`. The live Performance Timeline: sales (indigo area) on a left axis with ticks and a title, leads (blue) and close % (orange dashed) on their own right axes, circle legend on top. 380px tall by default.
  _"Show a ThreeAxisTimeline from components/ui for this source's sales, leads and closing rate."_

### Analyst chat

- **ChatDock** — `open`, `onClose?`, `title`, `side`, `inline?`, `children`, `footer?`. Dockable panel shell (right rail or bottom sheet, or inline) with a header, scroll body and pinned footer.
  _"Wrap the analyst chat in a ChatDock from components/ui docked to the right."_
- **ChatMessages** — `messages: ChatMessage[]`, `isStreaming?`, `streamingStatus?`, `onKpiClick?`, `emptyState?`. The transcript: user bubbles, assistant block lists (markdown, grouped mini-KPIs, tool cards, inline trends), and a live streaming status line.
  _"Render the conversation with ChatMessages from components/ui and show a streaming indicator while it answers."_
- **ChatInput** — `onSend(text)`, `disabled?`, `suggestions?`, `fallbackSuggestions?`, `showSuggestions?`. Auto-growing composer with suggested-question chips; Enter sends, Shift+Enter newlines.
  _"Add a ChatInput from components/ui with suggested-question chips from the highlights."_
- **ToolExecutionCard** — `toolCall: ToolCall`. A tool call in progress, then its result; expands to the raw payload, with an inline trend chart when the result is a series.
  _"Show each analyst tool call with a ToolExecutionCard from components/ui."_
- **InlineTrendChart** — `series: {month,value}[]`, `dataType`, `title?`. Compact trend whose line color follows direction (up green, anomaly red, flat amber).
- **ReportPanel** — `report: SavedReport`, `onExport?`, `onEditNarrative?`. A saved investigation: numbered section cards with editable narrative and data blocks.
  _"Put the saved investigation in a ReportPanel from components/ui with an export button."_
- **KnowledgePanel** — `docs: KnowledgeDoc[]`, `onNew?`. Searchable notes the analyst can browse; click a note to read it.
- **EventsPanel** — `events: BusinessEvent[]`, `onAdd?`. Typed business events with date range and affected stores.
- **InstructionsPanel** — `instructions: Instruction[]`, `onToggle?`, `onAdd?`, `onDelete?`. Standing instructions with an active toggle and a manual/feedback source pill.

### Primitives

`Card`, `SectionLabel`, `Pill`, `Tag`, `Delta`, `Markdown`, `Sparkline` — the shared building blocks used across the kit. `Card` is the app's panel treatment: `rounded-xl`, 1px surface-700 border, `bg-surface-900/50`, or the indigo gradient wash with `accent`.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
