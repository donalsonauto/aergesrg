// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import Link from "next/link";
import RecoveryView from "@/components/RecoveryView";
import { getRecovery } from "@/lib/recovery";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function RecoveryPage() {
  const groupId = "summit-auto-group";
  const db = getDb();
  const groupName =
    (db.prepare(`SELECT name FROM dealer_group WHERE id = ?`).get(groupId) as { name: string } | undefined)?.name ??
    groupId;
  const rooftops = db.prepare(`SELECT id, name FROM dealership WHERE group_id = ? ORDER BY name`).all(groupId) as {
    id: string; name: string;
  }[];
  const leadTypes = (
    db
      .prepare(
        `SELECT DISTINCT f.lead_type t FROM fact_leads f JOIN dealership d ON d.id=f.dealership_id
         WHERE d.group_id=? ORDER BY t`
      )
      .all(groupId) as { t: string }[]
  ).map((x) => x.t);

  // Default: whole group, 3 years (per the recipe).
  const initial = getRecovery({ years: 3 });

  return (
    <main className="min-h-screen px-6 py-10 sm:px-10 max-w-[1200px] mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase mb-2" style={{ letterSpacing: "0.1em" }}>
          <Link href="/" style={{ color: "var(--fg-muted)" }}>Dashboard</Link>
          <span style={{ color: "var(--fg-muted)" }}>/</span>
          <span style={{ color: "var(--accent)" }}>Revenue Recovery</span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--fg)" }}>{groupName}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Lead sources that used to sell and no longer do, and what winning them back is worth.
        </p>
      </header>

      <RecoveryView initial={initial} rooftops={rooftops} leadTypes={leadTypes} />
    </main>
  );
}
