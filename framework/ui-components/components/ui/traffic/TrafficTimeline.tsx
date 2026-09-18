// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// TrafficTimeline: the live v2 Traffic Timeline. Sessions as an orange area on
// the left axis, VDP views as a green line and conversions as a purple line,
// each on its own right axis with its own ticks, circle legend on top.

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth, int } from "@/lib/format";
import { TOKEN } from "@/lib/ui";
import type { TrafficTimelinePoint } from "@/lib/demo-types";

const SESS = "#fb923c"; // orange-400
const VDP = "#34d399"; // emerald-400
const CONV = "#a855f7"; // purple-500
const AXIS = { fontSize: 11, fill: TOKEN.axis };

function TrafficTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0;
  const row = (color: string, name: string, value: string) => (
    <div className="flex items-center gap-2 text-surface-400">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name} <span className="ml-auto tabular-nums text-surface-100">{value}</span>
    </div>
  );
  return (
    <div className="min-w-[160px] rounded-lg border border-surface bg-surface-900 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-surface-100">{formatMonth(String(label))}</div>
      {row(SESS, "Sessions", int(get("sessions")))}
      {row(VDP, "VDP Views", int(get("vdpViews")))}
      {row(CONV, "Conversions", int(get("conversions")))}
    </div>
  );
}

export function TrafficTimeline({
  data,
  height = 380,
}: {
  data: TrafficTimelinePoint[];
  height?: number;
}) {
  if (!data?.length) return null;
  const tickEvery = data.length > 18 ? 4 : data.length > 8 ? 2 : 1;
  const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)},000`.replace(/,000$/, ",000") : String(v));
  return (
    <div>
      <div className="mb-1 flex items-center justify-center gap-5 text-xs text-surface-300">
        {[[SESS, "Sessions"], [VDP, "VDP Views"], [CONV, "Conversions"]].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full border-[3px]" style={{ borderColor: c }} />
            {l}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="traffic-sess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SESS} stopOpacity={0.3} />
              <stop offset="100%" stopColor={SESS} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="traffic-conv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CONV} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CONV} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={TOKEN.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            interval={tickEvery - 1}
            tickFormatter={(m) => formatMonth(String(m))}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis yAxisId="sessions" tick={{ fontSize: 11, fill: SESS }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => compact(Number(v))}
            label={{ value: "Sessions", angle: -90, position: "insideLeft", fill: SESS, fontSize: 11, dx: 8 }} />
          <YAxis yAxisId="vdp" orientation="right" tick={{ fontSize: 11, fill: VDP }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => compact(Number(v))}
            label={{ value: "VDP Views", angle: 90, position: "insideRight", fill: VDP, fontSize: 11, dx: -6 }} />
          <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11, fill: CONV }} tickLine={false} axisLine={false} width={44}
            label={{ value: "Conversions", angle: 90, position: "insideRight", fill: CONV, fontSize: 11, dx: -6 }} />
          <Tooltip content={<TrafficTooltip />} cursor={{ stroke: TOKEN.line }} />
          <Area yAxisId="sessions" type="monotone" dataKey="sessions" stroke={SESS} strokeWidth={2} fill="url(#traffic-sess)" isAnimationActive={false} dot={{ r: 2, fill: SESS, strokeWidth: 0 }} activeDot={{ r: 4 }} />
          <Line yAxisId="vdp" type="monotone" dataKey="vdpViews" stroke={VDP} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Area yAxisId="conv" type="monotone" dataKey="conversions" stroke={CONV} strokeWidth={2} fill="url(#traffic-conv)" isAnimationActive={false} dot={{ r: 2, fill: CONV, strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
