// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// BreakdownTable — children of the current drill level. Sortable columns; click
// a row to drill one level deeper into that value. Rows with a big swing get a
// faint row tint. Pure: data and dataType in, onRowClick out.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Table2 } from "lucide-react";
import { formatValue, type DataType } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { BreakdownRow } from "@/lib/demo-types";

type SortField = "label" | "current" | "previous" | "variance" | "variancePct" | "lastYear";

export function BreakdownTable({
  data,
  dataType = "int",
  dimensionLabel,
  onRowClick,
}: {
  data: BreakdownRow[];
  dataType?: DataType;
  dimensionLabel?: string | null;
  onRowClick?: (row: BreakdownRow) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("current");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      if (sortField === "label") {
        return sortDir === -1
          ? b.label.localeCompare(a.label)
          : a.label.localeCompare(b.label);
      }
      const av = (a[sortField] ?? 0) as number;
      const bv = (b[sortField] ?? 0) as number;
      return sortDir === -1 ? bv - av : av - bv;
    });
    return rows;
  }, [data, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortField(field);
      setSortDir(-1);
    }
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card py-12 text-center">
        <Table2 className="mb-2 h-7 w-7 text-muted/50" />
        <p className="text-sm text-muted">
          {dimensionLabel ? "No breakdown data" : "Select a dimension above"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <Th label="Name" field="label" align="left" {...{ sortField, sortDir, toggleSort }} />
              <Th label="Current" field="current" {...{ sortField, sortDir, toggleSort }} />
              <Th label="Prev" field="previous" {...{ sortField, sortDir, toggleSort }} />
              <Th label="Change" field="variance" className="hidden sm:table-cell" {...{ sortField, sortDir, toggleSort }} />
              <Th label="Chg %" field="variancePct" {...{ sortField, sortDir, toggleSort }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-line/60 transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-elevated",
                  row.variancePct != null && row.variancePct >= 15 && "bg-success/5",
                  row.variancePct != null && row.variancePct <= -15 && "bg-danger/5",
                )}
              >
                <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-fg">
                  {row.label}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-fg">
                  {formatValue(row.current, dataType)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                  {formatValue(row.previous, dataType)}
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">
                  <span
                    className={cn(
                      "font-semibold",
                      row.variance > 0
                        ? "text-success"
                        : row.variance < 0
                          ? "text-danger"
                          : "text-muted",
                    )}
                  >
                    {row.variance > 0 ? "+" : ""}
                    {formatValue(row.variance, dataType)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.variancePct != null ? (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-semibold",
                        row.variancePct > 0
                          ? "bg-success/15 text-success"
                          : row.variancePct < 0
                            ? "bg-danger/15 text-danger"
                            : "text-muted",
                      )}
                    >
                      {row.variancePct > 0 ? "+" : ""}
                      {row.variancePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  field,
  align = "right",
  className,
  sortField,
  sortDir,
  toggleSort,
}: {
  label: string;
  field: SortField;
  align?: "left" | "right";
  className?: string;
  sortField: SortField;
  sortDir: -1 | 1;
  toggleSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  const Icon = !active ? ChevronsUpDown : sortDir === -1 ? ArrowDown : ArrowUp;
  return (
    <th
      onClick={() => toggleSort(field)}
      className={cn(
        "cursor-pointer select-none px-4 py-2.5 kpi-label hover:text-fg",
        align === "left" ? "text-left" : "text-right",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-accent" : "text-muted/60")} />
      </span>
    </th>
  );
}
