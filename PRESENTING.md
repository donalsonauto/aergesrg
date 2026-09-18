# Presenting: what you say while Claude codes

The hard part of this session is not the build. Claude does the build. The hard part is holding a
room of dealers for 90 minutes while a terminal scrolls. This is the runbook for that.

**The core idea: the wait is the lesson, not dead air.** You are a color commentator on an AI
building software. Every second Claude is working is a second you are explaining what it is doing
and why it matters. Done right, the audience never notices they are "waiting" because you were
never not teaching.

## The three rules

1. **Talk to the humans, not the terminal.** The moment you hit enter, turn back to the room:
   "While that runs, here is what it is about to do." Never paste a prompt and then watch the
   scroll in silence. Silence is the only real failure mode.
2. **You and Claude run in parallel, never in series.** While it builds step N, you teach the
   concept behind step N, or you run the review discussion from step N-1. Nobody waits on anybody.
3. **Pre-warm the one long wait.** The only genuinely dead stretch is the scaffold plus
   `npm install` (2-5 minutes of nothing to watch). Hide it. See "Pre-warming" below.

## The rhythm of every step

```
FRAME   (why this step, 20-40s)
PASTE   (the prompt from the deck)
NARRATE (talk the concept while it builds)
REVIEW  (look at the output together: "do you believe this number?")
SYNC    (everyone caught up? next step)
```

The prompts are punctuation. Your talk is the content. The deck's framing interstitials ("Now
argue with it", "That shape is the whole product") are placed exactly where the build settles, so
lean on them as designed breathing room.

## How long the build actually takes (measured, and it changes the plan)

The first two instrumented runs, with the old terse prompts, came in at **6.0 and 7.7 minutes** of
raw machine time. The plain-English prompts now in `PROMPTS.md` are slower on purpose: every one
asks Claude to prove its work (write checks, take screenshots, look at phone width, list what it
fixed). A fresh unattended run of the current ten pastes on 2026-09-17 took **41 minutes of machine
time**, with the same numbers as every earlier build and the gate at PASS:

| Prompt | Machine time | What you are doing meanwhile |
|---|---|---|
| Step 1, point it at the toolkit | 0:25 | "it reads before it writes" |
| Step 2, verify the data | 1:19 | raw tables first; check last month's totals against the CRM before anything is built |
| Step 3, scaffold and the math | **11:10** | knowledge is king, normalization, the structure |
| Ask it, why this stack | 0:40 | "you pick" |
| Step 4, the whole Revenue Recovery screen, both sides | **11 to 18 min** | walk the reference: the table, the rows, the cliff, then flip to Traffic Channels |
| Step 5, improve it | 5:15 | sum, then divide; change a filter live |
| Step 6, the home dashboard | about 10 min | walk the real home page; the step to drop if behind |
| Step 7, make it look finished (then the loop) | 6:22 | skills, feedback |
| Step 8, the lock | 4:50 | the real login, shown not built |
| Gate | 1:04 | point at each line |
| Step 10, own data (none present) | 0:32 | Monday's homework |

Live in front of a room it runs a little slower still, so plan on **40 to 45 minutes of build and
about 45 of you**. Four waits are long enough to need a real talk track: Step 3, Step 4, Step 6 and Step 7.
Everything else is one to five minutes: paste, make one point, look at the result. Do not fill the
waits with monologue; use the review beats and the reference screen.

The discipline that follows:

- **Pace deliberately. Do not rush prompt to prompt.** Let each build finish, then actually do the
  review beat and the discussion before the next paste. The framing interstitials and the "argue with
  it" checks are not filler between the real content; on the measured timings they *are* most of the
  session.
- **Three steps are genuine waits** worth pre-planning talk for: **Step 3** (scaffold + install +
  metrics, ~11 min), **Step 4** (the whole screen, ~9 min), **Step 6** (the home page, ~10 min) and **Step 7** (the finish pass and the
  loop, ~6 min). The rest are one to five minutes: paste, say one or two sentences, look at what
  came back.
- **Budget your minutes like the recipe does**, not like the machine does: `recipes/revenue-recovery.md`
  allots 10/15/20/25/10/10 minutes across the phases. That minute budget already assumes you are
  spending the time on framing, review and discussion, not on watching code appear. Follow it.

**Cross-checked across model families.** After the two Claude runs, the same exact prompts were run
by OpenAI's Codex (about 14 minutes of machine time) and xAI's Grok (about 15 minutes), plus a
Gemini documentation review. Every build produced the identical headline and classifications, and
every one showed the same time profile: **Step 3 is the one real wait** (Grok measured ~4 minutes of
generation there; the chart at Step 8 is under a minute), and everything else is a short burst. One
beat worth knowing: **Step 1 can take up to ~90 seconds** because the assistant reads five documents
before answering. That is not lag, it is the lesson ("it reads before it writes"); narrate it as such.
The four independent builders also all flagged the same doc-level traps, which have since been
fixed in the kit (the deploy gate, the lock-before-gate order, the chart axis, the date-range default).

**The deploy path was exercised for real** (2026-09-15, a throwaway Vercel project on the sample
data): the first `npx vercel` put the dashboard straight on its production URL, which returned 500
("DASHBOARD_PASSWORD is not set") on every route, with or without credentials, until the password
was added and `--prod` run; then 401 with a password prompt on `/` and on `/api/data`, and 200 with
the real dashboard once the password was supplied. Say the 500 beat with confidence; it is exactly
what the room will see.

**Numbers to rehearse to.** Every run, across every model family, produced the identical headline on
the sample data, so this is what will be on everyone's screen and you can say it before it renders:

- **Recoverable revenue: $342.3K/mo** (All Stores, all lead types, 3-year window)
- **Est. monthly sales: 151.9** (the same dormant + declining set, not all sources)
- **2 dormant sources, 3 declining** (of 12)

(The `$583.4K` in the docs is the reference-screen example from a larger real group, not the sample
file. On the sample file it is $342.3K. Do not promise $583K on screen; you will get $342.3K.)

One thing the sample cannot show: every source has well over 5 sales, so the "fewer than 5 sales,
insufficient data" guardrail never fires on it. Describe that guard; do not promise to demo it live.

## Pre-warming the slow part (do this, it is the difference)

The dry run found the one killer wait is Step 3: `create-next-app` plus `npm install`. Split it:

- **During your 0-10 intro**, before you conceptually reach Step 3, quietly kick off the scaffold
  and install in the terminal (or have Claude do it as the first action). It runs while you talk
  through "why this screen".
- By the time you reach Step 3 out loud, install is done and Step 3 is only "write `metrics.ts`
  and the test", which is fast and genuinely interesting to narrate.
- In the prep page, have attendees run `npm install` once at home on a throwaway app so their
  package cache is warm. A warm cache turns a 4-minute install into 40 seconds.
- Keep **checkpoint branches** (`step-4`, `step-7`, `step-11`) in the repo. Anyone who falls
  behind runs `git checkout step-7` at the next sync beat and is instantly current.

## The per-step runbook

For each step: what Claude is doing and roughly how long, then what you say while it does it.
The prompts are in `PROMPTS.md`, twelve pastes plus the launch line.

### Launch (0:00) - Get the toolkit, launch Claude Code
**Everyone:** downloads the folder from the link, drags it where their projects live, opens
Terminal, `cd` into it, launches with the three switches. 3-5 minutes of the room catching up.
**You say:** what each switch means, and why you skip the permission prompts on purpose here: this
folder holds nothing you cannot rebuild and no keys. The moment a folder has a key or a real
export, drop the flag. Nobody moves on until everyone is in the folder.

### Step 1 (0:05) - Point Claude at the toolkit
**Claude:** reads five docs, replies in five lines, writes no code. ~30-60s.
**You say:** "Run this so Claude understands what we are about to do before it does anything.
Notice it reads before it writes." Set the frame: they describe outcomes and check results, not
write code. "You could also just ask it: give me a summary of this project."

### Step 2 (0:08) - Look at the data before you build on it
**Claude:** reads the file, reports rows, months, sources, stores, a PII verdict by column name,
and a column mapping. ~1 min.
**You say:** why we look first: a wrong column now is a wrong number on every panel later. "Your
file never left your laptop. This is a program opening a spreadsheet in a folder." Monthly counts
by source are not customer data; names, emails and phones are, and this build uses none.

### Step 3 (0:14) - All right, let's build this (scaffold, and the math first)
**Claude:** sets up the app, installs, writes every formula and the checks that prove them. The
long one: 6-7 minutes. Paste it, then the three knowledge slides.
**You say:** knowledge is king: it is writing every formula from METRICS.md, and every tool on top
of these models has a system prompt like that (look up the leaked ones). Normalization: AI can do
the work, somebody has to train it, and that is you. Data structure: agency, group, dealership,
month, metric, source; build it flexible once. When the checks go green: "the formulas are right
before we draw a pixel."

### Ask it (0:23) - Curious? Ask why
**Claude:** explains the stack it chose. ~1 min.
**You say:** you never told it which technology; the folder did. You are allowed to ask, and you
are allowed to say "you pick".

### Step 4 (0:24) - Build the Revenue Recovery screen
**Claude:** the whole screen in one paste, on the v2 shell and components from `framework/`: cards,
the table, the rows that open, the chart, the drill-downs, and the Traffic Channels side on the
second file. 11 to 18 minutes, the longest wait of the day; when it lands, everyone opens a second
terminal tab and runs `npm run dev`. Open Google Ads: launched, peaked, collapsed. Then flip the
switch: sessions and conversions, never dollars.
**You say:** walk the reference screen while it builds. "The table is the point, not the four
cards." Drill-downs by default: the prompt asks for one generic mechanism so the next KPI gets
them free. FTP drops: most integrations start there, often free, because it is the dealer's data.
Data has to be fast: an indexed, organized database, and ask the AI how to speed things up.

### Step 5 (0:40) - Improve it
**Claude:** compares its own work to the reference, fixes what is weaker, adds filters and the
card trend lines. 2-3 minutes.
**You say:** instead of arguing with it, ask it what is missing. Then the averaged-ratio trap:
"When I switch to All Stores, watch the closing ratio. It sums the components and recomputes. This
is the number a GM checks first." Change a filter live and show every card move.

### Step 6 (0:46) - Build the home dashboard
**Claude:** the page v2 opens on, on the home components: four tiles with trend lines, six
small tiles, leads vs sales, the Lead Health gauge, Do This Now, rankings, the lead-type mix.
About 10 minutes. Walk the real home page while it builds; when it lands, click a Do This Now
item. **If you are behind, this is the step to drop**: name it, tell them to paste it Monday.

### Step 7 (0:58) - Make it look finished, then let it loop
**Claude:** one review pass (phone width, formatting, every number against the math), then the
loop runs passes until one comes back clean. 5-7 minutes total.
**You say:** loops are how you buy back your time: say the standard once and let it iterate.
Skills: a written procedure Claude runs; the kit's two checks are skills; pick three from skills.sh
that match what you do, not twenty. Feedback: a button on the page, an agent that reads the notes
and acts. Resize to phone width when it lands.

### Step 8 (1:10) - Put a lock on the door, then the gate
**Claude:** adds the password gate that fails closed and covers the API. ~3 min. Then
`/check-before-deploy`: PASS or a numbered list. ~1 min.
**You say:** "No password set means nobody gets in, not everybody." The real login is a code by
email (SendGrid); show the prompt on the slide, do not build it today. The gate: fix the list and
run it again until PASS, even at 4:55.

### Step 9, optional (1:16) - Put it online
**Claude:** Vercel if they have it, otherwise it recommends the simplest place; deploys behind the
password. 2-4 minutes, only for those who want a link today.
**You say:** the private-window check nobody can run for you: password before a single number,
then an `/api/` route in the same window, you want 401 not JSON. "A gated page in front of an open
API is not gated." AI does the DevOps now: CI/CD, backups, the server; tell it the real situation.

### Step 10 (1:20) - Now build on your own data
**Claude:** maps their columns, switches to their file, then keeps going on whatever exports they
drop in. Theirs to do Monday.
**You say:** "Everything so far ran on the sample so our screens matched. This is the part you take
home." Nobody wants to log in to another tool: email the GM the digest.

## The evergreen tangent bank

Things that are true regardless of where the build is. Pull one whenever a build runs longer than
your talk, or a step finishes early and you need a bridge.

- **The security story** (GLBA, Safeguards Rule, $50k+ per violation, why aggregate counts are
  safe). 2-3 minutes, deployable any time.
- **Derived not imported** (the two-multiplications thesis). The spine of the whole day.
- **Review is the skill** (a wrong number repeated to a GM is worse than no dashboard; you are the
  domain check the software does not have). Reinforce it every time a number appears.
- **Model orchestration teaser** (`reference/MODEL-ORCHESTRATION.md`): "What you are watching is
  Claude driving itself. The next level is Claude driving other models: a cheap one for the bulk
  work, an expensive one for the hard call, even a competitor's model for a second opinion." Great
  for the advanced-class crowd and it fills 2-3 minutes.
- **Where this goes** (the framework: a real database, an AI analyst chat you can ask questions of,
  live Google Analytics). "Today is one screen. The same skill scales into all of that." Point at
  `FRAMEWORK.md`.
- **A war story** you have from a real dealer group. Two or three of these, rehearsed, are worth
  more than any slide.
- **Take a question.** A room that is asking questions is a room that is not bored. Seed it: "What
  is a lead source you have always suspected you were wasting money on?"

## Behind-the-room playbook

- **Someone is stuck / errored:** do not debug it live for the room. "Grab me at the break, and for
  now `git checkout step-N` to jump to where we are." Keep moving. One stuck laptop cannot hold 30.
- **A build genuinely goes sideways on your screen:** narrate it as the lesson. "This is the part
  we practice: it did something I did not want, so I tell it what I actually meant." Then correct
  it live. Watching you recover is more instructive than watching it go perfectly.
- **You are ahead of schedule:** pull an evergreen tangent or open Q&A. Never rush to the next
  paste to fill time; the room needs the pauses.
- **You are behind:** the framing interstitials are skippable talk, the steps are not. Compress the
  stories, keep the builds.
- **Energy dips mid-session** (usually around the source list): that is your cue for the timeline
  step's payoff or a war story, not another quiet build.

## One page to keep on a second screen

Have this open where the audience cannot see it: the step list with times, the three or four
prompts you are most likely to fumble, and the evergreen bank as a bulleted menu. You should never
be reading; you should be glancing.

## The presenter deck

`site/present.html` is the deck you drive on your own screen while Claude builds. Open it in a
browser (it deploys with the site too). Keys: arrows or space to advance, `n` to toggle your
speaker notes at the bottom, `g` for a grid overview. Each slide carries a badge showing which
build step it pairs with and the deck's time cue, so you always know where the room should be.

The pairing rule: the "open" slides run before Step 1, the "beyond" slides run after the build
(the last 15 to 20 minutes: agents, loops, remote control, the cutout demo, the offer), and
everything in between is placed in the pause where the build makes it concrete (normalization at
Step 3 while metrics generate, drill-downs at Step 5, servers while it deploys). The speaker notes
are in your voice and carry the stories; the slides carry one idea each.

Two placeholders to fill before the day: your family and Vladimir photos on the "Who am I" slide
(drop them in `site/img/` and reference them), and the contact line on the last slide.

## The bonus, the chat, is not inside the 90 minutes

A fresh Claude built the analyst chat from the four bonus prompts (Steps 11 to 14) and it works (multi-step
investigation, honest refusals, cited knowledge notes), but it took about 80 minutes of build on
its own. Present it as homework or as the next session: show the finished chat on your screen at
the end, tell them the four prompts are in the toolkit, and stop there.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
