// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// MiniStatTile: the smallest v2 tile (Financial Focus, Digital & Marketing):
// 9px uppercase label, base-size value, MoM change. Eight or six to a row.

import { cn } from "@/lib/ui";
import { changeColor, formatValue, pctChange, type DataType } from "@/lib/format";

export interface MiniStatTileProps {
  label: string;
  value: number | null;
  prior?: number | null;
  dataType: DataType;
  invert?: boolean;
  onClick?: () => void;
}

export function MiniStatTile({ label, value, prior, dataType, invert = false, onClick }: MiniStatTileProps) {
  const ch = pctChange(value, prior);
  const tone = changeColor(ch, invert);
  const diff = value != null && prior != null ? value - prior : null;
  const toneClass = tone === "positive" ? "text-green-400" : tone === "negative" ? "text-red-400" : "text-surface-400";
  return (
    <div
      onClick={onClick}
      className={cn("rounded-xl border border-surface bg-surface-900/50 p-3", onClick && "cursor-pointer transition-colors hover:border-indigo-400/60")}
    >
      <div className="mb-1.5 truncate text-[9px] font-semibold uppercase tracking-wider text-surface-400">{label}</div>
      <div className="text-base font-bold tabular-nums text-surface-0">{value != null ? formatValue(value, dataType) : "--"}</div>
      {ch != null && (
        <div className="mt-0.5 flex items-center gap-1">
          <span className={cn("text-[9px] font-semibold tabular-nums", toneClass)}>
            {ch > 0 ? "+" : ""}
            {ch.toFixed(1)}%
          </span>
          {diff != null && diff !== 0 && (
            <span className={cn("text-[9px] tabular-nums", toneClass)}>
              {diff > 0 ? "+" : ""}
              {formatValue(diff, dataType)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A titled strip of MiniStatTiles ("Financial Focus", "Digital & Marketing"). */
export function StatStrip({
  title,
  items,
  columns = 8,
  onSelect,
}: {
  title: string;
  items: MiniStatTileProps[];
  columns?: 6 | 8;
  onSelect?: (label: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-surface-0">{title}</h3>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3", columns === 8 ? "lg:grid-cols-8" : "md:grid-cols-4 lg:grid-cols-6")}>
        {items.map((it) => (
          <MiniStatTile key={it.label} {...it} onClick={onSelect ? () => onSelect(it.label) : it.onClick} />
        ))}
      </div>
    </div>
  );
}
