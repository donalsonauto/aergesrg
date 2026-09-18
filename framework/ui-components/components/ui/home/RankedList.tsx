// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RankedList: v2's "Top Lead Sources" and "Rankings by Property" panels share
// this: a numbered list (top three in the accent color), a value, a change
// percent, and an optional proportional bar. A metric toggle in the header
// switches what the value means.

import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
import { SectionCard } from "./SectionCard";

export interface RankedItem {
  id: string;
  label: string;
  /** Already formatted for display. */
  value: string;
  /** Raw number, for the bar width. */
  raw: number;
  change?: number | null;
}

export interface RankedListProps {
  title: string;
  items: RankedItem[];
  subtitle?: string;
  /** Show a bar under each row, scaled to the largest item. */
  bars?: boolean;
  toggle?: {
    options: Array<{ key: string; label: string }>;
    selected: string;
    onSelect: (key: string) => void;
  };
  emptyText?: string;
  onSelect?: (item: RankedItem) => void;
  onAsk?: () => void;
  icon?: ReactNode;
  className?: string;
}

function Change({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="w-14 shrink-0 text-right text-[11px] text-surface-400">--</span>;
  const tone = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-surface-400";
  return (
    <span className={cn("w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums", tone)}>
      {value > 0 ? "+" : ""}
      {value.toFixed(0)}%
    </span>
  );
}

export function RankedList({
  title,
  items,
  subtitle,
  bars = false,
  toggle,
  emptyText = "Nothing to rank for this period.",
  onSelect,
  onAsk,
  icon,
  className,
}: RankedListProps) {
  const max = Math.max(...items.map((i) => i.raw), 0) || 1;
  return (
    <SectionCard
      title={title}
      icon={icon}
      onAsk={onAsk}
      className={className}
      right={
        toggle ? (
          <div className="inline-flex rounded-lg border border-surface bg-surface-900 p-0.5">
            {toggle.options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => toggle.onSelect(o.key)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                  toggle.selected === o.key
                    ? "bg-indigo-500 text-white"
                    : "text-surface-500 hover:text-surface-200",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : subtitle ? (
          <span className="text-xs text-surface-400">{subtitle}</span>
        ) : null
      }
    >
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div
              key={it.id}
              onClick={onSelect ? () => onSelect(it) : undefined}
              className={cn("flex items-center gap-3", onSelect && "cursor-pointer")}
            >
              <span
                className={cn(
                  "w-5 shrink-0 text-right text-[11px] font-bold",
                  i < 3 ? "text-indigo-500" : "text-surface-400",
                )}
              >
                {i + 1}
              </span>
              {bars ? (
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-surface-300">{it.label}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs font-bold text-surface-0 tabular-nums">{it.value}</span>
                      {it.change != null && (
                        <span
                          className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            it.change > 0 ? "text-green-400" : it.change < 0 ? "text-red-400" : "text-surface-400",
                          )}
                        >
                          {it.change > 0 ? "+" : ""}
                          {it.change.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                      style={{ width: `${(it.raw / max) * 100}%`, opacity: 1 - i * 0.06 }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-surface-300">{it.label}</span>
                  <span className="shrink-0 text-sm font-bold text-surface-0 tabular-nums">{it.value}</span>
                  <Change value={it.change} />
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-surface-400">{emptyText}</div>
      )}
    </SectionCard>
  );
}
