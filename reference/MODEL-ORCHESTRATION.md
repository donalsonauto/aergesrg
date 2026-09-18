# Model orchestration: one model that runs others

This is the advanced idea the class builds toward. You already know how to use one model. The next
skill is using **one model as an orchestrator that delegates to others**: a fast cheap model for
bulk work, a deep expensive model for the hard call, and other tools (even other companies' CLIs)
for a second opinion. You do not pay Opus prices to reformat a CSV, and you do not ask Haiku to
untangle a contradictory dataset.

There are two places this happens, and they are different. Keep them separate in your head.

1. **Build time** - orchestrating models *inside Claude Code* while you build the dashboard.
2. **Run time** - orchestrating models *inside the dashboard's AI analyst chat* that your users
   talk to. See `recipes/ai-analyst-chat.md`.

## The models, and when to reach for each

Model names and exact pricing move; check the current list in the Anthropic docs (or ask Claude
Code "what Claude models are current and what do they cost"). As of this writing the useful
mental model is:

| Role | Model | Reach for it when |
|---|---|---|
| **Orchestrator** | Fable (`claude-fable-5-1`) | the top-level driver: plans, delegates, keeps the thread. Fast, good at routing. |
| **Deep reasoning** | Opus 5 (`claude-opus-5`) | one genuinely hard sub-problem: a contradictory join, a subtle metric bug, an architecture call. Expensive, so aim it narrowly. |
| **Balanced default** | Sonnet 5 (`claude-sonnet-5`) | most build work. The default for a reason. |
| **Cheap and fast** | Haiku 4.5 (`claude-haiku-4-5-20251001`) | high-volume, low-judgment work: classify 300 source names, extract fields, first-pass summaries. |
| **A different family** | Codex CLI (OpenAI), Gemini CLI (Google) | a *second opinion* on a claim or a judgment. Different training means different blind spots, which is the whole point of a check. |

The rule that saves the most money and gives the best results is the same rule: **match the model
to the difficulty of the sub-task, not to the difficulty of the overall project.**

## Build time: orchestrating from Claude Code

You do not wire an SDK for this. Claude Code already is the orchestrator, and it delegates through
**subagents**.

- **Delegate a self-contained chunk to a subagent** so it runs with its own context and does not
  clutter the main thread. "Spawn a subagent to write the column-mapping for all 20 rooftops and
  report back the mapping table." The subagent can run on a cheaper model while your main session
  stays sharp.
- **Pick the model per subagent.** In Claude Code you can point a subagent at a specific model.
  Bulk normalization -> Haiku. The one gnarly closing-ratio-above-100% bug -> Opus. The rest ->
  Sonnet.
- **Use another family to verify, not to execute.** When a number looks too good or a design call
  is genuinely contested, have a Codex or Gemini CLI review it. Checking a Claude conclusion with
  another Claude gives you correlated blind spots; a different family is a real second opinion.
  This is a review step, not a build step: you keep the conclusion, they poke holes in it.

A good build-time loop for this project:

```
Fable / Sonnet (you, the main session)
  ├─ subagent (Haiku)   normalize 35 raw source names -> 13 canonical, return the map
  ├─ subagent (Sonnet)  build the KPI cards + trend lines from the recipe
  ├─ subagent (Opus)    the one hard thing: why does group gross not equal the store sum?
  └─ codex / gemini     "here is the recoverable-revenue formula and result, argue it is wrong"
```

Ask Claude Code to explain any of this live: "how would you split this build across subagents and
which model would you put each one on, and why?" That conversation is the lesson.

## A real gotcha: pin the working directory when you call another CLI

When you hand work to another company's CLI (Codex, Gemini, Grok), it is a separate program with
its own idea of "where am I". Never assume it inherited your folder. A real failure from testing this
kit: a Gemini CLI run launched with a plain `cd` into a scratch folder ignored that folder, searched
the whole disk for the file it was told to read, found a same-named file in an unrelated project, and
wrote its report there. Nothing was lost, but only because the target folder happened not to contain
a file by that name.

The rule, every time:

- **Use the CLI's own directory flag** (`codex exec -C <dir>`, `grok --cwd <dir>`, `agy --add-dir
  <dir>`), not `cd`.
- **Put absolute paths in the prompt** for every file it must read or write.
- **Say it explicitly**: "work only inside `<absolute path>`; do not search the filesystem; write the
  output to exactly `<absolute path>/REPORT.md`."
- **Run it on a copy**, never on the live repo, so a stray write cannot touch the real thing.

This is also a good thing to say out loud in the room: delegating to an agent means delegating to
something that will do exactly what you said, including the parts you did not say.

## Run time: orchestrating inside the chat

The dashboard's analyst chat (`recipes/ai-analyst-chat.md`) can do the same thing at run time, and
this is where it gets interesting for your users. The chat has a main model that decides what to
do, and it can hand sub-tasks to cheaper or different models.

Two patterns worth teaching:

1. **Router.** A cheap model (Haiku) reads the user's question and classifies it: is this a
   lookup, a comparison, or a deep investigation? A lookup gets answered by Haiku directly. A deep
   investigation gets escalated to the orchestrator with the full tool loop. Most questions are
   lookups, so most questions never touch the expensive model. This is the single biggest lever on
   what the chat costs to run.
2. **Escalation.** The orchestrator does its tool-use investigation, and when it hits one
   genuinely hard analytical step ("decompose this 60% gross drop across store, source and
   month"), it calls Opus for that one turn, then continues. The user sees one answer; under the
   hood three models contributed.

Mechanically, this is just more than one Anthropic client call with different `model` values,
plus (optionally) a `child_process` call out to a `codex` or `gemini` CLI for a cross-family
check. The chat's tool loop already routes work; adding a model choice to each hop is a small
change. `recipes/ai-analyst-chat.md` marks where the model selection plugs in.

## What to actually say in the room

- "Your main model is the orchestrator. It is a manager, not the whole company."
- "Cheap models do the volume. Expensive models do the one hard thing. A different company's model
  tells you when you are wrong."
- "You are not locked in. If tomorrow a better or cheaper model ships, you change one string."

And the honest caveat: orchestration is a real cost/quality lever, not a magic trick. Start with a
single good model, get the dashboard correct, and add orchestration where you can point at the
specific sub-task that is too expensive or too hard for the default. Complexity you cannot justify
against a sub-task is complexity you will regret.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
