// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RelatedKpis — a horizontal strip of KPIs related to the one being drilled
// (driver, upstream, component, correlated). Click a card to pivot the drill
// to that metric.

import { formatValue, pctChange, changeColor } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { RelatedKpi } from "@/lib/demo-types";

const TYPE_BADGE: Record<string, string> = {
  driver: "bg-info/15 text-info",
  correlated: "bg-accent/15 text-accent",
  upstream: "bg-warning/15 text-warning",
  downstream: "bg-info/15 text-info",
  component: "bg-success/15 text-success",
};

export function RelatedKpis({
  items,
  onSelect,
}: {
  items: RelatedKpi[];
  onSelect?: (kpi: RelatedKpi) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-3 kpi-label">Related KPIs</h3>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((rel) => {
          const change = pctChange(rel.current, rel.previous);
          const color = changeColor(change, rel.key === "cps");
          return (
            <button
              key={rel.key}
              onClick={() => onSelect?.(rel)}
              className="min-w-[150px] shrink-0 rounded-xl border border-line bg-card p-3 text-left transition-colors hover:border-accent/40 hover:bg-elevated"
            >
              <div className="mb-1.5 truncate text-[11px] font-medium text-muted">
                {rel.name}
              </div>
              <div className="mb-1.5 flex items-baseline gap-1.5">
                <span className="text-sm font-bold tabular-nums text-fg">
                  {formatValue(rel.current, rel.dataType)}
                </span>
                {change != null && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      color === "positive"
                        ? "text-success"
                        : color === "negative"
                          ? "text-danger"
                          : "text-muted",
                    )}
                  >
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize",
                  TYPE_BADGE[rel.relationshipType] ?? "bg-elevated text-muted",
                )}
              >
                {rel.relationshipType}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
