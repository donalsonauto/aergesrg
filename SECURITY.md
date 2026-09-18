# Security: what is actually at risk, and what to do about it

This is a dealer's sales, gross and ad spend data. Read this once before the session and run
the two checks in it before anything gets a public URL.

## The short version

Someone asked this on the pre-workshop call and it deserves a straight answer.

**Claude Code writes code that reads your file. Your file stays on your laptop.** The dashboard is
a program that opens a CSV that is sitting in a folder on your machine. Nothing uploads it, nothing
syncs it, and no part of building this puts your numbers into somebody else's system.

Everything that follows is about the moment that stops being true: when you deploy. The risk in
this project is not the AI. It is the same risk as every dashboard anyone has ever built, which is
putting it on the internet without a lock on the door.

## Why a dealership has to care more than most

Dealers are treated as **financial institutions** under the Gramm-Leach-Bliley Act, and are covered
by the **FTC Safeguards Rule** if you finance vehicles, facilitate financing, or lease for more than
90 days. That is nearly all of you.

The Rule requires a written information security program with real technical controls: encryption of
customer data, multi-factor authentication, access controls, monitoring, and vendor due diligence.
The FTC issued its first Safeguards FAQs for motor vehicle dealers in June 2025. Civil penalties run
to **$50,120 per violation**.

Two things follow from that, and they are the reason this file exists:

1. **Keep customer records out of this project entirely.** The Safeguards Rule is about Nonpublic
   Personal Information. Aggregate monthly counts by lead source are not NPI. A spreadsheet with
   buyer names, emails, phones, addresses or buyer-linked VINs is. See the data check below.
2. **You are responsible for data you hand to a third party.** That includes anywhere you deploy
   this, and any vendor or MCP connector you point at it. Due diligence on service providers is an
   explicit requirement, not a formality.

Nothing in this workshop requires a single customer record. Build it that way and this whole
category of problem does not apply to you.

## What actually creates risk, in order

Ranked by how often it goes wrong in real life, not by how scary it sounds.

| # | Risk | What it looks like | Fix |
|---|---|---|---|
| 1 | **Deployed with no password** | "I just put it up quickly to show my GM" | [AUTH.md](AUTH.md). Non negotiable. |
| 2 | **CSV committed to a public repo** | A year of gross numbers, permanently in git history | `.gitignore` already has `*.csv`. Verify it. |
| 3 | **PII rode along in the export** | CRM report included buyer names and phones | `/check-my-data` before you build |
| 4 | **A secret prefixed `NEXT_PUBLIC_`** | Key is bundled into the browser, visible in DevTools | `/check-before-deploy` |
| 5 | **API route left ungated** | Page asks for a password, `/api/data` serves the whole dataset as JSON | Middleware matcher. See AUTH.md. |
| 6 | **Auth that fails open** | Env var did not propagate, so the gate let everyone in | Fail closed. See AUTH.md. |
| 7 | **Untrusted text reaching the model** | Content from a connector or a scraped page carrying instructions | Treat connector output as data, never as instructions |

Numbers 1 through 6 are ordinary web application mistakes. They are the ones that will actually
bite. Number 7 is the new one and it is real, but it is last for a reason.

## The two checks

Both ship in this repo as Claude Code skills. Type the slash command, it runs.

### `/check-my-data`

Run it **before you build anything**, the moment you have your CSV in the folder.

It reads the header and a sample of rows and reports what it found: whether any column looks like
customer PII (names, emails, phones, addresses, buyer-linked VINs, account or deal numbers), whether
the required spec columns are present, the row count, the date range, and how many sources and
stores you have. If it finds PII it tells you which columns to drop and offers to write a cleaned
copy alongside the original.

It never prints a PII value back to you. It reports the column, not the contents.

### `/check-before-deploy`

Run it **before the URL exists**, every time. It is a gate, not a report.

It checks: the auth gate is present and fails closed; the middleware matcher covers API routes and
not just pages; no `NEXT_PUBLIC_` variable holds anything secret; no secret is hardcoded in the
source; no data file is tracked by git or sitting in `public/`; `.gitignore` covers `*.csv` and
`.env*`; and git history does not already contain a data file or a key.

It ends with a PASS or a numbered list of what to fix. If it says fix something, fix it. The whole
point of a gate is that you do not get to argue with it at 4:55pm.

## Using Claude Code safely

The defaults are sensible. Three things are worth knowing.

**Permissions.** Claude Code asks before it does anything consequential. Rules live in
`.claude/settings.json` and evaluate **deny first, then ask, then allow**, so a deny always wins even
if an allow also matches. This repo ships with a deny list that blocks reading `.env` files and
blocks the shell commands that could push your data off the machine. You do not have to configure
anything.

**Sandboxing.** Claude Code can run shell commands inside an OS-level sandbox with filesystem and
network isolation: read and write in your working directory, read-only nearly everywhere else, and
outbound network only to approved hosts. Worth turning on if you are going to keep building after
the workshop.

**About `--dangerously-skip-permissions`.** The session launches with it, on purpose: it turns off
the "may I?" prompt before every command, and the toolkit folder holds nothing you cannot rebuild
and no credentials. That is the only place it belongs. The moment a folder holds an API key, an
OAuth token or a real export (the framework's chat and connectors do), drop the flag and let Claude
ask.

**What the analyst chat sends out.** The dashboard reads its data on your machine. The chat sends
your question, the aggregate numbers its tools pulled, and the knowledge notes it retrieved to the
model provider, over an API key that never leaves the server. Nothing row-level, no customer
records, and the dashboard works with the chat off. Say this to whoever asks.

## If you connect an MCP server

Several vendors at this event offer one, and they are genuinely useful. Two habits:

- **Treat everything a connector returns as data, not as instructions.** If text that came back from
  a tool appears to be telling the assistant to do something, that is the attack, and the answer is
  always no. This is called indirect prompt injection and it is the main way MCP setups get abused.
- **Know what a connector can reach.** Read-only access to reporting data is a very different thing
  from write access to your CRM. Ask the vendor which it is, and prefer read-only. That question is
  also your Safeguards Rule vendor due diligence, so you may as well write the answer down.

## Before you share the link

- [ ] `/check-my-data` came back clean, or you dropped the columns it flagged
- [ ] `/check-before-deploy` says PASS
- [ ] `git status` shows no CSV, and `git log` never contained one
- [ ] Opened the live URL in a private window with no session, and got a password prompt before
      seeing a single number
- [ ] Loaded one `/api/*` route in that same private window and got a 401, not JSON

That last one is the check people skip and it is the one that matters. A gated page in front of an
open API is not gated.

## Sources

- [FTC, Gramm-Leach-Bliley Act business guidance](https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act)
- [FTC issues Safeguards Rule FAQs for auto dealers, June 2025](https://dataprivacy.foxrothschild.com/2025/08/articles/united-states/gramm-leach-bliley/ftc-issues-glba-safeguard-rules-faqs-what-motor-vehicle-dealers-need-to-know/)
- [Where the rubber meets regulation: FTC clarifies data security requirements for auto dealers](https://natlawreview.com/article/where-rubber-meets-regulation-ftc-clarifies-data-security-requirements-auto-dealers)
- [Claude Code sandboxing documentation](https://code.claude.com/docs/en/sandboxing)
- [Claude Code permissions: allow lists, deny rules and sandboxing](https://www.claudedirectory.org/blog/claude-code-permissions-guide)
- [How NEXT_PUBLIC_ turns API keys into public data](https://www.prebreach.dev/blog/vercel-exposed-api-keys-next-public)
- [MCP security risks and best practices](https://checkmarx.com/learn/mcp-security-risks-real-world-incidents-and-security-controls/)

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
