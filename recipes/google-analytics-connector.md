# Recipe: the Google Analytics connector (local browser OAuth)

Layer 4. A "Connect Google Analytics" button in the dashboard that walks the dealer through
authorizing in their own browser, stores the token locally, and then lets the dashboard and the AI
analyst chat query their real GA4 traffic. The same pattern extends to Google Ads and Google
Business Profile; only the API scope and the query calls change.

This is the connector you already use with a coding CLI, rebuilt as a first-class dashboard
feature: local, browser-based consent, token held on the machine (or the deployment), never a
service account file emailed around.

## The shape of it

```
Dashboard "Connect Google Analytics" button
   -> opens Google's consent screen in the browser
   -> Google redirects back to a local callback route with a code
   -> the app exchanges the code for tokens (server-side)
   -> tokens saved server-side (encrypted at rest); the dashboard shows "Connected"
   -> GA4 Data API queries run through the stored token
   -> the chat gets GA tools (sessions, users, conversions by channel)
```

OAuth is the fiddly part. Everything else is a normal API call. Do the token dance once, correctly,
and the rest is easy.

## Step 0 - what the dealer sets up once (walk them through it)

A non-developer needs hand-holding here, so the connector should render these steps inline, not
assume the dealer knows what a "client ID" is:

1. Go to the Google Cloud Console, create (or pick) a project.
2. Enable the **Google Analytics Data API** and the **Google Analytics Admin API** (the second one
   lists their properties in Step 3; without it that step fails with a confusing error).
3. Configure the OAuth consent screen (External, add themselves as a test user). That is enough
   for the workshop, with one catch to show in the connection settings: in Testing mode Google
   expires the refresh token after seven days, so the dealer reconnects weekly until the app is
   published for their own use.
4. Create an **OAuth client ID** of type **Web application**, with the authorized redirect URI set
   to the app's callback (`http://localhost:3000/api/connect/google/callback` locally, and the
   deployed equivalent).
5. Copy the client ID and client secret into the app's env (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`). These are **server-side secrets**, never `NEXT_PUBLIC_`.

Write this as a short checklist in the connector's empty state with links, so the dealer can follow
it without leaving the dashboard. It is the one genuinely tedious part; owning that walkthrough is
what makes this feel like a product instead of a script.

## Step 1 - the OAuth routes

Two API routes, both server-side:

- `GET /api/connect/google/start` - builds the Google consent URL and redirects to it. Scope for
  read-only analytics is `https://www.googleapis.com/auth/analytics.readonly`. Request
  `access_type=offline` and `prompt=consent` so you get a **refresh token** (without it the
  connection dies in an hour and the dealer has to reconnect constantly). Include a random `state`
  and check it on the way back (CSRF).
- `GET /api/connect/google/callback` - receives `code`, verifies `state`, exchanges the code for
  `{ access_token, refresh_token, expiry }` at Google's token endpoint, saves them, and redirects
  back to the dashboard with a "Connected" state.

Use the official client if you want it to handle refresh for you:

```bash
npm install googleapis
```

`googleapis` gives you the OAuth2 client and the Analytics Data API client, and it refreshes the
access token from the refresh token automatically. You can also do it with plain `fetch` against
the token and Data API endpoints; the flow is identical, you just handle refresh yourself.

## Step 2 - storing the token safely

The refresh token is a long-lived key to the dealer's analytics. Treat it like one.

- **Never send it to the browser.** It lives only in server-side storage and is used only in API
  routes.
- **Local dev**: a gitignored file (`data/google-token.json`) or a row in the SQLite DB is fine.
  Add it to `.gitignore` before you write it, next to `.env` and `*.csv`.
- **Deployed**: store it encrypted (a row in the DB encrypted with a key from the environment), not
  in a plaintext file in the deployment. At minimum, it must not be web-readable: it is not in
  `public/`, and the middleware auth gate (`AUTH.md`) covers the route that reads it.
- The connection status the browser sees is a boolean and the Analytics account and property
  names (from the Admin API), never the token and never the person's email.
- The `state` value is random, stored in a short-lived signed cookie, and consumed once on the
  callback. Encrypt stored tokens with a key from `GOOGLE_TOKEN_ENCRYPTION_KEY`; refuse to store a
  token if the key is missing. On `invalid_grant`, mark the connection "reconnect needed" and keep
  the data already imported, labeled with its fetch time.

## Step 3 - the "which property" step

A GA account can have several GA4 properties (one per rooftop, often). After connecting, call the
Admin API to list the properties the dealer can access and let them map each property to a rooftop
in the dealer group. Store that mapping in a table (`ga_property`: property id, dealership id,
property name, mapped at), one property per rooftop and one rooftop per property; if a dealer
shares one property across stores, say it is not supported yet rather than counting it twice. Now
a store filter in the dashboard maps to the right GA4 property automatically. Without this step,
group-level GA numbers are meaningless.

## Step 4 - querying GA4

With a valid access token, the GA4 Data API `runReport` call takes dimensions and metrics and
returns rows. For the traffic-channel view that pairs with the CRM data, request:

- dimensions: `date` (or `yearMonth` for month grain), `sessionDefaultChannelGroup`
- metrics: `sessions`, `totalUsers`, `keyEvents` (and a VDP-view event if they track one)

Query at `yearMonth` grain directly: `totalUsers` counts distinct people, so daily users cannot be
added into a monthly figure, and channel users cannot be added into a store figure (label any such
sum "not de-duplicated"). Map `sessions` to `sessions`, `totalUsers` to `users`, `keyEvents` to
`conversions` (label them "GA key events", they are not CRM leads), and `vdp_views` from a second
report filtered to the configured VDP event, joined only after both are at property, month, channel
grain. A sync replaces the months it fetched in one transaction; cache by property, range and
metrics for a few hours so you are not hitting the API on every page load and every chat turn.
Real data and demo data never share a table: the demo group is its own dataset with a "Demo" badge,
and a live connection imports into the real group only. The shape you produce should match
`demo-data/ga4_channels.csv` exactly, so the same charts and the same chat tools work whether the
data came from the API or from a file.

## Step 5 - wiring GA into the chat

Once GA data lands in the same store as everything else, add tools to the analyst chat
(`recipes/ai-analyst-chat.md`):

- `get_channel_traffic({store?, from?, to?})` - sessions/users/conversions by channel
- `compare_traffic_to_leads({store?})` - the interesting one: channel traffic and key events next
  to the store's internet leads and sales, month by month

Be straight about what this data can and cannot say. A CRM source (Autotrader, Dealer Website) is
not a GA channel (Paid Search, Organic Social), and nothing in these files links a session to a
sale. So the tool puts traffic **beside** outcomes at store and month grain and describes the
relationship ("paid search sessions fell 30% the same month website leads fell 25%"); it never
allocates sales to channels, and if asked "which channel sold cars" it says that needs
channel-attributed CRM data the dealer does not have yet. That honesty is the whole reason a GM
will trust the rest of it.

## A local connector for more than Google

The same three-route pattern (start -> consent -> callback -> stored token -> API tools) is how you
connect anything with OAuth. To add **Google Ads** or **Google Business Profile**, change the scope
and the API client; the routes, the token storage, and the "wire it into the chat as tools" steps
are identical. Build the Google Analytics one properly first, then the others are mostly copy and
adjust. Keep each connector's tokens and status separate so one can be connected without the other.

## Verify it

- Click Connect, complete consent in the browser, and confirm the dashboard flips to "Connected"
  and shows the account label (not the token).
- Confirm a **refresh token** was captured (disconnect network briefly, or wait past the access
  token expiry, and confirm the next query still works by refreshing silently).
- Pull one month of channel traffic and confirm it matches what the dealer sees in the GA4 UI for
  the same range. If it does not, you are almost always on the wrong property or the wrong date
  grain.
- Grep the built client bundle for the client secret and the token: neither may appear.
- Run `/check-before-deploy` before this goes to a URL. The token file and any `GOOGLE_` secret
  must be server-side only, gitignored, and behind the auth gate.

## Honest scope note

The OAuth setup (Step 0) is real work the first time, and Google's consent-screen configuration is
the kind of thing that eats twenty minutes. For a workshop, demoing the connector against one
already-configured Google project is the sane move; the full self-serve setup for every dealer is a
"do it after" task. `NEXT-STEPS.md` is the right place to point anyone who wants it productionised.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
