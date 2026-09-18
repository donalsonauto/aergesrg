# Recipe: automated email reports (nobody logs in)

Layer 6. You love your dashboard. Your GM will not log into it. So the dashboard emails them:
a short digest on a schedule, and an alert only when something needs attention. This is the
LotIntel daily digest and the Carfinity Daily Pulse, rebuilt inside your app. The v2 engine is
in `framework/carfinity-v2/server/pulse-engine.js` (what goes in the email) and
`pulse-email.js` (how it is sent); read them, then build yours on your own metrics.

Build the data model and the query layer first (`recipes/data-model.md`). The email is the same
numbers the dashboard shows, from the same functions, so it can never disagree with the screen.

## What a good digest is

- **Short.** Five lines a GM reads on a phone at 7:55. The month so far against last month and
  last year, the three biggest moves, one line per rooftop that needs attention. Nothing else.
- **Phrased as questions or findings, never as a data dump.** "Closing ratio at Summit Ford fell
  to 9.1% (from 12.4%). Internet leads are up, sales flat: a follow-up problem?" comes from the
  highlights engine (`reference/METRICS.md`, anomaly highlights), not from the model.
- **Links back to the drill-down.** Every line links to the dashboard filtered to that store and
  metric, behind the same password gate. The email is the doorway; the dashboard is the room.
- **Honest about partial months.** Compare like ranges (day 1 to 12 against day 1 to 12), say
  which month is in progress, and say when a feed has gone quiet instead of reporting zeros.

Two kinds, and they are different products:

| Kind | When | Who | Content |
|---|---|---|---|
| **Digest** | every weekday morning, or Monday | everyone in the group | the standing five lines |
| **Alert** | only when a rule trips | the person who owns that metric | one finding, one link |

An alert that fires every day is a digest people learn to delete. Set thresholds from
`reference/METRICS.md` (20% month-over-month is the default) and let the AI analyst write the
one-paragraph explanation only for alerts, with the numbers it pulled through tools.

## Step 1 - the report function

Write `lib/reports/digest.ts`: a pure function `buildDigest(groupId, asOf)` that returns the
digest as data (headline numbers, the highlights list, the per-rooftop attention lines, the
links), using the same query layer as the dashboard. Render it twice: to HTML for the email
(inline styles, dark text on white, no images that need loading, one column so it reads on a
phone) and to plain text for the fallback. Put a preview route behind the password gate,
`/reports/digest/preview`, so you can look at it in the browser before anything is sent.

## Step 2 - sending

Use one provider and keep its key server-side. SendGrid or Resend are the simple ones; SMTP
through Nodemailer works with either (`pulse-email.js` shows the SMTP version). The key lives in
`.env.local` as `EMAIL_API_KEY` (or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`), never in the browser,
and the deploy gate checks that. A `FROM` address on a domain you control, and the recipient list
in the database (`report_subscription`: email, group, kind, enabled), not in code.

**Nothing sends without a dry run you have seen.** The first version writes the email to
`data/outbox/` and shows it at the preview route. Add a `REPORTS_SEND=true` flag; only when it is
set does the provider get called. Log every send (who, when, which digest) in a table.

## Step 3 - the schedule

Three ways, least to most infrastructure:

- **A loop in Claude Code**, while you are building: `/loop 24h build the digest for yesterday,
  show me the preview, and send it if REPORTS_SEND is on`. Good for a week of testing.
- **A cron on the server** that hits `POST /api/reports/digest/run` with a shared secret header.
  This is the normal answer for a dashboard on a box of its own.
- **A hosted scheduler** (Vercel Cron, GitHub Actions) calling the same route, for the snapshot
  edition. Same route, same secret.

Whichever you pick, the run is idempotent: running it twice for the same day sends once.

## The quiet-month rule (learned from a live run)

The "biggest moves" section filters at the 20% highlight threshold. On a healthy group that is
most months, so a digest that only shows moves past 20% shows nothing there most mornings. Fall
back to the biggest real moves, phrased the same way, and mark them `belowThreshold`. Alerts
(Step 4) must **skip** anything marked that way, or the fallback makes an alert fire every day,
which is exactly the failure the "no more than three, only when something moved" rule exists to
prevent. Test both halves: the digest always has a moves section; the alerts never fire on a
fallback move.

## Step 4 - alerts and the analyst

Alerts reuse the highlights rule engine: for each tracked metric, if the move passes the
threshold and the prior period is complete, create an alert. Then hand only that finding to the
analyst (`recipes/ai-analyst-chat.md`) with the instruction "explain this in one paragraph using
tools; if you cannot, say what is missing". The email carries the number, the paragraph, and the
link. Cap it: at most three alerts a day per group, biggest first, or people stop reading.

## Verify it

- The preview route renders the digest for the latest complete month and it matches the
  dashboard's cards to the dollar.
- With `REPORTS_SEND` unset, a run writes to `data/outbox/` and sends nothing.
- With it set, one test recipient (you) gets the email, on a phone it reads in one column, and
  every link opens the dashboard at the right store and metric behind the password.
- Run it twice for the same day: one email.
- The key and the recipient list are not in git and not in the browser bundle.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
