# The prompts, in order

Paste one block at a time into Claude Code, in the folder you downloaded. Say the outcome; the guidelines in the folder hold the technology. When a number comes back, look at it before you build the next thing.

## Phase 1

### Launch. Get the toolkit. Launch Claude Code.

```text
cd ~/Projects/ohmydash
claude --dangerously-skip-permissions --chrome --rc
```

What you should see: PROMPTS-MAC.txt or PROMPTS-WINDOWS.txt in the folder: every prompt today, in order, to copy; bit.ly/OhMyDash2026: the folder. Unzip it, put it where you keep projects, then cd into it; --dangerously-skip-permissions: no may-I prompts. Safe here: nothing you cannot rebuild and no credentials. Drop it once a folder holds a key; --chrome: it can open your dashboard in the browser, click through it and check its own work; --rc: pick this same session up in the Claude app on your phone. The work runs on your laptop.

### Step 1. Start with a summary

```text
What is this project about? Give me a summary.
```

What you should see: A plain English summary, no code; It names your data files and the guidelines it found; It knows what you are about to build before you say it; Ask this of any project you ever open.

### Step 2. Verify the data before you build on it

```text
Verify my data first.
```

What you should see: Row count, date range, store and source counts, for both files; Last month's leads and sales by store: open your CRM and check them before anything gets built; A PII verdict, by column name only; A mapping from your column names to the spec names, which you can correct.

## Phase 2

### Step 3. The math, before any screen

```text
All right, let's build it.
```

What you should see: It names the numbers it built and the checks it ran; The checks pass; No screen yet. Correct.

## Phase 3

### Step 4. The Revenue Recovery screen

```text
Keep going.
```

What you should see: It picks up the plan it gave you and builds the Revenue Recovery screen; Four cards, then the source table, biggest opportunity first; It tells you to open a second terminal tab and run npm run dev; do that, leave it open, keep localhost:3000 in the browser; A dead source looks like a cliff when you open its row.

### Step 5. Now change something yourself

```text
Add filters for store, date range and lead type. Then move the
sources worth the most money to the top.
```

What you should see: It changes what you asked for and leaves the rest alone; Now try one of your own: rename a card, reorder the table, change what a tile shows; Do not like it? Say undo that; Nothing you ask for here can break the numbers underneath.

### Step 6. The home page

```text
Keep going with the next phase.
```

What you should see: The app now opens on the home page and Revenue Recovery moves to its own page; Big tiles with trend lines, the health score, Do This Now; Every number matches the Revenue Recovery page; You never had to name a file, a component or a screen.

## Phase 4

### Step 7. Let it loop until it is done

```text
/loop review this dashboard against the guidelines, fix what you
find, and stop when a full pass finds nothing to fix
```

What you should see: It runs a pass, fixes what it found, runs again; It stops on its own and tells you the pass came back clean; Check it on your phone while it works; /loop 5m check the deploy and tell me if it is down is the timed form; This is how you buy back your time: say the standard once, walk away.

### Step 8. Lock it. Then a real login.

```text
Put a password on it.

/check-before-deploy

Replace the password with a login by email: I type my email, I get a six-digit code, I am in. Use SendGrid to send it. Tell me what you need from me to set that up.
```

## Phase 5

### Step 10. Now build on your own data

```text
Now use my own data.
```

What you should see: A mapping table you can read and correct; Your own numbers on the same screen; It asks where each new export came from before it builds on it.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
