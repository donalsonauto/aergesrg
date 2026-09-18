// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// TrendCard: "Leads vs Sales", the six-month line chart in the first column of
// v2's trend / health / do-this-now row. Two series, each on its own hidden
// axis so the smaller one never flattens into the baseline.

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth } from "@/lib/format";
import { TOKEN } from "@/lib/ui";
import { SectionCard } from "./SectionCard";

export interface TrendCardProps {
  title?: string;
  labels: string[];
  leads: number[];
  sales: number[];
  rangeLabel?: string;
  onAsk?: () => void;
  className?: string;
}

export function TrendCard({
  title = "Leads vs Sales",
  labels,
  leads,
  sales,
  rangeLabel = "Last 6 months",
  onAsk,
  className,
}: TrendCardProps) {
  const data = labels.map((l, i) => ({ month: formatMonth(l), leads: leads[i], sales: sales[i] }));
  return (
    <SectionCard
      title={title}
      onAsk={onAsk}
      askLabel="Ask AI about this trend"
      right={<span className="text-xs text-surface-400">{rangeLabel}</span>}
      className={className}
    >
      <div className="min-h-[220px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={TOKEN.grid} />
              <XAxis
                dataKey="month"
                tick={{ fill: TOKEN.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis yAxisId="leads" hide domain={["auto", "auto"]} />
              <YAxis yAxisId="sales" hide orientation="right" domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: TOKEN.card,
                  border: `1px solid ${TOKEN.line}`,
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: TOKEN.muted }}
              />
              <Line
                yAxisId="leads"
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke={TOKEN.accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke={TOKEN.success}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-surface-400">
            No trend data
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-surface-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: TOKEN.accent }} /> Leads
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: TOKEN.success }} /> Sales
        </span>
      </div>
    </SectionCard>
  );
}
