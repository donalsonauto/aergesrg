// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// StorePerformance: v2's three-column row. Sales by Store (ranked bars), New vs
// Used per store (stacked blue / amber bar), Gross by Store (ranked green bars).

import { compactMoney, int, pctChange } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { HomeStorePerformance } from "@/lib/demo-types";
import { SectionCard } from "./SectionCard";

function ChangePill({ current, previous }: { current: number; previous: number }) {
  const ch = pctChange(current, previous);
  if (ch == null || Math.abs(ch) < 0.5) return null;
  return (
    <span className={cn("rounded px-1 py-0.5 text-[8px] font-semibold tabular-nums", ch > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
      {ch > 0 ? "+" : ""}
      {ch.toFixed(0)}%
    </span>
  );
}

function RankedBars({
  rows,
  color,
  rankColor,
}: {
  rows: Array<{ label: string; value: number; prev: number; display: string }>;
  color: string;
  rankColor: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className={cn("w-4 text-right text-[10px] font-bold", i < 3 ? rankColor : "text-surface-400")}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="truncate pr-2 text-[11px] font-medium text-surface-300">{r.label}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-xs font-bold tabular-nums text-surface-0">{r.display}</span>
                <ChangePill current={r.value} previous={r.prev} />
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-800">
              <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${(r.value / max) * 100}%`, opacity: 1 - i * 0.07 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StorePerformance({
  stores,
  onAsk,
}: {
  stores: HomeStorePerformance[];
  onAsk?: (panel: "sales" | "split" | "gross") => void;
}) {
  const bySales = [...stores].sort((a, b) => b.sales - a.sales);
  const byGross = [...stores].sort((a, b) => b.gross - a.gross);
  const maxTotal = Math.max(...stores.map((s) => s.newSales + s.usedSales), 0) || 1;
  const hasSplit = stores.some((s) => s.newSales + s.usedSales > 0);
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2", hasSplit ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      <SectionCard title="Sales by Store" right={<span className="text-xs text-surface-400">Units</span>} onAsk={onAsk ? () => onAsk("sales") : undefined}>
        <RankedBars rows={bySales.map((s) => ({ label: s.store, value: s.sales, prev: s.prevSales, display: int(s.sales) }))} color="bg-indigo-500" rankColor="text-indigo-500" />
      </SectionCard>
      {hasSplit && (
        <SectionCard
          title="New vs Used"
          onAsk={onAsk ? () => onAsk("split") : undefined}
          right={
            <div className="flex items-center gap-2 text-[9px] text-surface-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> New</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> Used</span>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            {bySales.map((s) => (
              <div key={s.store}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="truncate pr-2 text-[11px] font-medium text-surface-300">{s.store}</span>
                  <span className="text-xs font-bold tabular-nums text-surface-0">{int(s.newSales + s.usedSales)}</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-800">
                  <div className="bg-blue-500 transition-all duration-700" style={{ width: `${(s.newSales / maxTotal) * 100}%` }} />
                  <div className="bg-amber-500 transition-all duration-700" style={{ width: `${(s.usedSales / maxTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <SectionCard title="Gross by Store" right={<span className="text-xs text-surface-400">Revenue</span>} onAsk={onAsk ? () => onAsk("gross") : undefined}>
        <RankedBars rows={byGross.map((s) => ({ label: s.store, value: s.gross, prev: s.prevGross, display: compactMoney(s.gross) }))} color="bg-green-500" rankColor="text-green-500" />
      </SectionCard>
    </div>
  );
}
