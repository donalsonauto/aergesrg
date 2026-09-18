// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// InlineTrendChart — a compact series shown inside a tool result or chat answer.
// Line color follows direction: green if trending up, red on an anomaly (a zero
// after activity), amber when flat (mirrors the v2 InlineTrendChart logic).

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth, formatValue, type DataType } from "@/lib/format";
import { TOKEN } from "@/lib/ui";

function trendColor(values: number[]): string {
  if (values.length < 3) return TOKEN.info;
  // anomaly: a zero right after two non-zero months
  for (let i = 2; i < values.length; i++) {
    if (values[i] === 0 && values[i - 1] > 0 && values[i - 2] > 0) return TOKEN.danger;
  }
  const first3 = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const last3 = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
  if (last3 >= first3) return TOKEN.success;
  return TOKEN.warning;
}

export function InlineTrendChart({
  title,
  series,
  dataType = "int",
  height = 140,
}: {
  title?: string;
  series: { month: string; value: number }[];
  dataType?: DataType;
  height?: number;
}) {
  if (!series?.length) return null;
  const values = series.map((s) => s.value);
  const color = trendColor(values);
  const gradId = `inline-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <span className="kpi-label">{title}</span>
          <span className="text-[10px] text-surface-400">{series.length} mo</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: TOKEN.muted }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.floor(series.length / 6) - 1)}
            tickFormatter={(m) => formatMonth(String(m))}
          />
          <YAxis
            tick={{ fontSize: 9, fill: TOKEN.muted }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => formatValue(v, dataType)}
          />
          <Tooltip
            cursor={{ stroke: TOKEN.line }}
            contentStyle={{
              background: TOKEN.elevated,
              border: `1px solid ${TOKEN.line}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: TOKEN.fg }}
            labelFormatter={(m) => formatMonth(String(m))}
            formatter={(v) => [formatValue(Number(v), dataType), ""] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
