# Recipe: the general KPI dashboard (trend lines, drill-downs, filters)

Layer 1, generalized. `recipes/revenue-recovery.md` builds the one flagship screen and
`recipes/home-dashboard.md` the page the product opens on. This recipe is
the pattern for **any** KPI dashboard over the dealer group data: a grid of KPI cards that each
carry a trend line, drill-downs from group to dealership to source to month, and filters that
recompute. Build it on the data model (`recipes/data-model.md`) so every number comes from one
place.

Use the design tokens in `reference/DESIGN.md` throughout. The look is dark, dense, calm: a trading
terminal, not a consumer app.

## The home cards

The home screen shows, for the selected scope and the analysis month: **sales**, **gross**,
**leads**, **closing ratio** (the four CRM cards, one accent on gross), then **inventory units**
(`new_units + used_units`, a month-end snapshot, never summed across months), **paid media spend**
(from the spend file, by channel) and **sessions** (from GA4). Each card's metric is one named key
with one formula in `reference/METRICS.md` or the data-model query layer, and the chat's tools use
the same keys. Nothing else is a headline until it has a key and a formula.

## The KPI card, done right

Each card is: a small muted uppercase label, a big bold value, a delta versus the prior period, and
a **trend line** (a sparkline of the last 12+ months). The trend line is not decoration; it is what
turns a number into a story. A closing ratio of 14% means nothing on its own and everything when you
can see it slid from 19% over six months.

- **Value**: compact and formatted (`$583.4K`, `29.8%`, `1,740`) per the DESIGN.md formatting table.
- **Delta**: versus prior month and, where it matters, prior year. Color it (green up / red down)
  but respect direction: for a cost metric, down is good. Do not paint a cost drop red.
- **Sparkline**: a small Recharts line or area over the metric's monthly series from
  `get_kpi_timeline`. No axes, no grid, just the shape. On hover, show the last point's value.
- **One accent per card.** The primary KPI gets the violet wash; the rest are neutral with a single
  colored trend line. A grid of equally bright cards reads as noise (DESIGN.md).

Lay them out responsive: 4-up desktop, 2-up tablet, 1-up phone.

## Trend lines everywhere, from one function

Every trend line, sparkline and full chart pulls from the same `get_kpi_timeline(metric, filters)`
query (data-model recipe, Step 4). One source of series data means a card's sparkline can never
disagree with the big chart you open when you click it. Build the query once, well: it takes a
metric, an optional scope (store, source, lead type) and a date range, and returns a clean monthly
series with zeros filled on the full period grid (the same grid rule as `reference/METRICS.md`, so a
gap never reads as a dip).

## Drill-downs: one mechanism, not one per screen

A drill-down is the same query with one more filter and the grouping moved one level down:

```
group  ->  dealership  ->  source  ->  month
```

The drill path depends on what the metric knows about: CRM metrics drill group, dealership,
source, month; inventory drills group, dealership, month; spend and traffic drill group,
dealership, channel, month. One component, driven by that metadata. Ratios show their numerator
and denominator at each level; recovery estimates are recomputed per level and say so.

Click a KPI card: open the full timeline for that metric. Click a dealership in the timeline or a
filter: refilter every card and chart to that store and recompute. Click a source: drill to that
source's monthly detail. Build **one** generic drill component that takes the current dimension and
filter set and renders the level below it, rather than a bespoke handler per card. Because the
rollup logic lives in the query layer, a drilled-in view is always consistent with the level above
it.

Keep a breadcrumb of the active drill path (`All stores > Summit Ford Rivera > CarGurus`) so the
dealer always knows where they are and can climb back out in one click.

## Filters that recompute (the part a GM checks)

- **Dealership selector**: All Stores plus each rooftop. All Stores is a rollup that **sums the
  components and recomputes the ratio** (`SUM(sales)/SUM(leads)`), never the mean of per-store
  ratios. This weights a 900-unit store correctly against a 40-unit one, and getting it wrong is the
  first thing a GM catches (`reference/METRICS.md`).
- **Date range**: 1 / 2 / 3 years ending at the analysis month. A card shows the analysis month's
  value, so widening the window can leave it unchanged (that is correct); its sparkline shows the
  last 12 months of the window, the opened chart shows the whole window, and recovery uses the whole
  window. Every card, sparkline and chart re-queries.
- **Lead type** (internet, phone, campaign, chat, showroom, service) applies to CRM metrics only;
  **channel** applies to spend and traffic only. Store and date range apply to everything. When a
  filter does not apply to a panel, say "all lead types" on that panel rather than silently ignoring
  it, and drop any drill level the new filter makes impossible.

Filters re-filter the underlying rows and recompute the metrics. They do not just hide series on a
chart. Verify by changing a filter and confirming every KPI value moves, and that the group total
equals the sum of the stores.

## Making it beautiful (the template look)

The dashboard is a template the dealer keeps, so the polish is part of the deliverable, not an
afterthought:

- Consistent number formatting on every surface (DESIGN.md). Mixed `$583,412` and `$3.0M` on one
  screen looks broken.
- Generous card padding, tight line-height on the big numbers, roomy gaps between sections.
- Borders barely there (1px, low opacity) or replaced by background separation.
- Status and categories as small tinted pills, not colored words.
- Charts: horizontal grid only, muted 11px axis labels, no legend box (use small colored
  circle-plus-label chips above the chart), tick density that never lets labels collide.
- Empty states that name what is missing rather than showing a zero. Real loading states only where
  there is a real client fetch (the chat, the connectors); no fake spinners on server-rendered data.

## Verify it

- Every KPI card shows a value, a delta and a trend line, and the delta direction is right for cost
  metrics.
- Clicking a card opens the full timeline; clicking a dealership refilters everything and the group
  total equals the sum of the visible stores.
- A drilled-in number matches the rolled-up number it came from.
- Resize to phone width: cards stack, charts scroll rather than squash, nothing overlaps.
- Change every filter and confirm the whole screen recomputes.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
