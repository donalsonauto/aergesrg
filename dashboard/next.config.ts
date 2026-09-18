// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundle so it loads at runtime.
  serverExternalPackages: ["better-sqlite3"],
  // Recharts ships mixed ESM/CJS; without transpiling it, the production server
  // bundle throws "a[d] is not a function" when SSR-ing the charts. Force Next to
  // compile it so the chunk references resolve.
  transpilePackages: ["recharts"],
  // Note: the kit's `agentRules: false` guard is for Next 16, which can append an
  // "agent rules" block to CLAUDE.md. This project runs Next 15.5, which has no
  // such behavior and rejects the key, so it is intentionally omitted here.
};

export default nextConfig;
