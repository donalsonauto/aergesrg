// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import { useState } from "react";
import KpiCard from "./KpiCard";
import DrillModal from "./DrillModal";
import FilterBar from "./FilterBar";
import type { DashboardData, KpiCard as KpiCardData } from "@/lib/types";
import { formatMonthLong, formatMonthShort } from "@/lib/format";

// The interactive dashboard container. Owns the filter (rooftop, lead type, date
// range); on any change it refetches every card from /api/kpis so the whole
// screen recalculates from one place. The same filter is handed to the drill
// modal, so a drill starts inside the current scope.
export default function KpiGrid({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initial);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<KpiCardData | null>(null);

  async function applyFilter(patch: {
    store?: string | null;
    leadType?: string | null;
    years?: number;
  }) {
    const next = {
      store: patch.store !== undefined ? patch.store : data.store,
      leadType: patch.leadType !== undefined ? patch.leadType : data.leadType,
      years: patch.years !== undefined ? patch.years : data.years,
    };
    setOpen(null); // a drill belongs to the scope it was opened in
    setLoading(true);
    const params = new URLSearchParams({ years: String(next.years) });
    if (next.store) params.set("store", next.store);
    if (next.leadType) params.set("leadType", next.leadType);
    const res = await fetch(`/api/kpis?${params.toString()}`);
    setData(await res.json());
    setLoading(false);
  }

  const storeName = data.store
    ? data.rooftops.find((r) => r.id === data.store)?.name ?? data.store
    : null;
  const monthLabel = data.month === "-" ? "no data" : formatMonthLong(data.month);
  const priorLabel = data.priorMonth ? formatMonthLong(data.priorMonth) : null;
  const rangeLabel =
    data.from === "-" ? "" : `${formatMonthShort(data.from)}–${formatMonthShort(data.to)}`;

  return (
    <>
      <FilterBar
        rooftops={data.rooftops}
        leadTypes={data.leadTypes}
        store={data.store}
        leadType={data.leadType}
        years={data.years}
        loading={loading}
        onChange={applyFilter}
      />

      {data.cards.length === 0 ? (
        <div
          className="rounded-xl p-8 text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
        >
          No data for this filter. Try a wider date range or a different rooftop / lead type.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.cards.map((card) => (
              <KpiCard key={card.key} card={card} onClick={() => setOpen(card)} />
            ))}
          </section>

          <footer
            className="mt-6 pt-5 text-sm"
            style={{ borderTop: "1px solid var(--border)", color: "var(--fg-muted)" }}
          >
            <p>
              Showing <span style={{ color: "var(--fg)" }}>{monthLabel}</span>
              {priorLabel ? <> &middot; change measured against {priorLabel}</> : <> &middot; no prior month to compare</>}
            </p>
            <p className="mt-1">
              Scope:{" "}
              <span style={{ color: "var(--fg)" }}>
                {storeName ?? `all ${data.rooftops.length} rooftops`}
              </span>
              {data.leadType && <> &middot; {data.leadType} leads</>} &middot; last {data.years}{" "}
              {data.years === 1 ? "year" : "years"} ({rangeLabel})
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(storeName ? data.rooftops.filter((r) => r.id === data.store) : data.rooftops).map((r) => (
                <span
                  key={r.id}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--fg-muted)",
                  }}
                >
                  {r.name}
                </span>
              ))}
            </div>
          </footer>
        </>
      )}

      {open && (
        <DrillModal
          metricKey={open.key}
          metricLabel={open.label}
          color={open.color}
          baseStore={data.store ? { id: data.store, label: storeName ?? data.store } : null}
          leadType={data.leadType}
          from={data.from}
          to={data.to}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
