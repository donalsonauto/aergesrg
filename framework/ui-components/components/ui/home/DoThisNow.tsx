// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// DoThisNow: v2's "Do This Now" panel. A short list of actions from a rule
// engine (never a model), one severity stripe each; clicking one sends the
// text to the analyst as a question.

import { CheckCircle2, MessageSquare, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/ui";
import type { HomeAction } from "@/lib/demo-types";
import { SectionCard } from "./SectionCard";

export interface DoThisNowProps {
  actions: HomeAction[];
  onSelect?: (action: HomeAction) => void;
  className?: string;
}

const BOX: Record<HomeAction["priority"], string> = {
  critical: "bg-red-500/[0.08] border border-red-500/20",
  warning: "bg-amber-500/[0.08] border border-amber-500/20",
  info: "bg-blue-500/[0.08] border border-blue-500/20",
};
const STRIPE: Record<HomeAction["priority"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-blue-400",
};

export function DoThisNow({ actions, onSelect, className }: DoThisNowProps) {
  return (
    <SectionCard
      title="Do This Now"
      icon={
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
          <Zap size={12} className="text-amber-400" aria-hidden />
        </div>
      }
      right={
        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5">
          <Sparkles size={8} className="text-indigo-400" aria-hidden />
          <span className="text-[9px] font-semibold tracking-wide text-indigo-400">RULES</span>
        </span>
      }
      className={className}
    >
      {actions.length ? (
        <div className="flex flex-col gap-2">
          {actions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(item)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-all hover:ring-1 hover:ring-indigo-400/30",
                BOX[item.priority],
                onSelect ? "cursor-pointer" : "cursor-default",
              )}
            >
              <div className={cn("min-h-[28px] w-1 shrink-0 self-stretch rounded-full", STRIPE[item.priority])} />
              <p className="flex-1 text-xs leading-snug text-surface-100">{item.text}</p>
              {onSelect && (
                <MessageSquare size={12} className="mt-0.5 shrink-0 text-surface-400" aria-hidden />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-surface-400">
          <CheckCircle2 className="mb-2 h-8 w-8 text-green-400" aria-hidden />
          <p className="text-sm">All clear. Nothing urgent right now.</p>
        </div>
      )}
    </SectionCard>
  );
}
