# The framework: from one CSV to a dashboard you can talk to

The 90-minute class (see `SESSION.md`) gets you one screen, Revenue Recovery, on one CSV.
This document is the level above that: the **reusable framework** the same skill scales into.
Point Claude Code at this repo and describe what you want. It reads these instructions and
builds the right thing.

This is not an app you run. It is a set of instructions and recipes Claude Code follows, plus a
realistic demo dataset to build against. You own everything it produces.

## The one thing to say

Open Claude Code in this folder and say one of:

> Read FRAMEWORK.md. Build me a dashboard on the demo data in `demo-data/`.

> Read FRAMEWORK.md. Build me a dashboard. My data is in `./my-data/` (or `./my-data.csv`).

Or follow **`FRAMEWORK-PROMPTS.md`**: the same build as copy-paste prompts, one phase at a time,
with what you should see after each one.

From there you steer in plain language: "add drill-downs by dealership", "put trend lines on
every KPI", "make the UI look like the reference", "now add the AI analyst chat", "connect
Google Analytics". Each of those maps to a recipe below.

## What the framework gives you, in layers

You do not have to build all of it. Each layer is independently useful and builds on the one
before it.

| Layer | What it is | Recipe |
|---|---|---|
| 1. **The dashboard** | KPI cards with trend lines, a ranked list, timeline charts, filters and drill-downs, on the reference dark UI. | `recipes/revenue-recovery.md`, `recipes/home-dashboard.md`, `recipes/dashboard.md` |
| 2. **The data model** | A real database. Dealer group -> dealerships -> normalized sources. Ingest files, or automate pulls. | `recipes/data-model.md` |
| 3. **The AI analyst chat** | An in-dashboard chat that is a data analyst: it runs tools over your data, grounds answers in a knowledge base (RAG), and surfaces the biggest moves as questions. Same UI as Rankmatic. | `recipes/ai-analyst-chat.md` |
| 4. **Integrations** | Connect live sources. A local browser-OAuth connector for Google Analytics (extensible to Ads, Business Profile). | `recipes/google-analytics-connector.md` |
| 5. **Email reports** | A digest every morning and alerts only when something moved, built from the same numbers as the screen. Nobody has to log in. | `recipes/email-reports.md` |
| 6. **Orchestration** | Wire in other models as sub-agents: a Fable orchestrator calling Opus for hard reasoning, Haiku for cheap bulk work, or a Codex CLI. | `reference/MODEL-ORCHESTRATION.md` |

## The stack (same as the class, do not substitute)

One self-contained Next.js app, one deploy target. The advanced layers fit inside it so you
never have to stand up a second service.

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | one deploy, API routes host the chat and connectors |
| Styling | **Tailwind CSS** + the tokens in `reference/DESIGN.md` | the reference dark UI, no design system to learn |
| Charts | **Recharts** | trend lines, dual-axis, drill-downs |
| Database | **SQLite** (`better-sqlite3`) or DuckDB | a real DB with zero to provision; the file lives beside the app |
| AI | **Anthropic SDK** (`@anthropic-ai/sdk`) in an API route | the analyst chat; streamed over SSE |
| Auth | middleware password gate, see `AUTH.md` | local is open, deployed is never open |
| Deploy | a small server with a disk (the framework has a database); Vercel only for the class dashboard | SQLite needs a persistent volume; Vercel functions do not have one |

**Where the data lives, in order of size.** The class needs no database: one CSV parsed in
memory, the whole calculation runs in a millisecond. The framework puts SQLite beside the app,
which carries a 20-rooftop group with room to spare. When you outgrow that, the recommendation is
**Postgres on a dedicated server you own** (the same schema moves over; a box costs a fraction of
metered cloud and nobody bills you per read), and **ClickHouse** when the data is deal-level or
event-level at real scale (millions of rows, fast aggregates). **Supabase** is hosted Postgres with
no server to run: fine for a prototype or if nobody on your side will touch a server, at the price
of paying per use and giving up the box. Claude sets any of them up; tell it which and why.

Everything server-side (the DB, the Anthropic key, OAuth tokens) stays in API routes and env
vars. Nothing sensitive is ever put in a `NEXT_PUBLIC_` variable. See `SECURITY.md`. One thing to
say plainly: the dashboard reads its database on your machine, but the analyst chat sends your
question, the aggregate numbers its tools pull, and the knowledge notes it retrieves to the model
provider. The dashboard works with the chat turned off.

When a session invokes this file, its rules win over the class-only rows in `CLAUDE.md`: server-side
SQLite instead of an in-memory CSV parse, `demo-data/` instead of `sample-data/`, and no fixed
90-minute clock.

## The data model, in one picture

This is the shape every recipe assumes. It mirrors how a real dealer group's data is organized.

```
agency                  Northline Automotive Partners (the level above the group: one agency, many groups)
└─ dealer group         Summit Auto Group (12 rooftops), Harbor Motor Group (8 rooftops)
  └─ dealership          Summit Toyota of Fairview, Summit Honda Westland, ... (20 rooftops)
       └─ month          2025-09, 2025-10, ...
            └─ metrics    leads / sales / gross / inventory / ad spend / GA4 traffic
                 └─ source (normalized)   Autotrader, Cars.com, CarGurus, ...
```

Two things make it real rather than a toy:

- **Normalization.** The same lead source is spelled differently at every rooftop
  (`Autotrader`, `AutoTrader.com`, `auto trader`, `ATC`). The DB maps all of them to one
  canonical name before anything is computed. `demo-data/normalization/source_aliases.csv` is
  the map; `recipes/data-model.md` is how it is applied.
- **Rollups sum then divide.** A group number is the sum of its rooftops' components, with the
  ratio recomputed. Never average per-store ratios. This is in `reference/METRICS.md` and it is
  the error a GM catches first.

## The demo data

`demo-data/` is a full synthetic agency, two dealer groups, so every layer has something meaty to
build on (about 400,000 rows across eight files):

- **Two dealer groups, 20 rooftops**, mixed brands and sizes, under one agency
  (`dealer_group.json`: `agency`, `groups[]`, and a flattened `rooftops[]` with `group_id`); every
  file carries `group` and `store`
- **Multi-metric at month grain**: `leads_monthly.csv` (CRM), `inventory_monthly.csv`,
  `spend_monthly.csv`, `ga4_channels.csv` (website traffic), `service_monthly.csv` (fixed ops)
- **Detail files for drill-downs**: `dms_deals.csv` (one row per sold vehicle, 36 months, about
  100,000 deals with front and back gross, make, model, salesperson id), `crm_leads.csv` (one row
  per lead for the last 13 months, about 280,000 rows with a status funnel and response time),
  `inventory_units.csv` (every vehicle on the lot, about 3,300 units with days on lot, price to
  market, VDP views). They reconcile to the monthly files to the unit and the dollar. No VINs,
  no names, nothing that identifies a person.
- **The messy real world, on purpose**: raw source names differ per rooftop; one rooftop has a
  CRM cutover where its internet feed dies mid-window while its walk-in sales jump the same month
  (feed loss, not lost business: a real failure the chat can be asked to find and the recovery
  screen must flag rather than count); dormant and declining sources are planted so Revenue
  Recovery has something to show.
- **Answers to check against**: `demo-data/expected-results.json` has the row counts, the latest
  month's group and per-store totals (with the wrong averaged ratio beside the right one), the
  planted source lists and the cutover month. A build that disagrees with it is wrong.

Regenerate or resize it any time:

```bash
python3 demo-data/generate.py              # 36 months (dormancy detection works best)
python3 demo-data/generate.py --months 13  # last 13 months only
```

The simple single-file dataset for the 90-minute class still lives at
`sample-data/leads_monthly.csv` and is unchanged.

## The code you are getting

`framework/` is working code from the real dashboard and from builds of this toolkit: the
analyst's full system prompt and the eight specialist analysts, the agent loop, the highlights
engine, the Revenue Recovery math, the drill-down and KPI screens, the chat dock, the Daily Pulse
email engine, a Next.js analyst chat, a finished framework build on the demo data, and a React
component library ported from the v2 screens. `framework/README.md` says what each folder is
and how to point Claude at it. Most of it you say "do it the way framework/... does it" and
Claude reads, then builds inside your app. `framework/framework-app` is different: it is the
finished data layer, checks and screens for the demo group, and `demo-data/demo.db` is that data
already loaded, so the framework prompts **adopt** them (copy, install, run the checks) instead
of building them again. That turned a 64-minute build into about 28 measured minutes, and the
new 28 include bringing every screen onto the real components, which the old 64 never did.

## Bringing your own data

Three paths, least to most work. All of them land in the same DB, so the dashboard does not care
which you used.

1. **Drop files.** Export from your CRM/DMS/GA4 and drop the files in `./my-data/`. Claude writes
   the column mapping and normalization (`recipes/data-model.md`). This is the workshop path.
2. **Automate the pull.** A scheduled CRM export to a folder, or a CRM/DMS API. Fiddly but real;
   `NEXT-STEPS.md` covers the trade-offs.
3. **A data access point.** If your data already lives behind an MCP server or API (for example a
   OneVision-style access point), the chat's tools call it directly instead of reading files.
   `recipes/ai-analyst-chat.md` shows where the tool layer plugs in.

## Guardrails that never move

These come from `CLAUDE.md`, `SECURITY.md` and `AUTH.md` and they apply to every layer:

- **Every headline number is derived, never imported.** Formulas in `reference/METRICS.md`.
- **Never invent a number.** If it cannot be computed, render an empty state naming the gap.
- **No customer PII, ever.** Run `/check-my-data` on every lead file the first time you see it;
  inventory, spend and traffic files get the PII scan only, their columns are not CRM columns.
- **No deploy without auth.** Run `/check-before-deploy` before any public URL exists.
- **Secrets stay server-side.** The Anthropic key and OAuth tokens live in env vars and API
  routes, never in the browser bundle.

## Suggested order for a full build

1. `/check-my-data` on your files (or start on `demo-data/`).
2. Adopt `framework/framework-app` and `demo-data/demo.db` (`FRAMEWORK-PROMPTS.md`, Steps 2 and
   3): the database, the normalization, the query layer and the checks, already built. Build Layer
   2 yourself only for your own exports, with the same loader (`recipes/data-model.md`).
3. Layer 1: walk the shipped screens, then bring them onto `framework/ui-components`
   (`recipes/dashboard.md`, `recipes/home-dashboard.md`, `recipes/revenue-recovery.md`).
4. Layers 3, 4 and 5 at once, one subagent each: the analyst chat, Google Analytics, the email
   digest (`FRAMEWORK-PROMPTS.md`, Step 6). Dry run the digest first.
5. `/check-before-deploy`, add the auth gate (`AUTH.md`), ship.
6. Pick the model per step as the prompts say (`reference/MODEL-ORCHESTRATION.md`).

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
