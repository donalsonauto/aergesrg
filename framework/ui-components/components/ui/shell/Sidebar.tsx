// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Sidebar — the app's left rail, ported from AppSidebar.vue / AppMenu.vue /
// AppMenuItem.vue plus scss/sidebar/_sidebar_vertical.scss and
// sidebar/themes/_primary.scss (layoutConfig.menuTheme = 'primary',
// darkTheme = true, so the ground is surface-950 and every menu color is a
// white alpha).
//
// Dimensions come straight from the SCSS at a 14px root:
//   width 17rem = 238px, menu container padding 1rem = 14px,
//   item padding 0.45rem 0.75rem, item gap 0.35rem,
//   section label 0.75rem uppercase / 500 / 0.05rem tracking, pb 0.5rem,
//   separator margin 0.875rem 0.
//
// Data in, callbacks out: the menu model and the active path are props, and a
// click emits onNavigate. Nothing here knows about a router.

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  /** Route path. Compared against `activePath` for the active state. */
  to: string;
  /** Small red count bubble on the right of the row. */
  badge?: string | number | null;
}

export interface SidebarSection {
  /** Uppercase section label above the group ("Home", "Intelligence", ...). */
  label: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  /** Path of the current route; the matching item renders as active. */
  activePath?: string;
  onNavigate?: (to: string, item: SidebarItem) => void;
  /** Wordmark next to the logo cube. Bold half is rendered in white. */
  appName?: string;
  appNameAccent?: string;
  /** Mobile: the rail slides in when true. */
  mobileOpen?: boolean;
  className?: string;
}

function LogoCube() {
  // Verbatim from AppSidebar.vue: 22px, --primary-color, 8px right margin.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-[22px] w-[22px] shrink-0 text-primary-500"
    >
      <path d="M11.644 1.59a.75.75 0 01.712 0l9.75 5.25a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l9.75-5.25z" />
      <path d="M3.265 10.602l7.668 4.129a2.25 2.25 0 002.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.71 0l-9.75-5.25a.75.75 0 010-1.32l1.37-.738z" />
      <path d="M3.265 15.602l7.668 4.129a2.25 2.25 0 002.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.71 0l-9.75-5.25a.75.75 0 010-1.32l1.37-.738z" />
    </svg>
  );
}

export function Sidebar({
  sections,
  activePath,
  onNavigate,
  appName = "Carfin",
  appNameAccent = "ity",
  mobileOpen = false,
  className,
}: SidebarProps) {
  return (
    <div
      className={cn(
        // _sidebar_vertical.scss: width 17rem, full height, flex column,
        // rounded on the right, no text selection.
        "layout-sidebar z-10 flex h-full w-[17rem] shrink-0 select-none flex-col overflow-hidden",
        "rounded-r-3xl bg-surface-950 shadow-[0px_1px_2px_0px_rgba(18,18,23,0.05)]",
        // Off-canvas below the 992px breakpoint, as the real app does.
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform max-lg:duration-500",
        mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        className,
      )}
    >
      {/* .logo — padding 1rem, 2rem square image slot, app-name 1.5rem */}
      <div className="sidebar-header shrink-0">
        <div className="logo flex items-center p-4">
          <LogoCube />
          <span className="ml-2 align-middle text-2xl font-medium tracking-[0.2px] text-surface-0">
            {appName}
            <strong className="font-bold">{appNameAccent}</strong>
          </span>
        </div>
      </div>

      {/* .layout-menu-container — flex:1, overflow auto, padding 1rem */}
      <div className="layout-menu-container flex-1 overflow-auto p-4">
        <ul className="layout-menu m-0 list-none p-0">
          {sections.map((section, i) => (
            <li key={section.label} className="layout-root-menuitem">
              {/* .menu-separator — 1px, margin 0.875rem 0, white/20 in the
                  primary theme. The first section has no rule above it. */}
              {i > 0 && (
                <div className="my-3.5 h-px w-full border-t border-white/20" />
              )}

              <div className="layout-menuitem-root-text pb-2 text-xs font-medium uppercase tracking-[0.05rem] text-white/60">
                {section.label}
              </div>

              <ul className="m-0 flex list-none flex-col gap-[0.35rem] p-0">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePath === item.to;
                  return (
                    <li key={item.to}>
                      <a
                        href={item.to}
                        tabIndex={0}
                        onClick={(e) => {
                          if (onNavigate) {
                            e.preventDefault();
                            onNavigate(item.to, item);
                          }
                        }}
                        className={cn(
                          "relative flex cursor-pointer items-center rounded-md px-3 py-[0.45rem]",
                          "text-base font-medium transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/[0.64] hover:bg-white/10",
                        )}
                      >
                        <Icon
                          aria-hidden
                          className="layout-menuitem-icon mr-2 h-4 w-4 shrink-0"
                          strokeWidth={2}
                        />
                        <span className="layout-menuitem-text truncate">
                          {item.label}
                        </span>
                        {item.badge != null && item.badge !== "" && (
                          // .pulse-badge, verbatim from AppMenuItem.vue's
                          // scoped style (18px, #EF4444, 10px/700).
                          <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#EF4444] px-[5px] text-[10px] font-bold leading-none text-white">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
