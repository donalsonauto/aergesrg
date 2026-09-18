// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// RecoveryPageHeader — the top of the Revenue Recovery screen: title, subtitle
// carrying the analysis month and lookback window, and on the right a stacked
// control block matching the live page:
//
//   row 1   [ 3 Years v ]  [ CRM Sources | Traffic Channels ]
//   row 2   [ All Types | Internet | Phone | Campaign | Showroom | Service ]
//
// The lookback is a compact dropdown reading "3 Years" (not year tabs), and the
// lead types are a segmented pill group on a rounded surface-800 bar (not
// underlined tabs). The segmented-control classes are verbatim from
// RevenueRecovery.vue:
//   wrapper  flex items-center gap-1 bg-surface-800 rounded-lg p-0.5
//   button   px-3 py-1.5 text-xs font-medium rounded-md transition-all
//   active   bg-indigo-500 text-white shadow-sm
//   idle     text-surface-400 hover:text-white
//
// Data in, callbacks out: every selection is a controlled prop.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Globe } from "lucide-react";
import { cn } from "@/lib/ui";

export type RecoveryScope = "crm" | "traffic";

export interface RecoveryLeadTypeTab {
  /** `null` is the "All Types" option. */
  key: string | null;
  label: string;
}

export interface RecoveryPageHeaderProps {
  title?: string;
  /** Analysis month, already formatted, e.g. "August 2026". */
  monthLabel?: string;
  /** Lookback window, e.g. "36-month lookback · Sep 2023 – Aug 2026". */
  windowLabel?: string;

  /** CRM Sources / Traffic Channels toggle. */
  scope?: RecoveryScope;
  onScopeChange?: (scope: RecoveryScope) => void;

  /**
   * Lookback dropdown, in whole years: `[1, 2, 3]` renders "1 Year", "2 Years",
   * "3 Years". Omit to hide the control.
   */
  yearOptions?: number[];
  selectedYears?: number;
  onYearsChange?: (years: number) => void;

  /** Lead-type segmented group. Omit to hide the row. */
  leadTypes?: RecoveryLeadTypeTab[];
  selectedLeadType?: string | null;
  onLeadTypeChange?: (leadType: string | null) => void;

  className?: string;
}

// min-h rather than h so the lead-type group can still wrap on a narrow
// viewport, while the scope toggle lines up with the 32px lookback dropdown.
const SEG_WRAP =
  "flex min-h-[32px] items-center gap-1 rounded-lg bg-surface-800 p-0.5";
const SEG_BUTTON =
  "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap";
const SEG_ACTIVE = "bg-indigo-500 text-white shadow-sm";
const SEG_IDLE = "text-surface-400 hover:text-white";

function yearsLabel(n: number) {
  return `${n} Year${n === 1 ? "" : "s"}`;
}

/** Compact lookback dropdown, 32px tall to line up with the scope toggle. */
function YearsSelect({
  options,
  selected,
  onChange,
}: {
  options: number[];
  selected: number;
  onChange?: (years: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-[32px] cursor-pointer items-center gap-1.5 rounded-lg bg-surface-800 px-3",
          "text-xs font-medium transition-colors whitespace-nowrap",
          open ? "text-white" : "text-surface-400 hover:text-white",
        )}
      >
        <span>{yearsLabel(selected)}</span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-[999] mt-1 min-w-[112px] overflow-hidden rounded-lg border border-surface-700 bg-surface-900 p-1 shadow-xl"
        >
          {options.map((n) => {
            const active = n === selected;
            return (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange?.(n);
                  setOpen(false);
                }}
                className={cn(
                  "w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                  active
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-surface-300 hover:bg-surface-800",
                )}
              >
                {yearsLabel(n)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RecoveryPageHeader({
  title = "Revenue Recovery",
  monthLabel,
  windowLabel,
  scope = "crm",
  onScopeChange,
  yearOptions,
  selectedYears = 3,
  onYearsChange,
  leadTypes,
  selectedLeadType = null,
  onLeadTypeChange,
  className,
}: RecoveryPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-surface-400">
          Find proven lead sources that produced before but are no longer active
          {monthLabel && (
            <span className="ml-2 text-surface-500">
              {monthLabel}
              {windowLabel ? ` · ${windowLabel}` : ""}
            </span>
          )}
        </p>
      </div>

      {/* Right-hand control block: lookback + scope, then the lead types. */}
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-2">
          {yearOptions && yearOptions.length > 0 && (
            <YearsSelect
              options={yearOptions}
              selected={selectedYears}
              onChange={onYearsChange}
            />
          )}

          <div className={SEG_WRAP}>
            <button
              type="button"
              onClick={() => onScopeChange?.("crm")}
              className={cn(
                SEG_BUTTON,
                "inline-flex items-center",
                scope === "crm" ? SEG_ACTIVE : SEG_IDLE,
              )}
            >
              <Filter className="mr-1 h-2.5 w-2.5" aria-hidden />
              CRM Sources
            </button>
            <button
              type="button"
              onClick={() => onScopeChange?.("traffic")}
              className={cn(
                SEG_BUTTON,
                "inline-flex items-center",
                scope === "traffic" ? SEG_ACTIVE : SEG_IDLE,
              )}
            >
              <Globe className="mr-1 h-2.5 w-2.5" aria-hidden />
              Traffic Channels
            </button>
          </div>
        </div>

        {leadTypes && leadTypes.length > 0 && (
          <div className={cn(SEG_WRAP, "flex-wrap")}>
            {leadTypes.map((t) => {
              const active = selectedLeadType === t.key;
              return (
                <button
                  key={t.key ?? "all"}
                  type="button"
                  onClick={() => onLeadTypeChange?.(t.key)}
                  className={cn(SEG_BUTTON, active ? SEG_ACTIVE : SEG_IDLE)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
