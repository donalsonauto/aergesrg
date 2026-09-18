// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RecoveryKpiCards — the four KPI cards at the top of the Revenue Recovery
// screen. Only the FIRST card carries the indigo gradient wash and the indigo
// border; the other three are neutral, which is what the live page does (and
// what DESIGN.md means by "one bright color per card" — four equally bright
// cards read as noise).
//
// Measured on the live page at 1512px and reproduced at a 14px root:
//   card    284 x 105, rounded-xl (10.5px), p-5 (17.5px), 1px border
//   accent  border indigo-500/20, indigo gradient wash, indigo-400 label
//   neutral border-surface (surface-700), bg-surface-900, surface-400 label
//   label   text-xs (10.5px) / font-medium / tracking-wider / uppercase
//   value   text-3xl (26.25px) / font-bold / white
//   sub     text-[10px] / surface-400

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface RecoveryKpi {
  key: string;
  /** Uppercase micro-label, e.g. "EST. MONTHLY REVENUE". */
  label: string;
  /** Pre-formatted value, e.g. "$222.3K". Formatting stays in the page. */
  value: string;
  /** Muted one-liner under the value, e.g. "recoverable if re-activated". */
  sub?: string;
  icon: LucideIcon;
  /**
   * Carries the indigo gradient wash and indigo label. Defaults to the first
   * card only; set it explicitly to move or suppress the accent.
   */
  accent?: boolean;
  onClick?: () => void;
}

export interface RecoveryKpiCardsProps {
  items: RecoveryKpi[];
  className?: string;
}

export function RecoveryKpiCards({ items, className }: RecoveryKpiCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {items.map((kpi, i) => {
        const Icon = kpi.icon;
        const accent = kpi.accent ?? i === 0;
        return (
          <div
            key={kpi.key}
            onClick={kpi.onClick}
            className={cn(
              "rounded-xl border p-5",
              accent
                ? "border-indigo-500/20 bg-gradient-to-br from-indigo-500/20 to-violet-500/20"
                : "border-surface bg-surface-900",
              kpi.onClick &&
                "cursor-pointer transition-colors hover:border-indigo-500/40",
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon
                className={cn(
                  "h-3 w-3 shrink-0",
                  accent ? "text-indigo-400" : "text-surface-400",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "flex-1 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
                  accent ? "text-indigo-400" : "text-surface-400",
                )}
              >
                {kpi.label}
              </span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
              {kpi.value}
            </div>
            {kpi.sub && (
              <p className="mt-1 text-[10px] text-surface-400">{kpi.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
