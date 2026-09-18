// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Small shared helpers for the component kit.

import type { AccentVariant, RecoveryStatus } from "./demo-types";

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Tailwind text-color utility per accent token (matches app/globals.css). */
export const ACCENT_TEXT: Record<AccentVariant, string> = {
  accent: "text-accent",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
};

/** Recharts stroke color per accent token (needs concrete hex). */
export const ACCENT_HEX: Record<AccentVariant, string> = {
  accent: "#818cf8", // indigo-400, the app's primary
  success: "#4ade80",
  info: "#38bdf8",
  warning: "#fbbf24",
  danger: "#f87171",
};

/**
 * Concrete hexes for chart series, matching app/globals.css. surface-* is the
 * Aura dark ramp (Tailwind zinc); accent is primary/indigo. The chart neutrals
 * are the ones the real app hardcodes in its Chart.js options.
 */
export const TOKEN = {
  fg: "#ffffff", // surface-0
  muted: "#a1a1aa", // surface-400
  line: "#3f3f46", // surface-700
  grid: "rgba(148,163,184,0.1)", // verbatim from RevenueRecovery.vue
  axis: "#64748b", // verbatim from RevenueRecovery.vue
  accent: "#818cf8", // indigo-400
  accentStrong: "#6366f1", // indigo-500
  success: "#4ade80",
  info: "#38bdf8",
  warning: "#fbbf24",
  danger: "#f87171",
  card: "#18181b", // surface-900
  elevated: "#27272a", // surface-800
  ground: "#09090b", // surface-950
} as const;

/** Cycling palette for multi-series breakdown bars. */
export const SERIES_COLORS = [
  "#818cf8",
  "#4ade80",
  "#38bdf8",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
];

/**
 * Lead-type chips, each in its own color. The Revenue Recovery row shows one
 * per lead type the source produced. Unknown types fall back to neutral.
 */
export const LEAD_TYPE_CHIP: Record<string, string> = {
  internet: "bg-sky-500/15 text-sky-400",
  phone: "bg-emerald-500/15 text-emerald-400",
  campaign: "bg-violet-500/15 text-violet-400",
  showroom: "bg-amber-500/15 text-amber-400",
  service: "bg-cyan-500/15 text-cyan-400",
  chat: "bg-pink-500/15 text-pink-400",
};

export function leadTypeChip(leadType: string): string {
  return (
    LEAD_TYPE_CHIP[leadType.toLowerCase()] ??
    "bg-surface-700/50 text-surface-300"
  );
}

export interface StatusStyle {
  label: string;
  /** tinted background + solid text, per DESIGN.md status pills. */
  className: string;
}

/**
 * Verbatim from RevenueRecovery.vue's statusBadge(), dark half only. Steady is
 * deliberately neutral: those rows are context, not an opportunity, and a green
 * chip would read as a third status competing with the two that matter.
 */
export const RECOVERY_STATUS: Record<RecoveryStatus, StatusStyle> = {
  dormant: { label: "Dormant", className: "bg-red-500/20 text-red-400" },
  declining: { label: "Declining", className: "bg-amber-500/20 text-amber-400" },
  steady: { label: "Steady", className: "bg-surface-700/60 text-surface-300" },
};

export const FEED_LOST_STYLE: StatusStyle = {
  label: "Feed lost?",
  className: "bg-sky-500/20 text-sky-400",
};
