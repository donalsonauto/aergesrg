// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

import type { Rooftop } from "@/lib/types";

const selectStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  color: "var(--fg)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function FilterBar({
  rooftops,
  leadTypes,
  store,
  leadType,
  years,
  loading,
  onChange,
}: {
  rooftops: Rooftop[];
  leadTypes: string[];
  store: string | null;
  leadType: string | null;
  years: number;
  loading?: boolean;
  onChange: (patch: { store?: string | null; leadType?: string | null; years?: number }) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Rooftop */}
      <select
        aria-label="Rooftop"
        value={store ?? ""}
        onChange={(e) => onChange({ store: e.target.value || null })}
        style={selectStyle}
      >
        <option value="">All Stores</option>
        {rooftops.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {/* Lead type */}
      <select
        aria-label="Lead type"
        value={leadType ?? ""}
        onChange={(e) => onChange({ leadType: e.target.value || null })}
        style={selectStyle}
      >
        <option value="">All Lead Types</option>
        {leadTypes.map((t) => (
          <option key={t} value={t}>
            {titleCase(t)}
          </option>
        ))}
      </select>

      {/* Date range, segmented */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
        role="group"
        aria-label="Date range"
      >
        {[1, 2, 3].map((y) => {
          const active = years === y;
          return (
            <button
              key={y}
              onClick={() => onChange({ years: y })}
              className="px-3 py-2 text-[13px] transition-colors"
              style={{
                background: active ? "var(--accent)" : "var(--bg-card)",
                color: active ? "#fff" : "var(--fg-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {y} {y === 1 ? "Year" : "Years"}
            </button>
          );
        })}
      </div>

      {loading && (
        <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
          recalculating…
        </span>
      )}
    </div>
  );
}
