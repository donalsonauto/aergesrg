# Dashboard

The toolkit's `framework/framework-app` adopted as this repo's dashboard, running on the
synthetic demo dataset in [`../demo-data/`](../demo-data). Nothing here is real dealer data.

## Run it

```bash
cd dashboard
npm install
npm run load     # builds data/dealer.db from ../demo-data/*.csv
npm run dev      # http://localhost:3000
```

`data/dealer.db` is gitignored and rebuilt by `npm run load`, so a fresh clone needs that
one command before the app has anything to show.

## Screens

| Route | What it shows |
|---|---|
| `/` | Gross profit, sales, leads and closing ratio for the group, each with a 12-month trend line and a drill-in |
| `/recovery` | Revenue Recovery: dormant and declining lead sources, ranked, with the estimated monthly value of winning each back |
| `/api/kpis`, `/api/drill`, `/api/recovery` | The read layer the screens call |

## Checking the numbers

```bash
npm run checks                # recomputes ground truth from the raw CSVs and compares
npx tsx scripts/verify-load.ts  # DB vs ../demo-data/expected-results.json
npm run prove                 # proves All Stores is SUM/SUM, not an average of ratios
npm run recovery              # the Revenue Recovery report plus its rule checks
```

All four pass on the demo data as committed.

## Where the data comes from

`lib/demo-path.ts` resolves the dataset: it uses `./demo-data` if you keep a copy beside the
app, otherwise the toolkit's `../demo-data`, and `DEALER_DATA_DIR` overrides both. Swapping in
a real export means pointing that at your own folder and re-running `npm run load` — see
[`../DATA-SPEC.md`](../DATA-SPEC.md) for the expected columns and
[`../SECURITY.md`](../SECURITY.md) before any real file goes in.

Run `/check-before-deploy` in Claude Code before this gets a public URL. It is behind no auth
gate right now; [`../AUTH.md`](../AUTH.md) covers that.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
