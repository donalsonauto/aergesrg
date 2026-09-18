// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import Link from "next/link";
import KpiGrid from "@/components/KpiGrid";
import { getDashboardData } from "@/lib/kpis";

// Read the DB at request time so a fresh load is reflected without a rebuild.
export const dynamic = "force-dynamic";

export default function Home() {
  // First paint: All Stores, all lead types, last 1 year. The client container
  // takes over and refetches when a filter changes.
  const data = getDashboardData({ years: 1 });

  return (
    <main className="min-h-screen px-6 py-10 sm:px-10 max-w-[1200px] mx-auto">
      <header className="mb-8">
        <div
          className="text-[11px] font-medium uppercase mb-2"
          style={{ color: "var(--fg-muted)", letterSpacing: "0.1em" }}
        >
          Dealer Group Dashboard
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--fg)" }}>
            {data.groupName}
          </h1>
          <Link
            href="/recovery"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            Revenue Recovery →
          </Link>
        </div>
      </header>

      <KpiGrid initial={data} />
    </main>
  );
}
