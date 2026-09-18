// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Breadcrumb — a click-to-climb-out trail. The last crumb is the current level;
// clicking an earlier crumb calls onNavigate with its index (-1 = root/"All").

import { Fragment } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/ui";

export interface Crumb {
  label: string;
  /** index into the filter path; -1 for the root crumb. */
  index: number;
}

export function Breadcrumb({
  crumbs,
  onNavigate,
  className,
}: {
  crumbs: Crumb[];
  onNavigate: (index: number) => void;
  className?: string;
}) {
  if (crumbs.length <= 1) return null;
  return (
    <nav className={cn("flex flex-wrap items-center gap-1 text-xs", className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={`${crumb.index}-${crumb.label}`}>
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted" />}
            <button
              onClick={() => onNavigate(crumb.index)}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-elevated",
                isLast ? "font-semibold text-accent" : "text-muted hover:text-fg",
              )}
            >
              {crumb.label}
              {i > 0 && !isLast && <X className="h-3 w-3 text-muted" />}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
