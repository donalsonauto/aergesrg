# Reference code: what you are getting from the real dashboard

Three folders of working code. None of them is the app you build; they are what Claude Code
reads when you ask for the same thing in your own dashboard. Say it plainly: "build the analyst
chat the way `framework/analyst-chat-nextjs` does it", or "make the drill-down behave like
the one in `framework/carfinity-v2/ui/drilldown`". It reads, then builds inside your app.

| Folder | What it is | Stack | Use it for |
|---|---|---|---|
| `carfinity-v2/` | Pieces lifted from the live product | Vue 3 + PrimeVue (screens), Node (server) | the analyst's system prompt, the eight specialist analysts, the agent loop, the highlights engine, the Revenue Recovery math, the drill-down and KPI screens, the chat UI |
| `analyst-chat-nextjs/` | The analyst chat rebuilt inside a Next.js app, from `recipes/ai-analyst-chat.md` | Next.js + TypeScript, Anthropic SDK | drop-in shape for the chat in the app you build today: tools, knowledge folder search, streaming loop, the panel, the key onboarding |
| `ui-components/` | The v2 screens ported to a React component library, with a gallery page that renders every piece on demo data | Next.js + TypeScript + Tailwind + Recharts | the home page (hero tiles with trend lines, the Lead Health gauge, Do This Now, ranked lists), KPI cards with sparklines, the drill-down overlay (breadcrumb, dimension picker, breakdown table, trend, impact), the chat dock with tool cards and inline charts, highlights chips, the Revenue Recovery table with expandable rows, the filter bar. `npm install`, `npm run dev`, open the gallery; `components/ui/README.md` lists every component with its props |
| `framework-app/` | The framework built on `demo-data/`: database, normalization, KPI cards with trend lines, drill-downs, filters, Revenue Recovery on the two-group, 20-rooftop demo, the password gate. `demo-data/demo.db` is its database already loaded | Next.js + TypeScript + SQLite | **adopt it, do not rebuild it**: copy it in, copy `demo-data/demo.db` to `data/dealer.db`, `npm install`, `npm run checks`, `npm run prove`; `npm run load` rebuilds the database from the CSVs |

## The components

`ui-components/components/ui/` is the part you will use most: say "use the KPI card from
framework/ui-components" or "the drill-down overlay from framework/ui-components" and
Claude copies the component into your app and wires your data to its props. Every component takes
data in as props and sends actions out as callbacks, so nothing in it fetches or assumes a backend.
The gallery (`app/page.tsx`) shows each one on the class sample data, headline $342.3K.

## The chat, and the key it asks for

The chat is the analyst inside the dashboard: it calls tools over your data, investigates in
steps, searches a knowledge folder, and answers with the numbers it pulled. Both chat folders
work the same way and both need one secret: an **Anthropic API key**.

1. Get a key at `https://console.anthropic.com/settings/keys` (the same key works for the Claude
   Agent SDK).
2. Copy `.env.example` to `.env.local` and paste it after `ANTHROPIC_API_KEY=`.
3. Restart the dev server.

Until the key is there, the chat panel shows those three steps instead of a stack trace. The key
is read only on the server; it never reaches the browser, and the deploy gate checks that.

`carfinity-v2/server/system-prompt.js` is the full system prompt the live analyst runs on: the
investigation protocol, the metric crib sheet, the honesty rules. It is long on purpose. Read it
once to see what "knowledge is king" means in practice, then let Claude adapt it to your metrics.
`carfinity-v2/server/analysts/` are the eight specialist analysts (fixed ops, sales team, deal
desk, marketing ROI, lot intelligence, market radar, acquisition, strategy): each is a prompt plus
the questions it runs. Take the ones that match your store.

## What was changed on the way in

- Every credential, host and database name in the v2 server files was removed and replaced with
  `process.env.*`. The files will not run against Carfinity's data; they are here to be read and
  adapted.
- The v2 screens are Vue. Your app is React. Claude ports the behavior, not the file: say what
  you want it to keep (the drill path, the breadcrumb, the tool cards) and it rebuilds it in your
  stack.
- `framework-app/` was built by Claude Code from this toolkit's own recipes and prompts, then
  checked against `demo-data/expected-results.json`. Copy it whole if you want a head start:
  `cp -R framework/framework-app my-dashboard`, `npm install`, `npm run load`, `npm run dev`.

## What is not here

Carfinity's data connectors, its customer data, and its API. You bring your own exports
(`demo-data/` is a full synthetic group to practice on) and build the connectors with Claude.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
