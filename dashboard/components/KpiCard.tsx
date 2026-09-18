// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KpiCard as KpiCardData } from "@/lib/types";
import {
  formatCompactMoney,
  formatUnits,
  formatPercent,
  formatMonthShort,
} from "@/lib/format";

function valueFormatter(key: string): (v: number) => string {
  if (key === "gross") return formatCompactMoney;
  if (key === "closing") return (v) => formatPercent(v);
  return formatUnits;
}

function ChartTooltip({
  active,
  payload,
  cardKey,
  color,
}: {
  active?: boolean;
  payload?: { payload: { period: string; value: number } }[];
  cardKey: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const fmt = valueFormatter(cardKey);
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--fg-muted)", marginBottom: 2 }}>
        {formatMonthShort(p.period)}
      </div>
      <div style={{ color, fontWeight: 600 }} className="tnum">
        {fmt(p.value)}
      </div>
    </div>
  );
}

export default function KpiCard({
  card,
  onClick,
}: {
  card: KpiCardData;
  onClick?: () => void;
}) {
  const { key, label, value, deltaPct, higherIsBetter, accent, color, series } = card;

  const good =
    deltaPct == null
      ? null
      : deltaPct === 0
      ? null
      : (deltaPct > 0) === higherIsBetter;
  const deltaColor =
    good == null ? "var(--fg-muted)" : good ? "var(--success)" : "var(--danger)";
  const arrow = deltaPct == null || deltaPct === 0 ? "" : deltaPct > 0 ? "▲" : "▼";

  const gradId = `grad-${key}`;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-xl p-6 flex flex-col gap-4 transition-colors ${
        onClick ? "cursor-pointer hover:brightness-110" : ""
      }`}
      style={{
        background: accent
          ? "linear-gradient(160deg, rgba(124,108,255,0.16), rgba(124,108,255,0.04))"
          : "var(--bg-card)",
        border: accent
          ? "1px solid rgba(124,108,255,0.45)"
          : "1px solid var(--border)",
      }}
    >
      <div
        className="text-[11px] font-medium uppercase"
        style={{ color: "var(--fg-muted)", letterSpacing: "0.08em" }}
      >
        {label}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="text-4xl font-bold leading-none tnum" style={{ color: "var(--fg)" }}>
          {value}
        </div>
        <div className="text-sm font-medium tnum whitespace-nowrap" style={{ color: deltaColor }}>
          {deltaPct == null ? (
            <span style={{ color: "var(--fg-muted)" }}>no prior month</span>
          ) : (
            <>
              {arrow} {Math.abs(deltaPct).toFixed(1)}%
            </>
          )}
        </div>
      </div>

      <div style={{ height: 56, marginLeft: -4, marginRight: -4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={accent ? 0.35 : 0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="period" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={<ChartTooltip cardKey={key} color={color} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: "var(--bg)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div
        className="text-[11px] flex items-center justify-between"
        style={{ color: "var(--fg-muted)" }}
      >
        <span>Last {series.length} months</span>
        {onClick && <span>Drill in ↗</span>}
      </div>
    </div>
  );
}
