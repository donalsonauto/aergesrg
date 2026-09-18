// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Carfinity v2 component kit. Every component is a plain, typed function
// component: data comes in as props, actions go out as callbacks. See README.md.

// Primitives
export { Card, SectionLabel, Pill, Tag, Delta } from "./primitives";
export { Markdown } from "./Markdown";
export { Sparkline } from "./Sparkline";

// KPIs
export { KpiCard, type KpiCardProps } from "./KpiCard";
export { KpiGrid, type KpiGridItem } from "./KpiGrid";

// Filters / navigation
export { FilterBar, type FilterValue } from "./FilterBar";
export { Breadcrumb, type Crumb } from "./Breadcrumb";
export { HighlightsChips } from "./HighlightsChips";

// Drill-down
export { DrillDownOverlay } from "./drilldown/DrillDownOverlay";
export type {
  DrillDownModel,
  DrillFilter,
  DrillLevel,
} from "./drilldown/DrillDownOverlay";
export { DrillDownHeader } from "./drilldown/DrillDownHeader";
export { DimensionSelector } from "./drilldown/DimensionSelector";
export { BreakdownTable } from "./drilldown/BreakdownTable";
export { MonthlyTrendChart, type MonthlyTrend } from "./drilldown/MonthlyTrendChart";
export { RelatedKpis } from "./drilldown/RelatedKpis";
export { ImpactAnalysis } from "./drilldown/ImpactAnalysis";

// App shell
export {
  AppShell,
  type AppShellProps,
  Sidebar,
  type SidebarProps,
  type SidebarSection,
  type SidebarItem,
  Topbar,
  type TopbarProps,
  type TopbarOption,
  SESSION_MENU,
  FULL_MENU,
  CARFINITY_MENU,
} from "./shell";

// Revenue Recovery
export {
  RecoveryPageHeader,
  type RecoveryPageHeaderProps,
  type RecoveryScope,
  type RecoveryLeadTypeTab,
} from "./recovery/RecoveryPageHeader";
export {
  RecoveryKpiCards,
  type RecoveryKpiCardsProps,
  type RecoveryKpi,
} from "./recovery/RecoveryKpiCards";
export { HowItWorks, type HowItWorksProps } from "./recovery/HowItWorks";
export { RecoveryRow, type RecoveryRowProps } from "./recovery/RecoveryRow";
export { RecoveryList, type RecoveryListProps } from "./recovery/RecoveryList";
export { ThreeAxisTimeline } from "./recovery/ThreeAxisTimeline";

// Home dashboard (v2's "/" page)
export {
  HomePageHeader,
  type HomePageHeaderProps,
  AskButton,
  SectionCard,
  HeroKpiCard,
  type HeroKpiCardProps,
  SecondaryKpiTile,
  type SecondaryKpiTileProps,
  TrendCard,
  type TrendCardProps,
  HealthGauge,
  type HealthGaugeProps,
  DoThisNow,
  type DoThisNowProps,
  RankedList,
  type RankedListProps,
  type RankedItem,
  LeadTypeMix,
  type LeadTypeMixProps,
  DealershipHealth,
  type DealershipHealthProps,
  MiniStatTile,
  StatStrip,
  type MiniStatTileProps,
  StorePerformance,
  HealthScores,
  HealthByStore,
} from "./home";

// Traffic channels (the GA4 side of Revenue Recovery)
export { TrafficRow, type TrafficRowProps, TrafficList, TrafficInfo, type TrafficListProps, TrafficTimeline } from "./traffic";

// Analyst chat
export { ChatDock } from "./chat/ChatDock";
export { ChatMessages } from "./chat/ChatMessages";
export { ChatInput } from "./chat/ChatInput";
export { ToolExecutionCard } from "./chat/ToolExecutionCard";
export { InlineTrendChart } from "./chat/InlineTrendChart";
export { ReportPanel } from "./chat/ReportPanel";
export { KnowledgePanel } from "./chat/KnowledgePanel";
export { EventsPanel } from "./chat/EventsPanel";
export { InstructionsPanel } from "./chat/InstructionsPanel";

// Shared types
export type {
  DataType,
} from "@/lib/format";
export type {
  AccentVariant,
  RecoveryStatus,
  RecoverySource,
  RecoveryData,
  RecoveryTimelinePoint,
  BreakdownRow,
  RelatedKpi,
  DrillDownDimension,
  DrillDownData,
  Highlight,
  DemoKpi,
  HomeData,
  HomeHeroKpi,
  HomeSecondaryKpi,
  HomeTrend,
  HomeHealth,
  HealthSubScore,
  HomeAction,
  ActionPriority,
  HomeTopSource,
  HomeStoreRanking,
  HomeLeadType,
  HomeStorePerformance,
  HomeHealthScore,
  HomeHealthByStore,
  StoreBreakdown,
  TrafficChannel,
  TrafficData,
  TrafficMonth,
  TrafficTimelinePoint,
} from "@/lib/demo-types";
export type {
  ChatMessage,
  ChatBlock,
  ToolCall,
  ToolStatus,
  MiniKpi,
  SavedReport,
  ReportSection,
  KnowledgeDoc,
  BusinessEvent,
  EventType,
  Instruction,
} from "@/lib/chat-types";
