// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// AppShell — sidebar + top bar + scrolling content area, ported from
// AppLayout.vue and scss/_content.scss:
//
//   .layout-wrapper          height 100vh, display flex
//   .layout-content-wrapper  flex 1, height 100%, overflow auto
//   .layout-content-wrapper-inside  max-width 1540px, margin 0 auto, flex column
//
// The top bar scrolls with the content (position: static in _topbar.scss), so
// it lives inside the scroll container, not above it.
//
// The content slot carries `.layout-content`'s own 2rem padding, and pages add
// theirs on top (the real Revenue Recovery screen is `p-4 sm:p-6`, the ~20px
// measured on the live page). Both together are what make a 4-up KPI row
// measure 284px per card at a 1512px viewport.

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";
import { cn } from "@/lib/ui";

export interface AppShellProps {
  /** Everything the left rail needs: sections, active path, onNavigate. */
  sidebar: SidebarProps;
  /** Everything the top bar needs: title, selectors, month stepper, callbacks. */
  topbar: Omit<TopbarProps, "onMenu">;
  children: ReactNode;
  className?: string;
}

export function AppShell({
  sidebar,
  topbar,
  children,
  className,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn("layout-wrapper flex h-screen bg-surface-950", className)}>
      <Sidebar
        {...sidebar}
        mobileOpen={mobileOpen}
        onNavigate={(to, item) => {
          setMobileOpen(false);
          sidebar.onNavigate?.(to, item);
        }}
      />

      {/* Mobile scrim, as AppLayout.vue's .layout-mask */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[9] bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="layout-content-wrapper z-[9] h-full flex-1 overflow-auto">
        <div className="layout-content-wrapper-inside mx-auto flex h-full max-w-[1540px] flex-col">
          <Topbar {...topbar} onMenu={() => setMobileOpen((v) => !v)} />
          {/*
            .layout-content — padding 2rem (28px at a 14px root), 1rem below
            576px. Pages add their own `p-4 sm:p-6` on top, which is what makes
            a 4-up KPI row measure 284px wide at a 1512px viewport.
          */}
          <div className="layout-content relative flex-auto p-4 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
