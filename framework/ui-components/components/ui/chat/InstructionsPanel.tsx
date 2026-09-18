// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// InstructionsPanel — standing instructions the analyst always applies (e.g.
// "always compare like ranges", "flag any source under 30% of peak"). Each has an
// active toggle; inactive rows dim. Source pill marks manual vs learned-from-
// feedback. Toggle/add/delete are callbacks.

import { Brain, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/ui";
import type { Instruction } from "@/lib/chat-types";

export function InstructionsPanel({
  instructions,
  onToggle,
  onAdd,
  onDelete,
}: {
  instructions: Instruction[];
  onToggle?: (id: string, active: boolean) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <Brain className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-fg">Custom Instructions</span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-fg"
            aria-label="Add instruction"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {instructions.map((ins) => (
          <div
            key={ins.id}
            className={cn(
              "group flex items-start gap-2.5 rounded-xl border border-line bg-card p-3 transition-opacity",
              !ins.active && "opacity-50",
            )}
          >
            <button
              onClick={() => onToggle?.(ins.id, !ins.active)}
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                ins.active
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-transparent",
              )}
              aria-label={ins.active ? "Deactivate" : "Activate"}
            >
              {ins.active && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-fg">{ins.content}</p>
              <span
                className={cn(
                  "mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  ins.source === "feedback"
                    ? "bg-warning/15 text-warning"
                    : "bg-elevated text-muted",
                )}
              >
                {ins.source === "feedback" ? "From feedback" : "Manual"}
              </span>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(ins.id)}
                className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!instructions.length && (
          <p className="py-8 text-center text-sm text-muted">No standing instructions.</p>
        )}
      </div>
    </div>
  );
}
