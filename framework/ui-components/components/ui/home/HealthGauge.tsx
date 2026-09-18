// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HealthGauge: v2's "Website Performance Health" panel, here scoring lead
// health (reference/METRICS.md, "Lead Health score"). A half-donut gauge with a
// red-to-green gradient, the composite score in the middle, one bar per
// sub-score, and two small rank boxes.

import { cn } from "@/lib/ui";
import type { HealthSubScore } from "@/lib/demo-types";
import { SectionCard } from "./SectionCard";

export interface HealthGaugeProps {
  title?: string;
  score: number | null;
  subScores: HealthSubScore[];
  /** "#1 of 3" for the current store, or null at group scope. */
  ownRank?: { rank: number; of: number } | null;
  best?: { store: string; score: number } | null;
  worst?: { store: string; score: number } | null;
  onAsk?: () => void;
  className?: string;
}

function scoreColor(s: number | null) {
  if (s == null) return "text-surface-400";
  if (s >= 75) return "text-green-400";
  if (s >= 50) return "text-amber-400";
  return "text-red-400";
}

export function HealthGauge({
  title = "Lead Health",
  score,
  subScores,
  ownRank,
  best,
  worst,
  onAsk,
  className,
}: HealthGaugeProps) {
  // Half circle of radius 80 centered at (100, 100): arc length = pi * r.
  const r = 80;
  const len = Math.PI * r;
  const filled = score == null ? 0 : (Math.max(0, Math.min(100, score)) / 100) * len;
  return (
    <SectionCard title={title} onAsk={onAsk} askLabel="Ask AI about this health score" className={className}>
      {score == null ? (
        <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-sm text-surface-400">
          Not enough data to score this scope.
        </div>
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-[220px]">
            <svg viewBox="0 0 200 110" className="w-full">
              <defs>
                <linearGradient id="health-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(220,38,38)" />
                  <stop offset="50%" stopColor="rgb(250,204,21)" />
                  <stop offset="100%" stopColor="rgb(34,197,94)" />
                </linearGradient>
              </defs>
              <path
                d={`M 20 100 A ${r} ${r} 0 0 1 180 100`}
                fill="none"
                stroke="#27272a"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d={`M 20 100 A ${r} ${r} 0 0 1 180 100`}
                fill="none"
                stroke="url(#health-grad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${len}`}
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span className={cn("text-3xl font-bold leading-none tabular-nums", scoreColor(score))}>
                {score}
              </span>
              <span className="mt-1 text-[10px] uppercase tracking-wider text-surface-400">of 100</span>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {subScores.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-[74px] shrink-0 text-[10px] font-medium text-surface-400">{s.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-800">
                  {s.value != null && (
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.value}%`, backgroundColor: s.color }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "w-7 text-right text-[10px] font-bold tabular-nums",
                    s.value == null ? "text-surface-600" : "text-surface-200",
                  )}
                >
                  {s.value == null ? "--" : s.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-surface p-2 text-center">
              {ownRank ? (
                <>
                  <div className="text-sm font-bold text-surface-100">
                    #{ownRank.rank}
                    <span className="font-medium text-surface-400"> of {ownRank.of}</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-surface-400">Your stores</div>
                </>
              ) : best ? (
                <>
                  <div className="truncate text-sm font-bold text-surface-100">{best.store}</div>
                  <div className="text-[9px] uppercase tracking-wider text-surface-400">Best, {best.score}</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-surface-400">--</div>
                  <div className="text-[9px] uppercase tracking-wider text-surface-400">Single store</div>
                </>
              )}
            </div>
            <div className="rounded-lg border border-surface p-2 text-center">
              {worst ? (
                <>
                  <div className="truncate text-sm font-bold text-surface-100">{worst.store}</div>
                  <div className="text-[9px] uppercase tracking-wider text-surface-400">Needs work, {worst.score}</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-surface-400">--</div>
                  <div className="text-[9px] uppercase tracking-wider text-surface-400">No benchmark</div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
