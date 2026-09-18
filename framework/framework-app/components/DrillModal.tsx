// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCompactMoney,
  formatUnits,
  formatPercent,
  formatMonthShort,
  formatMonthLong,
} from "@/lib/format";

// The drill hierarchy, one level at a time. The month is the leaf.
const DIM_ORDER = ["rooftop", "source", "month"] as const;
type Dimension = (typeof DIM_ORDER)[number];
type Crumb = { dimension: Dimension; key: string; label: string };
type Point = { period: string; value: number };
type Child = { key: string; label: string; value: number | null };

const NEXT_LABEL: Record<Dimension, string> = {
  rooftop: "rooftop",
  source: "lead source",
  month: "month",
};

function queryMetric(cardKey: string): string {
  return cardKey === "closing" ? "closing_ratio" : cardKey;
}
function fmt(cardKey: string): (v: number | null | undefined) => string {
  if (cardKey === "gross") return formatCompactMoney;
  if (cardKey === "closing") return (v) => formatPercent(v);
  return formatUnits;
}
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DrillModal({
  metricKey,
  metricLabel,
  color,
  baseStore,
  leadType,
  from,
  to,
  onClose,
}: {
  metricKey: string;
  metricLabel: string;
  color: string;
  baseStore: { id: string; label: string } | null; // active rooftop filter, if any
  leadType: string | null;
  from: string;
  to: string;
  onClose: () => void;
}) {
  // If a rooftop filter is active, the drill is already inside it: seed the path
  // with that rooftop so the breadcrumb roots there and the first drill is source.
  const baseFixed: Crumb[] = baseStore
    ? [{ dimension: "rooftop", key: baseStore.id, label: baseStore.label }]
    : [];

  const [path, setPath] = useState<Crumb[]>([]);
  const [timeline, setTimeline] = useState<Point[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const format = fmt(metricKey);
  const fullPath = [...baseFixed, ...path];
  const childDimension: Dimension | null = DIM_ORDER[fullPath.length] ?? null;
  const selectedMonth = fullPath.find((c) => c.dimension === "month")?.key ?? null;
  const store = fullPath.find((c) => c.dimension === "rooftop")?.key;
  const source = fullPath.find((c) => c.dimension === "source")?.key;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ metric: queryMetric(metricKey), from, to });
    if (store) params.set("store", store);
    if (source) params.set("source", source);
    if (leadType) params.set("leadType", leadType);
    if (childDimension) params.set("child", childDimension);
    const res = await fetch(`/api/drill?${params.toString()}`);
    const data = await res.json();
    setTimeline(data.timeline ?? []);
    setChildren(data.children ?? []);
    setLoading(false);
  }, [metricKey, store, source, leadType, from, to, childDimension]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const descend = (child: Child) => {
    if (!childDimension) return;
    const label = childDimension === "month" ? formatMonthShort(child.key) : child.label;
    setPath([...path, { dimension: childDimension, key: child.key, label }]);
  };

  // Breadcrumb: root is the filter scope (a rooftop, or All Stores); climb only
  // back to that root, never above the active filter.
  const rootLabel = baseStore ? baseStore.label : "All Stores";
  const crumbs = [
    { label: rootLabel, to: [] as Crumb[] },
    ...path.map((c, i) => ({ label: c.label, to: path.slice(0, i + 1) })),
  ];

  const constraint = [
    leadType ? `${titleCase(leadType)} leads` : null,
    `${formatMonthShort(from)}–${formatMonthShort(to)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const selectedPoint = selectedMonth ? timeline.find((p) => p.period === selectedMonth) : undefined;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50 }}
      className="flex items-start justify-center overflow-y-auto p-4 sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[880px] rounded-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <div
              className="text-[11px] font-medium uppercase mb-2"
              style={{ color: "var(--fg-muted)", letterSpacing: "0.1em" }}
            >
              {metricLabel} &middot; drill-down &middot;{" "}
              <span style={{ textTransform: "none", letterSpacing: 0 }}>{constraint}</span>
            </div>
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span style={{ color: "var(--fg-muted)" }}>›</span>}
                  <button
                    onClick={() => setPath(c.to)}
                    className="rounded px-1.5 py-0.5"
                    style={{
                      color: i === crumbs.length - 1 ? "var(--fg)" : "var(--fg-muted)",
                      fontWeight: i === crumbs.length - 1 ? 600 : 400,
                    }}
                  >
                    {c.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2.5 py-1 text-lg leading-none"
            style={{ color: "var(--fg-muted)", border: "1px solid var(--border)" }}
          >
            ✕
          </button>
        </div>

        <div className="px-6">
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
          >
            {selectedPoint && (
              <div className="mb-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                {formatMonthLong(selectedPoint.period)}:{" "}
                <span className="tnum" style={{ color, fontWeight: 600 }}>
                  {format(selectedPoint.value)}
                </span>
              </div>
            )}
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="drillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatMonthShort}
                    interval={"preserveStartEnd"}
                    minTickGap={28}
                    tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => format(v)}
                    tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border)" }}
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(l) => formatMonthShort(String(l))}
                    formatter={(v: number) => [format(v), metricLabel]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill="url(#drillGrad)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {selectedPoint && (
                    <ReferenceDot
                      x={selectedPoint.period}
                      y={selectedPoint.value}
                      r={5}
                      fill={color}
                      stroke="var(--bg)"
                      strokeWidth={2}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="p-6 pt-5">
          {childDimension ? (
            <>
              <div
                className="text-[11px] font-medium uppercase mb-3"
                style={{ color: "var(--fg-muted)", letterSpacing: "0.08em" }}
              >
                Drill into {NEXT_LABEL[childDimension]}
                {loading && <span className="ml-2 normal-case">loading…</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto">
                {children.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => descend(c)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  >
                    <span className="text-sm truncate" style={{ color: "var(--fg)" }}>
                      {childDimension === "month" ? formatMonthShort(c.label) : c.label}
                    </span>
                    <span className="text-sm tnum ml-3 shrink-0" style={{ color }}>
                      {format(c.value)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Deepest level. Use the breadcrumb above to climb back out.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
