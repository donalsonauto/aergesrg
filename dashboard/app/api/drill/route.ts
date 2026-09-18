// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { NextRequest, NextResponse } from "next/server";
import {
  drillTimeline,
  drillChildren,
  type DrillMetric,
  type DrillDimension,
  type Filter,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const METRICS: DrillMetric[] = ["leads", "sales", "gross", "closing_ratio"];
const DIMENSIONS: DrillDimension[] = ["rooftop", "source", "month"];

// One endpoint for the whole drill mechanism. Given a metric, the current scope
// (store/source), and which child dimension to list, it returns the monthly
// timeline for that scope plus the children one level down.
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const metric = q.get("metric") as DrillMetric | null;
  if (!metric || !METRICS.includes(metric)) {
    return NextResponse.json({ error: "unknown metric" }, { status: 400 });
  }

  const child = q.get("child") as DrillDimension | null;
  if (child && !DIMENSIONS.includes(child)) {
    return NextResponse.json({ error: "unknown dimension" }, { status: 400 });
  }

  const filter: Filter = {};
  const store = q.get("store");
  const source = q.get("source");
  const leadType = q.get("leadType");
  const from = q.get("from");
  const to = q.get("to");
  if (store) filter.store = store;
  if (source) filter.source = source;
  if (leadType) filter.leadType = leadType;
  if (from) filter.from = from;
  if (to) filter.to = to;

  const timeline = drillTimeline(metric, filter);
  const children = child ? drillChildren(metric, child, filter) : [];

  return NextResponse.json({ timeline, children, childDimension: child ?? null });
}
