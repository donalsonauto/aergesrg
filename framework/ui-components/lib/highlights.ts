// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Turn a structured MoM highlight into the suggested-question chip text, mirroring
// the rule engine in reference/highlights.js (formatVariance). Cost metrics phrase
// a drop as an improvement.

import { formatValue } from "./format";
import type { Highlight } from "./demo-types";

export function highlightQuestion(h: Highlight): string {
  const abs = Math.abs(Math.round(h.changePct));
  const cur = formatValue(h.current, h.dataType);
  const prev = formatValue(h.previous, h.dataType);

  if (h.costMetric) {
    if (h.changePct > 0) {
      return `${h.label} rose to ${cur} (up ${abs}% from ${prev}). What's driving costs up?`;
    }
    return `${h.label} improved to ${cur} (down ${abs}% from ${prev}). What changed?`;
  }
  if (h.changePct < 0) {
    return `${h.label} dropped to ${cur} (down ${abs}% from ${prev}). What's causing this?`;
  }
  return `${h.label} grew to ${cur} (up ${abs}% from ${prev}). What's driving this?`;
}

/** Fallback prompts when no significant move surfaces (from highlights.js). */
export const FALLBACK_QUESTIONS = [
  "Give me a full performance overview for this month",
  "Which store needs the most attention right now?",
  "Compare my lead sources by ROI",
];
