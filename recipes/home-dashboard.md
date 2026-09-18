# Recipe: the home dashboard (the page the real product opens on)

Layer 1, the second screen. `recipes/revenue-recovery.md` builds the flagship. This one builds the
page the real dashboard opens on: a scan of the month for a GM who has thirty seconds. Every number
on it is one the Revenue Recovery build already computes; the home page adds no new math except
the Lead Health score and the Do This Now rules, both defined in `reference/METRICS.md`.

Build it on `framework/ui-components/components/ui/home` inside the same `AppShell`. Copy the
components in, wire the data to their props, do not restyle. `framework/ui-components/app/dashboard/page.tsx`
is the assembled reference; in the dealer's app it lives at `/` and Revenue Recovery moves to
`/revenue-recovery`, with both in the sidebar.

## The rows, top to bottom

The real page is `RankmaticDashboard.vue`, which scores website traffic (sessions, ASC events).
The CRM version keeps its rows and swaps the metrics:

| Row | The live page | This kit | Component |
|---|---|---|---|
| Header | Good Morning, name · date · month | Dashboard, scope · month | `HomePageHeader` |
| Hero, 4 tiles | Total Sales, Total Gross, Total Leads, Sessions | the same; Sessions only with a traffic file, otherwise Closing Ratio | `HeroKpiCard` |
| Secondary, 6 tiles | Closing Ratio, PVR, Good Leads, Cost/Sale, VDP Views, Conversion | **Closing Ratio, Avg Gross/Sale, Internet Leads, Cost/Sale (or Phone Leads), VDP Views, Conversion** | `SecondaryKpiTile` |
| Row of three | Dealership Statistics, Dealership Health, Do This Now | **Leads vs Sales (6 months), Dealership Health (credit-score gauge, 0 to 1000), Do This Now** | `TrendCard`, `DealershipHealth`, `DoThisNow` |
| Health By Store | twelve-month health lines per store with chips | the same, from the Lead Health score | `HealthByStore` |
| Financial Focus | eight small tiles | **Gross, Avg Gross/Sale, Gross/Lead, New Units, Used Units, Ad Spend, Cost/Lead, Cost/Sale** (cost tiles only with budget) | `StatStrip` of `MiniStatTile` |
| Store Performance | Sales by Store, New vs Used, Gross by Store | the same three columns | `StorePerformance` |
| Health Scores | one ringed score tile per metric | the same, each metric against its own 12-month best | `HealthScores` |
| Lists | Top Lead Sources, Sales Pipeline, Top Salespeople | **Top Lead Sources, Rankings by Store** (no pipeline or salesperson data in the file) | `RankedList` |
| Digital & Marketing | six small tiles from GA4 and Ads | **Sessions, Users, VDP Views, Form Submissions, Click-to-Call, Conversion Rate**, only with a traffic file | `StatStrip` |
| Breakdown | (none) | **Lead Type Mix** with each type's closing ratio | `LeadTypeMix` |

That is deliberately a lot of tiles: the home page is where a GM scans, so variety of tiles and
trend lines is the point. Every tile is one function call on the same numbers.

Each hero tile carries: the month's value, the month-over-month badge and the absolute change,
`Prev:` and `LY:` in small type, and a full-width twelve-month trend in the tile's own color with
last year dashed behind it. That is the v2 tile exactly; the ask button on every tile sends a
question to the analyst chat when one exists (`recipes/ai-analyst-chat.md`), and is a no-op before.

## One function per number

The home page and the Revenue Recovery page must never disagree, and the only way to guarantee
that is to compute each metric once. `lib/metrics.ts` already returns month totals (leads, sales,
gross, closing ratio, average gross, cost per sale when budget exists) and the recovery model.
The home page calls those; it does not re-add rows. The drill-down on a hero tile opens the same
generic drill the recovery cards use, so the level below always agrees with the tile.

Every derived series follows the period-grid rule: a month with no rows is a real zero for counts,
and the analysis month is the latest month in the file. The twelve-month sparkline is the last
twelve months of the window; the six-month trend is the last six.

## Dealership Health, a score a GM can argue with

The gauge is a 0 to 100 composite of five sub-scores, each already oriented so higher is better,
averaged equally, and shown times ten like a credit score (640, not 64), exactly as the live page
does. The formulas are in `reference/METRICS.md`. Under it: Sales, Leads and Gross versus the prior
month as green or red pills. The Health By Store panel walks the same score back twelve months per
store, and the Health Scores strip scores each metric on its own, so the composite is never a black
box: a dealer who sees momentum low and everything else high knows exactly what moved.

## Do This Now is a rule engine

The list is plain rules over numbers the page already has, in this order, at most four items:

1. **critical**: each dormant source with a recoverable estimate (up to two): name, months
   inactive, its historical monthly value, and the decision (reactivate or stop paying).
2. **warning**: the top declining source, with its own peak.
3. **warning**: the largest month-over-month drop past the 20% highlight threshold, pointing at the
   drill-down.
4. **info**: the store whose closing ratio is more than 20% under the group's this month.

No model writes these sentences. Same input, same output, every time, and each one carries the
number that justifies it. Clicking an item sends its text to the analyst chat as the question.

## Filters and scope

Store, group and month come from the top bar, exactly as on Revenue Recovery. Every tile, chart
and list recomputes on a change; All Stores sums the components and recomputes ratios. When a
filter leaves a tile with nothing to show (no budget rows, no leads of a type), the tile is left
out or shows a dash. Never a zero for something unknown.

## Verify it

- The four hero values equal the same month's totals the Revenue Recovery drill-down shows for
  "Total Gross" and its related KPIs.
- The group closing ratio equals `SUM(sales)/SUM(leads)` across stores, not the mean of the stores'
  ratios.
- Change the store in the top bar: every tile moves, the health score changes, the rankings show
  one store.
- The Do This Now list names the same dormant sources, with the same dollars, as the Revenue
  Recovery table.
- Phone width: tiles 1-up, the row of three stacks, the six-month chart still readable.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
