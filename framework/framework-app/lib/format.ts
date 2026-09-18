// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Formatting discipline from reference/DESIGN.md. Money is compact ($583.4K,
// $3.0M), percentages one decimal, months short (Sep 26). Used on both the
// server and the client, so it stays free of any node-only imports.

export function formatCompactMoney(v: number | null | undefined): string {
  if (v == null) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

// Whole dollars with thousands separators, for per-unit money ($3,382).
export function formatMoneyWhole(v: number | null | undefined): string {
  if (v == null) return "-";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function formatUnits(v: number | null | undefined): string {
  if (v == null) return "-";
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatPercent(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "-";
  return `${v.toFixed(decimals)}%`;
}

// Signed relative-change label, e.g. "+1.4%" / "-3.2%". Null when there is no
// prior value to compare against (renders as "no prior month").
export function formatDelta(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// "2026-09" -> "Sep 26"
export function formatMonthShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${String(y).slice(2)}`;
}

// "2026-09" -> "September 2026"
export function formatMonthLong(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${names[m - 1]} ${y}`;
}
