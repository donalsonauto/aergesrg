// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Shapes for the auto-generated demo dataset (lib/demo-data.ts). These mirror
// the props the UI components accept, so the gallery is fully typed.

import type { DataType } from "./format";

export interface Window {
  start: string;
  end: string;
  months: number;
}

export interface DemoKpi {
  key: string;
  label: string;
  value: number;
  prior: number;
  dataType: DataType;
  accent: AccentVariant;
  costMetric?: boolean;
  spark: number[];
}

export type AccentVariant =
  | "accent"
  | "success"
  | "info"
  | "warning"
  | "danger";

export type RecoveryStatus = "dormant" | "declining" | "steady";

export interface RecoveryTimelinePoint {
  month: string;
  sales: number;
  leads: number;
  closingRate: number;
}

export interface RecoverySource {
  source: string;
  leadTypes: string[];
  status: RecoveryStatus;
  feedLost: boolean;
  monthsInactive: number;
  lastActiveMonth: string | null;
  metrics: {
    totalSales: number;
    totalLeads: number;
    totalGross: number;
    newSales: number;
    usedSales: number;
    pctNew: number | null;
    closingRatio: number | null;
    avgGrossPerSale: number;
    peakMonthlySales: number;
    recentMonthlySales: number;
    historicalMonthlySales: number;
    cpl: number | null;
    cps: number | null;
  };
  estMonthlySales: number | null;
  estMonthlyRevenue: number | null;
  insufficient: boolean;
  evidenceScore: number;
  storesAffected: string[];
  /** Per-store totals for the STORES AFFECTED list, biggest first. */
  storeBreakdown: StoreBreakdown[];
  peakPeriod: { start: string; end: string };
  activeMonths: number;
  totalMonths: number;
  /** One timeline per lead type the source carries (the chart's tabs). */
  timelineByLeadType: Record<string, RecoveryTimelinePoint[]>;
  timeline: RecoveryTimelinePoint[];
}

export interface StoreBreakdown {
  store: string;
  sales: number;
  newSales: number;
  usedSales: number;
  gross: number;
}

// ---- Traffic channels (the GA4 side of Revenue Recovery) -------------------

export interface TrafficTimelinePoint {
  month: string;
  sessions: number;
  vdpViews: number;
  conversions: number;
  forms: number;
  calls: number;
}

export interface TrafficChannel {
  channel: string;
  status: RecoveryStatus;
  monthsInactive: number;
  lastActiveMonth: string | null;
  peakPeriod: { start: string; end: string };
  activeMonths: number;
  totalMonths: number;
  metrics: {
    totalSessions: number;
    totalUsers: number;
    totalVdpViews: number;
    formSubmissions: number;
    clickToCall: number;
    totalConversions: number;
    conversionRate: number;
    peakMonthlySessions: number;
    recentMonthlySessions: number;
    historicalMonthlySessions: number;
  };
  /** Sessions per month the channel used to bring and no longer does (0 when steady). */
  estMonthlySessions: number;
  estMonthlyConversions: number;
  storesAffected: string[];
  timeline: TrafficTimelinePoint[];
}

export interface TrafficMonth {
  sessions: number;
  users: number;
  vdpViews: number;
  forms: number;
  calls: number;
  conversions: number;
}

export interface TrafficData {
  window: Window;
  summary: {
    lostSessionsMonthly: number;
    lostConversionsMonthly: number;
    dormantChannels: number;
    decliningChannels: number;
  };
  month: TrafficMonth & { prior: TrafficMonth; spark: number[] };
  channels: TrafficChannel[];
}

export interface RecoveryData {
  headlineMonthly: number;
  headlineAnnual: number;
  dormantCount: number;
  decliningCount: number;
  totalOpportunities: number;
  window: Window;
  sources: RecoverySource[];
}

export interface Highlight {
  key: string;
  label: string;
  dataType: DataType;
  costMetric: boolean;
  current: number;
  previous: number;
  changePct: number;
}

export interface BreakdownRow {
  id: string;
  label: string;
  current: number;
  previous: number;
  lastYear?: number | null;
  variance: number;
  variancePct: number | null;
}

export interface RelatedKpi {
  key: string;
  name: string;
  dataType: DataType;
  current: number;
  previous: number;
  relationshipType: string;
}

export interface DrillDownDimension {
  key: string;
  label: string;
}

export interface DrillDownData {
  metricKey: string;
  metricName: string;
  dataType: DataType;
  current: number;
  previous: number;
  lastYear: number;
  periodLabel: string;
  dimensions: DrillDownDimension[];
  breakdowns: Record<string, BreakdownRow[]>;
  impact: Record<string, BreakdownRow[]>;
  monthlyTrend: { labels: string[]; current: number[] };
  relatedKpis: RelatedKpi[];
}


// ---- Home dashboard (v2's "/" page, CRM flavored) --------------------------

export interface HomeHeroKpi {
  key: string;
  label: string;
  dataType: DataType;
  value: number;
  prior: number | null;
  lastYear: number | null;
  /** Line color (hex); each hero tile carries its own, as in v2. */
  color: string;
  spark: number[];
  sparkLabels: string[];
  sparkLastYear: Array<number | null>;
}

export interface HomeSecondaryKpi {
  key: string;
  label: string;
  dataType: DataType;
  value: number;
  prior: number | null;
  /** Cost metric: a drop is good. */
  invert?: boolean;
}

export interface HomeTrend {
  labels: string[];
  leads: number[];
  sales: number[];
}

export interface HealthSubScore {
  key: string;
  label: string;
  color: string;
  value: number | null;
}

export interface HomeHealth {
  score: number | null;
  subScores: HealthSubScore[];
  stores: Array<{ store: string; score: number }>;
  bestStore: { store: string; score: number } | null;
  worstStore: { store: string; score: number } | null;
}

export type ActionPriority = "critical" | "warning" | "info";

export interface HomeAction {
  priority: ActionPriority;
  text: string;
}

export interface HomeTopSource {
  source: string;
  leads: number;
  sales: number;
  change: number | null;
}

export interface HomeStoreRanking {
  store: string;
  leads: number;
  sales: number;
  gross: number;
  closingRatio: number;
  change: { leads: number | null; sales: number | null; gross: number | null };
}

export interface HomeLeadType {
  key: string;
  label: string;
  leads: number;
  sales: number;
  share: number;
  closingRatio: number | null;
  color: string;
}

export interface HomeStorePerformance {
  store: string;
  sales: number;
  prevSales: number;
  newSales: number;
  usedSales: number;
  gross: number;
  prevGross: number;
}

export interface HomeHealthScore {
  key: string;
  label: string;
  category: string;
  dataType: DataType;
  invert?: boolean;
  current: number | null;
  previous: number | null;
  /** 0..100 against the metric's own 12-month best. */
  score: number | null;
  tone: "positive" | "negative" | "neutral";
}

export interface HomeHealthByStore {
  labels: string[];
  stores: string[];
  series: Record<string, number[]>;
  average: number[];
}

export interface HomeData {
  hero: HomeHeroKpi[];
  secondary: HomeSecondaryKpi[];
  trend: HomeTrend;
  health: HomeHealth;
  actions: HomeAction[];
  topSources: HomeTopSource[];
  storeRankings: HomeStoreRanking[];
  leadTypes: HomeLeadType[];
  /** The Financial Focus strip; cost tiles only when budget exists. */
  financial: HomeSecondaryKpi[];
  storePerformance: HomeStorePerformance[];
  healthScores: HomeHealthScore[];
  healthByStore: HomeHealthByStore;
  /** Digital & Marketing strip; empty without a traffic file. */
  digital: HomeSecondaryKpi[];
}

export interface DemoData {
  meta: {
    analysisMonth: string;
    priorMonth: string;
    window: Window;
    stores: string[];
    sources: string[];
    leadTypes: string[];
  };
  kpis: DemoKpi[];
  recovery: RecoveryData;
  highlights: Highlight[];
  drilldown: DrillDownData;
  home: HomeData;
  /** Null when no traffic file is present. */
  traffic: TrafficData | null;
}
