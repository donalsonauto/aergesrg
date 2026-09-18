// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// MonthlyTrendChart — 12-month line for the current metric, violet with a soft
// area fill and an optional dashed last-year comparison. Dark tooltip, month as
// heading, horizontal grid only (DESIGN.md).

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
import { Card } from "../primitives";
import { compactMoney, formatMonth, formatValue, type DataType } from "@/lib/format";
import { TOKEN } from "@/lib/ui";

export interface MonthlyTrend {
  labels: string[];
  current: number[];
  lastYear?: number[] | null;
}

export function MonthlyTrendChart({
  trend,
  dataType = "int",
  title = "Monthly Trend",
}: {
  trend: MonthlyTrend;
  dataType?: DataType;
  title?: string;
}) {
  const data = trend.labels.map((label, i) => ({
    label,
    current: trend.current[i],
    lastYear: trend.lastYear?.[i],
  }));

  return (
    <Card className="p-4">
      <div className="mb-3 kpi-label">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="mt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKEN.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={TOKEN.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={TOKEN.line} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: TOKEN.muted }}
            tickLine={false}
            axisLine={false}
            interval={2}
            tickFormatter={(m) => formatMonth(String(m))}
          />
          <YAxis
            tick={{ fontSize: 10, fill: TOKEN.muted }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) =>
              dataType === "money"
                ? compactMoney(v).replace("$", "")
                : formatValue(v, dataType)
            }
          />
          <Tooltip
            cursor={{ stroke: TOKEN.line }}
            contentStyle={{
              background: TOKEN.elevated,
              border: `1px solid ${TOKEN.line}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: TOKEN.fg, fontWeight: 600 }}
            labelFormatter={(m) => formatMonth(String(m))}
            formatter={(value, name) =>
              [
                formatValue(Number(value), dataType),
                name === "current" ? "This year" : "Last year",
              ] as [string, string]
            }
          />
          {trend.lastYear && (
            <Line
              type="monotone"
              dataKey="lastYear"
              stroke={TOKEN.muted}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="current"
            stroke={TOKEN.accent}
            strokeWidth={2}
            fill="url(#mt-fill)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
