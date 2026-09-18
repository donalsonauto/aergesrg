---
name: check-my-data
description: Scan a CRM or GA4 export for customer PII and check it against DATA-SPEC.md before building anything on it. Use when the user points at a CSV for the first time, says "here is my export", asks whether their data is safe to use, or before any dashboard work begins on a file you have not inspected.
---

# Check my data

Run this the moment a dealer points at their own file, before writing a line of dashboard code.
Two jobs: make sure no customer PII is in there, and tell them what they actually have.

A dealership is a financial institution under GLBA and covered by the FTC Safeguards Rule. Buyer
names, emails, phones, addresses and buyer-linked VINs are Nonpublic Personal Information. This
project needs none of it. See `SECURITY.md`.

## Rule you never break

**Never print a PII value.** Report the column name and the count. Not the contents, not an example,
not a redacted sample. The transcript of this session is a place that data must not end up.

## Steps

### 1. Find the file

Look for a CSV the user named. If they did not name one, look in the working directory and its
immediate subfolders. If they did not name one, default to `sample-data/leads_monthly.csv` (the class file) and say so;
`demo-data/` holds the framework layer's two-group, 20-rooftop set and is not the class file, so do not stop to
ask which. Only ask when the user's own files are genuinely ambiguous. If there is
none, tell them `sample-data/leads_monthly.csv` is there and they lose nothing by using it.

### 2. Read the header and a sample

Read the header row and roughly 50 data rows. Do not read the whole file into context if it is
large; head and a sampled slice is enough for every check here.

### 3. Classify every column

Flag a column as **PII** if its name matches any of:

`name`, `first`, `last`, `customer`, `contact`, `buyer`, `email`, `phone`, `mobile`, `cell`,
`address`, `street`, `city`, `state`, `zip`, `postal`, `dob`, `birth`, `ssn`, `license`, `vin`,
`deal_no`, `deal_number`, `ro_`, `ro_number`, `account`, `stock_no`, `ip_address`

Also flag a column whose **values** look like PII regardless of its name: values containing `@` with
a dot after it, values matching a 10 or 11 digit phone shape, values matching a 17 character VIN
shape. Check the shape, count the hits, and say so without quoting any of them.

Note the honest edge cases rather than guessing:
- `state` and `city` are PII in a customer row and are not PII in a store address. Ask which it is.
- A `vin` column is fine on an inventory export and is not fine on a sold-customer export. Ask.
- `source` is never PII. Do not flag lead source names.

### 4. Check it against the spec

Compare against `DATA-SPEC.md`. Report:

- Which required columns are present: `period`, `store`, `source`, `lead_type`, `leads`, `sales`, `gross`
  (lead files only; an inventory, spend or traffic file from `demo-data/` or a dealer's own folder
  gets the PII scan and a profile, not a missing-CRM-columns verdict)
- Which optional columns are present: `new_sales`, `used_sales`, `budget`
- Which required columns are **missing**, and what that costs them. Never invent a substitute.
- The likely mapping from their column names to spec names, as a table they can correct. Their
  CRM will not use spec names and that is expected, not a problem.

### 5. Profile it

- Row count
- Date range, and the number of distinct months. If under 12 months, say so plainly: dormancy
  detection will be weak and they should know that before they read conclusions off the screen.
- Number of distinct sources, and number of distinct stores
- Any `period` values that failed to parse, with a count. This is the single most common defect in
  a real export and it makes every source look dormant.
- Whether `sales` ever exceeds `leads` in a row. If it does, the export joined at two different
  grains and the closing ratio will come out above 100%. Flag it now, not at minute 60.

### 6. Report, then offer the fix

Give them a short verdict in this shape:

```
PII:      2 columns flagged - customer_name, customer_email
Spec:     6 of 7 required present, missing: lead_type
Rows:     4,812
Range:    2024-01 to 2026-07  (31 months)
Sources:  18    Stores: 3
Warnings: 41 rows where sales > leads
```

If PII was found, do not proceed to build. Offer to write a cleaned copy next to the original with
those columns dropped, leaving their file untouched, and tell them the cleaned file is the one the
dashboard will read. Then confirm `.gitignore` covers `*.csv` so neither copy can be committed.

If nothing was flagged, say so in one line and start building.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
