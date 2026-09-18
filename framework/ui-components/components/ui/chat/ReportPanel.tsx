// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// ReportPanel — a saved investigation: numbered section cards, each with an
// auto-titled header, an editable narrative (rendered markdown), and its data
// blocks (mini KPIs, tool cards, inline trends). Editing and export are surfaced
// as callbacks; the content is a prop.

import { useState } from "react";
import { Download, FileText, Pencil } from "lucide-react";
import { Markdown } from "../Markdown";
import { ToolExecutionCard } from "./ToolExecutionCard";
import { InlineTrendChart } from "./InlineTrendChart";
import { formatValue, pctChange } from "@/lib/format";
import type { ChatBlock, SavedReport } from "@/lib/chat-types";

function SectionBlock({ block }: { block: ChatBlock }) {
  switch (block.type) {
    case "text":
      return <Markdown text={block.text} />;
    case "tool":
      return <ToolExecutionCard toolCall={block.toolCall} />;
    case "trend":
      return (
        <InlineTrendChart title={block.title} series={block.series} dataType={block.dataType} />
      );
    case "kpiGroup":
      return (
        <div className="grid grid-cols-2 gap-2">
          {block.kpis.map((k) => {
            const change = pctChange(k.current, k.previous);
            return (
              <div key={k.key} className="rounded-lg border border-line bg-card p-2.5">
                <div className="mb-1 truncate text-[11px] text-muted">{k.name}</div>
                <div className="text-sm font-bold tabular-nums text-fg">
                  {formatValue(k.current, k.dataType)}
                </div>
                {change != null && (
                  <div
                    className={
                      change < 0 ? "text-[11px] text-danger" : "text-[11px] text-success"
                    }
                  >
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
  }
}

export function ReportPanel({
  report,
  onExport,
  onEditNarrative,
}: {
  report: SavedReport;
  onExport?: () => void;
  onEditNarrative?: (sectionId: string, narrative: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <FileText className="h-4 w-4 text-accent" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{report.title}</div>
          {report.periodLabel && (
            <div className="text-[11px] text-muted">{report.periodLabel}</div>
          )}
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-elevated"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {report.sections.map((section, i) => (
          <div key={section.id} className="rounded-xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-semibold text-fg">{section.title}</span>
              {section.toolCount != null && (
                <span className="text-[11px] text-muted">{section.toolCount} calls</span>
              )}
              {onEditNarrative && editing !== section.id && (
                <button
                  onClick={() => {
                    setEditing(section.id);
                    setDraft(section.narrative);
                  }}
                  className="text-muted transition-colors hover:text-fg"
                  aria-label="Edit narrative"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {editing === section.id ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-line bg-bg p-2 text-sm text-fg outline-none focus:border-accent/50"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onEditNarrative?.(section.id, draft);
                      setEditing(null);
                    }}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <Markdown text={section.narrative} />
            )}

            {section.blocks && section.blocks.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {section.blocks.map((b, j) => (
                  <SectionBlock key={j} block={b} />
                ))}
              </div>
            )}
          </div>
        ))}
        {!report.sections.length && (
          <div className="py-12 text-center text-sm text-muted">
            No sections in this report yet.
          </div>
        )}
      </div>
    </div>
  );
}
