# Where to go from here

You have a working dashboard on a static export. Roughly in order of value:

## 1. Stop exporting by hand

The static CSV is the right call for a workshop and the wrong call for month three. Options, from
least to most work:

- **Scheduled export.** Most CRMs can email a report on a schedule. Drop it in a folder, have the
  dashboard read the newest file. Ugly, effective, works this week.
- **CRM API.** VinSolutions, DealerSocket and eLead all have APIs. This is the fiddly part: auth,
  rate limits, pagination, and the fact that lead-source naming drifts over time.
- **A DMS/CRM integration partner.** If the API work stalls, this is a solved problem for
  specialists and not worth burning weeks on.

## 2. Add the second data source

CRM plus GA4 is where it gets genuinely interesting: you can compare what your traffic does
against what your leads do, and see which sources bring people who actually buy.

## 3. Extend the model

Everything below runs on the same monthly grain you already have:

- **Salesperson performance** - add a `salesperson` column, same math
- **Appointment funnel** - appointments set, shown, sold
- **Inventory health** - days on lot, price to market, missing photos
- **OEM benchmarking** - your closing ratio vs your brand's average
- **Anomaly digest** - the biggest MoM moves, emailed monthly

## 4. Make it hold up

- Real auth with per-user access ([AUTH.md](AUTH.md), option 3)
- Tests over the metric functions, because the formulas are the product
- A staging copy so you are not editing the thing your GM is looking at

## Getting help

Two honest paths:

**Do it yourself.** Everything here is yours. The formulas are in
[reference/METRICS.md](reference/METRICS.md), the design tokens are in
[reference/DESIGN.md](reference/DESIGN.md), and Claude Code will keep building with you.

**Get the plumbing done for you.** The integration layer - live CRM and DMS feeds, normalizing
source names across rooftops, nightly refresh, multi-store permissions - is the part that eats
time and is not where your judgment adds value. That is worth handing to someone, whether that
is us or another firm, so you stay focused on what the dashboard shows and how it looks.

Either way the dashboard is yours and there is no lock-in. That is deliberate.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
