// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HeroKpiCard: one of the four big tiles at the top of the home page, ported
// from v2's hero KPI row. Label row (label, ask button), big value with the
// month-over-month badge and the absolute change, a "Prev / LY" line, and a
// full-width area sparkline in the tile's own color with last year dashed.

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/ui";
import { changeColor, formatValue, pctChange, type DataType } from "@/lib/format";
import { AskButton } from "./AskButton";

export interface HeroKpiCardProps {
  label: string;
  value: number | null;
  prior?: number | null;
  lastYear?: number | null;
  dataType: DataType;
  /** Line and fill color (hex). */
  color: string;
  spark?: number[];
  sparkLabels?: string[];
  sparkLastYear?: Array<number | null>;
  /** Cost metric: a rise is bad. */
  invert?: boolean;
  onClick?: () => void;
  onAsk?: () => void;
  className?: string;
}

function countChange(value: number | null, prior: number | null | undefined) {
  if (value == null || prior == null) return null;
  const diff = value - prior;
  if (diff === 0) return null;
  const rounded = Math.abs(diff) < 10 ? Math.round(diff * 10) / 10 : Math.round(diff);
  return (rounded > 0 ? "+" : "") + rounded.toLocaleString("en-US");
}

export function HeroKpiCard({
  label,
  value,
  prior,
  lastYear,
  dataType,
  color,
  spark,
  sparkLabels,
  sparkLastYear,
  invert = false,
  onClick,
  onAsk,
  className,
}: HeroKpiCardProps) {
  const pctVal = pctChange(value, prior);
  const tone = changeColor(pctVal, invert);
  const count = countChange(value, prior);
  const badge =
    tone === "positive"
      ? "bg-green-500/20 text-green-400"
      : tone === "negative"
        ? "bg-red-500/20 text-red-400"
        : "bg-surface-800 text-surface-400";
  const countTone =
    tone === "positive" ? "text-green-400" : tone === "negative" ? "text-red-400" : "text-surface-400";

  const data = (spark ?? []).map((v, i) => ({
    i,
    label: sparkLabels?.[i] ?? String(i),
    v,
    ly: sparkLastYear?.[i] ?? null,
  }));
  const gradId = `hero-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-surface bg-surface-900/50 shadow-[0px_1px_2px_0px_rgba(18,18,23,0.05)]",
        onClick && "cursor-pointer transition-colors hover:border-indigo-400/60",
        className,
      )}
    >
      <div className="px-4 pt-3.5 pb-1">
        <div className="flex items-start gap-2">
          <span className="flex-1 text-sm font-medium text-surface-400">{label}</span>
          <AskButton label={`Ask AI about ${label}`} onClick={onAsk} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-surface-0 tabular-nums">
            {value != null ? formatValue(value, dataType) : "--"}
          </span>
          {pctVal != null && (
            <span className={cn("rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums", badge)}>
              {pctVal > 0 ? "+" : ""}
              {pctVal.toFixed(1)}%
            </span>
          )}
          {count != null && (
            <span className={cn("text-[12px] font-medium tabular-nums", countTone)}>{count}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-surface-400">
          {prior != null && <span>Prev: {formatValue(prior, dataType)}</span>}
          {lastYear != null && <span>LY: {formatValue(lastYear, dataType)}</span>}
        </div>
      </div>
      {data.length >= 2 ? (
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Hidden axis so the tooltip labels read as months, not 0, 1, 2. */}
              <XAxis dataKey="label" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                cursor={{ stroke: color, strokeDasharray: "4 2", strokeWidth: 1 }}
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 11,
                  padding: "4px 8px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(v, name) => [
                  formatValue(typeof v === "number" ? v : Number(v), dataType),
                  name === "ly" ? "Last year" : "Actual",
                ]}
              />
              {sparkLastYear && (
                <Line
                  type="monotone"
                  dataKey="ly"
                  stroke="#71717a"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: color, stroke: "#09090b" }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-16 items-center px-3">
          <div className="h-[1.5px] w-full rounded-full opacity-30" style={{ backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}
