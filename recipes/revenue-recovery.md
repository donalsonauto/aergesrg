# Recipe: the Revenue Recovery screen

The reference build. Follow it in order. Each step produces something visible on screen, so the
dealer is never watching a blank page while you scaffold.

Formulas live in [`../reference/METRICS.md`](../reference/METRICS.md). Do not re-derive them here.

## Step 0 - load and map (10 min)

Read the dealer's CSV. **Their column names will not match the spec.** Print the header and the
first three rows, show them, and write an explicit mapping:

```ts
const COLUMN_MAP: Record<string, string> = {
  "Lead Source": "source",
  "Month": "period",
  "Total Leads": "leads",
  "Units Sold": "sales",
  "Total Gross": "gross",
};
```

Normalize as you load:

- `period` to `YYYY-MM`. Exports arrive as `Jul 2026`, `7/1/2026`, `2026-07-01`. Handle all three.
- currency to a number. Strip `$`, commas, parentheses. `(1,234)` means negative 1234.
- empty vs zero. Empty stays `null`, not `0`. This matters for averages.
- trim whitespace on `source`. `"Autotrader "` and `"Autotrader"` must not become two sources.

**Then tell them what you found:** row count, date range, number of sources, number of stores. If
the range is under 12 months, say so now, because dormancy detection will be weak and they should
know before they read conclusions off it.

**Build the full period grid now, before any metric.** Compute the sorted list of every month in
the analysis window once. Every source's rolling averages must be computed against that grid, with
a missing month treated as a real zero, not skipped. A dormant source stops producing rows; if you
average over "its last 3 rows" instead of "the last 3 months of the window" its recent run-rate
comes out non-zero and the whole classification silently breaks. This is called out in bold in
`../reference/METRICS.md` and it is the most dangerous trap in the build.

Scaffolding note: the Next.js app is scaffolded into this repo, which already has the kit's docs at
its root. `create-next-app` will not scaffold into a non-empty folder, so scaffold into a temp
subfolder and merge up, and do not clobber the kit's `CLAUDE.md`/`README.md`. The exact steps are
in `../CLAUDE.md` under "Scaffolding".

## Step 1 - the four KPI cards (15 min)

Ship these first. This is the moment the dealer sees their own numbers and starts paying
attention.

| Card | Value | Sub-label |
|---|---|---|
| Est. monthly revenue | sum of `estimatedMonthlyRevenue` over dormant + declining | "recoverable if re-activated" |
| Est. monthly sales | sum of `estimatedMonthlySales` over the **same** dormant + declining set, same 5-sale floor (on the sample: 99.4, not 123.7) | "units/month potential" |
| Feed lost? | sources excluded from both headlines because a whole lead type at one store went dark in one month (`reference/METRICS.md`, feed loss) | "check the feed, not the vendor" |
| Dormant sources | count with status `dormant` | "no activity recently" |
| Declining sources | count with status `declining` | "< 30% of peak performance" |

Statuses are **mutually exclusive, dormant wins** (`../reference/METRICS.md`). A dormant source has
recent sales of 0 and so also satisfies the declining test; if you count the two predicates
independently you double-count it and the cards no longer match the ranked list.

Formatting is the whole job here: `$583.4K`, not `583412.83`. One decimal. The first card carries
the accent color; the rest are neutral. See [`../reference/DESIGN.md`](../reference/DESIGN.md).

Directly under the cards, print the assumption in small muted text. Generate the dates from the
data, never hardcode them, and describe the formula that is actually used:

> We analyzed 36 months of CRM data (2023-09 to 2026-08) and found lead sources that previously
> generated sales and are now dormant or significantly declined. The estimate assumes each source
> returns to its own historical monthly sales rate (historical minus recent) at its own average
> gross per sale. Sources with fewer than 5 sales are excluded.

Do not describe it as "based on closing ratio": closing ratio is an audit metric here, not a factor
in the multiplication (`../reference/METRICS.md`). Say the window out loud on screen. This number
ends up in vendor negotiations. On the sample data the headline is **$342.3K/mo** with 3 dormant
and 3 declining sources; the `$583.4K` used elsewhere in the kit is an illustration from a larger
real group.

## Step 2 - the ranked source list (20 min)

One row per source, sorted by `estimatedMonthlyRevenue` descending. Collapsed by default.

Steady sources get a row (for context) but **no dollar estimate**: their `estimatedMonthlySales`
is not recoverable revenue and they are not in the headline. If you print an estimate on a steady
row, a dealer adds the column up, gets more than the headline, and concludes the dashboard is
broken. Show a muted "steady, not in total" instead.

Each row shows: source name, its lead-type tags, a status pill (`Dormant` / `Declining`), peak
sales/mo, total sales, closing ratio, months inactive, and estimated $/mo on the right.

Make the row expandable. Expanded, show:

- **Key metrics**: total sales, total leads, total gross, avg gross/sale
- **New vs used split**: two bars with counts and percentages
- **A footer line**: peak period, last active, closing ratio, active months out of total

Skip any panel whose source column is missing rather than rendering zeros.

## Step 3 - the performance timeline (25 min)

The centrepiece. One chart per expanded source, three series, three independently scaled Y axes:

| Series | Axis | Style |
|---|---|---|
| Sales | left | solid, accent, filled area under the line |
| Leads | right | solid, cyan, no fill |
| Close % | far right | dashed, amber, no fill |

Recharts `ComposedChart` with three `YAxis` components (sales left, leads right, close % far
right, each its own scale) and `yAxisId` on each series. Two axes squash the percentage into a
flat line against hundreds of leads. Points are
monthly; label ticks every 4 months (`Jul 23`, `Nov 23`, ...) or the axis is unreadable.

Add lead-type filter tabs above it (All / Internet / Phone / Campaign / Showroom) that re-filter
the underlying rows and recompute, not just hide series.

**The chart is the argument.** A dormant source looks like a mountain that falls to zero and stays
there. Once a dealer sees that shape on a source they are still paying for, the dashboard has
done its job.

## Step 4 - filters and the header (10 min)

Store selector (All Stores plus each rooftop), date-range selector (1 / 2 / 3 years, **defaulting
to 3**), and the CRM Sources vs Traffic Channels toggle if they brought GA4 data.

Warn on screen when a short window is selected: a source that died before the window has zero
rows inside it and drops off the list entirely. On the sample data, "1 year" makes both planted
dormant sources vanish, which is correct per the filter and disastrous as a demo. Default to 3
years and say why.

**Rollups sum components and recompute ratios.** Never average per-store ratios together. This is
in METRICS.md and it is the error a GM will catch first.

## Step 4b - the Traffic Channels side (10 min, only when a traffic file exists)

The header's CRM Sources / Traffic Channels switch flips the whole body to the second file
(`DATA-SPEC.md`, the optional traffic export). Same page, same rules in different units
(`reference/METRICS.md`, "Traffic channels"), and the components are already in
`framework/ui-components/components/ui/traffic`:

- Four cards: **lost sessions / mo**, **lost conversions / mo**, dormant channels, declining
  channels (declining is under 45% of the channel's own peak).
- The tinted info line: GA4 source / medium pairs that drove sessions and conversions before and
  have gone quiet or fallen far below their own peak.
- One row per channel, biggest loss first: name, status chip, then Peak sess/mo, Conv (rate),
  VDPs, Inactive. Steady channels stay in the list without a figure.
- The row opens to six tiles (total sessions, total VDP views, form submissions, click-to-call,
  conversion rate, active months), the Peak and Last active lines, and the **traffic timeline**:
  sessions (orange area), VDP views (green), conversions (purple), each on its own axis.

With no traffic file the switch still exists and the body says what file would fill it. Never
put a dollar figure on traffic; sessions and conversions are the units.

## Step 5 - make it look finished (10 min)

Empty states and a "no data for this filter" message. Number formatting consistent everywhere.
Then [`../AUTH.md`](../AUTH.md) before it goes anywhere near a public URL.

A note on loading states: with the CSV parsed server-side at build/request time there is no client
fetch to wait on, so the data is present on first paint and a spinner would be theatre. Do not add
a fake one. Add real loading states only if you later move to client-side fetching (the AI chat and
live connectors do fetch, and those genuinely need them).

## If you finish early

- **Compare mode**: two sources on one chart
- **Monthly highlights**: the largest MoM moves, phrased as questions (METRICS.md has the shape)
- **Export**: the ranked list to CSV, so it can go into a vendor conversation
- **Compare mode** is in `framework/ui-components` as a button on the timeline; wire it to a
  second source

## Common failure modes

| Symptom | Cause |
|---|---|
| Every source looks dormant | date parsing failed, everything landed in one month |
| Closing ratios above 100% | joined leads and sales at different grains, double-counting sales |
| Recoverable revenue absurdly high | `avgGrossPerSale` computed on a source with 1-2 sales; require a minimum before estimating |
| Chart is a flat line | summing all sources instead of filtering to one |
| Group total does not match store totals | averaged ratios instead of recomputing from sums |

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
