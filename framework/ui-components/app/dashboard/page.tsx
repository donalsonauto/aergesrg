// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// The home dashboard, whole, inside AppShell: v2's "/" page rebuilt on CRM
// data. In the dealer's app this is the root route ("/") and Revenue Recovery
// moves to /revenue-recovery; here it lives at /dashboard so the gallery keeps
// the root.
//
// Same rows as the live ExecutiveDashboard.vue: four hero tiles with sparklines,
// six secondary tiles, trend / Dealership Health / Do This Now, Health By
// Store, Financial Focus, Store Performance, Health Scores, the ranked lists,
// Digital & Marketing (when a traffic file exists) and the lead-type mix. Every number comes from lib/demo-data.ts, derived
// from sample-data/leads_monthly.csv by scripts/gen-demo.mjs.

import { useMemo, useState } from "react";
import { AppShell, CARFINITY_MENU } from "@/components/ui/shell";
import {
  DealershipHealth,
  DoThisNow,
  DrillDownOverlay,
  HealthByStore,
  HealthScores,
  HeroKpiCard,
  HomePageHeader,
  LeadTypeMix,
  RankedList,
  SecondaryKpiTile,
  StatStrip,
  StorePerformance,
  TrendCard,
} from "@/components/ui";
import { demo } from "@/lib/demo-data";
import { compactMoney, formatMonth, pct } from "@/lib/format";
import { buildDrillModel } from "../gallery-data";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longMonth(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTHS_LONG[parseInt(m, 10) - 1]} ${y}`;
}

const RANK_METRICS = [
  { key: "leads", label: "Leads" },
  { key: "sales", label: "Sales" },
  { key: "gross", label: "Gross" },
] as const;
type RankMetric = (typeof RANK_METRICS)[number]["key"];

export default function HomeDashboardPage() {
  const { home, meta } = demo;
  const [store, setStore] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [rankMetric, setRankMetric] = useState<RankMetric>("leads");
  const [drillOpen, setDrillOpen] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);

  const scopeLabel = store ?? "All Stores";
  const monthLabel = longMonth(meta.analysisMonth);
  const rangeLabel = `${monthLabel} · ${formatMonth(meta.analysisMonth)} · vs ${formatMonth(meta.priorMonth)}`;

  const rankedStores = useMemo(() => {
    const fmt = (v: number) => (rankMetric === "gross" ? compactMoney(v) : v.toLocaleString("en-US"));
    return [...home.storeRankings]
      .sort((a, b) => b[rankMetric] - a[rankMetric])
      .map((s) => ({
        id: s.store,
        label: s.store,
        value: fmt(s[rankMetric]),
        raw: s[rankMetric],
        change: s.change[rankMetric],
      }));
  }, [home.storeRankings, rankMetric]);

  const topSources = home.topSources.map((s) => ({
    id: s.source,
    label: s.source,
    value: s.leads.toLocaleString("en-US"),
    raw: s.leads,
    change: s.change,
  }));

  const model = useMemo(() => buildDrillModel(), []);

  return (
    <AppShell
      sidebar={{ sections: CARFINITY_MENU, activePath: "/", onNavigate: () => {} }}
      topbar={{
        title: "Dashboard",
        stores: meta.stores.map((s) => ({ id: s, name: s })),
        selectedStore: store,
        onSelectStore: setStore,
        groups: [{ id: "northeast", name: "Northeast Group", count: meta.stores.length }],
        selectedGroup: group,
        onSelectGroup: setGroup,
        monthLabel,
        nextMonthDisabled: true,
        userName: "Alex Oleynik",
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
        <HomePageHeader scopeLabel={scopeLabel} rangeLabel={rangeLabel} />

        {/* Hero KPI row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          {home.hero.map((h) => (
            <HeroKpiCard
              key={h.key}
              label={h.label}
              value={h.value}
              prior={h.prior}
              lastYear={h.lastYear}
              dataType={h.dataType}
              color={h.color}
              spark={h.spark}
              sparkLabels={h.sparkLabels.map(formatMonth)}
              sparkLastYear={h.sparkLastYear}
              onClick={() => setDrillOpen(true)}
              onAsk={() => setQuestion(`Why did ${h.label.toLowerCase()} move this month?`)}
            />
          ))}
        </div>

        {/* Secondary KPI grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {home.secondary.map((s) => (
            <SecondaryKpiTile
              key={s.key}
              label={s.label}
              value={s.value}
              prior={s.prior}
              dataType={s.dataType}
              invert={s.invert}
              onAsk={() => setQuestion(`Break down ${s.label.toLowerCase()} for ${scopeLabel} in ${monthLabel}.`)}
            />
          ))}
        </div>

        {/* Trend + Health + Do This Now */}
        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-12">
          <TrendCard
            className="lg:col-span-4"
            labels={home.trend.labels}
            leads={home.trend.leads}
            sales={home.trend.sales}
            onAsk={() => setQuestion("Leads and sales over the last six months: what moved and why?")}
          />
          <DealershipHealth
            className="lg:col-span-4"
            score={home.health.score}
            rows={[
              { label: "Sales vs Prior", current: home.hero.find((h) => h.key === "sales")?.value ?? null, previous: home.hero.find((h) => h.key === "sales")?.prior ?? null },
              { label: "Leads vs Prior", current: home.hero.find((h) => h.key === "leads")?.value ?? null, previous: home.hero.find((h) => h.key === "leads")?.prior ?? null },
              { label: "Gross vs Prior", current: home.hero.find((h) => h.key === "gross")?.value ?? null, previous: home.hero.find((h) => h.key === "gross")?.prior ?? null },
            ]}
            onAsk={() => setQuestion(`Break down the Dealership Health score for ${scopeLabel} in ${monthLabel} and tell me what would move it most.`)}
          />
          <DoThisNow
            className="lg:col-span-4"
            actions={home.actions}
            onSelect={(a) => setQuestion(a.text)}
          />
        </div>

        <HealthByStore data={home.healthByStore} onAsk={() => setQuestion("Which store's health moved the most over the last twelve months, and why?")} />

        <StatStrip title="Financial Focus" items={home.financial} columns={8} onSelect={(l) => setQuestion(`Break down ${l.toLowerCase()} for ${scopeLabel} in ${monthLabel}.`)} />

        <StorePerformance stores={home.storePerformance} onAsk={(panel) => setQuestion(panel === "gross" ? "Rank my stores by gross this month and explain the gaps." : panel === "split" ? "Which store leans hardest on used, and is that closing better?" : "Rank my stores by units this month and tell me which one is underperforming.")} />

        <HealthScores scores={home.healthScores} />

        {/* Top Lead Sources + Rankings by Store */}
        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-2">
          <RankedList
            title="Top Lead Sources"
            subtitle="leads by source · vs prior"
            items={topSources}
            onAsk={() => setQuestion(`Which lead sources are driving my leads for ${scopeLabel} in ${monthLabel}, and where should I invest more?`)}
          />
          <RankedList
            title="Rankings by Store"
            items={rankedStores}
            bars
            toggle={{
              options: RANK_METRICS.map((m) => ({ key: m.key, label: m.label })),
              selected: rankMetric,
              onSelect: (k) => setRankMetric(k as RankMetric),
            }}
            onAsk={() => setQuestion(`Rank my stores by performance for ${monthLabel} and tell me which ones are underperforming.`)}
          />
        </div>

        {home.digital.length > 0 && (
          <StatStrip title="Digital & Marketing" items={home.digital} columns={6} onSelect={(l) => setQuestion(`What moved ${l.toLowerCase()} on the website this month?`)} />
        )}

        <LeadTypeMix
          leadTypes={home.leadTypes}
          monthLabel={formatMonth(meta.analysisMonth)}
          onAsk={() => setQuestion("Which lead types close best, and which carry volume without closing?")}
        />

        {question && (
          <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-xl border border-surface bg-surface-900 p-3 text-xs text-surface-200 shadow-lg">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-surface-400">
              Sent to the analyst (demo)
            </div>
            <div>{question}</div>
            <button
              type="button"
              className="mt-2 text-[11px] text-indigo-400"
              onClick={() => setQuestion(null)}
            >
              dismiss
            </button>
          </div>
        )}

        <p className="text-[11px] text-surface-500">
          Dealership Health is a composite of five sub-scores ({home.health.subScores.map((s) => s.label.toLowerCase()).join(", ")}), each 0 to 100, averaged and shown times ten, defined in reference/METRICS.md. Health Scores tiles score each metric against its own twelve-month best. Group closing ratio this month: {pct(home.secondary.find((h) => h.key === "closingRatio")?.value ?? null)}.
        </p>
      </div>

      {drillOpen && <DrillDownOverlay model={model} onClose={() => setDrillOpen(false)} />}
    </AppShell>
  );
}
