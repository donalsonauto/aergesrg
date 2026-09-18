# How to write a skill for this kit

A skill is a written procedure Claude runs when you type its name (`/check-my-data`). The two
that ship here are the model. Every new one (`/load-my-data`, `/add-a-panel`, `/refresh-data`)
uses the same five headings, so it is a procedure and not a to-do list.

```markdown
---
name: refresh-data
description: Reload the exports in ./my-data and re-check the totals. Use it when a new file lands.
---

## When to use
One sentence: the situation, not the feature.

## Prerequisites
What must already be true (the data model exists, the file is in ./my-data, the dev server is stopped).

## Steps
Numbered. Each step is one action with the command or the file it touches.

## Verification
How you know it worked: the number to compare, the page to load, the check to run. Never "it should work".

## Rollback
What to do if it went wrong: which file to delete, which command re-creates it, what to tell the dealer.
"If the totals are wrong, delete data/dealer.db and run npm run load again" is the line that turns a
bad afternoon into a two-minute fix.
```

Two rules the headings do not say: never print a customer-identifying value in any step's output,
and write the Rollback section first; if you cannot write it, the skill is not safe to run.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
