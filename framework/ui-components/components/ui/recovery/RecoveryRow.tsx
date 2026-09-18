// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RecoveryRow — one source in the Revenue Recovery list, collapsed and expanded.
// Ported from RevenueRecovery.vue's opportunity card. The class strings are
// verbatim wherever the .vue has them:
//
//   card      bg-surface-900/50 rounded-xl border border-surface overflow-hidden
//   head      flex items-center justify-between px-5 py-3 cursor-pointer
//             hover:bg-surface-800/30 transition-colors      -> 44px tall
//   chevron   text-xs, indigo-400 when open, surface-400 when closed
//   name      text-sm font-medium text-surface-200 truncate
//   chip      text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0
//   stats     flex items-center gap-4 sm:gap-6 text-xs text-surface-400
//   stat      "Label:" in surface-400, value in surface-300 font-medium ml-1
//   body      border-t border-surface/50 px-5 py-4, a 3-column grid
//   tile      bg-surface-800/50 rounded-lg p-3, 10px uppercase label + text-lg bold
//
// Data in, callbacks out: `expanded` and every action are props.

import { useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Percent,
  Star,
} from "lucide-react";
import { ThreeAxisTimeline } from "./ThreeAxisTimeline";
import { compactMoney, int, pct, units } from "@/lib/format";
import {
  cn,
  FEED_LOST_STYLE,
  leadTypeChip,
  RECOVERY_STATUS,
} from "@/lib/ui";
import type { RecoverySource } from "@/lib/demo-types";

export interface RecoveryRowProps {
  source: RecoverySource;
  expanded: boolean;
  onToggle: () => void;
  /** Eye icon on the right of the row. Hidden when omitted. */
  onView?: (source: RecoverySource) => void;
  /**
   * Small neutral uppercase label after the source name (the row's TAG slot),
   * e.g. a vendor category or the store scope.
   */
  tag?: string;
  /** The Compare button on the timeline. Hidden when omitted. */
  onCompare?: (source: RecoverySource) => void;
  className?: string;
}

/** "Peak:" + value, the right-hand stat group's unit. */
function Stat({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <span className="text-surface-400">{label}:</span>
      <span
        className={cn("ml-1 font-medium tabular-nums", valueClassName ?? "text-surface-300")}
      >
        {value}
      </span>
    </div>
  );
}

function Tile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-800/50 p-3">
      <div className="text-[10px] uppercase text-surface-400">{label}</div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          valueClassName ?? "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function RecoveryRow({
  source: s,
  expanded,
  onToggle,
  onView,
  tag,
  onCompare,
  className,
}: RecoveryRowProps) {
  const [tab, setTab] = useState<string | null>(null);
  const status = RECOVERY_STATUS[s.status];
  const steady = s.status === "steady";
  const insufficient = s.insufficient || s.estMonthlyRevenue == null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-surface bg-surface-900/50",
        className,
      )}
    >
      {/* ── Collapsed head ─────────────────────────────────────────────── */}
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
            <ChevronDown className="h-3 w-3 shrink-0 text-indigo-400" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-surface-400" aria-hidden />
          )}

          <span className="truncate text-sm font-medium text-surface-200">
            {s.source}
          </span>

          {tag && (
            <span className="shrink-0 rounded border border-surface-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-surface-400">
              {tag}
            </span>
          )}

          {/* Lead-type chips, each in its own color */}
          <div className="flex shrink-0 items-center gap-1.5">
            {s.leadTypes.map((lt) => (
              <span
                key={lt}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                  leadTypeChip(lt),
                )}
              >
                {lt}
              </span>
            ))}
          </div>

          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>

          {s.feedLost && (
            <span
              className={cn(
                "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium lg:inline",
                FEED_LOST_STYLE.className,
              )}
            >
              {FEED_LOST_STYLE.label}
            </span>
          )}
        </div>

        {/* Right-hand stat group */}
        <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400 sm:gap-6">
          <Stat
            label="Peak"
            value={`${units(s.metrics.peakMonthlySales)} sales/mo`}
            className="hidden sm:block"
          />
          <Stat
            label="Total"
            value={`${int(s.metrics.totalSales)} sales`}
            className="hidden lg:block"
          />
          <Stat
            label="Close"
            value={s.metrics.closingRatio != null ? pct(s.metrics.closingRatio) : "--"}
            className="hidden xl:block"
          />
          {s.monthsInactive > 0 && (
            <Stat
              label="Inactive"
              value={`${s.monthsInactive}mo`}
              className="hidden sm:block"
            />
          )}
          {/*
            Steady sources are listed for context but never counted, so they
            say so in place of a figure (METRICS.md: the headline is dormant +
            declining only). Insufficient evidence likewise shows no number.
          */}
          <span
            className={cn(
              "font-semibold tabular-nums",
              steady || insufficient ? "text-surface-500" : "text-indigo-400",
            )}
          >
            {steady
              ? "steady, not in total"
              : insufficient
                ? "insufficient data"
                : `${compactMoney(s.estMonthlyRevenue)}/mo`}
          </span>
          {onView && (
            <button
              type="button"
              aria-label={`View ${s.source}`}
              onClick={(e) => {
                e.stopPropagation();
                onView(s);
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-100"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded body (the live v2 layout) ─────────────────────────── */}
      {expanded && (
        <div className="border-t border-surface-700/50 px-5 py-4">
          {s.feedLost && (
            <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
              Possible dead CRM feed for this lead type. Excluded from the
              recoverable headline until confirmed.
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left column: key metrics, split, dates, stores */}
            <div className="space-y-4">
              <div>
                <SectionHead>Key Metrics</SectionHead>
                <div className="grid grid-cols-2 gap-3">
                  <Tile label="Total Sales" value={int(s.metrics.totalSales)} />
                  <Tile label="Total Leads" value={int(s.metrics.totalLeads)} />
                  <Tile label="Total Gross" value={compactMoney(s.metrics.totalGross)} />
                  <Tile label="Avg Gross/Sale" value={compactMoney(s.metrics.avgGrossPerSale)} />
                </div>
              </div>

              {(s.metrics.newSales > 0 || s.metrics.usedSales > 0) && (
                <div>
                  <SectionHead>New vs Used Split</SectionHead>
                  <div className="grid grid-cols-2 gap-3">
                    <SplitTile label="New" value={s.metrics.newSales} total={s.metrics.newSales + s.metrics.usedSales} color="bg-blue-500" text="text-blue-400" />
                    <SplitTile label="Used" value={s.metrics.usedSales} total={s.metrics.newSales + s.metrics.usedSales} color="bg-emerald-500" text="text-emerald-400" />
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs text-surface-300">
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                  <span>
                    <strong className="font-semibold">Peak:</strong> {s.peakPeriod.start} to {s.peakPeriod.end} ({units(s.metrics.peakMonthlySales)} sales/mo)
                  </span>
                </div>
                {s.lastActiveMonth && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-surface-400" aria-hidden />
                    <span>
                      <strong className="font-semibold">Last active:</strong> {s.lastActiveMonth}
                      {s.monthsInactive > 0 && ` (${s.monthsInactive}mo ago)`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-surface-400" aria-hidden />
                  <span>
                    <strong className="font-semibold">Closing ratio:</strong> {s.metrics.closingRatio != null ? pct(s.metrics.closingRatio) : "--"}
                    {" \u2022 "}
                    <strong className="font-semibold">Active months:</strong> {s.activeMonths}/{s.totalMonths}
                  </span>
                </div>
              </div>

              <div>
                <SectionHead>Stores Affected</SectionHead>
                <div className="flex max-h-[290px] flex-col gap-1.5 overflow-y-auto pr-1">
                  {s.storeBreakdown.map((b) => (
                    <div key={b.store} className="flex items-center gap-3 rounded-lg bg-surface-800/50 px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium text-surface-200">{b.store}</span>
                      <span className="shrink-0 tabular-nums text-surface-100">{int(b.sales)} sales</span>
                      <span className="shrink-0 tabular-nums text-blue-400">{int(b.newSales)}N</span>
                      <span className="shrink-0 tabular-nums text-emerald-400">{int(b.usedSales)}U</span>
                      <span className="w-16 shrink-0 text-right tabular-nums text-surface-300">{compactMoney(b.gross)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] italic text-surface-500">
                  The estimate is recomputed per scope, not additive across stores.
                </p>
              </div>
            </div>

            {/* Right: performance timeline with lead-type tabs and Compare */}
            <div className="lg:col-span-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-300">
                    Performance Timeline
                  </h4>
                  {Object.keys(s.timelineByLeadType ?? {}).length > 1 && (
                    <div className="inline-flex rounded-lg bg-surface-800/60 p-0.5">
                      {[null, ...Object.keys(s.timelineByLeadType)].map((lt) => (
                        <button
                          key={lt ?? "all"}
                          type="button"
                          onClick={() => setTab(lt)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                            tab === lt ? "bg-sky-500 text-white" : "text-surface-400 hover:text-surface-200",
                          )}
                        >
                          {lt ?? "All"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {onCompare && (
                  <button
                    type="button"
                    onClick={() => onCompare(s)}
                    className="inline-flex items-center gap-2 rounded-lg border border-surface px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:bg-surface-800"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Compare
                  </button>
                )}
              </div>
              <ThreeAxisTimeline data={tab && s.timelineByLeadType?.[tab] ? s.timelineByLeadType[tab] : s.timeline} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">{children}</div>
  );
}

function SplitTile({
  label,
  value,
  total,
  color,
  text,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  text: string;
}) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-lg bg-surface-800/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-surface-400">{label}</span>
        <span className={cn("text-xs font-semibold tabular-nums", text)}>{share.toFixed(0)}%</span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-white">{int(value)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-950">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
