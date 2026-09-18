// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// The Revenue Recovery screen, whole, inside AppShell. This is the acceptance
// test for the port: it should read as the real v2 page.
//
// Demo numbers come from lib/demo-data.ts, generated from
// reference/leads_monthly.csv per reference/METRICS.md. The headline is
// $222.3K/mo across 2 dormant and 3 declining sources.

import { useMemo, useState } from "react";
import { ArrowDown, DollarSign, Globe, MousePointerClick, PauseCircle, ShoppingCart } from "lucide-react";
import { AppShell, CARFINITY_MENU } from "@/components/ui/shell";
import {
  HowItWorks,
  RecoveryKpiCards,
  RecoveryList,
  RecoveryPageHeader,
  TrafficList,
  type RecoveryKpi,
  type RecoveryScope,
} from "@/components/ui";
import { demo } from "@/lib/demo-data";
import { compactMoney, formatMonth, int, units } from "@/lib/format";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08" -> "August 2026" */
function longMonth(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTHS_LONG[parseInt(m, 10) - 1]} ${y}`;
}

export default function RevenueRecoveryPage() {
  const { recovery, meta, traffic } = demo;

  const [scope, setScope] = useState<RecoveryScope>("crm");
  const [leadType, setLeadType] = useState<string | null>(null);
  const [lookbackYears, setLookbackYears] = useState(3);
  const [store, setStore] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Lead-type tabs: All Types first, then the types present in the data, in the
  // order the real screen lists them.
  const leadTypeTabs = useMemo(() => {
    const ORDER = ["internet", "phone", "campaign", "showroom", "service", "chat"];
    const present = ORDER.filter((t) => meta.leadTypes.includes(t));
    return [
      { key: null, label: "All Types" },
      ...present.map((t) => ({
        key: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      })),
    ];
  }, [meta.leadTypes]);

  const sources = useMemo(() => {
    const rows = leadType
      ? recovery.sources.filter((s) => s.leadTypes.includes(leadType))
      : recovery.sources;
    // Dormant and declining first, ranked by recoverable revenue. Steady
    // sources follow as context, in source order. Insufficient-evidence rows
    // sort last within their own group: they still show (METRICS.md), they
    // just carry no number.
    return [...rows].sort((a, b) => {
      const rank = (s: typeof a) => (s.status === "steady" ? 1 : 0);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (rank(a) === 1) return 0; // keep steady in the generator's order
      if (a.insufficient !== b.insufficient) return a.insufficient ? 1 : -1;
      return (b.estMonthlyRevenue ?? 0) - (a.estMonthlyRevenue ?? 0);
    });
  }, [recovery.sources, leadType]);

  // The headline is recomputed on the visible slice, never summed from a
  // pre-filtered total (METRICS.md: recovery estimates are not additive).
  // Steady sources are listed but never counted, and neither are feed-loss or
  // insufficient-evidence sources.
  const visible = useMemo(() => {
    const counted = sources.filter(
      (s) => s.status !== "steady" && !s.insufficient && !s.feedLost,
    );
    return {
      monthlyRevenue: counted.reduce(
        (n, s) => n + (s.estMonthlyRevenue ?? 0),
        0,
      ),
      monthlySales: counted.reduce((n, s) => n + (s.estMonthlySales ?? 0), 0),
      dormant: sources.filter((s) => s.status === "dormant").length,
      declining: sources.filter((s) => s.status === "declining").length,
    };
  }, [sources]);

  const kpis: RecoveryKpi[] = [
    {
      key: "revenue",
      label: "Est. Monthly Revenue",
      value: compactMoney(visible.monthlyRevenue),
      sub: "recoverable if re-activated",
      icon: DollarSign,
    },
    {
      key: "sales",
      label: "Est. Monthly Sales",
      value: units(visible.monthlySales),
      sub: "units/month potential",
      icon: ShoppingCart,
    },
    {
      key: "dormant",
      label: "Dormant Sources",
      value: String(visible.dormant),
      sub: "no activity recently",
      icon: PauseCircle,
    },
    {
      key: "declining",
      label: "Declining Sources",
      value: String(visible.declining),
      sub: "< 30% of peak performance",
      icon: ArrowDown,
    },
  ];

  const windowLabel = `${recovery.window.months}-month lookback · ${formatMonth(
    `${recovery.window.start}`,
  )} – ${formatMonth(`${recovery.window.end}`)}`;

  return (
    <AppShell
      sidebar={{
        sections: CARFINITY_MENU,
        activePath: "/revenue-recovery",
        onNavigate: () => {},
      }}
      topbar={{
        title: "Revenue Recovery",
        stores: meta.stores.map((s) => ({ id: s, name: s })),
        selectedStore: store,
        onSelectStore: setStore,
        groups: [
          { id: "northeast", name: "Northeast Group", count: meta.stores.length },
        ],
        selectedGroup: group,
        onSelectGroup: setGroup,
        monthLabel: longMonth(meta.analysisMonth),
        nextMonthDisabled: true,
        userName: "Alex Oleynik",
      }}
    >
      <div className="space-y-6 p-4 sm:p-6">
        <RecoveryPageHeader
          monthLabel={longMonth(meta.analysisMonth)}
          windowLabel={windowLabel}
          scope={scope}
          onScopeChange={setScope}
          yearOptions={[1, 2, 3]}
          selectedYears={lookbackYears}
          onYearsChange={setLookbackYears}
          leadTypes={leadTypeTabs}
          selectedLeadType={leadType}
          onLeadTypeChange={setLeadType}
        />

        {scope === "traffic" ? (
          traffic ? (
            <>
              <RecoveryKpiCards
                items={[
                  { key: "sessions", label: "Lost Sessions / mo", value: int(Math.round(traffic.summary.lostSessionsMonthly)), sub: "sessions the quiet channels used to bring", icon: Globe },
                  { key: "conversions", label: "Lost Conversions / mo", value: int(Math.round(traffic.summary.lostConversionsMonthly)), sub: "at each channel's own conversion rate", icon: MousePointerClick },
                  { key: "dormant", label: "Dormant Channels", value: String(traffic.summary.dormantChannels), sub: "had traffic, now silent", icon: PauseCircle },
                  { key: "declining", label: "Declining Channels", value: String(traffic.summary.decliningChannels), sub: "< 45% of peak performance", icon: ArrowDown },
                ]}
              />
              <TrafficList channels={traffic.channels} months={traffic.window.months} />
            </>
          ) : (
            <div className="rounded-xl border border-surface bg-surface-900/50 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15">
                <Globe className="h-6 w-6 text-indigo-400" aria-hidden />
              </div>
              <p className="text-base font-semibold text-surface-100">Traffic Channel Recovery</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-surface-400">
                This view needs a website traffic file (DATA-SPEC.md, the optional GA4 export by
                month and channel). Drop one in and it fills in. The CRM Sources view is complete
                without it.
              </p>
            </div>
          )
        ) : (
          <>
            <RecoveryKpiCards items={kpis} />

            <HowItWorks />

            <RecoveryList
              sources={sources}
              expandedSource={expanded}
              onExpandChange={setExpanded}
              onView={() => {}}
              onCompare={() => {}}
              tagFor={(s) =>
                s.storesAffected.length === 1
                  ? "1 store"
                  : `${s.storesAffected.length} stores`
              }
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
