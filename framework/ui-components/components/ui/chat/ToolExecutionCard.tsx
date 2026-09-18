// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// ToolExecutionCard — one analyst tool call. Running: indigo tint + spinner +
// present-tense label. Completed: green check + past tense + result summary,
// expandable to the raw payload, with an InlineTrendChart when the result is a
// series. Failed: red. This tri-state chip is the "terminal" motif.

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Wrench,
} from "lucide-react";
import { InlineTrendChart } from "./InlineTrendChart";
import { cn } from "@/lib/ui";
import type { ToolCall } from "@/lib/chat-types";

const RUNNING_LABELS: Record<string, string> = {
  get_kpi_data: "Fetching KPI data",
  get_drilldown_data: "Drilling into breakdown",
  get_revenue_recovery: "Analyzing revenue recovery",
  get_monthly_highlights: "Scanning for anomalies",
  search_knowledge: "Searching knowledge base",
  get_daily_trend: "Loading daily trend",
};

const DONE_LABELS: Record<string, string> = {
  get_kpi_data: "Fetched KPI data",
  get_drilldown_data: "Drilled into breakdown",
  get_revenue_recovery: "Analyzed revenue recovery",
  get_monthly_highlights: "Scanned for anomalies",
  search_knowledge: "Searched knowledge base",
  get_daily_trend: "Loaded daily trend",
};

function humanName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ToolExecutionCard({ toolCall }: { toolCall: ToolCall }) {
  const [open, setOpen] = useState(false);
  const { name, status, args, resultSummary, result, series, seriesDataType, seriesLabel } =
    toolCall;

  const argText = args
    ? Object.entries(args)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : "";

  const hasDetails = result != null;

  const tone =
    status === "running"
      ? "border-accent/30 bg-accent/10"
      : status === "failed"
        ? "border-danger/30 bg-danger/10"
        : "border-line bg-card";

  return (
    <div className={cn("rounded-xl border", tone)}>
      <button
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left",
          hasDetails && "cursor-pointer",
        )}
      >
        <span className="shrink-0">
          {status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          ) : status === "failed" ? (
            <AlertCircle className="h-4 w-4 text-danger" />
          ) : (
            <Check className="h-4 w-4 text-success" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Wrench className="h-3 w-3 text-muted" />
            <span className="font-semibold text-fg">
              {status === "running"
                ? (RUNNING_LABELS[name] ?? humanName(name))
                : (DONE_LABELS[name] ?? humanName(name))}
            </span>
            {argText && <span className="truncate text-muted">{argText}</span>}
          </div>
          {status === "completed" && resultSummary && (
            <div className="mt-0.5 truncate text-[11px] text-muted">
              {resultSummary}
            </div>
          )}
          {status === "failed" && (
            <div className="mt-0.5 text-[11px] text-danger">
              {resultSummary ?? "Tool call failed"}
            </div>
          )}
        </div>
        {hasDetails && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open && (
        <div className="border-t border-line px-3 py-2.5">
          {series && series.length > 0 && (
            <div className="mb-2">
              <InlineTrendChart
                title={seriesLabel}
                series={series}
                dataType={seriesDataType}
                height={120}
              />
            </div>
          )}
          {hasDetails && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-bg p-2.5 font-mono text-[11px] leading-relaxed text-muted">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
