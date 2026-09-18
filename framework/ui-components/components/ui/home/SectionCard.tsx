// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// SectionCard: the rounded-2xl panel v2 uses for every home-page section
// (trend, health, do-this-now, ranked lists), with the label-medium header row.

import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
import { AskButton } from "./AskButton";

export function SectionCard({
  title,
  icon,
  right,
  askLabel,
  onAsk,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  askLabel?: string;
  onAsk?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-surface bg-surface-900/50 px-5 py-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-medium text-surface-0">{title}</h3>
          <AskButton label={askLabel ?? `Ask AI about ${title}`} onClick={onAsk} />
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
