// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// KnowledgePanel — the notes the analyst can search. A searchable list of docs;
// selecting one shows its rendered markdown with type/kpi pills. Display + local
// search + selection only; CRUD is out of scope for the kit (callbacks provided
// for the host to wire).

import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Plus, Search } from "lucide-react";
import { Markdown } from "../Markdown";
import { cn } from "@/lib/ui";
import type { KnowledgeDoc } from "@/lib/chat-types";

const TYPE_PILL: Record<KnowledgeDoc["type"], string> = {
  troubleshooting: "bg-warning/15 text-warning",
  "best-practice": "bg-success/15 text-success",
};

const TYPE_LABEL: Record<KnowledgeDoc["type"], string> = {
  troubleshooting: "Troubleshooting",
  "best-practice": "Best practice",
};

export function KnowledgePanel({
  docs,
  onNew,
}: {
  docs: KnowledgeDoc[];
  onNew?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        d.kpiName?.toLowerCase().includes(q),
    );
  }, [docs, query]);

  const doc = docs.find((d) => d.id === selected) ?? null;

  if (doc) {
    return (
      <div className="p-4">
        <button
          onClick={() => setSelected(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All notes
        </button>
        <h3 className="text-base font-bold text-fg">{doc.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TYPE_PILL[doc.type],
            )}
          >
            {TYPE_LABEL[doc.type]}
          </span>
          {doc.kpiName && (
            <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-medium text-muted">
              {doc.kpiName}
            </span>
          )}
        </div>
        <div className="mt-3">
          <Markdown text={doc.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-lg border border-line bg-card py-2 pl-8 pr-3 text-sm text-fg outline-none placeholder:text-muted focus:border-accent/50"
          />
        </div>
        {onNew && (
          <button
            onClick={onNew}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-fg"
            aria-label="New note"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d.id)}
            className="w-full rounded-xl border border-line bg-card p-3 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">{d.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      TYPE_PILL[d.type],
                    )}
                  >
                    {TYPE_LABEL[d.type]}
                  </span>
                  {d.kpiName && (
                    <span className="text-[10px] text-muted">{d.kpiName}</span>
                  )}
                  {d.pendingComments ? (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
                      {d.pendingComments} pending
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        ))}
        {!filtered.length && (
          <p className="py-8 text-center text-sm text-muted">No matching notes.</p>
        )}
      </div>
    </div>
  );
}
