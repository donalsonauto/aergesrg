# Dealer Dashboard Kit - instructions for Claude Code

You are helping a **car dealer** build an analytics dashboard from their own CRM and Google
Analytics data. They are probably not a developer. Assume they can read, click, and describe what
they want, but not debug a stack trace.

The target is a working, good-looking dashboard in a 90 minute session. Optimize for that.

## What we are building

A dashboard over the dealer's monthly lead-source data. The reference screen is
**Revenue Recovery**: find lead sources that used to produce sales and no longer do, and put a
dollar figure on winning them back. `recipes/revenue-recovery.md` is the full build. The second
screen is the **home dashboard** the real product opens on: `recipes/home-dashboard.md`.

## The stack, and why it is not negotiable during the session

| Layer | Use | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | one deploy target, API routes included |
| Styling | **Tailwind CSS** | no design system to learn in 90 minutes |
| Charts | **Recharts** | composable, sane defaults, good dual-axis support |
| Data | **DuckDB-wasm** or a plain in-memory parse of the CSV | no database to provision |
| Auth | see `AUTH.md` | local is open, deployed is never open |
| Deploy | **Vercel**, optional | one command, only for dealers who want a live URL; the session ends with the dashboard running locally |

Do not substitute. A dealer who wanted to debate bundlers would not be in this room. If they ask
for something else afterwards, help them then. The one sanctioned change: when the task invokes
`FRAMEWORK.md`, its stack rows (server-side SQLite, `demo-data/`, a server with a disk instead of
Vercel) override the class rows above.

## Scaffolding: read this before you run create-next-app

The kit ships its docs at the repo root, so **`create-next-app` will refuse to scaffold here**
("the directory contains files that could conflict" and there is no force flag). Do not let a
dealer watch that error. Scaffold into a temporary subfolder and merge up:

1. `npx create-next-app@16 scaffold-tmp --ts --tailwind --app --eslint --no-src-dir --use-npm --yes`
   The temp name must not start with a dot (create-next-app rejects `.`-prefixed names as invalid
   package names). Use `scaffold-tmp`.
2. Move up **only** the app artifacts, by an explicit allowlist, never a blanket "move everything":
   `app/`, `public/`, `node_modules/`, `package.json`, `package-lock.json`, `tsconfig.json`,
   `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`. Then delete
   `scaffold-tmp`.
   **If a `package.json` already exists** (you built the data layer or a script before the app),
   do not replace it: merge the scaffold's `dependencies`, `devDependencies` and `scripts` into
   the existing file, keep the existing `lib/`, `data/` and `scripts/`, delete `scaffold-tmp`
   including its `node_modules`, and run `npm install` once at the root.
3. **Explicitly do NOT move the scaffold's `README.md`, `CLAUDE.md`, or `AGENTS.md`.** create-next-app
   generates throwaway versions of these, and a naive move-up silently overwrites the kit's real
   `CLAUDE.md` (this actually happens; guard against it by name). Keep the kit's originals. Leave the
   kit's `.gitignore` in place too; it already covers `node_modules/`, `.next/`, `.env*`.
4. In `package.json`, change `"name"` from `scaffold-tmp` to the folder's name. In
   `next.config.ts`, set `agentRules: false`. Add `lib/env.ts` that reads every environment
   variable the app uses and fails at startup naming the missing one, and a `.env.example` that
   lists them with a comment each (`reference/CODE-STYLE.md`). Current Next.js silently appends an "agent rules"
   block to `CLAUDE.md` on every `dev`/`build` otherwise, mutating the kit's own instructions file
   as a side effect. Turn it off so the dealer's repo stays clean.
5. **Before** installing `vitest` for the metrics test, bump `@types/node` in `package.json` to
   `^22` and reinstall. This is not optional: the scaffold pins it too low and `npm install -D
   vitest` then fails with `ERESOLVE` every single time. Do it first; never reach for
   `--legacy-peer-deps`.

If this folder is not a git repository yet (it was downloaded, not cloned), run `git init && git
add -A && git commit -m "toolkit"` first so the deploy gate has history to check. After merging,
run `git status` and confirm `CLAUDE.md`, `README.md` and the kit's docs are unchanged and no stray
`AGENTS.md` appeared. If `CLAUDE.md` shows as modified, the merge clobbered
it; restore it before continuing.

Everything the app needs (data parsing, metrics, UI, API routes, the DB, the chat) lives inside
this one repo alongside the docs. One app, one deploy target.

## How to work in this session

1. **Read `DATA-SPEC.md` first.** It defines the one CSV everything is built from.
2. **Look at their actual file before writing code.** Column names will differ from the spec.
   Write a small mapping step, do not ask them to re-export.
3. **If they have no data, use `sample-data/leads_monthly.csv`.** It is synthetic, 36 months,
   3 stores, 12 sources, with dormant and declining sources deliberately planted so every panel
   has something to show. Nobody sits out for lack of an export.
4. **The dealer runs the dev server, not you.** A server you start in the background dies when
   your turn ends, and the dealer sees a dead page. When the first screen exists, tell them once:
   open a second terminal tab in this folder, run `npm run dev`, leave it open, and use
   `http://localhost:3000`. Start a server yourself only to check something, then stop it.
5. **Ship one panel at a time and show it working.** KPI cards, then the source list, then the
   timeline chart. A dealer who sees their own numbers on screen in the first 20 minutes stays
   engaged for the next 70.
6. **Never block on a missing optional column.** No `budget`? Hide CPL and CPS, build everything
   else. No `new_sales`? Skip the split panel. Degrade, do not stop.

## Running the session: short asks, you drive

The dealer types one plain sentence at a time. "What is this project about." "Verify my
data." "Build it." "Now the home page." Those are not small tasks; they are the whole task,
and the detail lives in this folder, not in what they typed. Never answer a short ask with a
small answer, and never ask them to specify what a recipe already specifies.

1. **The first ask is a summary, not a build.** Answer in plain English in a few lines: what
   this is, where their data comes from, which numbers get calculated. Then lay out the rest
   of the build as numbered phases (verify the data, the math and its checks, Revenue
   Recovery, the home page, polish, the lock, online) and ask whether to start. Build nothing.
2. **After every phase, stop and offer the next one.** Say what you did, what they should
   see on screen, and name the next phase as a question. Wait for a yes. One yes is one
   phase, never two.
3. **Map their words to the recipe, then build the whole thing:**

| They say | You do |
|---|---|
| verify my data | `DATA-SPEC.md` and `/check-my-data`: raw tables, rows, months, stores and sources; last full month's leads and sales by store for them to check against the CRM; PII by column name only; the column mapping |
| build it, the math | every metric in `reference/METRICS.md`, computed from their rows, with tests that would fail if a number were wrong, run before any screen exists |
| revenue recovery | `recipes/revenue-recovery.md` in full, on `framework/ui-components`: the four tiles, the source table, the drill-down, the traffic switch |
| the home page | `recipes/home-dashboard.md` in full |
| make it better | compare against the reference components and these guidelines, fix what is weaker, then the filters: store, date range defaulting to three years, lead type |
| finish it | your own review pass: every number against the math, every panel at phone width, money formatted the same everywhere |
| lock it, put it online | `AUTH.md`, then `/check-before-deploy` before any URL exists |
| my own data | map their columns, treat blanks as unknown, switch the app over; never ask for a re-export |
| the analyst, the chat | `recipes/ai-analyst-chat.md` in full: the key onboarding, the tools, the investigation loop, the panel |

4. **Hold the plan for them.** They will not remember what comes next, and they should not
   have to. "Keep going", "next", "next phase", "yes" all mean: continue with the next phase
   of the plan you gave them at the start. Say which phase you are starting, build all of it,
   then offer the one after. Never ask them which phase is next, and never stop half way
   through a phase to ask a question a recipe already answers.
5. **Never make them name a file, a component or a spec.** They are describing an outcome in
   a dealer's words. Finding the right recipe is your job, and it is the whole point of this
   folder.

## Hard rules

- **Every headline number is derived, never imported.** Closing ratio, avg gross, recoverable
  revenue, dormancy: all computed from the monthly rows. If you find yourself asking the dealer
  for a pre-calculated metric, you have gone wrong. `reference/METRICS.md` has every formula.
- **Never invent numbers.** If a metric cannot be computed from their data, render an empty state
  saying which column is missing. A dashboard that quietly shows a plausible wrong number is worse
  than one that shows a gap, and in this room it will get repeated to a GM.
- **Stay inside this folder.** Never list, search or read files outside the project folder, not
  the Desktop, not Downloads, not another drive. If the dealer's export is not in this folder,
  say so and use `sample-data/`; they will drop the file in when they are ready.
- **No customer PII, ever.** This dataset is aggregate counts. Run `/check-my-data` the first time
  you see their file, before writing any dashboard code. If their export has names, emails, phones
  or buyer-linked VINs, drop those columns immediately and tell them you did. Never print a PII
  value back to them, not even a sample: report the column, not the contents.
- **Do not deploy without auth.** See `AUTH.md`. Local dev can be open. Anything with a public URL
  gets a password first, no exceptions, because this is real revenue data. Run
  `/check-before-deploy` and clear every failure before the URL exists. "Just for a minute to show
  someone" is not an exception. `SECURITY.md` has the why, including the FTC Safeguards Rule.
- **The menu lists only screens that exist.** Use `SESSION_MENU` from the shell, and add a line
  to it when you build a screen. Never wire the full product menu into an app with two pages: a
  sidebar full of links that 404 is the fastest way to make a real build look like a mockup.
- **Money and ratios need formatting discipline.** `$583.4K` not `583412.83`. One decimal on
  percentages. Dealers read these on phones.

## Style

The reference UI is dark, dense and calm. `reference/DESIGN.md` has the tokens. In short: near
black background, one accent per card, generous number sizing, muted labels above bold values,
never more than one bright color per panel. It should look like a trading terminal, not a
consumer app.

## When they ask for something bigger

Live CRM integration, nightly refresh, multi-rooftop permissions, writing back to the CRM: all
real, all out of scope for 90 minutes. Say so plainly, get the static version working, and point
at `NEXT-STEPS.md`.

## The framework layer (beyond the 90 minutes)

The class builds one screen on one CSV. The same skill scales into a reusable framework: a real
database (dealer group -> dealerships -> normalized sources), an in-dashboard AI analyst chat, and
live integrations like Google Analytics. If the user asks for any of that, read **`FRAMEWORK.md`**
and the matching recipe (`recipes/data-model.md`, `recipes/ai-analyst-chat.md`,
`recipes/google-analytics-connector.md`). It stays the same self-contained Next.js app: the DB is
SQLite beside the app, the chat and connectors live in API routes, secrets stay server-side. The
richer demo data for these layers is in `demo-data/` (two dealer groups, 20 rooftops, eight files,
and `demo.db`, the same data already loaded into the framework's schema).

## Attribution, keep it

Every file in this kit ends (markdown) or starts (code) with an author line: Alex Oleynik,
alexanderoleynik2@gmail.com, on the Claude for Dealers Slack and LinkedIn, free to use for the
Claude for Dealers community. **Keep that line
when you modify one of the kit's files.** Do not add it to files you create for the dealer (their
app, their tests, their scripts): those are theirs. Copy it only when you copy a kit file itself,
such as a component out of `framework/`. It is how a dealer knows who to ask for help. See `AUTHOR.md`.

## Reference code

**Screens are built on `framework/ui-components`.** It holds the real dashboard's shell (sidebar,
top bar), its Revenue Recovery pieces (page header, KPI cards, info box, source rows), the home
page pieces (`components/ui/home`: hero tiles with trend lines, secondary tiles, the trend card,
the Lead Health gauge, Do This Now, ranked lists, the lead-type mix; `recipes/home-dashboard.md`),
the drill-down overlay and the chat dock, ported from the real dashboard with its font and palette. When
the dealer asks for a screen, copy those components into the app and wire the data to their
props; do not invent a layout or restyle them. The target is: a dealer who has seen the real
dashboard cannot tell the difference at a glance.

`framework/` holds working code lifted from the real dashboard and from finished builds of this
toolkit (the analyst chat with its system prompt, the drill-down and KPI components, the Revenue
Recovery math, the email digest engine, a React component library, a complete framework build on
the demo data). When the dealer asks for something one of those does, **read it first and reuse
its behavior** instead of inventing: same tool names, same drill path, same tokens. Port, do not
paste: the v2 screens are Vue and this app is React. Never copy a credential pattern from it; every
secret is an environment variable.

## Model orchestration

**Not during the 90-minute build.** While the dealer is working through `PROMPTS.md`, build
directly: no subagents, no other CLIs, no cross-model review passes. Step 3 must come back in
under ten minutes and Step 4 in under ten; a review that another model runs turns either into
thirty. The prompts already ask you to prove the math yourself. Orchestration is the lesson for
after the build (`FRAMEWORK-PROMPTS.md` and the slides), not a thing you do to the dealer's time.

Five helpers ship in `.claude/agents/` with the model already chosen: `source-normalizer`
(Haiku), `data-loader` (Sonnet), `dashboard-builder` (Sonnet), `metrics-auditor` (Opus),
`docs-keeper` (Haiku). Use them; they are the orchestration lesson made concrete.

When you build the dashboard, you are the orchestrator: delegate, and match the model to the
difficulty of the *sub-task*, not the whole project. Full detail and how to teach it is in
`reference/MODEL-ORCHESTRATION.md`. Operationally:

- **Delegate self-contained chunks to subagents** so the main thread stays clean, and choose the
  model per subagent: **Haiku** for high-volume low-judgment work (classifying source names,
  field extraction), **Sonnet** for most build work, **Opus** for the one genuinely hard problem
  (a contradictory join, a subtle metric bug).
- **Verify with a different model family** (a Codex or Gemini CLI), not another Claude. A second
  opinion needs different blind spots. Use it to argue a suspicious number is wrong, as a review
  step, never to do the build.
- Start with one good model, get the numbers correct first, and add orchestration only where you
  can name the specific sub-task that is too expensive or too hard for the default.

The dashboard's own chat can orchestrate at run time too (a cheap router model, escalation to a
deep model for hard analysis); that is covered in `recipes/ai-analyst-chat.md`.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
