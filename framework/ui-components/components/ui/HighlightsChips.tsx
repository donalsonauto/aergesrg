// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HighlightsChips — the rule-engine anomaly questions as clickable chips. Each
// chip is a suggested question for the analyst; click emits it. Direction tints
// the leading icon (drop = danger, rise = success, cost improvement = success).

import { TrendingDown, TrendingUp } from "lucide-react";
import { highlightQuestion } from "@/lib/highlights";
import { cn } from "@/lib/ui";
import type { Highlight } from "@/lib/demo-types";

export function HighlightsChips({
  highlights,
  fallback = [],
  onSelect,
  title = "Highlights",
}: {
  highlights: Highlight[];
  /** Plain-string prompts to show when there are no highlights. */
  fallback?: string[];
  onSelect?: (question: string) => void;
  title?: string;
}) {
  const hasHighlights = highlights.length > 0;
  const items = hasHighlights
    ? highlights.map((h) => ({ h, text: highlightQuestion(h) }))
    : fallback.map((text) => ({ h: null as Highlight | null, text }));

  if (!items.length) return null;

  return (
    <div>
      {title && <h3 className="mb-3 kpi-label">{title}</h3>}
      <div className="flex flex-wrap gap-2">
        {items.map(({ h, text }, i) => {
          const isDrop =
            h != null && (h.costMetric ? h.changePct < 0 : h.changePct < 0);
          const good = h != null && h.costMetric ? h.changePct < 0 : (h?.changePct ?? 0) > 0;
          return (
            <button
              key={i}
              onClick={() => onSelect?.(text)}
              className="group inline-flex max-w-full items-start gap-2 rounded-xl border border-line bg-card px-3 py-2 text-left text-xs text-fg transition-colors hover:border-accent/40 hover:bg-elevated"
            >
              {h != null &&
                (isDrop && !good ? (
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                ) : (
                  <TrendingUp
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      good ? "text-success" : "text-warning",
                    )}
                  />
                ))}
              <span className="leading-snug">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
