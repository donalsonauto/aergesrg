// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// ChatMessages — the transcript. User messages are right-aligned bubbles;
// assistant messages are full-width and render an ordered block list (markdown,
// grouped mini-KPI cards, tool-execution cards, inline trend charts). Streaming
// state is a prop: when isStreaming, a live status line shows at the bottom.

import { Sparkles } from "lucide-react";
import { Markdown } from "../Markdown";
import { ToolExecutionCard } from "./ToolExecutionCard";
import { InlineTrendChart } from "./InlineTrendChart";
import { formatValue, pctChange, changeColor } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { ChatBlock, ChatMessage, MiniKpi } from "@/lib/chat-types";

function MiniKpiCard({ kpi, onClick }: { kpi: MiniKpi; onClick?: () => void }) {
  const change = pctChange(kpi.current, kpi.previous);
  const color = changeColor(change, kpi.key === "cps");
  return (
    <button
      onClick={onClick}
      className="min-w-[130px] rounded-lg border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-elevated"
    >
      <div className="mb-1 truncate text-[11px] text-muted">{kpi.name}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold tabular-nums text-fg">
          {formatValue(kpi.current, kpi.dataType)}
        </span>
        {change != null && (
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              color === "positive"
                ? "text-success"
                : color === "negative"
                  ? "text-danger"
                  : "text-muted",
            )}
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  );
}

function Block({
  block,
  onKpiClick,
}: {
  block: ChatBlock;
  onKpiClick?: (key: string) => void;
}) {
  switch (block.type) {
    case "text":
      return <Markdown text={block.text} />;
    case "tool":
      return <ToolExecutionCard toolCall={block.toolCall} />;
    case "kpiGroup":
      return (
        <div className="flex flex-wrap gap-2">
          {block.kpis.map((k) => (
            <MiniKpiCard key={k.key} kpi={k} onClick={() => onKpiClick?.(k.key)} />
          ))}
        </div>
      );
    case "trend":
      return (
        <InlineTrendChart
          title={block.title}
          series={block.series}
          dataType={block.dataType}
        />
      );
  }
}

export function ChatMessages({
  messages,
  isStreaming = false,
  streamingStatus,
  onKpiClick,
  emptyState,
}: {
  messages: ChatMessage[];
  isStreaming?: boolean;
  /** Humanized live status, e.g. "Fetching KPI data (2/3)". */
  streamingStatus?: string;
  onKpiClick?: (key: string) => void;
  emptyState?: React.ReactNode;
}) {
  if (!messages.length && emptyState) {
    return <div className="flex flex-1 items-center justify-center p-6">{emptyState}</div>;
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-white">
              {m.text}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="kpi-label">AI Analytics</span>
                {m.timeSavedMin != null && (
                  <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                    saved ~{m.timeSavedMin} min
                  </span>
                )}
              </div>
              {m.text && <Markdown text={m.text} />}
              {m.blocks?.map((b, i) => (
                <Block key={i} block={b} onKpiClick={onKpiClick} />
              ))}
            </div>
          </div>
        ),
      )}

      {isStreaming && (
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" />
          </div>
          <div className="flex items-center gap-2 pt-1 text-sm text-muted">
            <span className="flex gap-1">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </span>
            {streamingStatus && <span>{streamingStatus}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
