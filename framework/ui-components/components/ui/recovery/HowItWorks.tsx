// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// HowItWorks — the tinted info box under the KPI cards. Ported verbatim from
// RevenueRecovery.vue's info block, recolored from orange to the screen's
// indigo:
//
//   rounded-xl px-5 py-3 flex items-start gap-3,
//   bg-indigo-500/5, border border-indigo-500/10,
//   text-xs leading-relaxed, a bold lead-in then the body.
//
// METRICS.md requires the estimate's assumption to be stated on screen, so the
// default copy says what the number assumes and over what window.

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export interface HowItWorksProps {
  /** Bold lead-in, e.g. "How it works:". */
  title?: string;
  /** The explanation. Pass a node to embed the window or a link. */
  children?: ReactNode;
  className?: string;
}

export function HowItWorks({
  title = "How it works:",
  children,
  className,
}: HowItWorksProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 px-5 py-3",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden />
      <div className="text-xs leading-relaxed text-indigo-300">
        <strong className="font-semibold">{title}</strong>{" "}
        {children ?? (
          <>
            we rank every CRM lead source by how much monthly revenue it used to
            produce and no longer does. A source is <strong>dormant</strong>{" "}
            after 3 months with no sales, and <strong>declining</strong> under
            30% of its own peak. The estimate assumes a reactivated source
            returns to its own historical run rate at its own historical gross.
            That is a planning figure, not a forecast.
          </>
        )}
      </div>
    </div>
  );
}
