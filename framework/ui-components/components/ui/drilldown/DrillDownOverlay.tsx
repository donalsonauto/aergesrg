// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// DrillDownOverlay — the whole drill experience as one generic mechanism driven
// by a metric+dimension model. It holds only UI state (the filter path and the
// selected dimension); every level of data is resolved from props via
// model.resolve(path), so a value comes in and callbacks go out. Click a
// breakdown row to drill one level deeper; click a breadcrumb to climb out.

import { useEffect, useMemo, useState } from "react";
import { DrillDownHeader } from "./DrillDownHeader";
import { DimensionSelector } from "./DimensionSelector";
import { BreakdownTable } from "./BreakdownTable";
import { MonthlyTrendChart, type MonthlyTrend } from "./MonthlyTrendChart";
import { RelatedKpis } from "./RelatedKpis";
import { ImpactAnalysis } from "./ImpactAnalysis";
import type { Crumb } from "../Breadcrumb";
import type { DataType } from "@/lib/format";
import type {
  BreakdownRow,
  DrillDownDimension,
  RelatedKpi,
} from "@/lib/demo-types";

export interface DrillFilter {
  dimension: string;
  dimensionLabel: string;
  value: string;
  label: string;
}

export interface DrillLevel {
  total: { current: number; previous: number; lastYear?: number | null };
  breakdowns: Record<string, BreakdownRow[]>;
  impact: Record<string, BreakdownRow[]>;
}

export interface DrillDownModel {
  metricKey: string;
  metricName: string;
  dataType: DataType;
  scope?: string;
  periodLabel?: string;
  invert?: boolean;
  dimensions: DrillDownDimension[];
  monthlyTrend: MonthlyTrend;
  relatedKpis: RelatedKpi[];
  /** Resolve one level of the drill for the given filter path. Pure. */
  resolve: (path: DrillFilter[]) => DrillLevel;
}

export function DrillDownOverlay({
  model,
  onClose,
  chat,
  onSelectRelated,
}: {
  model: DrillDownModel;
  onClose: () => void;
  /** Optional analyst panel rendered in the right rail. */
  chat?: React.ReactNode;
  onSelectRelated?: (kpi: RelatedKpi) => void;
}) {
  const [path, setPath] = useState<DrillFilter[]>([]);
  const [selectedDim, setSelectedDim] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(!!chat);

  // ESC to close + lock the page scroll while the overlay is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const level = useMemo(() => model.resolve(path), [model, path]);

  const usedDims = useMemo(() => new Set(path.map((f) => f.dimension)), [path]);
  const availableDims = model.dimensions.filter((d) => !usedDims.has(d.key));

  // Default the selected dimension to the first available at this level.
  const effectiveDim =
    selectedDim && availableDims.some((d) => d.key === selectedDim)
      ? selectedDim
      : (availableDims[0]?.key ?? null);

  const dimLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(model.dimensions.map((d) => [d.key, d.label])),
    [model.dimensions],
  );

  const crumbs: Crumb[] = [
    { label: "All", index: -1 },
    ...path.map((f, i) => ({ label: `${f.dimensionLabel}: ${f.label}`, index: i })),
  ];

  function drillInto(row: BreakdownRow) {
    if (!effectiveDim) return;
    const dim = model.dimensions.find((d) => d.key === effectiveDim);
    setPath((p) => [
      ...p,
      {
        dimension: effectiveDim,
        dimensionLabel: dim?.label ?? effectiveDim,
        value: row.id,
        label: row.label,
      },
    ]);
    setSelectedDim(null);
  }

  function navigate(index: number) {
    setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)));
    setSelectedDim(null);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex animate-overlay-in flex-col bg-bg">
      <DrillDownHeader
        metricName={model.metricName}
        scope={model.scope}
        currentValue={level.total.current}
        previousValue={level.total.previous}
        lastYearValue={level.total.lastYear}
        dataType={model.dataType}
        periodLabel={model.periodLabel}
        crumbs={crumbs}
        onNavigate={navigate}
        onClose={onClose}
        invert={model.invert}
        chatOpen={chatOpen}
        onToggleChat={chat ? () => setChatOpen((v) => !v) : undefined}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
            <div className="section-stagger" style={{ animationDelay: "0s" }}>
              <RelatedKpis items={model.relatedKpis} onSelect={onSelectRelated} />
            </div>

            <div className="section-stagger" style={{ animationDelay: "0.08s" }}>
              <ImpactAnalysis
                impact={level.impact}
                dimensionLabels={dimLabels}
                dataType={model.dataType}
                onFilter={(dim, row) => {
                  setSelectedDim(dim);
                  const d = model.dimensions.find((x) => x.key === dim);
                  setPath((p) => [
                    ...p,
                    {
                      dimension: dim,
                      dimensionLabel: d?.label ?? dim,
                      value: row.id,
                      label: row.label,
                    },
                  ]);
                  setSelectedDim(null);
                }}
              />
            </div>

            <div className="section-stagger" style={{ animationDelay: "0.16s" }}>
              <MonthlyTrendChart trend={model.monthlyTrend} dataType={model.dataType} />
            </div>

            <div className="section-stagger" style={{ animationDelay: "0.24s" }}>
              <DimensionSelector
                dimensions={availableDims}
                selected={effectiveDim}
                onSelect={setSelectedDim}
              />
              <BreakdownTable
                data={effectiveDim ? (level.breakdowns[effectiveDim] ?? []) : []}
                dataType={model.dataType}
                dimensionLabel={effectiveDim}
                onRowClick={drillInto}
              />
            </div>
          </div>
        </div>

        {chat && chatOpen && (
          <div className="hidden w-[360px] shrink-0 border-l border-line md:block xl:w-[400px]">
            {chat}
          </div>
        )}
      </div>
    </div>
  );
}
