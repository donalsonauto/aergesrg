// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// DimensionSelector — pill row for choosing which dimension to break the current
// level down by (store, source, month, lead type). Selected pill takes the accent.

import { cn } from "@/lib/ui";
import type { DrillDownDimension } from "@/lib/demo-types";

export function DimensionSelector({
  dimensions,
  selected,
  onSelect,
}: {
  dimensions: DrillDownDimension[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  if (!dimensions.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="kpi-label mr-1">Break down by</span>
      {dimensions.map((dim) => (
        <button
          key={dim.key}
          onClick={() => onSelect(dim.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            selected === dim.key
              ? "bg-accent text-white"
              : "bg-elevated text-muted hover:text-fg",
          )}
        >
          {dim.label}
        </button>
      ))}
    </div>
  );
}
