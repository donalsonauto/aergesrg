// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Resolves the demo-data/ folder the load and check scripts read from.
//
// The toolkit ships demo-data/ at its root, one level above this app. A dealer
// who copies this app somewhere else keeps their own demo-data/ beside it. Look
// for the local copy first, then fall back to the toolkit root, so both layouts
// work without an env var. DEALER_DATA_DIR overrides for anything else.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveDemoDir(): string {
  const override = process.env.DEALER_DATA_DIR;
  const candidates = [
    ...(override ? [override] : []),
    join(APP_ROOT, "demo-data"),
    join(APP_ROOT, "..", "demo-data"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "dealer_group.json"))) return dir;
  }
  throw new Error(
    `No demo-data/ found. Looked in:\n  ${candidates.join("\n  ")}\n` +
      `Copy the toolkit's demo-data/ beside this app, or set DEALER_DATA_DIR.`,
  );
}

export const DEMO = resolveDemoDir();
