// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import { useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RecoverySource } from "@/lib/types";
import {
  formatCompactMoney,
  formatMoneyWhole,
  formatUnits,
  formatPercent,
  formatMonthShort,
  formatMonthLong,
} from "@/lib/format";

const STATUS: Record<RecoverySource["status"], { label: string; color: string }> = {
  dormant: { label: "Dormant", color: "var(--danger)" },
  declining: { label: "Declining", color: "var(--warning)" },
  feed_lost: { label: "Feed lost", color: "var(--info)" },
  steady: { label: "Steady", color: "var(--fg-muted)" },
};

function Pill({ status }: { status: RecoverySource["status"] }) {
  const s = STATUS[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase" style={{ color: "var(--fg-muted)", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="text-lg font-semibold tnum" style={{ color: "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}

export default function RecoverySourceRow({ s }: { s: RecoverySource }) {
  const [open, setOpen] = useState(false);
  const estLabel =
    s.status === "feed_lost"
      ? "feed lost, excluded"
      : s.status === "steady"
      ? "steady, not in total"
      : s.insufficientData
      ? "insufficient data"
      : formatCompactMoney(s.estimatedMonthlyRevenue) + "/mo";
  const estColor =
    s.status === "feed_lost"
      ? "var(--info)"
      : s.status === "steady" || s.insufficientData
      ? "var(--fg-muted)"
      : "var(--accent)";

  const newPct = s.newSales + s.usedSales > 0 ? (s.newSales / (s.newSales + s.usedSales)) * 100 : 0;
  // Safe SVG gradient id: source names contain dots/spaces (Cars.com, Facebook
  // Marketplace) which are invalid in a url(#id) reference and drop the fill.
  const gradId = "rr-" + s.source.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {/* Collapsed row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span style={{ color: "var(--fg-muted)", width: 14 }}>{open ? "▾" : "▸"}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: "var(--fg)" }}>{s.source}</span>
            <Pill status={s.status} />
            {s.leadType && (
              <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{s.leadType}</span>
            )}
          </span>
        </span>
        <span className="hidden md:block text-right tnum text-sm" style={{ color: "var(--fg-muted)", width: 90 }}>
          {formatUnits(Math.round(s.peakMonthlySales * 10) / 10)}<span className="text-[11px]"> peak/mo</span>
        </span>
        <span className="hidden md:block text-right tnum text-sm" style={{ color: "var(--fg-muted)", width: 90 }}>
          {formatUnits(s.totalSales)}<span className="text-[11px]"> sales</span>
        </span>
        <span className="hidden lg:block text-right tnum text-sm" style={{ color: "var(--fg-muted)", width: 80 }}>
          {formatPercent(s.closingRatio)}<span className="text-[11px]"> close</span>
        </span>
        <span className="hidden lg:block text-right tnum text-sm" style={{ color: "var(--fg-muted)", width: 90 }}>
          {s.status === "dormant" || s.status === "feed_lost" ? `${s.monthsInactive}mo` : "-"}
          <span className="text-[11px]"> inactive</span>
        </span>
        <span className="text-right tnum font-semibold" style={{ color: estColor, width: 130 }}>
          {estLabel}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <Metric label="Total sales" value={formatUnits(s.totalSales)} />
            <Metric label="Total leads" value={formatUnits(s.totalLeads)} />
            <Metric label="Total gross" value={formatCompactMoney(s.totalGross)} />
            <Metric label="Avg gross / sale" value={formatMoneyWhole(s.avgGrossPerSale)} />
          </div>

          {/* New vs used split */}
          <div className="mt-4">
            <div className="text-[11px] uppercase mb-1" style={{ color: "var(--fg-muted)", letterSpacing: "0.06em" }}>
              New vs used ({s.newSales} / {s.usedSales})
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
              <div style={{ width: `${newPct}%`, background: "var(--accent)" }} />
              <div style={{ width: `${100 - newPct}%`, background: "var(--success)" }} />
            </div>
            <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--fg-muted)" }}>
              <span>New {newPct.toFixed(1)}%</span>
              <span>Used {(100 - newPct).toFixed(1)}%</span>
            </div>
          </div>

          {/* Timeline: sales (area, left), leads (line, right), close% (dashed, far right) */}
          <div className="mt-5" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={s.timeline} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatMonthShort}
                  interval={3}
                  tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis yAxisId="sales" tick={{ fill: "var(--fg-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <YAxis yAxisId="leads" orientation="right" tick={{ fill: "var(--fg-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="close" orientation="right" hide />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => formatMonthShort(String(l))}
                  formatter={(v: number, name: string) =>
                    name === "Close %" ? [formatPercent(v), name] : [formatUnits(v), name]
                  }
                />
                <Area yAxisId="sales" type="monotone" dataKey="sales" name="Sales" stroke="var(--accent)" strokeWidth={2} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
                <Line yAxisId="leads" type="monotone" dataKey="leads" name="Leads" stroke="var(--info)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line yAxisId="close" type="monotone" dataKey="closing" name="Close %" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12px]" style={{ color: "var(--fg-muted)" }}>
            <span>Peak: {s.peakPeriod ? formatMonthLong(s.peakPeriod) : "-"} ({formatUnits(Math.round(s.peakMonthlySales * 10) / 10)}/mo)</span>
            <span>Last active: {s.lastActiveMonth ? formatMonthLong(s.lastActiveMonth) : "-"}</span>
            <span>Closing ratio: {formatPercent(s.closingRatio)}</span>
            <span>Active {s.activeMonths} of {s.totalMonths} months</span>
            <span>Evidence score: {s.evidenceScore}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}
