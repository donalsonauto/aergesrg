// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// KpiCard — one metric: label above, big value below, delta vs prior month,
// and a 12-month sparkline. The hero card takes the accent wash; the rest stay
// neutral with a single colored accent. Cost metrics invert delta color.
// Data comes in as props; clicking the card emits onDrillDown.

import { Card, Delta, SectionLabel } from "./primitives";
import { Sparkline } from "./Sparkline";
import { formatValue, type DataType } from "@/lib/format";
import { ACCENT_HEX, cn } from "@/lib/ui";
import type { AccentVariant } from "@/lib/demo-types";

export interface KpiCardProps {
  label: string;
  value: number;
  /** Prior month value, for the delta badge. */
  prior?: number | null;
  dataType?: DataType;
  /** Last-12-months series for the sparkline. */
  sparkline?: number[];
  accent?: AccentVariant;
  /** Cost metric: a rise is bad, so delta colors invert. */
  costMetric?: boolean;
  /** Hero card gets the accent wash and border. */
  hero?: boolean;
  subLabel?: string;
  onDrillDown?: () => void;
  className?: string;
}

export function KpiCard({
  label,
  value,
  prior,
  dataType = "int",
  sparkline,
  accent = "accent",
  costMetric = false,
  hero = false,
  subLabel,
  onDrillDown,
  className,
}: KpiCardProps) {
  const color = ACCENT_HEX[accent];
  return (
    <Card
      accent={hero}
      onClick={onDrillDown}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            // 26.25px / 21px at the app's 14px root, the same value scale as
            // the Revenue Recovery KPI cards.
            "font-bold leading-none tabular-nums",
            hero ? "text-3xl" : "text-2xl",
          )}
        >
          {formatValue(value, dataType)}
        </span>
        <div className="flex items-center gap-2">
          {prior != null && (
            <Delta
              current={value}
              previous={prior}
              dataType={dataType}
              invert={costMetric}
            />
          )}
          {subLabel && (
            <span className="text-xs text-muted">{subLabel}</span>
          )}
          {prior != null && !subLabel && (
            <span className="text-xs text-muted">
              vs {formatValue(prior, dataType)}
            </span>
          )}
        </div>
      </div>

      {sparkline && sparkline.length >= 2 && (
        <div className="-mx-1 mt-auto">
          <Sparkline data={sparkline} color={color} height={hero ? 60 : 44} />
        </div>
      )}
    </Card>
  );
}
