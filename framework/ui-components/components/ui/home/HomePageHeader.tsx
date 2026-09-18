// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HomePageHeader: the title block at the top of the home dashboard, as in v2's
// RankmaticDashboard.vue. Scope and month come from the top bar; this only
// prints them.

export interface HomePageHeaderProps {
  title?: string;
  /** "All Stores" or a store name; rendered in the accent color. */
  scopeLabel: string;
  /** "August 2026 · Aug 1 – Aug 31" */
  rangeLabel: string;
  right?: React.ReactNode;
}

export function HomePageHeader({
  title = "Dashboard",
  scopeLabel,
  rangeLabel,
  right,
}: HomePageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <h1 className="mb-1 text-xl font-bold text-surface-0 sm:text-2xl">{title}</h1>
        <p className="text-xs text-surface-500 sm:text-sm">
          <span className="font-medium text-indigo-400">{scopeLabel}</span>
          <span> &middot; </span>
          {rangeLabel}
        </p>
      </div>
      {right}
    </div>
  );
}
