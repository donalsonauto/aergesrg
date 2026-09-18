// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// EventsPanel — business events the analyst is told about (a personnel change, a
// system migration, a marketing push), so it can attribute swings. Typed pills,
// date range, affected stores. Display-only; add/edit surface as callbacks.

import { Calendar, Plus } from "lucide-react";
import { Tag } from "../primitives";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { BusinessEvent, EventType } from "@/lib/chat-types";

const TYPE_PILL: Record<EventType, string> = {
  personnel: "bg-info/15 text-info",
  system: "bg-accent/15 text-accent",
  marketing: "bg-success/15 text-success",
  inventory: "bg-warning/15 text-warning",
  market: "bg-danger/15 text-danger",
  general: "bg-elevated text-muted",
};

function dateRange(start: string, end?: string) {
  const s = formatMonth(start);
  if (!end || end === start) return s;
  return `${s} to ${formatMonth(end)}`;
}

export function EventsPanel({
  events,
  onAdd,
}: {
  events: BusinessEvent[];
  onAdd?: () => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-fg">Business Events</span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-fg"
            aria-label="Add event"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  TYPE_PILL[e.type],
                )}
              >
                {e.type}
              </span>
              <span className="ml-auto text-[11px] text-muted">
                {dateRange(e.startDate, e.endDate)}
              </span>
            </div>
            <div className="mt-1.5 text-sm font-medium text-fg">{e.title}</div>
            {e.description && (
              <p className="mt-1 text-xs leading-relaxed text-muted">{e.description}</p>
            )}
            {e.stores && e.stores.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.stores.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            )}
          </div>
        ))}
        {!events.length && (
          <p className="py-8 text-center text-sm text-muted">No events recorded.</p>
        )}
      </div>
    </div>
  );
}
