# Metric definitions

Every number on the dashboard, and exactly how it is computed. Verified against a live
38-rooftop dealer group. Nothing here requires data beyond the monthly rows in `DATA-SPEC.md`.

Notation: rows are grouped by `source` (optionally filtered by `store` and `lead_type`), ordered
by `period` ascending. `T` = that ordered timeline.

**Conventions that hold everywhere in this kit.** Ratios are percent values (`11.5` means 11.5%)
in every query, tool result and chart; format them once, never multiply by 100 twice. The
**analysis month** is the latest `period` in the data, chosen once for the whole dataset before any
filter is applied (never a filtered source's own last row, or a dead source looks alive again). For
a group it is the latest month in which every rooftop has lead rows. The demo data is complete
through the month named in `demo-data/dealer_group.json` (`completed_through`). A total is complete
only when every component is known: `SUM` over a column with unknown cells is a **partial** total,
label it so; a ratio needs a complete numerator and denominator and a denominator above zero, else
it is unavailable, never `0`, `NaN` or `Infinity`.

## Per-source totals

| Metric | Formula |
|---|---|
| `totalLeads` | `sum(leads)` over T |
| `totalSales` | `sum(sales)` over T |
| `totalGross` | `sum(gross)` over T |
| `closingRatio` | `totalSales / totalLeads * 100` |
| `avgGrossPerSale` | `totalGross / totalSales` |
| `newSales` / `usedSales` | `sum(new_sales)`, `sum(used_sales)` |
| `pctNew` | `newSales / (newSales + usedSales) * 100` |
| `activeMonths` | count of periods in T where `sales > 0` |
| `totalMonths` | count of periods in the analysis window |

## Activity and dormancy

This is the engine of the Revenue Recovery screen.

| Metric | Formula |
|---|---|
| `lastActiveMonth` | latest `period` in T where `sales > 0` |
| `monthsInactive` | whole months between `lastActiveMonth` and the analysis month (the latest `period` in the file, not today's date, so a stale export does not inflate dormancy) |
| `peakMonthlySales` | highest 3-month rolling average of `sales` in T |
| `peakPeriod` | the 3-month window achieving that peak |
| `recentMonthlySales` | mean `sales` over the last 3 periods |
| `historicalMonthlySales` | mean `sales` over active months, excluding the trailing dormant run |

**Reindex onto the full period grid before any rolling average.** This is the single most dangerous
trap in the whole model, because getting it wrong produces a confident, wrong, unflagged number.
A real CRM export (and the sample file) simply **stops emitting rows for a source once it goes
dormant** rather than writing explicit `sales = 0` rows. So "the last 3 periods" must mean the last
3 months **of the analysis window**, not the last 3 rows the source happens to have. Build the full
list of periods in the window once, then for each source place its rows on that grid and treat any
missing month as a real zero. If you skip this, a source that died 16 months ago still shows a
healthy `recentMonthlySales` (its last 3 *alive* months), and the dormant/declining classification
and the recoverable-revenue math both silently break while looking completely plausible.

A missing row in a complete export means no activity that month, so it is a real zero. The one
exception is **feed loss**: when every source of one lead type at one store goes to zero leads in
the same month and stays there (the demo's Hyundai rooftop), that is a CRM feed that died, not
five vendors that stopped producing. Two guards, or the rule eats a real dormant source: the lead
type must have had **more than one** source (a single-source type going quiet is that vendor dying,
which is what the screen exists to show), and the store's total sales must have held up while the
leads went dark. Flag those sources `feed lost?`, list them separately with the
first missing month, and exclude them from the recoverable headline. A store whose total sales did
not fall in that month, while one lead type went dark, is the confirming signal.

**Status classification:**

```
dormant    if monthsInactive >= 3
declining  if recentMonthlySales < 0.30 * peakMonthlySales   (under 30% of its own peak)
steady     otherwise
```

The 30% threshold is the one judgment call in the whole model. It is deliberately generous:
a source at a third of its peak is worth a phone call, not a crisis. Tune it and say you tuned it.

## The recoverable revenue headline

The `$583.4K` number, and the only place estimation happens.

```
estimatedMonthlySales   = historicalMonthlySales - recentMonthlySales   (floor at 0)
estimatedMonthlyRevenue = estimatedMonthlySales * avgGrossPerSale
```

Summed across every dormant and declining source, that is the headline.

**Recovery is computed on the selected scope, pooled by source.** For All Stores, sum the stores'
rows into one series per source first, then classify and estimate. A per-store view recomputes the
same thing on that store's rows. The two do not add up: a source can be steady for the group and
dormant at one rooftop, and the group headline is not the sum of the twelve store headlines. Say so
on screen wherever store breakdowns appear ("recomputed for this store, not additive"). Sales,
leads and gross are additive; recovery estimates and ratios are not.

**Minimum evidence before you estimate.** Do not compute `estimatedMonthlyRevenue` or
`estimatedMonthlySales` for a source with fewer than **5 total sales** across the whole window; it
is excluded from both headline cards, and it still counts in the dormant/declining counts. With one or two sales, `avgGrossPerSale`
is noise, and multiplying it out is how "recoverable revenue absurdly high" happens (it is in the
recipe's failure-modes table). Still show the source in the ranked list, but render the estimate as
"insufficient data" rather than a number, and exclude it from the headline sum. Five is the floor,
not a target; say it on screen if a source is excluded for it.

**State the assumption on screen.** It assumes a reactivated source returns to its own historical
run rate at its own historical gross. That is a reasonable planning figure and it is not a
forecast. The reference screen prints its window inline ("We analyzed 3 Years of CRM data...
2023-07-01 to 2026-07-28") and you should too. A dealer will take this number into a vendor
negotiation, so it has to be legible and defensible.

**Evidence score.** The field is `evidenceScore`, shown as `85/100`, never as a percentage and never
called "confidence": it is a hand-built 0-100 measure of how much history supports the estimate, not
a probability the revenue will be recovered. A dealer will read "100% confidence" as certainty. The
scale:

```
evidenceScore = clamp(0..100) of:
    40  base
  + 30 * min(activeMonths / 12, 1)      more history, more trust
  + 20 * min(totalSales / 50, 1)        more sales, less noise
  + 10 * (1 if budget present else 0)   spend data lets you sanity-check ROI
```

Show it in the expanded row next to the estimate. An 85/100 row and a 45/100 row should not look
identical. "Budget present" means budget known for every month in the window, not any one cell.

## Spend metrics (only when `budget` is present)

| Metric | Formula |
|---|---|
| `cpl` | `budget / leads` |
| `cps` | `budget / sales` |
| `netProfit` | `gross - budget` |
| `roi` | `(gross - budget) / budget * 100` |

`budget` is the spend a dealer records against a source (vendor invoices). It is not the same
series as a paid-media spend file by channel; never add the two or call either "total marketing
spend". If `budget` is empty, hide these entirely. Do not render `$0.00` or `Infinity`. If a source has
`budget` for some months and blank for others, treat its spend metrics as **unavailable** for that
window rather than summing the known subset: a partial sum quietly understates spend and overstates
ROI. (The sample file has 492 blank budget cells, so this bites immediately.)

## Group rollups

For "All Stores" or a whole group, **sum the components and recompute the ratio**. Never average
a ratio:

```
correct:   closingRatio = sum(sales) / sum(leads)
wrong:     closingRatio = mean(per_store_closing_ratios)
```

The wrong version weights a 40-unit store the same as a 900-unit store. This is the single most
common error in dealer dashboards and a GM will catch it.

Imported averages (inventory `avg_days_on_lot`, `avg_price_to_market`) cannot be summed and
cannot be recomputed from components you do not have. Show them per store; for the group, weight
them by that store's units and label the result "unit-weighted". Do the same for any imported
average.

## Month-over-month comparisons

Compare **like ranges**. On the 12th of the month, compare days 1-12 against days 1-12 of the
prior month, not against the prior full month. Otherwise every dashboard shows a catastrophic
decline for the first three weeks of every month.

At month grain that means: for the current in-progress month, either mark it clearly as partial or
pace-adjust it by `days_elapsed / days_in_month`.

## Anomaly highlights

The reference product surfaces a short list of the largest month-over-month moves, phrased as
questions. Real output from a live group:

> Total gross profit dropped to 5,345,225 (down 60% from 13,507,161) - what's causing this?
> Closing ratio dropped to 18.2% (down 30% from 26.2%) - what's causing this?
> Inventory grew to 26,531 (up 19% from 22,353) - what's driving this?

Implementation: for each metric, compute MoM percentage change, keep anything past a threshold
(20%, the same number the chat's highlights use), rank by absolute change, take the top five. Both
months must be complete; a zero prior month is "new activity", not an infinite percentage. Phrase as a question rather
than a conclusion. The dashboard does not know why, and pretending it does is how dashboards lose
credibility.

## Traffic channels (the GA4 side of Revenue Recovery)

Same shape as the CRM rules, different units, and never dollars. Pool each channel across the
stores in scope on the full period grid (a month with no rows is zero sessions).

| Term | Rule |
|---|---|
| Peak monthly sessions | highest 3-month rolling average of `sessions` |
| Dormant | 3 or more months with zero sessions after a period of activity |
| Declining | recent 3-month average under **45%** of the channel's own peak (traffic is noisier than sales, so the bar is lower than the CRM 30%) |
| Historical monthly sessions | mean over active months, excluding the trailing dormant run |
| Lost sessions / mo | `historical - recent`, floored at 0, dormant and declining only |
| Lost conversions / mo | `lost sessions x channel conversion rate` (`conversions / sessions` over the window) |
| Conversion rate | `SUM(conversions) / SUM(sessions)`, never averaged across months |

Users are never summed across months or channels (they count people). The two headline cards
are lost sessions per month and lost conversions per month; dormant and declining counts follow.
A channel with fewer than 500 sessions in the window is listed but carries no estimate.

## Lead Health score (home dashboard)

The home page's gauge, the CRM counterpart of v2's Website Performance Health. A 0 to 100
composite: five sub-scores, each clamped to 0..100 and oriented so higher is better, averaged
equally. `t12` is the last twelve months of totals for the scope; `now` is the analysis month.

| Sub-score | Formula |
|---|---|
| Closing | `now.closing_ratio / max(t12.closing_ratio) * 100` |
| Lead volume | `now.leads / mean(t12.leads) * 100` |
| Gross per sale | `now.avg_gross / max(t12.avg_gross) * 100` |
| Momentum | `sum(sales, last 3 months) / sum(sales, the 3 months before) * 50` (flat = 50) |
| Sources | `(1 - quiet_sources / sources) * 100`, where a quiet source had 5+ lifetime sales and none in the last 3 months |

Score the group and each store with the same function; rank stores by it. The home page shows the
composite times ten (640, not 64) the way the real product does, credit-score style, with Sales,
Leads and Gross versus the prior month under it. Keep the five sub-scores reachable (a tooltip, the
ask button, the Health Scores strip): a composite nobody can decompose is a number nobody trusts.

The **Health Scores** strip scores each tracked metric on its own: `current / best of the last 12
months x 100` (inverted for cost metrics), colored by the direction of its month-over-month move.

## Do This Now (rules, not a model)

At most four items, in this order: each dormant source with a recoverable estimate (up to two,
critical), the top declining source (warning), the largest month-over-month drop past the 20%
highlight threshold (warning), and the store whose closing ratio is more than 20% under the
group's this month (info). Each sentence carries the number that justifies it. Same input, same
output, every time.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
