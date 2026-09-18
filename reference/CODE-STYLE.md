# Code style, the short version

Claude writes the code. These are the habits that keep it readable a month later, when a new
export arrives and the person who "built" it is you.

- **One place for every formula.** `lib/metrics.ts` (class) or `lib/queries.ts` (framework).
  A screen, a chart, a tool and an email all call the same function. If two numbers on screen
  disagree, that rule was broken.
- **Names say what the thing is to a dealer.** `closingRatio`, `recoverableRevenue`,
  `monthsInactive`. Not `val2`, not `calc`.
- **No magic numbers.** The 30% decline threshold, the 5-sale floor, the 20% highlight threshold
  live in one constants file with a comment saying where they come from (`reference/METRICS.md`).
- **API routes return one shape.** `{ data }` on success, `{ error: "plain sentence" }` on failure
  with the right status code. Never a raw stack trace to the browser.
- **Environment is validated at startup.** One `lib/env.ts` reads every variable the app needs,
  fails with the variable's name if one is missing, and `.env.example` lists all of them with a
  comment each. No `NEXT_PUBLIC_` for anything secret.
- **Empty is not zero.** A missing cell stays `null` all the way to the screen, where it renders
  as an empty state that names the gap.
- **Small files, obvious folders.** `app/` screens, `components/` UI, `lib/` data and math,
  `scripts/` things you run by hand, `data/` things that never go in git.
- **Tests for the math, not for the pixels.** A check that fails when a rollup averages ratios is
  worth more than a snapshot of a card.
- **No em-dashes in copy.** Periods, commas, colons.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
