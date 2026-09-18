// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HealthByStore: v2's twelve-month health trendline, one line per store plus
// the group average dashed, with store chips underneath to toggle lines.

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@/lib/format";
import { cn, SERIES_COLORS, TOKEN } from "@/lib/ui";
import type { HomeHealthByStore } from "@/lib/demo-types";
import { SectionCard } from "./SectionCard";

export function HealthByStore({ data, onAsk }: { data: HomeHealthByStore; onAsk?: () => void }) {
  const [active, setActive] = useState<Set<string>>(() => new Set(data.stores));
  const rows = data.labels.map((l, i) => {
    const r: Record<string, string | number | null> = { month: formatMonth(l), Average: data.average[i] };
    for (const s of data.stores) r[s] = data.series[s][i];
    return r;
  });
  const latest = (s: string) => data.series[s][data.series[s].length - 1];
  return (
    <SectionCard title="Health By Store" onAsk={onAsk} right={<span className="text-xs text-surface-400">Last 12 months</span>}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke={TOKEN.grid} />
            <XAxis dataKey="month" tick={{ fill: TOKEN.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: TOKEN.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: TOKEN.card, border: `1px solid ${TOKEN.line}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TOKEN.muted }} />
            <Line type="monotone" dataKey="Average" stroke="#a1a1aa" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            {data.stores.map((s, i) =>
              active.has(s) ? (
                <Line key={s} type="monotone" dataKey={s} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 border-t border-surface pt-3">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">Stores</span>
          <button type="button" onClick={() => setActive(new Set(data.stores))} className="rounded-md bg-surface-800 px-2 py-0.5 text-[10px] text-surface-400 hover:bg-surface-700">All</button>
          <button type="button" onClick={() => setActive(new Set())} className="rounded-md bg-surface-800 px-2 py-0.5 text-[10px] text-surface-400 hover:bg-surface-700">Clear</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.stores.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setActive((a) => { const n = new Set(a); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all",
                active.has(s) ? "border-indigo-400 bg-indigo-900/20 text-indigo-300" : "border-surface-700 text-surface-400 hover:border-surface-600",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <span className="max-w-[120px] truncate">{s}</span>
              <span className="tabular-nums opacity-60">{latest(s)}</span>
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
