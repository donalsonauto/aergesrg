// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Number and date formatting, ported from the v2 useFormatKpi composable and
// nailed to the rules in reference/DESIGN.md. Format once, never *100 twice:
// ratios arrive already as percent values (11.5 means 11.5%). The locale is pinned: the server
// formats in Node's locale and the browser in the viewer's, and a German browser would otherwise
// render $583.413 beside $3.0M and trip a hydration mismatch.

export type DataType =
  | "money" // compact, 1 decimal: $583.4K, $3.0M
  | "moneyWhole" // whole dollars: $2,960
  | "pct" // 1 decimal: 29.8%
  | "units" // 1 decimal if fractional: 236.1, 1,740
  | "int" // integer with grouping: 1,740
  | "number"; // raw number, minimal formatting

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Compact money, one decimal in K/M. `$583.4K`, `$3.0M`, `$412`. */
export function compactMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

/** Whole dollars with grouping, for per-unit money. `$2,960`. */
export function moneyWhole(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** One decimal percent. Value is already a percent (29.8 -> `29.8%`). */
export function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  return `${n.toFixed(1)}%`;
}

/** Units: one decimal only when fractional, grouped thousands. `236.1`, `1,740`. */
export function units(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  const isFractional = Math.abs(n % 1) > 1e-9;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: isFractional ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

/** Integer with grouping. `1,740`. */
export function int(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  return Math.round(n).toLocaleString("en-US");
}

/** Single dispatch used everywhere a value is rendered by data type. */
export function formatValue(
  value: number | null | undefined,
  type: DataType = "int",
): string {
  switch (type) {
    case "money":
      return compactMoney(value);
    case "moneyWhole":
      return moneyWhole(value);
    case "pct":
      return pct(value);
    case "units":
      return units(value);
    case "number":
      return value == null ? "--" : String(value);
    case "int":
    default:
      return int(value);
  }
}

/** Short month label from a `YYYY-MM` period or Date. `Jul 26`. */
export function formatMonth(period: string | Date): string {
  let y: number;
  let m: number;
  if (period instanceof Date) {
    y = period.getFullYear();
    m = period.getMonth() + 1;
  } else {
    const [ys, ms] = String(period).split("-");
    y = parseInt(ys, 10);
    m = parseInt(ms, 10);
  }
  if (!m || m < 1 || m > 12) return String(period);
  return `${MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

/** Percent change between two values, or null when it cannot be computed. */
export function pctChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null; // a zero prior month is "new", not infinite
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type ChangeColor = "positive" | "negative" | "neutral";

/**
 * Color for a delta. `invert` flips the semantics for cost metrics, where a
 * drop is good (cost per sale down = green).
 */
export function changeColor(
  changePct: number | null,
  invert = false,
): ChangeColor {
  if (changePct == null) return "neutral";
  const up = changePct > 0.5;
  const down = changePct < -0.5;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  if (good) return "positive";
  if (bad) return "negative";
  return "neutral";
}

/** Arrow glyph for a delta direction. */
export function trendArrow(changePct: number | null): string {
  if (changePct == null) return "";
  if (changePct > 0.5) return "↑";
  if (changePct < -0.5) return "↓";
  return "";
}
