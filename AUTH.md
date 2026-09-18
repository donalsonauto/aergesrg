# Auth: local is open, deployed is never open

The moment this dashboard has a public URL it is holding a dealer's sales, gross and ad spend.
That is competitively sensitive and, in a group, sometimes contractually restricted.

**Rule: no deploy without a password. No exceptions, including "just for a minute to show
someone".** An unlisted Vercel URL is not access control; it is a URL that has not been found yet.

## Local development: open is fine

`npm run dev` on your own machine needs no auth. Skip it, build the dashboard, come back here
before you deploy.

## Deployed: pick one of three

### 1. Vercel password protection (30 seconds, no code)

Project Settings > Deployment Protection > Password Protection. One shared password across the
whole deployment.

Good for: showing a GM tomorrow morning. Honestly good enough for most single-dealer cases.
Not good for: per-person access, audit trails, or revoking one individual.
Note: this is a paid Vercel feature. If you are on Hobby, use option 2.

### 2. Middleware password gate (5 minutes, works on any plan)

A single shared password checked in Next.js middleware, so every route including API routes is
covered. It grants everything in the app: every store, the chat, the reports,
the connectors. Store filters are not permissions; if a manager may only see their own rooftop,
that is option 2.

> On current Next.js you may see a build warning that the `middleware` file convention is
> deprecated in favor of `proxy`. It still works and is safe to ignore for the workshop. If you
> want the warning gone, rename `middleware.ts` to `proxy.ts` and the `middleware` function to
> `proxy`; the code below is otherwise identical.

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

export function middleware(req: NextRequest) {
  // Never gate in local development, so the workshop build stays fast.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    // Fail CLOSED. A missing password must never mean "let everyone in".
    return new NextResponse("DASHBOARD_PASSWORD is not set", { status: 500 });
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try { decoded = atob(encoded); } catch { decoded = ""; }   // malformed header must not throw
    const password = decoded.slice(decoded.indexOf(":") + 1); // keep colons inside the password
    // Constant-time-ish compare; avoids leaking length via early exit.
    if (password && password.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < password.length; i++) {
        diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      if (diff === 0) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Dashboard", charset="UTF-8"' },
  });
}
```

Then `vercel env add DASHBOARD_PASSWORD production` and redeploy.

Two details that matter and are easy to get wrong:

- **Fail closed.** If the env var is missing the app returns 500, not an open dashboard. The
  common bug is `if (!expected) return NextResponse.next()`, which silently publishes everything
  the first time an env var does not propagate.
- **Match API routes too.** The matcher above covers everything except static assets. If you gate
  only pages, `/api/data` still serves the full dataset as JSON to anyone who asks.

### 3. Real accounts (when it outlives the workshop)

When more than a couple of people need it, or you need per-user revocation, move to a provider:
Auth.js with a Google provider restricted to your dealership domain, or Clerk. Roughly an hour,
and out of scope for the session.

Do this once you have multiple rooftops with different managers, or anyone outside the dealership
needs a login.

## Also do these before you deploy

- **Do not commit the CSV.** Add `*.csv` to `.gitignore`. A public GitHub repo with a year of gross
  numbers is a bad day. How the data then reaches the deployment depends on how you deploy:
  - **`npx vercel --prod` (the workshop path)** uploads your local folder, and the Vercel CLI does
    **not** apply `.gitignore` rules (it only skips a fixed list such as `.git`, `node_modules`,
    `.env.local`). So your gitignored `my-data.csv` rides along and the live site has your numbers.
    It lives in the deployment source, behind the password gate and behind Vercel's login-only
    source protection (`/_src`), but it is there. Only a `.vercelignore` would exclude it.
  - **A GitHub-connected deploy** builds from git, so the CSV is not there and the build has no
    data. For that path keep the file in a private blob store or fetch it at build time
    (`NEXT-STEPS.md`).
- **Keep secrets in env vars.** Never in the repo, never in client-side code. Anything in a
  `NEXT_PUBLIC_` variable is visible to every visitor by design.
- **Check what the API returns.** If the dashboard fetches from `/api/*`, confirm those routes
  are gated too. Load one in a private browser window and see what comes back.
- **Confirm no PII rode along.** Re-read the export's columns. See `DATA-SPEC.md`.

## Sanity check

After deploying, open the URL in a private window with no session. If you see any data before
being asked for a password, stop and fix it before sharing the link.

---
Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
