// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// DrillDownHeader — sticky top of the overlay: metric name, current value with
// delta, prev/LY, scope, period, and the click-to-climb breadcrumb. Emits close
// and (optional) chat toggle.

import { Sparkles, X } from "lucide-react";
import { Delta } from "../primitives";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { formatValue, type DataType } from "@/lib/format";
import { cn } from "@/lib/ui";

export function DrillDownHeader({
  metricName,
  scope,
  currentValue,
  previousValue,
  lastYearValue,
  dataType = "int",
  periodLabel,
  crumbs,
  onNavigate,
  onClose,
  onToggleChat,
  chatOpen = false,
  invert = false,
}: {
  metricName: string;
  scope?: string;
  currentValue: number;
  previousValue?: number | null;
  lastYearValue?: number | null;
  dataType?: DataType;
  periodLabel?: string;
  crumbs: Crumb[];
  onNavigate: (index: number) => void;
  onClose: () => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
  invert?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-fg sm:text-2xl">
              {metricName}
            </h1>
            {scope && (
              <span className="rounded-md border border-line bg-elevated px-2 py-0.5 text-[11px] text-muted">
                {scope}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold tabular-nums text-fg">
              {formatValue(currentValue, dataType)}
            </span>
            {previousValue != null && (
              <Delta
                current={currentValue}
                previous={previousValue}
                dataType={dataType}
                invert={invert}
              />
            )}
            {previousValue != null && (
              <span className="text-xs text-muted">
                Prev: {formatValue(previousValue, dataType)}
              </span>
            )}
            {lastYearValue != null && (
              <span className="text-xs text-muted">
                LY: {formatValue(lastYearValue, dataType)}
              </span>
            )}
            {periodLabel && (
              <span className="text-[11px] text-muted">{periodLabel}</span>
            )}
          </div>
          <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} className="mt-2" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Ask the analyst about this metric"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-elevated",
                chatOpen && "bg-accent/10",
              )}
            >
              <Sparkles
                className={cn("h-4 w-4", chatOpen ? "text-accent" : "text-muted")}
              />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-elevated"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>
      </div>
    </div>
  );
}
