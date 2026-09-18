# Recipe: the data model (dealer group, dealerships, normalization, DB)

Layer 2 of the framework. Build this when you have more than one rooftop, more than one file, or
you want the AI analyst chat to query real tables instead of re-parsing a CSV on every request.
Skip it for a single simple CSV; the 90-minute class does not need it.

The whole point: turn a pile of messy exports into **one normalized SQLite database** the rest of
the app queries. Formulas still come from `reference/METRICS.md`. This recipe is about getting the
data clean and queryable, not about the math.

## The shape

```sql
CREATE TABLE IF NOT EXISTS dealer_group (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dealership (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES dealer_group(id),
  name TEXT NOT NULL, brand TEXT, region TEXT);
CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY,                 -- slug of the canonical name, e.g. "autotrader"
  group_id TEXT NOT NULL REFERENCES dealer_group(id),
  canonical_name TEXT NOT NULL, UNIQUE (group_id, canonical_name));
CREATE TABLE IF NOT EXISTS source_alias (
  group_id TEXT NOT NULL, raw_name TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), PRIMARY KEY (group_id, raw_name));
CREATE TABLE IF NOT EXISTS fact_leads (
  period TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  source_id TEXT NOT NULL REFERENCES source(id), lead_type TEXT NOT NULL,
  raw_source TEXT NOT NULL,            -- kept so the alias audit can count leads per spelling
  leads INTEGER, sales INTEGER, new_sales INTEGER, used_sales INTEGER, gross REAL, budget REAL,
  PRIMARY KEY (period, dealership_id, source_id, lead_type, raw_source));
CREATE TABLE IF NOT EXISTS fact_inventory (
  period TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  new_units INTEGER, used_units INTEGER, avg_days_on_lot REAL, avg_price_to_market REAL,
  PRIMARY KEY (period, dealership_id));
CREATE TABLE IF NOT EXISTS fact_spend (
  period TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  channel TEXT NOT NULL, spend REAL, PRIMARY KEY (period, dealership_id, channel));
CREATE TABLE IF NOT EXISTS fact_ga4 (
  period TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  channel TEXT NOT NULL, sessions INTEGER, users INTEGER, vdp_views INTEGER, conversions INTEGER,
  PRIMARY KEY (period, dealership_id, channel));
CREATE TABLE IF NOT EXISTS fact_service (
  period TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  opcode_family TEXT NOT NULL, ro_count INTEGER, labor_revenue REAL, parts_revenue REAL,
  customer_pay INTEGER, avg_hours REAL, PRIMARY KEY (period, dealership_id, opcode_family));
-- detail tables: one row per thing, for drill-downs past the month grain
CREATE TABLE IF NOT EXISTS deal (
  deal_id TEXT PRIMARY KEY, date TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  source_id TEXT NOT NULL REFERENCES source(id), lead_type TEXT NOT NULL, new_used TEXT NOT NULL,
  make TEXT, model TEXT, model_year INTEGER, sale_price REAL, front_gross REAL, back_gross REAL,
  fi_products INTEGER, salesperson_id TEXT, days_to_close INTEGER);
CREATE TABLE IF NOT EXISTS lead (
  lead_id TEXT PRIMARY KEY, date TEXT NOT NULL, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  source_id TEXT NOT NULL REFERENCES source(id), lead_type TEXT NOT NULL, status TEXT NOT NULL,
  new_used_interest TEXT, response_minutes INTEGER, sold INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_unit (
  stock_number TEXT PRIMARY KEY, dealership_id TEXT NOT NULL REFERENCES dealership(id),
  new_used TEXT NOT NULL, make TEXT, model TEXT, model_year INTEGER, days_on_lot INTEGER,
  list_price REAL, cost REAL, price_to_market_pct REAL, vdp_views_30d INTEGER, leads_30d INTEGER,
  as_of TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_leads_pd ON fact_leads (period, dealership_id);
CREATE INDEX IF NOT EXISTS ix_deal_dd ON deal (dealership_id, date);
CREATE INDEX IF NOT EXISTS ix_lead_dd ON lead (dealership_id, date);
CREATE INDEX IF NOT EXISTS ix_leads_src ON fact_leads (source_id);
CREATE INDEX IF NOT EXISTS ix_inv_pd ON fact_inventory (period, dealership_id);
CREATE INDEX IF NOT EXISTS ix_spend_pd ON fact_spend (period, dealership_id);
CREATE INDEX IF NOT EXISTS ix_ga4_pd ON fact_ga4 (period, dealership_id);
```

The monthly `fact_*` tables are what every card and chart reads. The detail tables (`deal`, `lead`,
`inventory_unit`) are what a drill-down opens when the month is not enough: the deals behind a
gross number, the leads behind a closing ratio, the units behind days on lot. The demo ships all
of them (`demo-data/dealer_group.json`, `detail_files`) and they reconcile: deals per store, month
and source sum to `fact_leads.sales` and `gross`; leads per store, month and source count to
`fact_leads.leads`. Load the monthly files first, then the detail files, and prove the
reconciliation in the load report. Lead type lives on the fact row, not on the source: one source
can carry more than one type.
Counts are nullable integers (unknown stays `NULL`), money is a nullable number of dollars.
Turn on `PRAGMA foreign_keys = ON` on every connection so a fact can never point at a rooftop or
source that does not exist. IDs, never display names, are what filters, URLs and chat tools pass
around; `store_id` in the manifest becomes `dealership.id`, `store` becomes `dealership.name`.

`period` is always `YYYY-MM`. Every fact table joins to `dealership` and, where relevant, to
`source` through the alias map. The demo fact files carry the rooftop by **name** (`store`) and its
group by name (`group`), not by id: resolve them through `demo-data/dealer_group.json` (`groups[]`
with their `rooftops[]`, or the flattened `rooftops[]` where each entry carries `group_id`) at load
time, and stop on a name that is not in the manifest. The manifest also names the agency above the
groups; one `dealer_group` row per group is enough, the agency is the scope "all groups". This mirrors `demo-data/dealer_group.json` exactly, so build it
against `demo-data/` first and swap in real files after.

## Why SQLite

One file (`data/dealer.db`), no server to provision, `better-sqlite3` gives synchronous queries
that are trivial to call from a Next.js API route. **It needs a disk that persists**: locally that
is the project folder; online it is a small server with a volume (the dedicated box the deck
recommends, or Fly, Railway, Render). Vercel's functions have no persistent disk, so the framework
does not deploy there as-is; Vercel stays the one-command option for the class dashboard, which has
no database. If you outgrow SQLite, the same schema moves to Postgres with small changes (the
full-text search table is the SQLite-specific part). The recommendation at that point is Postgres
on a dedicated server you own; ClickHouse if the deal-level and event-level files get into the
millions of rows; Supabase if you want hosted Postgres and nobody will run a server, accepting
metered pricing. Say which to Claude and it does the migration. Add `data/*.db` to `.gitignore` now: a
committed DB is a committed copy of the dealer's numbers.

```bash
npm install better-sqlite3
```

## Step 0a - the fast path: the schema and the data already ship

`framework/framework-app` holds this recipe finished (`lib/db.ts` is the schema, `scripts/load.ts`
the loader, `lib/queries.ts` the query layer, `scripts/checks.ts` the proofs), and
`demo-data/demo.db` is the demo group already loaded through it. Copy the app in, copy the
database to `data/dealer.db`, run `npm run checks`. Read the rest of this recipe to understand
what you adopted and to load your own exports; do not spend an hour rebuilding it.

## Step 0 - the schema

Write `lib/db.ts`: open (or create) `data/dealer.db`, run the statements above (keep them in
`lib/schema.sql`), and export a `getDb()` singleton that resolves the path from the project root,
never from the current working directory. Write the loader as `scripts/load-data.ts` with an npm
script, `npm run data:load -- --manifest demo-data/dealer_group.json`; it reads exactly the files
the manifest names (`metric_files`, `normalization`, `knowledge`) and nothing else in the folder.
The clean-start sequence is `npm install`, `npm run data:load`, `npm run dev`.

## Step 1 - load the hierarchy

Read `demo-data/dealer_group.json` (or, for your own data, build the same object from what you
have). Insert one `dealer_group` row and one `dealership` row per rooftop. Keep the stable
`store_id` from the manifest as the primary key so re-running the load is idempotent (upsert, do
not duplicate).

## Step 2 - build the normalization map (this is the real work)

Real exports name the same source differently at every rooftop: `Autotrader`, `AutoTrader.com`,
`auto trader`, `ATC` are all one source. If you skip this, the dashboard shows four half-sized
Autotraders and every ranking is wrong.

1. Load `demo-data/normalization/source_aliases.csv` (columns `raw_source`, `canonical_source`)
   into `source` (distinct canonical names) and `source_alias` (every raw spelling -> its
   source id).
2. **For your own data, generate the map, do not hand-type it.** Pull the distinct raw source
   names out of the export, then have Claude propose a `raw -> canonical` mapping and show it to
   the dealer as a table to correct. They know that `ATC` means Autotrader; the model is guessing.
   Never auto-merge two names you are unsure about; leave them separate and flag them.
3. Any raw name with no alias entry maps to itself (a new source) and is listed in the load report
   as "unmapped, kept as its own source". That is a warning, not an error. Match aliases exactly
   after trimming whitespace; never merge by similarity without a human saying yes. Silently
   dropping an unmapped source loses real leads.

## Step 3 - load the facts, normalized

Real files are ugly: a Latin-1 export from an old CRM, a tab-separated "CSV", two title rows above
the header, a month re-exported after a correction. Keep the file's quirks in
`data/mappings/<file>.json` (`delimiter`, `encoding`, `skipRows`, the column map) so the next load
of the same export needs no conversation. The error policy is fixed: a bad row is skipped, the rest
loads, and the report lists the first ten bad rows with line numbers. A column you did not map is
kept on the row as `extra_json`, never dropped silently. After every load, reconcile out loud: rows
in the file equal rows loaded plus rows skipped.

For each metric file, map the columns to the schema (`recipes/revenue-recovery.md` Step 0 covers
the parsing rules: `period` to `YYYY-MM`, currency to number, empty stays `null` not `0`, trim
whitespace). As you insert `fact_leads`, resolve each raw `source` through `source_alias` to a
`source_id`. Insert facts keyed on `(period, dealership_id, source_id, lead_type)` so a re-load
replaces rather than duplicates.

If two raw spellings of one source land in the same store, month and lead type, keep both rows
(the key includes `raw_source`) and let the query layer sum them; the audit can still count each
spelling. A load **replaces** every (dataset, store, month) it covers rather than upserting row by
row, so a re-export that dropped a row does not leave the old row behind; load into a staging table,
validate, then swap in one transaction.

Then report what you loaded, per file: rows in, rows after normalization, distinct sources before
and after (the collapse from raw to canonical is the proof normalization worked), date range,
rooftop count. Inventory, spend and GA files have no sources; report channels instead. If a fact
references a store that is not in the manifest, stop and say so; that is a mapping bug, not a row
to skip. `demo-data/expected-results.json` has the row counts and the latest month's totals to
check the load against.

## Step 4 - the query layer

Write `lib/queries.ts` with the reads the dashboard and chat need, each a plain function over the
DB:

- `listDealerships(groupId)` -> the filter/drill-down options
- `getKpi(metric, scope)` -> one value for the analysis month with prior month and prior year
- `getKpiTimeline(metric, scope)` -> the monthly series on the full period grid
- `getSourceRollup(scope)` -> per-source leads/sales/gross/closing ratio for the ranked list
- `getRevenueRecovery(scope)` -> statuses, estimates, the feed-loss list, the headline
- `drilldown(metric, dimension, scope)` -> one level down, with the filter set applied
- `getChannelTraffic(scope)` -> GA4 and spend by channel

`scope` is always the same object: `{groupId, dealershipId?, sourceId?, leadType?, channel?, from,
to}`, validated server-side, IDs only. Every result carries `{value or rows, unit, scope, window,
partial?}`. The chat's tools are these functions under snake_case names with a JSON schema for
`scope`; they do no SQL and no math of their own, so the chat can never disagree with the screen.
Never join one fact table to another: aggregate each family to the grain you need, then combine.

**Every rollup sums components and recomputes the ratio.** `closingRatio = sum(sales) /
sum(leads)`, never the mean of per-store ratios. Put this in SQL (`SUM(sales) * 1.0 /
SUM(leads)`), not in JavaScript over pre-divided rows. This is the single most common error in
dealer dashboards (`reference/METRICS.md`).

These same functions are what the AI analyst chat calls as tools
(`recipes/ai-analyst-chat.md`), so keep them pure and well-named: the tool descriptions are
generated from them.

## Step 5 - drill-downs

A drill-down is just the same query with one more filter applied and the grouping changed one
level down: group -> dealership -> source -> month. Build one generic drill function that takes a
dimension and a filter set, rather than a bespoke query per screen. The UI passes the clicked
value as the next filter. Because the rollup logic lives in one place, a drill-down can never
disagree with the KPI card above it.

## Ingesting real data later

The DB is the seam that makes the source of the data irrelevant to everything downstream:

- **Dropped files**: re-run the loader (Steps 1-3) whenever new exports land in `./my-data/`.
- **Scheduled export**: point the loader at the folder a CRM emails reports to; run it on a cron.
- **CRM/DMS/GA4 API**: replace the file read in Step 3 with an API client; the mapping and
  normalization steps are unchanged.
- **An MCP server or data API** (e.g. a OneVision-style access point): plug it into the query
  layer above so the dashboard and the chat both read it through the same functions and the same
  scope. Ingest its aggregates into the DB when you can; if a metric stays remote, both surfaces
  call the same adapter and show where the number came from and when it was fetched.

## Common failure modes

| Symptom | Cause |
|---|---|
| One source appears several times in the ranked list | normalization not applied, or an alias missing from the map |
| Group total does not match the sum of stores | averaged ratios instead of `SUM/SUM` in SQL |
| A rooftop shows zero internet leads part-way through | not always a bug: the demo group's Hyundai rooftop has a planted CRM cutover. On real data, it is usually exactly this, a feed that was never reconnected. Surface it, do not paper over it |
| Re-loading doubles every number | inserts instead of upserts on the fact key |

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
