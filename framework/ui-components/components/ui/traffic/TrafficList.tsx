// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// TrafficList: the ranked stack of TrafficRows, biggest loss first, with the
// live page's info line and all-clear state. One row open at a time.

import { useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { TrafficRow } from "./TrafficRow";
import type { TrafficChannel } from "@/lib/demo-types";

export interface TrafficListProps {
  channels: TrafficChannel[];
  expandedChannel?: string | null;
  onExpandChange?: (channel: string | null) => void;
  /** Months in the window, for the info line. */
  months?: number;
}

export function TrafficInfo({ months = 36 }: { months?: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-orange-500/10 bg-orange-500/5 px-5 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden />
      <div className="text-xs leading-relaxed text-orange-300">
        <strong>Traffic analysis:</strong> GA4 source / medium pairs that previously drove significant
        sessions and conversions but have gone silent or fallen far below their own peak over the
        last {months} months. Units are sessions and conversions, never dollars.
      </div>
    </div>
  );
}

export function TrafficList({ channels, expandedChannel, onExpandChange, months = 36 }: TrafficListProps) {
  const [local, setLocal] = useState<string | null>(null);
  const open = expandedChannel === undefined ? local : expandedChannel;
  const setOpen = (v: string | null) => {
    setLocal(v);
    onExpandChange?.(v);
  };
  return (
    <div className="space-y-3">
      <TrafficInfo months={months} />
      {channels.length ? (
        channels.map((c) => (
          <TrafficRow
            key={c.channel}
            channel={c}
            expanded={open === c.channel}
            onToggle={() => setOpen(open === c.channel ? null : c.channel)}
          />
        ))
      ) : (
        <div className="rounded-xl border border-surface bg-surface-900/50 p-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-green-400" aria-hidden />
          <p className="text-sm font-medium text-surface-300">All clear.</p>
          <p className="mt-1 text-xs text-surface-400">No dormant or declining traffic channels found.</p>
        </div>
      )}
    </div>
  );
}
