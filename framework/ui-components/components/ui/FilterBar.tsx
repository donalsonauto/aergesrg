// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// FilterBar — global dashboard scope: store, date range, lead type. Pure: the
// current selection comes in as `value`, changes go out through onChange.

import { Calendar, MapPin, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface FilterValue {
  store: string;
  dateRange: string;
  leadType: string;
}

function Select({
  icon,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm">
      <span className="text-muted">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-fg outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-elevated text-fg">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({
  value,
  stores,
  leadTypes,
  dateRanges = ["This month", "Last 3 months", "Last 12 months", "All time"],
  onChange,
  className,
}: {
  value: FilterValue;
  stores: string[];
  leadTypes: string[];
  dateRanges?: string[];
  onChange: (value: FilterValue) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        icon={<MapPin className="h-4 w-4" />}
        value={value.store}
        options={["All Stores", ...stores]}
        onChange={(store) => onChange({ ...value, store })}
      />
      <Select
        icon={<Calendar className="h-4 w-4" />}
        value={value.dateRange}
        options={dateRanges}
        onChange={(dateRange) => onChange({ ...value, dateRange })}
      />
      <Select
        icon={<TagIcon className="h-4 w-4" />}
        value={value.leadType}
        options={["All Lead Types", ...leadTypes]}
        onChange={(leadType) => onChange({ ...value, leadType })}
      />
    </div>
  );
}
