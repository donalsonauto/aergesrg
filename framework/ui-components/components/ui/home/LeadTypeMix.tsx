// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// LeadTypeMix: the "ASC Events Breakdown" panel from v2, for CRM lead types.
// One row per lead type: color dot, name, leads this month, share bar, and the
// closing ratio, so a GM sees where the volume is and where it closes.

import { cn } from "@/lib/ui";
import { pct } from "@/lib/format";
import type { HomeLeadType } from "@/lib/demo-types";
import { SectionCard } from "./SectionCard";

export interface LeadTypeMixProps {
  leadTypes: HomeLeadType[];
  monthLabel?: string;
  onSelect?: (leadType: HomeLeadType) => void;
  onAsk?: () => void;
  className?: string;
}

export function LeadTypeMix({ leadTypes, monthLabel, onSelect, onAsk, className }: LeadTypeMixProps) {
  const rows = leadTypes.filter((l) => l.leads > 0);
  return (
    <SectionCard
      title="Lead Type Mix"
      onAsk={onAsk}
      right={monthLabel ? <span className="text-xs text-surface-400">{monthLabel} · share of leads</span> : null}
      className={className}
    >
      {rows.length ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
          {rows.map((l) => (
            <div
              key={l.key}
              onClick={onSelect ? () => onSelect(l) : undefined}
              className={cn("flex items-center gap-3", onSelect && "cursor-pointer")}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
              <span className="w-20 shrink-0 truncate text-xs font-medium text-surface-300">{l.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-800">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${l.share}%`, backgroundColor: l.color }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-bold text-surface-0 tabular-nums">
                {l.leads.toLocaleString("en-US")}
              </span>
              <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-surface-400">
                {pct(l.share)}
              </span>
              <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-surface-400">
                {l.closingRatio == null ? "--" : `${pct(l.closingRatio)} close`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-surface-400">No leads recorded for this period.</div>
      )}
    </SectionCard>
  );
}
