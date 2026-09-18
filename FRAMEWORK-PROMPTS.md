# The framework prompts, in order

The class prompts (`PROMPTS.md`) build one screen on one CSV. These build the framework on top:
a real database for two dealer groups (20 rooftops under one agency), a dashboard with drill-downs, the same Revenue Recovery
screen on the group, an AI analyst you can talk to, a live Google Analytics connection and an
email digest.

Same rules as the class. Paste one block at a time. Describe outcomes, never technology; the
guidelines in this folder pick the technology. When a number comes back, argue with it before
you build the next thing. Each phase is a checkpoint you can stop at and still have something
that works.

**Why this is fast now.** The first version of these prompts asked Claude to design the schema,
write the loader, write the checks and build every screen from the recipes; measured on
2026-09-16 that took **64 minutes of machine time** for the data layer and the dashboard alone.
Nobody should wait for work that already exists. The kit now ships the finished build
(`framework/framework-app`: schema, loader, query layer, checks, the screens) and the loaded
database (`demo-data/demo.db`). Phases B and C are now **adopt, verify, re-skin**: copy, run the
checks, look, then bring the screens onto the real components. Measured on 2026-09-18 with a fresh
unattended Claude Code on Sonnet: **2:38 to adopt, 2:45 to prove, 22:55 to re-skin every screen
onto `framework/ui-components`**, about 28 minutes for everything the old prompts spent 64 on, and
the old ones never got to the real look. The chat, the Google connector and the digest are then
built **at the same time** by three subagents (Step 6): **33 minutes measured** for all three,
against about three hours in sequence. The whole framework, class screen to digest, is now about
an hour of machine time, which is what the orchestration lesson from the class looks like in
practice.

**Pick the model per step.** Two commands in Claude Code: `/model sonnet` and `/model opus`.
Each step below says which one. Sonnet is faster and cheaper and is right for copying, wiring and
verifying; Opus is for the steps where judgment is the work (arguing with the load, the analyst's
system prompt, the finish pass). Haiku is what the subagents use for high-volume, low-judgment
pieces such as normalizing source names.

Launch the same way:

```text
claude --dangerously-skip-permissions --chrome --rc
```

That flag is right for this folder, which holds nothing you cannot rebuild. Once the folder holds
an API key or a real export (Step 6 onward), launch without it and let Claude ask.

## Phase A: point it at the framework

### Step 1. Read first, build nothing

Model: `/model sonnet`

```text
Read FRAMEWORK.md and the recipes it points to, then look at what is in
demo-data/ and in framework/framework-app.

Tell me in plain English, in ten lines or fewer: what this framework
builds, what already ships built and what I still build, what the demo
dealer group looks like (how many rooftops, how many months, which
files), and what is deliberately messy in the demo data. Do not build
anything yet.
```

What you should see: ten lines, no code; two dealer groups, 20 rooftops, 36 months, eight files
and a loaded database; it says the data layer, the checks and the screens ship in
`framework/framework-app`; it names the source-name mess and the planted CRM cutover.

## Phase B: the database, adopted and proven

### Step 2. Adopt the data layer and the loaded database

Model: `/model sonnet`

```text
Do not design a database. Adopt the one that ships: copy
framework/framework-app into this app (its lib, scripts, app,
components and config), install it, and copy demo-data/demo.db to
data/dealer.db. Make sure the database file can never be committed.

Then start it and show me the home page in the browser. Tell me what
you copied, what the database holds (groups, rooftops, sources, how
many monthly rows, the date range), and how I would rebuild it from
the CSVs with the loader if I ever change the data.
```

What you should see: a copy, an install, a running page, no schema design; two groups, 20
rooftops, 13 canonical sources folded from 35 raw spellings, 8,316 monthly lead rows plus
inventory, spend and GA4, 2023-10 to 2026-09; `data/*.db` in `.gitignore`; `npm run load` named
as the rebuild path. Under five minutes of machine time.

### Step 3. Run the proof that ships

Model: `/model sonnet`

```text
Run the checks that ship with the framework (npm run checks and
npm run prove) and show me the output. Then compare the group totals
to demo-data/expected-results.json.

Tell me in plain English what each check would have caught: a group
total built by averaging the stores, a month with no rows skipped
instead of counted as zero, two spellings of one source counted
separately. Then give me the group's closing ratio for the latest
full month and the same number for each rooftop, so I can see the
group is the sum of its stores and not the average.
```

What you should see: every check passes in seconds; a group closing ratio that equals total sales
over total leads across the rooftops, not the mean of the rooftop ratios; the expected-results
totals match.

### Check. Argue with the load

Model: `/model opus`

```text
Show me every raw source spelling the alias map folded into one name,
as a table: raw spelling, the name it became, and how many leads it
carried. Flag any merge you are not sure about.

Then show me the sources that had no mapping and became their own
source. Rebuild the database from the CSVs with the loader, confirm
it matches the shipped one row for row, and tell me if anything
differs. I want to correct the map myself.
```

What you should see: a readable alias table you can correct; unmapped names listed, not silently
dropped; a rebuild that matches the shipped database.

## Phase C: the screens, adopted and re-skinned

### Step 4. Walk what ships, then bring it onto the real components

Model: `/model sonnet`

```text
The dashboard home, the drill-downs, the filters and the Revenue
Recovery screen ship in framework/framework-app and are running now.
Walk every one of them in the browser and tell me what works.

Then bring them onto the component library in framework/ui-components,
which is the real dashboard's look: the app shell and menu, the home
rows from recipes/home-dashboard.md (hero tiles with trend lines, the
Dealership Health gauge, Do This Now, Health By Store, Financial Focus,
store performance, Health Scores, the lists), the drill-down overlay,
the filter bar, and the Revenue Recovery rows with their timeline.
Same numbers, same query layer; only the components change. Keep the
group and rooftop pickers and make every screen recompute when they
change: All Stores adds the rooftops up and recomputes the ratio,
never averages it.

When you are done: the group headline and the biggest rooftop's on
Revenue Recovery, which planted sources you found, and the Hyundai
rooftop's feed loss kept out of the headline.
```

What you should see: the screens on the real look; a breadcrumb like
`All stores > Summit Ford Rivera > CarGurus`; every card moves when a filter changes; the
dormant and declining lists (`demo-data/expected-results.json` names the planted ones); the
Hyundai rooftop's internet sources in a separate "feed lost?" list, not in the headline. About
twenty-five minutes, the one real build in this half; the measured run came back with the
group at $876.2K/mo, 3 dormant and 3 declining, Radio Spot pooled at group level but
"insufficient" at one rooftop, and the six Hyundai internet sources flagged as feed loss.

### Step 5. Make it look finished

Model: `/model opus`

```text
Now review your own work until it is finished. Check every number on
screen against the database. Check every page at phone width. Make the
money formatting consistent everywhere. Fix what you find and check
again. Keep going until you would put this on a screen in the sales
tower. Then tell me what you fixed.
```

### Loops. Let it keep going

```text
/loop keep reviewing this dashboard against reference/DESIGN.md and
reference/METRICS.md, fix what you find, and stop when a full pass
finds nothing to fix
```

## Phase D: three layers at once

The chat, the Google Analytics connector and the email digest do not depend on each other once
the database exists. Build them in parallel. This is the orchestration the class talked about:
you are the manager, three subagents do the work, and you review what comes back. It needs an
Anthropic API key in `.env.local` for the chat to be tested; the subagent will tell you if it is
missing and build the calm empty state instead. **Set a spending cap on the key first**
(console.anthropic.com, Limits, ten dollars a day): running out is the good problem, a leaked
key with no cap is the ten-thousand-dollar one.

### Step 6. The chat, the connector and the digest, in parallel

Model: `/model opus` for you; the subagents choose their own as written below.

```text
Build three layers at the same time, one subagent each, and do not
start the next thing until all three report back:

1. The analyst chat, on Sonnet, following recipes/ai-analyst-chat.md
   and the chat components in framework/ui-components. Start with the
   key and a calm empty state if it is missing. Give it the same view
   of my data the dashboard has (KPIs, rooftops, source rollups, the
   recovery numbers, drill-downs) and the knowledge folder
   demo-data/knowledge. Read the system prompt in
   framework/carfinity-v2/server/system-prompt.js first and adapt it to
   my metrics. Tool cards say in plain words what they fetch, with the
   result inline; suggested questions come from the biggest moves;
   every investigation leaves a report I can read later.

2. The Google Analytics connector, on Sonnet, following
   recipes/google-analytics-connector.md: the Connect button, the
   one-time Google setup as a checklist in plain English with links,
   the token kept on the server, and until there is a Google project,
   the traffic screens running on demo-data/ga4_channels.csv. Then
   traffic next to leads, month by month, honest about what it cannot
   say.

3. The email digest, on Sonnet, following recipes/email-reports.md:
   every weekday morning, five lines a GM reads on a phone, plus alerts
   when a tracked number moves past the threshold. Preview in the
   browser behind the password; nothing sends until I turn it on, each
   email written to data/outbox/ until then.

Give each one its own files and its own tests so they do not step on
each other, and tell each one: no em dashes anywhere, and every number
it shows must come from the same query layer the dashboard uses (if
the dashboard has a tile for it, the analyst has a tool for it). When
all three are back, run every test, walk each layer in the browser,
ask the analyst one question a tile already answers and check they
agree, and tell me what each subagent built, what you had to fix, and
what I need to give you for the chat key, the Google project and the
email provider.
```

What you should see: three subagents running at once, then one report; the chat answering with
numbers that match the cards; the traffic screens on the demo channels; a digest file in
`data/outbox/`; a short list of the three things only you can provide. Measured on 2026-09-18:
**33 minutes for all three together**, including a live chat test that found the Hyundai
cutover in ten tool calls, against about an hour each in sequence. The two things the
integrator had to fix that run: the analyst had no spend tool while the dashboard had a spend
tile (so it denied the data existed), and the three subagents wrote 21 em dashes between them.
Both are now in the prompt above.

### Step 7. Test the analyst like an analyst

Model: `/model opus`

```text
Test the analyst and show me the three transcripts:

1. Which rooftop had internet leads fall to zero, and when? Did the
   store's sales fall with them? (One did; its sales did not.)
2. What was our marketing spend in 2019? (My data does not have it.)
3. Which source should I stop paying for, what does the data show, and
   what would you want to check before I make that call?

Then confirm the key is nowhere in the browser.
```

What you should see: it finds the Hyundai rooftop's cutover month from the timeline and notices
the store's Walk In sales jumped the same month, so it calls it feed loss, not lost business; an
honest "I cannot answer that from this data" on question 2; a recommendation on question 3 that
cites the recovery numbers, says the ongoing spend on a dormant source is unknown, and names what
to check.

## Phases E to G, one at a time

If you would rather build the three layers in sequence, or one subagent's work needs redoing,
these are the same layers as single pastes. Model: `/model sonnet` for each, `/model opus` for
the analyst's system prompt.

### The analyst chat

### Step 8. The key, and a calm empty state

Model: `/model opus` (the system prompt is judgment)

```text
Add an AI analyst to this dashboard, following
recipes/ai-analyst-chat.md.

Start with the key. If there is no Anthropic key yet, show me a calm
message with the three steps to get one and where to paste it, and
tell me to restart. The key never goes to the browser.

Build it the way framework/analyst-chat-nextjs does, and read the
system prompt in framework/carfinity-v2/server/system-prompt.js
first: that is the analyst from the real dashboard. Adapt it to my
metrics, do not copy it blind.
```

### Step 9. Tools and the investigation loop

Model: `/model sonnet`

```text
Give the analyst the same view of my data the dashboard has: the KPIs,
the rooftops, the source rollups, the recovery numbers, and the ability
to drill down. Give it a small knowledge folder it can search
(demo-data/knowledge). Let it investigate in steps: pull a number,
break it down, form a view, confirm it, then answer.

Every number it says must come from my data. If it cannot answer, it
says so and says what is missing. It never averages ratios.
```

### Step 10. The chat panel

Model: `/model sonnet`

```text
Build the chat panel to match the dashboard. I want to watch it work:
show each step it takes, then the answer. The chat dock, tool cards
and inline charts in framework/ui-components are the pieces to
use.

Above the box, suggest questions from the biggest month-over-month
moves in the group. And every investigation should leave behind a
report I can read later or export.
```

### Google Analytics

### Step 11. The connector, with the walkthrough

Model: `/model sonnet`

```text
Add a "Connect Google Analytics" button, following
recipes/google-analytics-connector.md.

Before it works, it has to teach me: show the one-time Google setup as
a checklist inside the dashboard, in plain English, with links. When I
connect, the browser asks me for consent, the dashboard shows
"Connected" with my account name, and the token stays on the server.
While there is no Google project, run the traffic screens on
demo-data/ga4_channels.csv so I can see what they will look like.
```

### Step 12. Traffic next to leads

Model: `/model sonnet`

```text
Now put website traffic next to CRM leads, month by month: sessions
and key events by channel beside the store's internet leads and sales.
Be honest about what that can and cannot say; nothing in my data links
a session to a sale. Give the analyst the same view so when I ask
"which channel actually sells cars?" it tells me what the data shows
and what it would take to answer properly.
```

### Reports that come to you

### Step 13. A digest nobody has to log in for

Model: `/model sonnet`

```text
Build the email digest from recipes/email-reports.md: every weekday
morning, five lines a GM reads on a phone. This month so far against
last month and last year, the three biggest moves phrased as
questions, and one line per rooftop that needs attention, each line
linking back to the dashboard.

Show it to me in the browser first, behind the password. Nothing
sends until I turn sending on; until then, write each email to a
folder so I can read it. Then tell me what I need to give you to
actually send it.
```

What you should see: a preview page with the same numbers as the cards; a file in
`data/outbox/` after a dry run; a clear list of what to set (the provider key, a from address,
the recipients) before anything goes out.

### Step 14. Alerts, only when something moved

Model: `/model sonnet`

```text
Add alerts on top of the digest: when a tracked number moves more
than the threshold in the guidelines, one email to whoever owns that
number, with the finding, a one-paragraph explanation from the
analyst using its tools, and a link. No more than three a day,
biggest first. Same rule: nothing sends until I turn it on.
```

## Phase H: lock and ship

### Step 15. Put a lock on the door

Model: `/model sonnet`

```text
Put a password on it the way AUTH.md says. If the password is missing
it must lock everyone out, not let everyone in. It must cover the data
and the chat, not just the pages.
```

### Step 16. The gate

```text
/check-before-deploy
```

### Ask it. Why this way?

```text
Is this the best way to build a dashboard for a twelve-rooftop group?
Why did you pick what you picked, and what would you change for a
group with fifty rooftops and nightly CRM exports?
```

What you should see: a straight answer in plain English, reasons, not jargon.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
