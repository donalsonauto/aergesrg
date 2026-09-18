// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Three-axis monthly timeline for a recovery source, matched to the live v2
// Performance Timeline: sales as a violet area on the left axis, leads as a
// blue line on a right axis, close % as a dashed orange line on a second right
// axis, every axis with its own ticks and title, and a circle legend on top.
// A dead source reads as a cliff because each series keeps its own scale.

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth, pct, units, int } from "@/lib/format";
import { TOKEN } from "@/lib/ui";
import type { RecoveryTimelinePoint } from "@/lib/demo-types";

const AXIS = { fontSize: 11, fill: TOKEN.axis };
const CLOSE = "#fb923c"; // orange-400, the live chart's close % color

function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const row = (color: string, name: string, value: string) => (
    <div className="flex items-center gap-2 text-surface-400">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name} <span className="ml-auto tabular-nums text-surface-100">{value}</span>
    </div>
  );
  return (
    <div className="min-w-[150px] rounded-lg border border-surface bg-surface-900 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-surface-100">{formatMonth(String(label))}</div>
      {row(TOKEN.accent, "Sales", units(get("sales") ?? 0))}
      {row(TOKEN.info, "Leads", int(get("leads") ?? 0))}
      {row(CLOSE, "Close %", pct(get("closingRate") ?? 0))}
    </div>
  );
}

export interface ThreeAxisTimelineProps {
  data: RecoveryTimelinePoint[];
  height?: number;
  /** Show the circle legend above the chart (the live page does). */
  legend?: boolean;
}

export function ThreeAxisTimeline({ data, height = 380, legend = true }: ThreeAxisTimelineProps) {
  if (!data?.length) return null;
  const tickEvery = data.length > 18 ? 4 : data.length > 8 ? 2 : 1;
  const maxClose = Math.max(...data.map((d) => d.closingRate), 0);
  return (
    <div>
      {legend && (
        <div className="mb-1 flex items-center justify-center gap-5 text-xs text-surface-300">
          <LegendCircle color={TOKEN.accent} label="Sales" />
          <LegendCircle color={TOKEN.info} label="Leads" />
          <LegendCircle color={CLOSE} label="Close %" />
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rec-sales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKEN.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={TOKEN.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={TOKEN.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            interval={tickEvery - 1}
            tickFormatter={(m) => formatMonth(String(m))}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            yAxisId="sales"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={40}
            label={{ value: "Sales", angle: -90, position: "insideLeft", fill: TOKEN.axis, fontSize: 11, dx: 8 }}
          />
          <YAxis
            yAxisId="leads"
            orientation="right"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => int(Number(v))}
            label={{ value: "Leads", angle: 90, position: "insideRight", fill: TOKEN.axis, fontSize: 11, dx: -6 }}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={{ fontSize: 11, fill: CLOSE }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, Math.max(10, Math.ceil(maxClose / 10) * 10)]}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            label={{ value: "Close %", angle: 90, position: "insideRight", fill: CLOSE, fontSize: 11, dx: -6 }}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ stroke: TOKEN.line }} />
          <Area
            yAxisId="sales"
            type="monotone"
            dataKey="sales"
            stroke={TOKEN.accent}
            strokeWidth={2}
            fill="url(#rec-sales)"
            isAnimationActive={false}
            dot={{ r: 2, fill: TOKEN.accent, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="leads"
            type="monotone"
            dataKey="leads"
            stroke={TOKEN.info}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="closingRate"
            stroke={CLOSE}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendCircle({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-4 w-4 rounded-full border-[3px]" style={{ borderColor: color }} />
      {label}
    </span>
  );
}
