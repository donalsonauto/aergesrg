// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import { useState } from "react";
import FilterBar from "./FilterBar";
import RecoverySourceRow from "./RecoverySourceRow";
import type { RecoveryResult, Rooftop } from "@/lib/types";
import { formatCompactMoney, formatUnits, formatMonthLong } from "@/lib/format";

function Kpi({
  label, value, sub, accent,
}: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: accent
          ? "linear-gradient(160deg, rgba(124,108,255,0.16), rgba(124,108,255,0.04))"
          : "var(--bg-card)",
        border: accent ? "1px solid rgba(124,108,255,0.45)" : "1px solid var(--border)",
      }}
    >
      <div className="text-[11px] font-medium uppercase mb-3" style={{ color: "var(--fg-muted)", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div className="text-4xl font-bold leading-none tnum" style={{ color: "var(--fg)" }}>{value}</div>
      <div className="text-[12px] mt-2" style={{ color: "var(--fg-muted)" }}>{sub}</div>
    </div>
  );
}

export default function RecoveryView({
  initial, rooftops, leadTypes,
}: {
  initial: RecoveryResult;
  rooftops: Rooftop[];
  leadTypes: string[];
}) {
  const [r, setR] = useState<RecoveryResult>(initial);
  const [loading, setLoading] = useState(false);
  // Lead-type filter isn't part of RecoveryResult, so track it locally for the bar.
  const [leadType, setLeadType] = useState<string | null>(null);

  async function applyFilter(patch: { store?: string | null; leadType?: string | null; years?: number }) {
    const next = {
      store: patch.store !== undefined ? patch.store : r.store,
      leadType: patch.leadType !== undefined ? patch.leadType : leadType,
      years: patch.years !== undefined ? patch.years : r.years,
    };
    setLoading(true);
    const params = new URLSearchParams({ years: String(next.years) });
    if (next.store) params.set("store", next.store);
    if (next.leadType) params.set("leadType", next.leadType);
    const res = await fetch(`/api/recovery?${params.toString()}`);
    setR(await res.json());
    setLoading(false);
  }

  const recoverable = r.sources.filter((s) => s.status === "dormant" || s.status === "declining");
  const feedLost = r.sources.filter((s) => s.status === "feed_lost");
  const steady = r.sources.filter((s) => s.status === "steady");

  return (
    <>
      <FilterBar
        rooftops={rooftops}
        leadTypes={leadTypes}
        store={r.store}
        leadType={leadType}
        years={r.years}
        loading={loading}
        onChange={(p) => {
          if (p.leadType !== undefined) setLeadType(p.leadType);
          applyFilter(p);
        }}
      />

      {r.windowShort && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-[13px]"
          style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)", color: "var(--warning)" }}
        >
          Short window: a source that went dormant before {formatMonthLong(r.from)} has no rows in range and drops off
          this list entirely. 3 years is recommended so planted dormant sources stay visible.
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi accent label="Est. Monthly Revenue" value={formatCompactMoney(r.estMonthlyRevenue)} sub="recoverable if re-activated" />
        <Kpi label="Est. Monthly Sales" value={formatUnits(Math.round(r.estMonthlySales * 10) / 10)} sub="units / month potential" />
        <Kpi label="Feed Lost?" value={String(r.feedLostCount)} sub="check the feed, not the vendor" />
        <Kpi label="Dormant Sources" value={String(r.dormantCount)} sub="no activity recently" />
        <Kpi label="Declining Sources" value={String(r.decliningCount)} sub="< 30% of peak performance" />
      </section>

      {r.store && (
        <p className="mt-3 text-[12px]" style={{ color: "var(--info)" }}>
          Recomputed for {r.scopeLabel}, not additive to the group. A source can be steady group-wide and dormant here;
          the group headline is not the sum of the twelve rooftop headlines.
        </p>
      )}

      {/* Assumption */}
      <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--fg-muted)", maxWidth: 900 }}>
        We analyzed {r.totalMonths} months of CRM data ({r.from === "-" ? "no data" : `${formatMonthLong(r.from)} to ${formatMonthLong(r.to)}`}){" "}
        and found lead sources that previously generated sales and are now dormant or significantly declined. The estimate
        assumes each source returns to its own historical monthly sales rate (historical minus recent) at its own average
        gross per sale. Sources with fewer than 5 sales are excluded from the total, and a lead feed that went dark at a
        store (feed loss) is flagged separately and excluded, not counted as recoverable.
      </p>

      {/* Ranked list */}
      <section className="mt-6 flex flex-col gap-2">
        {recoverable.length === 0 && (
          <div className="rounded-xl p-6 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}>
            No dormant or declining sources in this scope and window.
          </div>
        )}
        {recoverable.map((s) => (
          <RecoverySourceRow key={s.source} s={s} />
        ))}

        {feedLost.length > 0 && (
          <>
            <div className="mt-4 text-[11px] uppercase" style={{ color: "var(--info)", letterSpacing: "0.08em" }}>
              Feed loss (excluded from the total)
            </div>
            {r.feedLoss.map((fl) => (
              <div
                key={fl.leadType}
                className="rounded-lg px-4 py-3 text-[13px]"
                style={{ background: "color-mix(in srgb, var(--info) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--info) 40%, transparent)", color: "var(--info)" }}
              >
                The <strong>{fl.leadType}</strong> feed at {r.scopeLabel} went dark in {formatMonthLong(fl.firstMissingMonth)}:
                all {fl.sourceCount} {fl.leadType} sources dropped to zero the same month.{" "}
                {fl.storeKeptSelling
                  ? `The store kept selling (${fl.salesBefore}→${fl.salesAfter} sales/mo), so this is a dead CRM feed, not lost business.`
                  : `Store sales fell too (${fl.salesBefore}→${fl.salesAfter} sales/mo), so confirm whether this is a feed or real decline.`}{" "}
                These sources are excluded from recoverable revenue: check the feed, not the vendor.
              </div>
            ))}
            {feedLost.map((s) => (
              <RecoverySourceRow key={s.source} s={s} />
            ))}
          </>
        )}

        {steady.length > 0 && (
          <>
            <div className="mt-4 text-[11px] uppercase" style={{ color: "var(--fg-muted)", letterSpacing: "0.08em" }}>
              Steady sources (context, not in the total)
            </div>
            {steady.map((s) => (
              <RecoverySourceRow key={s.source} s={s} />
            ))}
          </>
        )}
      </section>
    </>
  );
}
