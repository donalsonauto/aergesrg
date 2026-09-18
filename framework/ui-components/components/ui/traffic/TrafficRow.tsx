// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// TrafficRow: one GA4 channel in the Traffic Channels list, collapsed and
// expanded, matched to the live v2 page. Head: chevron, "source / medium",
// status chip, then Peak sess/mo, Conv (rate), VDPs, Inactive. Body: six tiles,
// the Peak and Last active lines, and the traffic timeline.

import { ChevronDown, ChevronRight, Clock, Star } from "lucide-react";
import { TrafficTimeline } from "./TrafficTimeline";
import { int, pct } from "@/lib/format";
import { cn, RECOVERY_STATUS } from "@/lib/ui";
import type { TrafficChannel } from "@/lib/demo-types";

export interface TrafficRowProps {
  channel: TrafficChannel;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

function Stat({ label, value, className, valueClassName }: { label: string; value: string; className?: string; valueClassName?: string }) {
  return (
    <div className={className}>
      <span className="text-surface-400">{label}:</span>
      <span className={cn("ml-1 font-medium tabular-nums", valueClassName ?? "text-surface-300")}>{value}</span>
    </div>
  );
}

function Tile({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg bg-surface-800/50 p-3">
      <div className="text-[10px] uppercase text-surface-400">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", valueClassName ?? "text-white")}>{value}</div>
    </div>
  );
}

export function TrafficRow({ channel: c, expanded, onToggle, className }: TrafficRowProps) {
  const status = RECOVERY_STATUS[c.status];
  const steady = c.status === "steady";
  return (
    <div className={cn("overflow-hidden rounded-xl border border-surface bg-surface-900/50", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-surface-800/30"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-orange-400" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-surface-400" aria-hidden />
          )}
          <span className="truncate text-sm font-medium text-surface-200">{c.channel}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", status.className)}>{status.label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400 sm:gap-6">
          <Stat label="Peak" value={`${int(c.metrics.peakMonthlySessions)} sess/mo`} className="hidden sm:block" />
          {c.metrics.totalConversions > 0 && (
            <div className="hidden md:block">
              <span className="text-surface-400">Conv:</span>
              <span className="ml-1 font-medium tabular-nums text-purple-400">{int(c.metrics.totalConversions)}</span>
              <span className="ml-0.5 text-surface-400">({pct(c.metrics.conversionRate)})</span>
            </div>
          )}
          <Stat label="VDPs" value={int(c.metrics.totalVdpViews)} className="hidden lg:block" />
          {c.monthsInactive > 0 && <Stat label="Inactive" value={`${c.monthsInactive}mo`} className="hidden sm:block" />}
          <span className={cn("font-semibold tabular-nums", steady ? "text-surface-500" : "text-orange-400")}>
            {steady ? "steady, not in total" : `${int(Math.round(c.estMonthlySessions))} sess/mo lost`}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-700/50 px-5 py-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Tile label="Total Sessions" value={int(c.metrics.totalSessions)} />
                <Tile label="Total VDP Views" value={int(c.metrics.totalVdpViews)} />
                <Tile label="Form Submissions" value={int(c.metrics.formSubmissions)} valueClassName="text-purple-400" />
                <Tile label="Click-to-Call" value={int(c.metrics.clickToCall)} valueClassName="text-purple-400" />
                <Tile label="Conversion Rate" value={pct(c.metrics.conversionRate)} />
                <Tile label="Active Months" value={String(c.activeMonths)} />
              </div>
              <div className="space-y-2 text-xs text-surface-300">
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                  <span><strong className="font-semibold">Peak:</strong> {c.peakPeriod.start} to {c.peakPeriod.end}</span>
                </div>
                {c.lastActiveMonth && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-surface-400" aria-hidden />
                    <span><strong className="font-semibold">Last active:</strong> {c.lastActiveMonth}</span>
                  </div>
                )}
              </div>
              {!steady && (
                <p className="text-[10px] italic text-surface-500">
                  Lost sessions are the channel&apos;s own historical rate minus its recent rate. Sessions and conversions only, never dollars.
                </p>
              )}
            </div>
            <div className="lg:col-span-2">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-300">Traffic Timeline</h4>
              <TrafficTimeline data={c.timeline} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
