// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Gallery-only glue: turns the static demo dataset into the props each component
// expects, including a pure DrillDownModel.resolve() that nests one level deeper
// by scaling the other dimensions by the drilled value's share. This lives with
// the gallery, not in the kit: the kit stays data-source agnostic.

import { demo } from "@/lib/demo-data";
import type {
  DrillDownModel,
  DrillFilter,
  DrillLevel,
} from "@/components/ui";
import type { BreakdownRow } from "@/lib/demo-types";
import type {
  BusinessEvent,
  ChatMessage,
  Instruction,
  KnowledgeDoc,
  SavedReport,
} from "@/lib/chat-types";
import { formatMonth } from "@/lib/format";

const dd = demo.drilldown;

function recompute(rows: BreakdownRow[]): BreakdownRow[] {
  return rows.map((r) => ({
    ...r,
    variance: r.current - r.previous,
    variancePct: r.previous ? ((r.current - r.previous) / Math.abs(r.previous)) * 100 : null,
  }));
}

function scaleRows(rows: BreakdownRow[], curFactor: number, prevFactor: number): BreakdownRow[] {
  return recompute(
    rows.map((r) => ({
      ...r,
      current: Math.round(r.current * curFactor),
      previous: Math.round(r.previous * prevFactor),
      lastYear: r.lastYear != null ? Math.round(r.lastYear * curFactor) : r.lastYear,
    })),
  );
}

function shareFor(path: DrillFilter[]) {
  let cur = 1;
  let prev = 1;
  for (const f of path) {
    const rows = dd.breakdowns[f.dimension] ?? [];
    const row = rows.find((r) => r.id === f.value);
    const totalCur = rows.reduce((a, r) => a + r.current, 0) || 1;
    const totalPrev = rows.reduce((a, r) => a + r.previous, 0) || 1;
    if (row) {
      cur *= row.current / totalCur;
      prev *= row.previous / totalPrev;
    }
  }
  return { cur, prev };
}

export function buildDrillModel(onSelectRelated?: () => void): DrillDownModel {
  void onSelectRelated;
  return {
    metricKey: dd.metricKey,
    metricName: dd.metricName,
    dataType: dd.dataType,
    scope: "All Stores",
    periodLabel: formatMonth(dd.periodLabel),
    dimensions: dd.dimensions,
    monthlyTrend: dd.monthlyTrend,
    relatedKpis: dd.relatedKpis,
    resolve(path: DrillFilter[]): DrillLevel {
      if (path.length === 0) {
        return {
          total: { current: dd.current, previous: dd.previous, lastYear: dd.lastYear },
          breakdowns: dd.breakdowns,
          impact: dd.impact,
        };
      }
      const { cur, prev } = shareFor(path);
      const usedDims = new Set(path.map((f) => f.dimension));
      const breakdowns: Record<string, BreakdownRow[]> = {};
      const impact: Record<string, BreakdownRow[]> = {};
      for (const dim of dd.dimensions) {
        if (usedDims.has(dim.key)) continue;
        const scaled = scaleRows(dd.breakdowns[dim.key] ?? [], cur, prev);
        breakdowns[dim.key] = scaled;
        impact[dim.key] = [...scaled]
          .filter((r) => r.variance !== 0)
          .sort((a, b) => a.variance - b.variance)
          .slice(0, 5);
      }
      return {
        total: {
          current: Math.round(dd.current * cur),
          previous: Math.round(dd.previous * prev),
          lastYear: Math.round(dd.lastYear * cur),
        },
        breakdowns,
        impact,
      };
    },
  };
}

// ---- Analyst chat sample transcript ---------------------------------------
export const sampleMessages: ChatMessage[] = [
  {
    id: "u1",
    role: "user",
    text: "Total gross profit dropped to $1.1M (down 8% from $1.2M). What's causing this?",
  },
  {
    id: "a1",
    role: "assistant",
    timeSavedMin: 18,
    blocks: [
      {
        type: "tool",
        toolCall: {
          id: "t1",
          name: "get_kpi_data",
          status: "completed",
          args: { metric: "Total Gross", month: "Aug 26" },
          resultSummary: "$1.1M this month vs $1.2M prior",
          result: { current: 1094738, previous: 1192524, dataType: "money" },
        },
      },
      {
        type: "text",
        text: "Gross fell **8.2%** month over month. The drop is concentrated in two places, not spread evenly:",
      },
      {
        type: "kpiGroup",
        kpis: [
          { key: "sales", name: "Units Sold", current: 344, previous: 367, dataType: "units" },
          { key: "closingRatio", name: "Closing Ratio", current: 11.1, previous: 11.6, dataType: "pct" },
          { key: "avgGross", name: "Avg Gross / Sale", current: 3182, previous: 3250, dataType: "moneyWhole" },
        ],
      },
      {
        type: "tool",
        toolCall: {
          id: "t2",
          name: "get_drilldown_data",
          status: "completed",
          args: { metric: "Total Gross", by: "store" },
          resultSummary: "Chevrolet Cranberry down 22%, the largest mover",
          result: dd.breakdowns.store,
        },
      },
      {
        type: "text",
        text: "**Chevrolet Cranberry** is the biggest single driver, off 22% on the month. Its used volume held, but new-car gross compressed. Two declining lead sources (CarGurus, TrueCar) also fed fewer units into the funnel.",
      },
      {
        type: "trend",
        title: "Total Gross, last 12 months",
        series: dd.monthlyTrend.labels.map((m, i) => ({
          month: m,
          value: dd.monthlyTrend.current[i],
        })),
        dataType: "money",
      },
    ],
  },
];

export const sampleReport: SavedReport = {
  title: "August gross decline: root-cause",
  periodLabel: formatMonth(demo.meta.analysisMonth),
  sections: [
    {
      id: "s1",
      title: "Headline",
      narrative:
        "Group gross came in at **$1.1M**, down 8.2% from July. The decline is not broad based: two rooftops account for most of it, and lead supply from two declining sources is the upstream cause.",
      toolCount: 2,
      blocks: [
        {
          type: "kpiGroup",
          kpis: [
            { key: "gross", name: "Total Gross", current: 1094738, previous: 1192524, dataType: "money" },
            { key: "sales", name: "Units Sold", current: 344, previous: 367, dataType: "units" },
          ],
        },
      ],
    },
    {
      id: "s2",
      title: "By store",
      narrative:
        "Chevrolet Cranberry (-22%) and Nissan Boardman (-12%) drove the miss. Honda Monroeville was roughly flat.",
      toolCount: 1,
      blocks: [
        {
          type: "trend",
          title: "Total Gross, last 12 months",
          series: dd.monthlyTrend.labels.map((m, i) => ({
            month: m,
            value: dd.monthlyTrend.current[i],
          })),
          dataType: "money",
        },
      ],
    },
  ],
};

export const sampleKnowledge: KnowledgeDoc[] = [
  {
    id: "k1",
    title: "Reading the recoverable-revenue number",
    type: "best-practice",
    kpiName: "Revenue Recovery",
    content:
      "The headline assumes a reactivated source returns to its **own historical run rate** at its own historical gross. It is a planning figure, not a forecast.\n\n- Sources under 5 total sales show *insufficient data* and never enter the headline.\n- Possible dead CRM feeds are excluded until confirmed.\n- Evidence score is 0-100, not a probability. An 85/100 has more history behind it than a 45/100.",
  },
  {
    id: "k2",
    title: "Why closing ratio must be recomputed, never averaged",
    type: "troubleshooting",
    kpiName: "Closing Ratio",
    content:
      "For a group, compute `sum(sales) / sum(leads)`. Averaging per-store ratios weights a 40-unit store the same as a 900-unit store, and a GM will catch it.",
  },
  {
    id: "k3",
    title: "Feed loss vs a vendor that quit",
    type: "troubleshooting",
    kpiName: "Lead Sources",
    content:
      "When **every** source of one lead type at one store goes to zero in the same month and stays there, suspect a dead CRM feed, not five vendors quitting. The confirming signal: the store's total sales did not fall that month while one lead type went dark.",
    pendingComments: 2,
  },
];

export const sampleEvents: BusinessEvent[] = [
  {
    id: "e1",
    title: "GM transition at Chevrolet Cranberry",
    description: "New general manager started; expect a few months of noise in the numbers.",
    type: "personnel",
    startDate: "2026-06",
    stores: ["Chevrolet Cranberry"],
  },
  {
    id: "e2",
    title: "CarGurus contract wound down",
    description: "Budget cut mid-quarter; lead volume tapering off.",
    type: "marketing",
    startDate: "2026-04",
    endDate: "2026-07",
    stores: ["Nissan Boardman", "Honda Monroeville"],
  },
  {
    id: "e3",
    title: "DMS migration",
    description: "Cutover to the new DMS; watch for gaps in the feed around go-live.",
    type: "system",
    startDate: "2026-05",
  },
];

export const sampleInstructions: Instruction[] = [
  {
    id: "i1",
    content: "Always compare like ranges. On the 12th, compare days 1-12 against days 1-12 of the prior month.",
    active: true,
    source: "manual",
  },
  {
    id: "i2",
    content: "Flag any source running under 30% of its own peak, even if it is not yet dormant.",
    active: true,
    source: "feedback",
  },
  {
    id: "i3",
    content: "Never call the evidence score a confidence or a probability.",
    active: true,
    source: "manual",
  },
  {
    id: "i4",
    content: "Lead with dollars at risk, not percentages, when talking to a dealer principal.",
    active: false,
    source: "feedback",
  },
];
