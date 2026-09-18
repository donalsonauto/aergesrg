// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Plain data shapes shared by the server aggregation (lib/kpis.ts) and the
// client cards. Kept free of any imports so it is safe in the browser bundle.
export type SeriesPoint = { period: string; value: number };

export type KpiCard = {
  key: string;
  label: string;
  value: string; // formatted current-month value
  deltaPct: number | null; // relative % change vs prior month
  higherIsBetter: boolean; // controls delta color (down is good for cost metrics)
  accent: boolean; // the one hero card gets the violet wash
  color: string; // the single trend-line color for this card
  series: SeriesPoint[]; // last 12 months
};

export type Rooftop = { id: string; name: string };

// ---- Revenue Recovery ----
export type RecoveryTimelinePoint = {
  period: string;
  sales: number;
  leads: number;
  gross: number;
  closing: number | null;
};

export type FeedLoss = {
  leadType: string;
  firstMissingMonth: string;
  sourceCount: number;
  storeKeptSelling: boolean; // the confirming signal: store total sales held when the feed died
  salesBefore: number;
  salesAfter: number;
};

export type RecoverySource = {
  source: string;
  leadType: string | null;
  status: "dormant" | "declining" | "steady" | "feed_lost";
  totalSales: number;
  totalLeads: number;
  totalGross: number;
  newSales: number;
  usedSales: number;
  closingRatio: number | null;
  avgGrossPerSale: number | null;
  activeMonths: number;
  totalMonths: number;
  lastActiveMonth: string | null;
  monthsInactive: number;
  peakMonthlySales: number;
  peakPeriod: string | null;
  recentMonthlySales: number;
  historicalMonthlySales: number;
  estimatedMonthlySales: number | null; // null for steady or insufficient-data
  estimatedMonthlyRevenue: number | null;
  insufficientData: boolean; // recoverable but < 5 total sales
  inHeadline: boolean; // counted in the headline sum
  evidenceScore: number; // 0..100, shown as "85/100"
  hasBudget: boolean;
  feedLostMonth: string | null; // first missing month if this source is part of a dead feed
  timeline: RecoveryTimelinePoint[];
};

export type RecoveryResult = {
  scopeLabel: string;
  store: string | null;
  years: number;
  from: string;
  to: string;
  totalMonths: number;
  estMonthlyRevenue: number;
  estMonthlySales: number;
  dormantCount: number;
  decliningCount: number;
  feedLostCount: number;
  feedLoss: FeedLoss[];
  windowShort: boolean;
  sources: RecoverySource[];
};

export type DashboardData = {
  groupName: string;
  month: string; // "2026-09" (latest month in the active scope)
  priorMonth: string | null;
  rooftops: Rooftop[]; // all rooftops, for the selector
  leadTypes: string[]; // available lead types, for the selector
  store: string | null; // active rooftop filter (dealership id) or null = All Stores
  leadType: string | null; // active lead-type filter or null = All
  years: number; // active date range in years (1, 2, 3)
  from: string; // window start "YYYY-MM"
  to: string; // window end "YYYY-MM"
  cards: KpiCard[];
};
