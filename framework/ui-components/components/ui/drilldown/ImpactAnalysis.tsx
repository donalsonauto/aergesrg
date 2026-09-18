// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// ImpactAnalysis — "what moved the number": per dimension, the biggest movers as
// a ranked leaderboard with a value bar and variance. Click a row to filter the
// drill into that value.

import { formatValue, type DataType } from "@/lib/format";
import { cn, SERIES_COLORS } from "@/lib/ui";
import type { BreakdownRow } from "@/lib/demo-types";

export function ImpactAnalysis({
  impact,
  dimensionLabels,
  dataType = "int",
  onFilter,
}: {
  /** { dimensionKey: rows } — already ranked (biggest drops first). */
  impact: Record<string, BreakdownRow[]>;
  dimensionLabels: Record<string, string>;
  dataType?: DataType;
  onFilter?: (dimension: string, row: BreakdownRow) => void;
}) {
  const dims = Object.keys(impact);
  if (!dims.length) return null;

  return (
    <div>
      <h3 className="mb-3 kpi-label">What Moved The Number</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dims.map((dim) => {
          const rows = impact[dim] ?? [];
          const max = Math.max(...rows.map((r) => Math.abs(r.current)), 1);
          return (
            <div key={dim} className="rounded-xl border border-line bg-card p-4">
              <h4 className="mb-3 kpi-label">By {dimensionLabels[dim] ?? dim}</h4>
              <div className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <button
                    key={row.id}
                    onClick={() => onFilter?.(dim, row)}
                    className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-elevated"
                  >
                    <span
                      className={cn(
                        "w-4 shrink-0 text-right text-[10px] font-bold tabular-nums",
                        i < 3 ? "text-accent" : "text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-fg">
                          {row.label}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs font-semibold tabular-nums text-fg">
                            {formatValue(row.current, dataType)}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold tabular-nums",
                              row.variance > 0
                                ? "text-success"
                                : row.variance < 0
                                  ? "text-danger"
                                  : "text-muted",
                            )}
                          >
                            {row.variance > 0 ? "+" : ""}
                            {formatValue(row.variance, dataType)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(Math.abs(row.current) / max) * 100}%`,
                            backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
                            opacity: 1 - i * 0.08,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
                {!rows.length && (
                  <p className="py-2 text-xs text-muted">No data</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
