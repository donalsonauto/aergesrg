// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Gallery: every component in components/ui rendered with realistic static demo
// data (derived from reference/leads_monthly.csv via scripts/gen-demo.mjs). No
// backend, no data fetching. This page is the living catalogue for the kit.

import { useState } from "react";
import { ArrowDown, DollarSign, PauseCircle, ShoppingCart } from "lucide-react";
import {
  BreakdownTable,
  ChatDock,
  ChatInput,
  ChatMessages,
  DimensionSelector,
  DrillDownOverlay,
  EventsPanel,
  FilterBar,
  HighlightsChips,
  ImpactAnalysis,
  InlineTrendChart,
  InstructionsPanel,
  KnowledgePanel,
  KpiGrid,
  MonthlyTrendChart,
  RecoveryKpiCards,
  RecoveryList,
  RecoveryPageHeader,
  RelatedKpis,
  ReportPanel,
  ToolExecutionCard,
  HowItWorks,
  type FilterValue,
  type KpiGridItem,
  type RecoveryKpi,
  type RecoveryScope,
} from "@/components/ui";
import { CARFINITY_MENU, Sidebar, Topbar } from "@/components/ui/shell";
import { demo } from "@/lib/demo-data";
import { FALLBACK_QUESTIONS } from "@/lib/highlights";
import { compactMoney, formatMonth, units } from "@/lib/format";
import {
  buildDrillModel,
  sampleEvents,
  sampleInstructions,
  sampleKnowledge,
  sampleMessages,
  sampleReport,
} from "./gallery-data";

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div className="border-b border-line pb-2">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        {blurb && <p className="mt-0.5 text-sm text-muted">{blurb}</p>}
      </div>
      {children}
    </section>
  );
}

function Frame({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <div className="mb-2 kpi-label">{label}</div>
      <div className={className}>{children}</div>
    </div>
  );
}

const NAV = [
  ["shell", "App shell"],
  ["kpis", "KPI cards"],
  ["highlights", "Highlights"],
  ["recovery", "Revenue Recovery"],
  ["drilldown", "Drill-down"],
  ["chat", "Analyst chat"],
  ["filters", "Filters"],
];

export default function Gallery() {
  const [filter, setFilter] = useState<FilterValue>({
    store: "All Stores",
    dateRange: "This month",
    leadType: "All Lead Types",
  });
  const [drillOpen, setDrillOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [dimSelected, setDimSelected] = useState<string>("store");
  const [lastAsked, setLastAsked] = useState<string | null>(null);
  const [recScope, setRecScope] = useState<RecoveryScope>("crm");
  const [recLeadType, setRecLeadType] = useState<string | null>(null);
  const [recOpen, setRecOpen] = useState<string | null>(null);

  const model = buildDrillModel();
  const baseLevel = model.resolve([]);

  // Only the first card is accented; the rest are neutral. Values arrive
  // pre-formatted, so the page owns formatting and the component owns look.
  const recoverableSources = demo.recovery.sources.filter(
    (s) => s.status !== "steady" && !s.insufficient && !s.feedLost,
  );
  const recoveryKpis: RecoveryKpi[] = [
    {
      key: "revenue",
      label: "Est. Monthly Revenue",
      value: compactMoney(demo.recovery.headlineMonthly),
      sub: "recoverable if re-activated",
      icon: DollarSign,
    },
    {
      key: "sales",
      label: "Est. Monthly Sales",
      value: units(
        recoverableSources.reduce((n, s) => n + (s.estMonthlySales ?? 0), 0),
      ),
      sub: "units/month potential",
      icon: ShoppingCart,
    },
    {
      key: "dormant",
      label: "Dormant Sources",
      value: String(demo.recovery.dormantCount),
      sub: "no activity recently",
      icon: PauseCircle,
    },
    {
      key: "declining",
      label: "Declining Sources",
      value: String(demo.recovery.decliningCount),
      sub: "< 30% of peak performance",
      icon: ArrowDown,
    },
  ];

  const kpiItems: KpiGridItem[] = demo.kpis.map((k) => ({
    key: k.key,
    label: k.label,
    value: k.value,
    prior: k.prior,
    dataType: k.dataType,
    sparkline: k.spark,
    accent: k.accent,
    costMetric: k.costMetric,
  }));

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-base font-bold text-fg">Carfinity v2 UI kit</h1>
            <p className="text-[11px] text-muted">
              {demo.meta.stores.length} rooftops · analysis month{" "}
              {formatMonth(demo.meta.analysisMonth)} · static demo data
            </p>
          </div>
          <nav className="ml-auto hidden flex-wrap gap-1 md:flex">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                {label}
              </a>
            ))}
          </nav>
          <button
            onClick={() => setDockOpen(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            Ask analyst
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-14 px-4 py-8 sm:px-6">
        {/* App shell */}
        <Section
          id="shell"
          title="AppShell = Sidebar + Topbar + content"
          blurb="The real app's layout: a 17rem near-black rail with the v2 menu, and a 56px top bar carrying the page title, the All Stores and dealer-group dropdowns, the month stepper, search, bell and avatar. Assembled and live at /revenue-recovery."
        >
          <a
            href="/revenue-recovery"
            className="inline-block rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Open the Revenue Recovery screen inside AppShell
          </a>

          <div className="mt-6 overflow-hidden rounded-xl border border-surface">
            <div className="flex h-[420px] bg-surface-950">
              <Sidebar
                sections={CARFINITY_MENU}
                activePath="/revenue-recovery"
                onNavigate={() => {}}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar
                  title="Revenue Recovery"
                  stores={demo.meta.stores.map((st) => ({ id: st, name: st }))}
                  selectedStore={null}
                  groups={[
                    {
                      id: "northeast",
                      name: "Northeast Group",
                      count: demo.meta.stores.length,
                    },
                  ]}
                  selectedGroup={null}
                  monthLabel="August 2026"
                  nextMonthDisabled
                  userName="Alex Oleynik"
                />
                <div className="flex-1 p-4 sm:p-6">
                  <p className="text-sm text-surface-400">
                    Page content goes here. Pages bring their own{" "}
                    <code className="text-surface-200">p-4 sm:p-6</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* KPI cards */}
        <Section
          id="kpis"
          title="KpiCard + KpiGrid"
          blurb="Label above, value below, delta vs prior month, 12-month sparkline. The hero card takes the accent wash; cost-per-sale inverts delta color. Click a card to open the drill-down."
        >
          <KpiGrid
            items={kpiItems}
            onDrillDown={() => setDrillOpen(true)}
          />
        </Section>

        {/* Highlights */}
        <Section
          id="highlights"
          title="HighlightsChips"
          blurb="Rule-engine anomaly questions (highlights.js) as chips. Click one to send it to the analyst."
        >
          <HighlightsChips
            highlights={demo.highlights}
            fallback={FALLBACK_QUESTIONS}
            onSelect={(q) => {
              setLastAsked(q);
              setDockOpen(true);
            }}
          />
          {lastAsked && (
            <p className="mt-3 text-xs text-muted">
              Last asked: <span className="text-fg">{lastAsked}</span>
            </p>
          )}
        </Section>

        {/* Revenue Recovery */}
        <Section
          id="recovery"
          title="RecoveryPageHeader + RecoveryKpiCards + HowItWorks + RecoveryList"
          blurb="The Revenue Recovery screen's pieces, ported class-for-class from RevenueRecovery.vue. See them assembled on a real page at /revenue-recovery."
        >
          <div className="space-y-6">
            <RecoveryPageHeader
              monthLabel={formatMonth(demo.meta.analysisMonth)}
              windowLabel={`${demo.recovery.window.months}-month lookback`}
              scope={recScope}
              onScopeChange={setRecScope}
              yearOptions={[1, 2, 3]}
              selectedYears={3}
              leadTypes={[
                { key: null, label: "All Types" },
                ...demo.meta.leadTypes.map((t) => ({
                  key: t,
                  label: t.charAt(0).toUpperCase() + t.slice(1),
                })),
              ]}
              selectedLeadType={recLeadType}
              onLeadTypeChange={setRecLeadType}
            />
            <RecoveryKpiCards items={recoveryKpis} />
            <HowItWorks />
            <RecoveryList
              sources={
                recLeadType
                  ? demo.recovery.sources.filter((s) =>
                      s.leadTypes.includes(recLeadType),
                    )
                  : demo.recovery.sources
              }
              expandedSource={recOpen}
              onExpandChange={setRecOpen}
              onView={() => {}}
              tagFor={(s) =>
                s.storesAffected.length === 1
                  ? "1 store"
                  : `${s.storesAffected.length} stores`
              }
            />
          </div>
        </Section>

        {/* Drill-down */}
        <Section
          id="drilldown"
          title="DrillDownOverlay"
          blurb="One generic mechanism driven by a metric + dimension model. Open the full overlay, or inspect the composed pieces below."
        >
          <button
            onClick={() => setDrillOpen(true)}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open drill-down for Total Gross
          </button>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Frame label="MonthlyTrendChart">
              <MonthlyTrendChart trend={demo.drilldown.monthlyTrend} dataType="money" />
            </Frame>
            <Frame label="RelatedKpis">
              <RelatedKpis items={demo.drilldown.relatedKpis} />
            </Frame>
          </div>

          <div className="mt-6">
            <Frame label="ImpactAnalysis">
              <ImpactAnalysis
                impact={demo.drilldown.impact}
                dimensionLabels={Object.fromEntries(
                  demo.drilldown.dimensions.map((d) => [d.key, d.label]),
                )}
                dataType="money"
              />
            </Frame>
          </div>

          <div className="mt-6">
            <Frame label="DimensionSelector + BreakdownTable">
              <DimensionSelector
                dimensions={demo.drilldown.dimensions}
                selected={dimSelected}
                onSelect={setDimSelected}
              />
              <BreakdownTable
                data={baseLevel.breakdowns[dimSelected] ?? []}
                dataType="money"
                dimensionLabel={dimSelected}
                onRowClick={() => setDrillOpen(true)}
              />
            </Frame>
          </div>
        </Section>

        {/* Analyst chat */}
        <Section
          id="chat"
          title="Analyst chat family"
          blurb="ChatMessages, ChatInput, ToolExecutionCard, InlineTrendChart, ReportPanel, KnowledgePanel, EventsPanel, InstructionsPanel. Streaming state is passed in as props."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Frame label="ChatMessages + ChatInput (in a ChatDock, inline)">
              <div className="h-[560px] overflow-hidden rounded-2xl border border-line">
                <ChatDock
                  open
                  inline
                  title="Analyst"
                  footer={
                    <ChatInput
                      onSend={(q) => setLastAsked(q)}
                      suggestions={demo.highlights}
                      fallbackSuggestions={FALLBACK_QUESTIONS}
                    />
                  }
                >
                  <ChatMessages
                    messages={sampleMessages}
                    isStreaming
                    streamingStatus="Searching knowledge base (2/3)"
                  />
                </ChatDock>
              </div>
            </Frame>

            <Frame label="ReportPanel">
              <div className="h-[560px] overflow-hidden rounded-2xl border border-line">
                <ReportPanel report={sampleReport} onExport={() => {}} onEditNarrative={() => {}} />
              </div>
            </Frame>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Frame label="ToolExecutionCard (3 states)">
              <div className="space-y-2.5">
                <ToolExecutionCard
                  toolCall={{
                    id: "r",
                    name: "get_drilldown_data",
                    status: "running",
                    args: { metric: "Total Gross", by: "source" },
                  }}
                />
                <ToolExecutionCard
                  toolCall={{
                    id: "c",
                    name: "get_kpi_data",
                    status: "completed",
                    args: { metric: "Units Sold", month: "Aug 26" },
                    resultSummary: "344 this month vs 367 prior",
                    result: { current: 344, previous: 367 },
                    series: demo.drilldown.monthlyTrend.labels.map((m, i) => ({
                      month: m,
                      value: Math.round(demo.drilldown.monthlyTrend.current[i] / 3200),
                    })),
                    seriesDataType: "units",
                    seriesLabel: "Units sold, last 12 months",
                  }}
                />
                <ToolExecutionCard
                  toolCall={{
                    id: "f",
                    name: "search_knowledge",
                    status: "failed",
                    args: { query: "closing ratio" },
                    resultSummary: "Knowledge base timed out",
                  }}
                />
              </div>
            </Frame>

            <Frame label="InlineTrendChart">
              <InlineTrendChart
                title="Total Gross, last 12 months"
                series={demo.drilldown.monthlyTrend.labels.map((m, i) => ({
                  month: m,
                  value: demo.drilldown.monthlyTrend.current[i],
                }))}
                dataType="money"
              />
            </Frame>

            <Frame label="InstructionsPanel">
              <div className="rounded-2xl border border-line">
                <InstructionsPanel
                  instructions={sampleInstructions}
                  onToggle={() => {}}
                  onAdd={() => {}}
                  onDelete={() => {}}
                />
              </div>
            </Frame>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Frame label="KnowledgePanel">
              <div className="h-[440px] overflow-y-auto rounded-2xl border border-line">
                <KnowledgePanel docs={sampleKnowledge} onNew={() => {}} />
              </div>
            </Frame>
            <Frame label="EventsPanel">
              <div className="h-[440px] overflow-y-auto rounded-2xl border border-line">
                <EventsPanel events={sampleEvents} onAdd={() => {}} />
              </div>
            </Frame>
          </div>
        </Section>

        {/* Filters */}
        <Section
          id="filters"
          title="FilterBar + Breadcrumb"
          blurb="Global scope selectors. The Breadcrumb lives inside the drill-down header (open the overlay to climb the path)."
        >
          <FilterBar
            value={filter}
            stores={demo.meta.stores}
            leadTypes={demo.meta.leadTypes}
            onChange={setFilter}
          />
          <p className="mt-3 text-xs text-muted">
            Scope: <span className="text-fg">{filter.store}</span> ·{" "}
            <span className="text-fg">{filter.dateRange}</span> ·{" "}
            <span className="text-fg">{filter.leadType}</span>
          </p>
        </Section>

        <footer className="border-t border-line pt-6 text-xs text-muted">
          Ported from the Carfinity v2 Vue app. Tokens and formatting per
          reference/DESIGN.md; recovery math per reference/METRICS.md. See
          components/ui/README.md.
        </footer>
      </main>

      {/* Drill-down overlay */}
      {drillOpen && (
        <DrillDownOverlay
          model={model}
          onClose={() => setDrillOpen(false)}
          chat={
            <div className="flex h-full flex-col">
              <ChatMessages messages={sampleMessages} />
              <div className="border-t border-line p-3">
                <ChatInput
                  onSend={(q) => setLastAsked(q)}
                  showSuggestions={false}
                  placeholder="Ask about Total Gross..."
                />
              </div>
            </div>
          }
        />
      )}

      {/* Analyst dock */}
      <ChatDock
        open={dockOpen}
        onClose={() => setDockOpen(false)}
        title="Analyst"
        footer={
          <ChatInput
            onSend={(q) => setLastAsked(q)}
            suggestions={demo.highlights}
            fallbackSuggestions={FALLBACK_QUESTIONS}
          />
        }
      >
        <ChatMessages
          messages={
            lastAsked
              ? [...sampleMessages, { id: "live", role: "user", text: lastAsked }]
              : sampleMessages
          }
          isStreaming={!!lastAsked}
          streamingStatus="Fetching KPI data (1/3)"
        />
      </ChatDock>
    </div>
  );
}
