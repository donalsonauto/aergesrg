// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Shared-password gate over every route, including /api/*. See AUTH.md option 2.
// Local dev is open on purpose; the gate only binds in production.
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
