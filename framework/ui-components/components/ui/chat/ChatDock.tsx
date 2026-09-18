// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// ChatDock — the dockable analyst panel shell. Docks to the right rail (or the
// bottom on phones), with a titled header, a scrollable body, and a pinned
// footer (usually the ChatInput). Open/close is controlled via props.

import { X } from "lucide-react";
import { cn } from "@/lib/ui";

export function ChatDock({
  open,
  onClose,
  title = "Analyst",
  side = "right",
  children,
  footer,
  headerActions,
  /** Render inline (fills its container) instead of fixed-position docking. */
  inline = false,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  side?: "right" | "bottom";
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  inline?: boolean;
  className?: string;
}) {
  if (!open) return null;

  const shell = (
    <div
      className={cn(
        "flex flex-col overflow-hidden border-line bg-bg",
        inline
          ? "h-full w-full"
          : side === "right"
            ? "fixed right-0 top-0 z-[9998] h-full w-full border-l sm:w-[400px]"
            : "fixed inset-x-0 bottom-0 z-[9998] h-[70vh] rounded-t-2xl border-t shadow-2xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {headerActions}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-elevated"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-line p-3">{footer}</div>
      )}
    </div>
  );

  return shell;
}
