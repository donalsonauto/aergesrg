// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// DealershipHealth: v2's "Dealership Health" panel, credit-score style. A thick
// red-to-green arc with a tick ring, the composite score in the middle on a
// 0 to 1000 scale (the 0..100 composite from reference/METRICS.md times ten),
// and a boxed list of Sales / Leads / Gross versus the prior month.

import { changeColor, pctChange } from "@/lib/format";
import { cn } from "@/lib/ui";
import { SectionCard } from "./SectionCard";

export interface DealershipHealthProps {
  /** Composite 0..100 (METRICS.md). Shown times ten, like a credit score. */
  score: number | null;
  rows: Array<{ label: string; current: number | null; previous: number | null; invert?: boolean }>;
  title?: string;
  caption?: string;
  onAsk?: () => void;
  className?: string;
}

export function DealershipHealth({
  score,
  rows,
  title = "Dealership Health",
  caption = "Dealership Health",
  onAsk,
  className,
}: DealershipHealthProps) {
  const r = 84;
  const cx = 110;
  const cy = 112;
  const len = Math.PI * r;
  const filled = score == null ? 0 : (Math.max(0, Math.min(100, score)) / 100) * len;
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const a = Math.PI + (i / 40) * Math.PI;
    const inner = r - 16, outer = i % 5 === 0 ? r - 26 : r - 22;
    return { x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a), x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a) };
  });
  return (
    <SectionCard title={title} onAsk={onAsk} className={className}>
      <div className="relative mx-auto w-full max-w-[240px]">
        <svg viewBox="0 0 220 124" className="w-full">
          <defs>
            <linearGradient id="dh-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#27272a" strokeWidth="14" strokeLinecap="round" />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="url(#dh-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${len}`}
          />
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#3f3f46" strokeWidth={i % 5 === 0 ? 1.5 : 1} />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <span className="text-4xl font-bold leading-none tabular-nums text-surface-0">
            {score == null ? "--" : Math.round(score * 10)}
          </span>
          <span className="mt-1 text-xs text-surface-400">{caption}</span>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-surface">
        <div className="flex flex-col gap-2 p-3">
          {rows.map((row, i) => {
            const ch = pctChange(row.current, row.previous);
            const tone = changeColor(ch, row.invert);
            return (
              <div key={row.label}>
                {i > 0 && <div className="mb-2 h-px bg-surface-800" />}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-surface-400">{row.label}</span>
                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums",
                      tone === "positive" ? "bg-green-500/20 text-green-400" : tone === "negative" ? "bg-red-500/20 text-red-400" : "bg-surface-800 text-surface-400",
                    )}
                  >
                    {ch == null ? "--" : `${ch.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
