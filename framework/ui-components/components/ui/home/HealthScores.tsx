// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HealthScores: v2's strip of small score tiles, one per tracked metric: the
// category in 8px caps, a ringed score, the metric name, its value, and a bar.

import { formatValue } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { HomeHealthScore } from "@/lib/demo-types";

const RING: Record<HomeHealthScore["tone"], string> = {
  positive: "border-green-500 text-green-500 bg-green-500/10",
  negative: "border-red-500 text-red-500 bg-red-500/10",
  neutral: "border-surface-400 text-surface-400 bg-surface-400/10",
};
const BAR: Record<HomeHealthScore["tone"], string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-surface-400",
};

export function HealthScores({ scores, title = "Health Scores" }: { scores: HomeHealthScore[]; title?: string }) {
  if (!scores.length) return null;
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-surface-0">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
        {scores.map((hs) => (
          <div key={hs.key} className="rounded-xl border border-surface bg-surface-900/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-widest text-surface-400">{hs.category}</span>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold", RING[hs.tone])}>
                {hs.score ?? "--"}
              </div>
            </div>
            <span className="mb-0.5 block text-[11px] font-medium text-surface-200">{hs.label}</span>
            <span className="text-sm font-bold tabular-nums text-surface-0">{hs.current != null ? formatValue(hs.current, hs.dataType) : "--"}</span>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-800">
              <div className={cn("h-full rounded-full transition-all duration-700", BAR[hs.tone])} style={{ width: `${hs.score ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
