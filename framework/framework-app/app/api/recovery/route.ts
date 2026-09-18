// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { NextRequest, NextResponse } from "next/server";
import { getRecovery } from "@/lib/recovery";

export const dynamic = "force-dynamic";

// Recompute the whole Revenue Recovery screen for the current filter.
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const store = q.get("store");
  const leadType = q.get("leadType");
  const yearsRaw = Number(q.get("years"));
  const years = [1, 2, 3].includes(yearsRaw) ? yearsRaw : 3;

  return NextResponse.json(
    getRecovery({ store: store || null, leadType: leadType || null, years })
  );
}
