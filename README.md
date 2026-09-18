# Dealer Dashboard Kit

**Build a real analytics dashboard on your own dealership data, in 90 minutes, with Claude Code.**

You bring one CSV out of your CRM. You leave with a working dashboard, running on your laptop,
that finds lead sources which used to make you money and no longer do, and puts a dollar figure
on winning them back.

This repo is not an app. It is a set of instructions Claude Code reads so it builds the right
thing without you having to specify it.

## Start here

| If you are... | Read |
|---|---|
| Getting ready for the session | **[DATA-SPEC.md](DATA-SPEC.md)** - the one export to bring |
| In the session now | [SESSION.md](SESSION.md) - the 90 minute run of show |
| Worried about your data | **[SECURITY.md](SECURITY.md)** - the honest answer, and two checks that run for you |
| About to put it online | **[AUTH.md](AUTH.md)** - do not skip this |
| Wondering how a number is calculated | [reference/METRICS.md](reference/METRICS.md) |
| Wanting it to look good | [reference/DESIGN.md](reference/DESIGN.md) |
| Ready to go further | [NEXT-STEPS.md](NEXT-STEPS.md) |
| Building past the one screen | **[FRAMEWORK.md](FRAMEWORK.md)** - the DB, the AI analyst chat, live integrations |
| Reusing code from the real dashboard | [framework/README.md](framework/README.md) - the chat, the drill-downs, the UI components, the email digest, a finished build |
| Building the framework, prompt by prompt | [FRAMEWORK-PROMPTS.md](FRAMEWORK-PROMPTS.md) - the copy-paste sequence for the DB, drill-downs, chat and Google Analytics |
| **Running the session** (presenter) | **[PRESENTING.md](PRESENTING.md)** - what to say while Claude codes |

## 60 second start

```bash
# download the toolkit from https://bit.ly/OhMyDash2026, unzip it, then, in that folder:
cd ohmydash
claude
```

No GitHub or Vercel account is needed. The session ends with the dashboard running on your laptop;
putting it online behind a password is an optional last step for anyone with a Vercel account.

Then tell Claude Code:

> Read CLAUDE.md and DATA-SPEC.md. I have my CRM export at ./my-data.csv.
> Build the Revenue Recovery dashboard from recipes/revenue-recovery.md.
> Start with the four KPI cards so I can see my numbers, then the source list, then the chart.

That is the whole workflow. You are describing outcomes; Claude Code writes the code.

## What you are building

The reference screen, rebuilt on your data:

- **Four KPI cards** - recoverable revenue, recoverable units, dormant sources, declining sources
- **A ranked source list** - every lead source, with peak, total sales, closing ratio, months
  inactive, and estimated monthly value
- **A performance timeline** - sales, leads and closing ratio on one dual-axis chart, per source
- **Filters** - by store, by lead type (internet / phone / campaign / showroom), by date range

Every number is calculated from your monthly rows. Nothing is imported pre-computed and nothing
is estimated except one clearly-labeled projection, explained in
[reference/METRICS.md](reference/METRICS.md).

## What you need

**One CSV. Ten columns. One row per month, per lead source.** Twelve months minimum, three
years if your CRM will give it up. Full spec and per-CRM export instructions in
[DATA-SPEC.md](DATA-SPEC.md).

If you cannot get your export in time, **come anyway.** `sample-data/` has a realistic synthetic
dataset with dormant and declining sources planted in it. You will build the whole dashboard and
swap your own file in afterwards. Foureyes customers can also ask Foureyes for the export
directly, since lead source attribution is what they already track.

No customer PII. Ever. This runs on aggregate counts.

Two checks ship with the repo and run as slash commands in Claude Code:

- `/check-my-data` - scans your export for customer PII and profiles it, before you build
- `/check-before-deploy` - the gate your dashboard has to pass before it gets a public URL

Dealers are financial institutions under GLBA and covered by the FTC Safeguards Rule.
[SECURITY.md](SECURITY.md) explains what that means here and what it does not.

## What this is not

It is not a product, and it is not a replacement for a real BI platform. It is a starting point
that you own, running on your data, that you can keep building on.

If the integration work gets hard, that is normal - CRM and DMS extracts are genuinely fiddly.
[NEXT-STEPS.md](NEXT-STEPS.md) covers where to go from here, including getting help with the
plumbing so you can stay focused on the part you actually care about: what the dashboard shows
and how it looks.

---

Built for the **Claude for Dealers** workshop.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
