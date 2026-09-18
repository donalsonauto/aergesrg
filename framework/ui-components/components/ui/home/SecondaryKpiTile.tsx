// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// SecondaryKpiTile: the small six-up tiles under the hero row (v2's secondary
// KPI grid): uppercase micro label, value, month-over-month change.

import { cn } from "@/lib/ui";
import { changeColor, formatValue, pctChange, type DataType } from "@/lib/format";
import { AskButton } from "./AskButton";

export interface SecondaryKpiTileProps {
  label: string;
  value: number | null;
  prior?: number | null;
  dataType: DataType;
  invert?: boolean;
  onClick?: () => void;
  onAsk?: () => void;
}

export function SecondaryKpiTile({
  label,
  value,
  prior,
  dataType,
  invert = false,
  onClick,
  onAsk,
}: SecondaryKpiTileProps) {
  const pctVal = pctChange(value, prior);
  const tone = changeColor(pctVal, invert);
  const diff = value != null && prior != null ? value - prior : null;
  const toneClass =
    tone === "positive" ? "text-green-400" : tone === "negative" ? "text-red-400" : "text-surface-400";
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-surface bg-surface-900/50 p-3.5",
        onClick && "cursor-pointer transition-colors hover:border-indigo-400/60",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-surface-400">
          {label}
        </span>
        <AskButton label={`Ask AI about ${label}`} onClick={onAsk} size={10} />
      </div>
      <div className="text-lg font-bold text-surface-0 tabular-nums">
        {value != null ? formatValue(value, dataType) : "--"}
      </div>
      {pctVal != null && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("text-[10px] font-semibold tabular-nums", toneClass)}>
            {pctVal > 0 ? "+" : ""}
            {pctVal.toFixed(1)}%
          </span>
          {diff != null && diff !== 0 && (
            <span className={cn("text-[10px] tabular-nums", toneClass)}>
              {diff > 0 ? "+" : ""}
              {formatValue(diff, dataType)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
