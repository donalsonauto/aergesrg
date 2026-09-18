# Data spec: what to bring to the session

Read this first. It is the only thing you have to do before the workshop.

## The short version

**One CSV. Ten columns. One row per month, per lead source, per store.** (A second, optional
file for website traffic is described at the end.)

Everything on the dashboard you are going to build is calculated from that one file. There is
no second system to connect, no API to stand up, no warehouse.

```csv
period,store,source,lead_type,leads,sales,new_sales,used_sales,gross,budget
2025-07,Nissan Boardman,Autotrader,internet,346,21,9,12,69851,4200
2025-07,Nissan Boardman,Cars.com,internet,180,11,5,6,31200,3100
2025-07,Nissan Boardman,Lease Return,campaign,64,19,15,4,52400,
2025-08,Nissan Boardman,Autotrader,internet,301,17,8,9,54900,4200
```

That is it. If you show up with this, you will build a working dashboard in the session.

## Column definitions

| Column | Required | Type | Notes |
|---|---|---|---|
| `period` | yes | `YYYY-MM` | Month grain. Not daily. Daily is more data and a worse dashboard. |
| `store` | yes | text | Rooftop name. Single-store dealers: put the same value on every row. |
| `source` | yes | text | The lead source exactly as your CRM names it. Do not clean it up. |
| `lead_type` | yes | enum | One of `internet`, `phone`, `campaign`, `chat`, `showroom`, `service`. |
| `leads` | yes | integer | Leads received from that source in that month. |
| `sales` | yes | integer | Units sold attributed to that source. |
| `new_sales` | no | integer | New units. Enables the new/used split panel. |
| `used_sales` | no | integer | Used units. Same. |
| `gross` | yes | currency | Total gross for those sales, whole dollars, no `$` or commas. |
| `budget` | no | currency | Ad spend on that source that month. Unlocks CPL, CPS and ROI. |

Leave a cell empty if you do not have it. Do not put `0` for "unknown". Zero is a real value and
will produce wrong averages.

## Why month grain, and why these columns

Every headline number on the Revenue Recovery screen is **derived**, not imported. Verified
against live data for a 38-rooftop group:

| Shown on screen | How it is calculated |
|---|---|
| Closing ratio | `sales / leads` |
| Avg gross per sale | `gross / sales` |
| New vs used split | `new_sales / (new_sales + used_sales)` |
| Peak period | highest 3-month rolling `sales` in the timeline |
| Months inactive | months since the last row with `sales > 0` |
| Est. monthly sales | mean sales over active months, excluding the trailing dormant run (exact rule in `reference/METRICS.md`) |
| **Est. monthly revenue** | `est_monthly_sales x avg_gross_per_sale` |
| Dormant / declining | recent run-rate vs historical run-rate |
| CPL / CPS | `budget / leads`, `budget / sales` |

So the $583K "recoverable revenue" headline is two multiplications away from raw CRM rows. You
do not need anyone's black box to compute it. That is the point of the session.

## How much history

| History | What you get |
|---|---|
| **12 months** | Minimum. Enough to see seasonality and build every chart. **Bring this.** |
| **24 months** | Year-over-year comparison becomes real. |
| **36 months** | What the screenshot uses. Dormancy detection gets genuinely good, because a source that died 18 months ago is still visible. |

**Bring 12 months. We will show you how to extend to 36.** Do not delay the export trying to get
three years out of a stubborn CRM. Twelve months in hand beats three years in a ticket queue.

## Getting the export out of your CRM

Every CRM calls this report something different. Ask for **"lead source performance by month,
with sales and gross"**. Common paths:

| CRM | Where to look |
|---|---|
| VinSolutions | Reports > Lead Source ROI, set range to 12+ months, group by month |
| DealerSocket | Reports > Lead Source Analysis, export detail not summary |
| eLead | Analytics > Lead Source Performance, export to Excel |
| Reynolds / CDK | Usually a custom report request; ask for source, month, leads, sold, gross |

**If your CRM will not give you this cleanly, that is normal and it is not a blocker.** Come
anyway. Two fallbacks:

1. **Use the sample data.** `sample-data/` has a realistic synthetic dataset. You will build the
   entire dashboard against it and swap in your own file afterwards. Nobody sits out.
2. **Ask Foureyes.** If you are a Foureyes customer, this is data they already hold. Lead source,
   month, leads, sales and gross is exactly the attribution they track, so ask them for a lead
   source performance export by month. Any other DMS/CRM integration partner can pull the same
   thing. This is a well-understood extract, not a project.

## Optional: website traffic (Google Analytics 4)

Only if you want the Traffic Channels side of Revenue Recovery and the traffic tiles on the home
page. Separate file, same month grain, one row per month per store per channel. A channel is a
GA4 `source / medium` pair (or the default channel group if that is what you have):

```csv
period,store,channel,sessions,users,vdp_views,form_submissions,click_to_call,conversions
2025-07,Nissan Boardman,google / organic,18400,14200,29100,138,202,340
2025-07,Nissan Boardman,google / cpc,9600,8800,15400,106,154,260
2025-07,Nissan Boardman,iHeartMedia / radio,2100,1700,3600,9,21,30
```

| Column | Required | Notes |
|---|---|---|
| `period`, `store` | yes | same as the CRM file |
| `channel` | yes | `source / medium` as GA4 reports it, or a channel group name |
| `sessions` | yes | GA4 Sessions |
| `users` | no | Total users. Never summed across months or channels; it counts people |
| `vdp_views` | no | vehicle detail page views (the ASC `asc_item_pageview` event) |
| `form_submissions`, `click_to_call` | no | the ASC lead events; `conversions` is their sum when both exist |
| `conversions` | yes | GA4 key events |

Pull from GA4 Explore: dimensions `Month` + `Session source / medium`, metrics `Sessions`,
`Total users`, `Key events`, plus the ASC events if you track them. The sample for the class is
`sample-data/traffic_monthly.csv` (36 months, 3 stores, 10 channels, with one channel gone dark
and one that peaked and faded).

Traffic has no sales, gross or dollars. The screen puts lost sessions and lost conversions on
a quiet channel, never revenue. The CRM file alone still gives you a full dashboard.

## Privacy, and what NOT to bring

**Do not bring customer PII.** No names, emails, phone numbers, addresses, VINs tied to buyers.

This dataset is aggregate counts by month and source. It does not need a single customer record,
and adding them creates a compliance problem for you and slows the session down. If your export
includes them, delete the columns before you arrive.

## Checklist

- [ ] One CSV, month grain, 12+ months
- [ ] Columns: period, store, source, lead_type, leads, sales, gross (plus optional new/used, budget)
- [ ] No customer PII
- [ ] Opened it once to confirm it is not empty and the months look right
- [ ] If you could not get it: no problem, you will use `sample-data/`

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
