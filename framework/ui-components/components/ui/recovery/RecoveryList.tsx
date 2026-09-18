// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RecoveryList — the ranked stack of RecoveryRows, plus the loading and
// empty states from RevenueRecovery.vue. Rows sit 8px apart (space-y-2 at a
// 14px root), which is what the live page measures.
//
// Which row is open can be controlled (`expandedSource` + `onExpandChange`) or
// left to the component. Everything else is data in, callbacks out.

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { RecoveryRow } from "./RecoveryRow";
import { cn } from "@/lib/ui";
import type { RecoverySource } from "@/lib/demo-types";

export interface RecoveryListProps {
  sources: RecoverySource[];
  /** Controlled open row. Omit to let the list manage it. */
  expandedSource?: string | null;
  onExpandChange?: (source: string | null) => void;
  onView?: (source: RecoverySource) => void;
  /** The Compare button on each open row's timeline. */
  onCompare?: (source: RecoverySource) => void;
  /** Per-row TAG label, e.g. a vendor category or the store scope. */
  tagFor?: (source: RecoverySource) => string | undefined;
  loading?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  className?: string;
}

export function RecoveryList({
  sources,
  expandedSource,
  onExpandChange,
  onView,
  onCompare,
  tagFor,
  loading = false,
  emptyTitle = "All Clear!",
  emptyDetail = "No dormant or declining lead sources found.",
  className,
}: RecoveryListProps) {
  const [internal, setInternal] = useState<string | null>(null);
  const controlled = expandedSource !== undefined;
  const open = controlled ? expandedSource : internal;

  const setOpen = (next: string | null) => {
    if (!controlled) setInternal(next);
    onExpandChange?.(next);
  };

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-xl border border-surface bg-surface-900/50"
          />
        ))}
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-surface bg-surface-900/50 p-12 text-center",
          className,
        )}
      >
        <CircleCheck className="mx-auto mb-3 h-8 w-8 text-green-400" aria-hidden />
        <p className="text-sm font-medium text-surface-300">{emptyTitle}</p>
        <p className="mt-1 text-xs text-surface-400">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {sources.map((s) => (
        <RecoveryRow
          key={s.source}
          source={s}
          tag={tagFor?.(s)}
          expanded={open === s.source}
          onToggle={() => setOpen(open === s.source ? null : s.source)}
          onView={onView}
          onCompare={onCompare}
        />
      ))}
    </div>
  );
}
