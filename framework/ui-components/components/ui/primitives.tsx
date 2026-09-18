// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Shared visual primitives: card surface, section label, status pills, delta badge.
// These carry the dark/dense/calm look so every component stays consistent.

import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
import { formatValue, pctChange, changeColor, trendArrow, type DataType } from "@/lib/format";

export function Card({
  children,
  className,
  onClick,
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        // The app's panel treatment, shared by the drill-down overlay and the
        // Revenue Recovery list: rounded-xl (10.5px at a 14px root), a 1px
        // surface-700 border, and a half-strength surface-900 ground.
        "rounded-xl border p-5",
        accent
          ? "border-indigo-500/20 bg-gradient-to-br from-indigo-500/20 to-violet-500/20"
          : "border-surface bg-surface-900/50",
        onClick && "cursor-pointer transition-colors hover:bg-surface-800/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small muted uppercase label used above values and section headers. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("kpi-label block", className)}>{children}</span>
  );
}

/** Tinted status pill: bg at ~15% of the status color, solid color as text. */
export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Neutral lead-type tag. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-surface-700 px-1.5 py-0.5 text-[10px] font-medium text-surface-300">
      {children}
    </span>
  );
}

/**
 * Delta badge vs a prior value. Cost metrics invert the color semantics
 * (a drop in cost-per-sale is good, shown green).
 */
export function Delta({
  current,
  previous,
  dataType,
  invert = false,
  showValue = true,
  className,
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  dataType: DataType;
  invert?: boolean;
  showValue?: boolean;
  className?: string;
}) {
  const change = pctChange(current, previous);
  if (change == null) return null;
  const color = changeColor(change, invert);
  const badge =
    color === "positive"
      ? "bg-success/15 text-success"
      : color === "negative"
        ? "bg-danger/15 text-danger"
        : "bg-elevated text-muted";
  const diff =
    current != null && previous != null ? current - previous : null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded-lg px-1.5 py-0.5 text-xs font-semibold tabular-nums",
          badge,
        )}
      >
        {trendArrow(change)}
        {change > 0 ? "+" : ""}
        {change.toFixed(1)}%
      </span>
      {showValue && diff != null && diff !== 0 && (
        <span
          className={cn(
            "text-xs tabular-nums font-medium",
            color === "positive"
              ? "text-success"
              : color === "negative"
                ? "text-danger"
                : "text-muted",
          )}
        >
          {diff > 0 ? "+" : ""}
          {formatValue(diff, dataType)}
        </span>
      )}
    </span>
  );
}
