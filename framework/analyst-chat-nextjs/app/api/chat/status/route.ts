// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
export const dynamic = "force-dynamic";

// The key never leaves the server: this route reports only a boolean.
export function GET() {
 return Response.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
}
