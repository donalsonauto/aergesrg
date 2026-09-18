# Design reference

The look is dark, dense and calm. Closer to a trading terminal than a consumer app. Dealers read
these on a phone in a showroom, so contrast and number size matter more than decoration.

## Tokens

```css
:root {
  --bg:            #0a0a0f;   /* near black, slightly blue */
  --bg-card:       #14141c;   /* card surface */
  --bg-elevated:   #1c1c26;   /* hover / nested */
  --border:        rgba(255,255,255,.15); /* barely there: 1px at 15% opacity */
  --fg:            #f2f2f7;   /* primary text */
  --fg-muted:      #8a8a99;   /* labels, sub-text */

  --accent:        #7c6cff;   /* violet: the primary metric, sales series */
  --success:       #34d399;   /* green: used split, positive delta */
  --info:          #22d3ee;   /* cyan: leads series */
  --warning:       #fbbf24;   /* amber: declining, close % series */
  --danger:        #f87171;   /* red: dormant, critical */
}
```

## Rules that carry the look

- **One bright color per card.** The hero KPI card gets the violet wash and border. Everything
  else is neutral with a single colored icon. Four equally bright cards read as noise.
- **Label above, value below.** Small muted uppercase label (11-12px, letter-spacing), then the
  number large and bold (32-40px), then an optional muted sub-label. Never label-beside-value.
- **Numbers are the design.** `$583.4K` at 36px bold does more than any illustration. Compact
  notation everywhere: `$583.4K`, `236.1`, `1,740`, `29.8%`.
- **Generous card padding** (20-24px), tight line-height on numbers, roomy between sections.
- **Borders barely exist.** 1px at low opacity, or skip the border and separate by background.
- **Status as pills, not text.** Small rounded chips with a tinted background at ~15% opacity of
  the status color and the solid color as text.

## Charts

- Grid lines: horizontal only, `--border`, no vertical grid.
- Axes: `--fg-muted`, 11px, no axis lines.
- Sales solid violet with a subtle area fill; leads solid cyan, no fill; close % dashed amber.
- Tick every 4 months on a 36-month range, or the labels collide.
- Tooltip: dark elevated card, all three series, month as the heading.
- No legend box. Put small colored circle + label chips above the chart instead.

## Formatting

| Kind | Format | Example |
|---|---|---|
| Large money | compact, 1 decimal | `$583.4K`, `$3.0M` |
| Money per unit | whole dollars | `$2,960`, `$1,684` |
| Percentage | 1 decimal | `29.8%` |
| Units | 1 decimal if fractional | `236.1`, `1,740` |
| Month | short | `Jul 26` |

Be consistent. Mixed `$583,412` and `$3.0M` on the same screen looks broken.

## Responsive

KPI cards go 4-up on desktop, 2-up on tablet, 1-up on phone. The chart needs a horizontal scroll
container on phone rather than squashing 36 months into 375px. The source list collapses to name,
status and value, dropping the middle columns.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
