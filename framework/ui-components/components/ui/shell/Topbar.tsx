// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Topbar — ported from AppTopbar.vue. Left: back arrow, separator, page title
// (AppBreadcrumb.vue). Right: the store ("All Stores") dropdown, the dealer-group
// dropdown, month prev/next, search, bell, avatar and the right-menu button.
//
// The Tailwind strings for the group dropdown, the bell and the avatar are
// copied verbatim from AppTopbar.vue. The store selector and the month stepper
// were PrimeVue-styled child components (PropertySelector / DateFilter) that are
// not in the reference drop, so they are rebuilt in plain Tailwind to the same
// computed look: a 2.5rem-tall pill, text-sm font-medium, rounded-lg, muted
// until active, primary-400 on a primary-500/10 wash when open.
//
// _topbar.scss gives the bar itself: padding 0.75rem 0.5rem, a 1px bottom
// border, width calc(100% - 4rem) centered. At a 14px root that is the measured
// 56px tall bar (10.5px padding + a 2.5rem = 35px control + 10.5px).

import { useEffect, useRef, useState } from "react";
import {
  AlignRight,
  Bell,
  Building,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Search,
} from "lucide-react";
import { cn } from "@/lib/ui";

export interface TopbarOption {
  id: string;
  name: string;
  /** Optional right-aligned count, as the group list shows property counts. */
  count?: number;
}

export interface TopbarProps {
  /** Page title shown in the breadcrumb slot. */
  title: string;
  onBack?: () => void;

  /** Store / property selector. `null` value means "All Stores". */
  stores?: TopbarOption[];
  selectedStore?: string | null;
  onSelectStore?: (id: string | null) => void;
  allStoresLabel?: string;

  /** Dealer-group selector. `null` value means "All Groups". */
  groups?: TopbarOption[];
  selectedGroup?: string | null;
  onSelectGroup?: (id: string | null) => void;
  allGroupsLabel?: string;

  /** Month stepper, e.g. "August 2026". */
  monthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Disables the forward arrow at the newest month in the data. */
  nextMonthDisabled?: boolean;

  onSearch?: () => void;
  onBell?: () => void;
  notificationCount?: number;
  /** Avatar image; falls back to the initial of `userName`. */
  userName?: string;
  userPicture?: string | null;
  onAvatar?: () => void;
  onMenu?: () => void;

  className?: string;
}

/** Closes a dropdown on any mousedown outside its wrapper (AppTopbar.vue). */
function useOutsideClick(
  open: boolean,
  close: () => void,
) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

/** The pill trigger shared by the store and group selectors. */
const TRIGGER_BASE =
  "flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap";
const TRIGGER_IDLE =
  "text-surface-300 hover:text-surface-50 hover:bg-surface-800";
const TRIGGER_OPEN = "text-primary-400 bg-primary-500/10";

/** The dropdown panel, verbatim from AppTopbar.vue's group picker. */
const PANEL =
  "absolute top-full left-0 mt-2 z-[999] bg-surface-900 rounded-xl border border-surface-700 shadow-xl overflow-hidden min-w-[240px]";
const PANEL_HEADING =
  "px-2.5 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider";
const PANEL_ITEM =
  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer";
const PANEL_ITEM_IDLE = "text-surface-200 hover:bg-surface-800";
const PANEL_ITEM_ACTIVE = "bg-primary-500/10 text-primary-400";

function Selector({
  label,
  heading,
  allLabel,
  options,
  selected,
  onSelect,
  icon: Icon,
}: {
  label: string;
  heading: string;
  allLabel: string;
  options: TopbarOption[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  icon: typeof Building;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(open, () => setOpen(false));

  return (
    <li className="relative flex items-center" ref={ref as never}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(TRIGGER_BASE, open ? TRIGGER_OPEN : TRIGGER_IDLE)}
        // On a phone the label collapses to the icon; keep the name in the
        // accessible label and the tooltip so the picker is never a mystery.
        aria-label={`${heading}: ${label}`}
        title={`${heading}: ${label}`}
      >
        <Icon className="h-3 w-3 opacity-60" aria-hidden />
        <span className="hidden max-w-[180px] truncate sm:inline">{label}</span>
        <ChevronDown
          className="hidden h-2.5 w-2.5 opacity-50 sm:inline"
          aria-hidden
        />
      </button>
      {open && (
        <div className={PANEL}>
          <div className="p-1.5">
            <div className={PANEL_HEADING}>{heading}</div>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className={cn(
                PANEL_ITEM,
                selected == null ? PANEL_ITEM_ACTIVE : PANEL_ITEM_IDLE,
              )}
            >
              <Globe
                className={cn(
                  "h-3 w-3",
                  selected == null ? "text-primary-400" : "text-surface-400",
                )}
                aria-hidden
              />
              <span className="truncate">{allLabel}</span>
            </button>
            {options.map((opt) => {
              const active = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                  className={cn(
                    PANEL_ITEM,
                    active ? PANEL_ITEM_ACTIVE : PANEL_ITEM_IDLE,
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3 w-3",
                      active ? "text-primary-400" : "text-surface-400",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{opt.name}</span>
                  {opt.count != null && (
                    <span className="text-[10px] text-surface-500">
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-2.5 py-1.5 text-xs text-surface-400">
                None yet.
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function Topbar({
  title,
  onBack,
  stores = [],
  selectedStore = null,
  onSelectStore,
  allStoresLabel = "All Stores",
  groups = [],
  selectedGroup = null,
  onSelectGroup,
  allGroupsLabel = "All Groups",
  monthLabel,
  onPrevMonth,
  onNextMonth,
  nextMonthDisabled = false,
  onSearch,
  onBell,
  notificationCount = 0,
  userName = "User",
  userPicture = null,
  onAvatar,
  onMenu,
  className,
}: TopbarProps) {
  const storeLabel =
    stores.find((s) => s.id === selectedStore)?.name ?? allStoresLabel;
  const groupLabel =
    groups.find((g) => g.id === selectedGroup)?.name ?? allGroupsLabel;

  return (
    <div
      className={cn(
        // .layout-topbar: padding 0.75rem 0.5rem, 1px bottom border,
        // width calc(100% - 4rem) centered. Static, so it scrolls with content.
        "layout-topbar z-[999] mx-auto flex w-[calc(100%-4rem)] shrink-0 items-center justify-between",
        "border-b border-surface-700 px-2 py-3 text-surface-0",
        className,
      )}
    >
      <div className="topbar-left flex min-w-0 items-center">
        {/* .menu-button — 2.5rem square, hover surface-hover */}
        <button
          type="button"
          onClick={onBack ?? onMenu}
          aria-label={onBack ? "Back" : "Toggle menu"}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-surface-0 transition-colors hover:bg-surface-800"
        >
          <ChevronLeft className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </button>

        {/* .topbar-separator — 1px rule, stretched, 1rem side margins */}
        <span className="mx-4 hidden w-px self-stretch border-l border-surface-700 sm:block" />

        {/* AppBreadcrumb.vue: title-h7 text-xl, surface-0 */}
        <nav className="layout-breadcrumb min-w-0">
          <ol className="m-0 flex list-none items-center gap-4 p-0">
            <li className="truncate whitespace-nowrap text-xl font-medium text-surface-0">
              {title}
            </li>
          </ol>
        </nav>
      </div>

      <div className="topbar-right flex items-center">
        <ul className="topbar-menu m-0 flex list-none items-center gap-1 p-0">
          <Selector
            label={storeLabel}
            heading="Stores"
            allLabel={allStoresLabel}
            options={stores}
            selected={selectedStore}
            onSelect={(id) => onSelectStore?.(id)}
            icon={Building}
          />

          <Selector
            label={groupLabel}
            heading="Dealer Groups"
            allLabel={allGroupsLabel}
            options={groups}
            selected={selectedGroup}
            onSelect={(id) => onSelectGroup?.(id)}
            icon={Building}
          />

          {/* Month stepper (DateFilter.vue's computed look) */}
          {monthLabel && (
            <li className="flex items-center">
              <div className="flex h-9 items-center gap-0.5 rounded-lg px-1">
                <button
                  type="button"
                  onClick={onPrevMonth}
                  aria-label="Previous month"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="min-w-[96px] whitespace-nowrap px-1 text-center text-sm font-medium text-surface-200">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={onNextMonth}
                  disabled={nextMonthDisabled}
                  aria-label="Next month"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          )}

          <li className="hidden sm:list-item">
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-100"
            >
              <Search className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </button>
          </li>

          {/* Notifications bell — class string verbatim from AppTopbar.vue */}
          <li className="relative flex items-center">
            <button
              type="button"
              onClick={onBell}
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-surface-400 hover:text-surface-100 hover:bg-surface-800"
            >
              <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {notificationCount}
                </span>
              )}
            </button>
          </li>

          {/* Avatar — verbatim: 2.5rem circle, primary-500 ground, initial */}
          <li className="flex items-center pl-1">
            <button
              type="button"
              onClick={onAvatar}
              aria-label={userName}
              className="w-10 h-10 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center text-white font-semibold cursor-pointer"
            >
              {userPicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userPicture}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{userName.charAt(0).toUpperCase()}</span>
              )}
            </button>
          </li>

          <li className="hidden lg:list-item">
            <button
              type="button"
              onClick={onMenu}
              aria-label="Menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-100"
            >
              <AlignRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
