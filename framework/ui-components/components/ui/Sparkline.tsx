// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Tiny 12-point trend line with a soft area fill, in the KpiCard footer.
// Color follows the metric's accent (or a positive/negative override).

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({
  data,
  color,
  height = 44,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center px-1" style={{ height }}>
        <div
          className="h-px w-full rounded-full opacity-30"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  const chartData = data.map((v, i) => ({ i, v }));
  const min = Math.min(...data);
  const max = Math.max(...data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[min - (max - min) * 0.1, max + (max - min) * 0.1]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${gradId})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
