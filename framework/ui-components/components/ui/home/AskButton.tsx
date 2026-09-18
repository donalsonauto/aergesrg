// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// AskButton: the small chat-bubble affordance v2 puts on every KPI tile and
// section header (.kpi-chat-btn). Click sends a question to the analyst.

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/ui";

export function AskButton({
  label,
  onClick,
  size = 12,
  className,
}: {
  label: string;
  onClick?: () => void;
  size?: number;
  className?: string;
}) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border border-transparent text-surface-400 transition-colors hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:text-indigo-400",
        className,
      )}
    >
      <MessageSquare size={size} aria-hidden />
    </button>
  );
}
