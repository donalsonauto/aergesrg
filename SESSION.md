# The 90 minute session

**Claude for Dealers - Advanced track: Build your own dashboard**

## Before you arrive

One thing: bring the CSV described in [DATA-SPEC.md](DATA-SPEC.md). If you could not get it,
come anyway and use `sample-data/`.

Have Claude Code installed and working, and the toolkit downloaded and unzipped. If setup is your
first blocker we lose 20 minutes. No GitHub or Vercel account is required.

## Run of show

| Time | What | You leave with |
|---|---|---|
| 0-10 | **Why this screen.** Walk the reference dashboard. Every number on it comes from a 10-column CSV, and that is the whole point. | Understanding of what is derived vs imported |
| 10-20 | **Load your data.** Point Claude Code at your file. Map your columns. See your row count, date range and source list. | Your data parsed and validated |
| 20-35 | **The four KPI cards.** Your recoverable revenue number, on screen. | Working cards with your numbers |
| 35-55 | **The ranked source list.** Every source, sorted by opportunity, expandable. | The list you would take to a vendor meeting |
| 55-75 | **The performance timeline.** Dual-axis chart per source. This is where dormant sources become obvious. | The chart that makes the argument |
| 75-85 | **The lock, and (optional) deploy.** Password gate for everyone; Vercel for those who have it. | Locked, and live if you chose to |
| 85-90 | **Where next.** What is easy from here, what needs help. | A plan |

## What you will actually be doing

You will not be typing code. You will be describing what you want and reviewing what comes back:

> "The recoverable revenue card should be violet like the reference, and format as $583.4K not
> the full number."
>
> "Add a filter for internet leads only, and make sure the KPI cards recompute when I change it."
>
> "This source shows a 400% closing ratio, that cannot be right - check how we joined leads to
> sales."

That last one matters. **The skill being taught is reviewing output, not generating it.** A
dashboard that quietly shows a wrong number is worse than no dashboard, and you are the only
person in the room who knows what your closing ratio should roughly be.

## What good looks like at the end

- Your own data, your own numbers
- Four KPI cards, a ranked source list, a working timeline chart
- The dashboard running on your laptop, and, if you deployed, a URL behind a password
- A repo you own and can keep building on

## What we will not get to

Live CRM integration, nightly refresh, per-user permissions, writing back to your CRM. All real,
none of it fits in 90 minutes. [NEXT-STEPS.md](NEXT-STEPS.md).

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
