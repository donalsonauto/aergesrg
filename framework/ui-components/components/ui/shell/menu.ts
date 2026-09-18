// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.

// The real app's menu, transcribed from AppMenu.vue: the same eight sections,
// the same labels, in the same order. PrimeIcons are mapped to their closest
// lucide-react equivalent (pi-objects-column -> LayoutGrid, pi-replay ->
// RotateCcw, pi-building-columns -> Landmark, and so on).
//
// USE `SESSION_MENU` FOR WHAT YOU BUILD. It lists only the screens that exist:
// the home dashboard and Revenue Recovery. A sidebar full of links that 404 is
// the fastest way to make a real build look like a mockup. Add a line to it when
// you add a screen.
//
// `FULL_MENU` below is the whole product's menu, kept as a reference for what a
// finished version looks like. Do not put it in the dealer's app unless they have
// actually built those screens.

import {
  AlignRight,
  BarChart3,
  Building,
  CalendarPlus,
  Car,
  Crown,
  DollarSign,
  Eye,
  FilePen,
  Filter,
  Flag,
  Gauge,
  Globe,
  Landmark,
  LayoutGrid,
  List,
  Megaphone,
  MessagesSquare,
  PieChart,
  RotateCcw,
  ScatterChart,
  Search,
  Server,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  Users,
  Wallet,
  Wifi,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import type { SidebarSection } from "./Sidebar";

// Only the screens this toolkit builds. This is the one to pass to <Sidebar>.
export const SESSION_MENU: SidebarSection[] = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", icon: LayoutGrid, to: "/" },
      { label: "Revenue Recovery", icon: RotateCcw, to: "/revenue-recovery" },
    ],
  },
];

export const FULL_MENU: SidebarSection[] = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", icon: LayoutGrid, to: "/" },
      { label: "Operations", icon: Gauge, to: "/operations" },
      { label: "My Focus", icon: Target, to: "/focus" },
      { label: "Daily Pulse", icon: Zap, to: "/need-attention" },
      { label: "Tasks & Agent", icon: Zap, to: "/tasks" },
      { label: "My KPIs", icon: BarChart3, to: "/my-kpis" },
      { label: "Conversations", icon: MessagesSquare, to: "/conversations" },
      { label: "Store Comparison", icon: AlignRight, to: "/compare" },
      { label: "Benchmarking", icon: BarChart3, to: "/benchmarking" },
      { label: "Did You Know", icon: Sparkles, to: "/did-you-know" },
      { label: "Market Intelligence", icon: PieChart, to: "/market-share" },
      { label: "Revenue Recovery", icon: RotateCcw, to: "/revenue-recovery" },
      { label: "404 Recovery", icon: XCircle, to: "/dead-pages" },
      {
        label: "Lead Source Intel",
        icon: ScatterChart,
        to: "/lead-source-intelligence",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analyst Hub", icon: LayoutGrid, to: "/intelligence" },
      {
        label: "Marketing ROI",
        icon: ScatterChart,
        to: "/intelligence/marketing-roi",
      },
      { label: "Deal Desk", icon: DollarSign, to: "/intelligence/deal-desk" },
      { label: "Sales Team", icon: Users, to: "/intelligence/sales-team" },
      { label: "Fixed Ops", icon: Wrench, to: "/intelligence/fixed-ops" },
      { label: "Lot Intelligence", icon: Car, to: "/intelligence/lot" },
      { label: "Market Radar", icon: Wifi, to: "/intelligence/market-radar" },
      {
        label: "Acquisition",
        icon: ShoppingBag,
        to: "/intelligence/acquisition",
      },
      { label: "Strategy", icon: Crown, to: "/intelligence/strategy" },
    ],
  },
  {
    label: "Traction",
    items: [
      { label: "Scorecard", icon: LayoutGrid, to: "/traction" },
      { label: "10-20-30 Reports", icon: FilePen, to: "/traction/reports" },
      { label: "Intelligence", icon: Eye, to: "/traction/intelligence" },
      { label: "Goals & Pace", icon: Flag, to: "/traction/goals" },
    ],
  },
  {
    label: "Performance",
    items: [
      { label: "Sales", icon: ShoppingCart, to: "/sales" },
      { label: "Lead Sources", icon: Filter, to: "/lead-sources" },
      { label: "Service", icon: Wrench, to: "/service" },
      { label: "Group Overview", icon: Landmark, to: "/dealer-overview" },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Website", icon: Globe, to: "/website" },
      { label: "Site Performance", icon: Gauge, to: "/site-performance" },
      { label: "Paid Search", icon: Megaphone, to: "/ppc" },
      { label: "SEO", icon: Search, to: "/seo" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Stock Report", icon: List, to: "/inventory" },
      { label: "VDP Analysis", icon: Eye, to: "/vdp-report" },
      { label: "Market Pricing", icon: Tag, to: "/market-price" },
    ],
  },
  {
    label: "Strategy",
    items: [
      { label: "Budget", icon: Wallet, to: "/budget" },
      { label: "Planner", icon: CalendarPlus, to: "/planner" },
      { label: "Report Builder", icon: SlidersHorizontal, to: "/report-builder" },
      { label: "Enterprise", icon: Building, to: "/enterprise-reporting" },
    ],
  },
  {
    label: "Integrations",
    items: [{ label: "MCP Server", icon: Server, to: "/mcp" }],
  },
];

/**
 * @deprecated Old name, kept so existing code and half-remembered examples keep working.
 * It resolves to SESSION_MENU on purpose: reaching for the old name must not put a menu of
 * dead links into an app with two screens. Want the whole product's menu? Ask for FULL_MENU.
 */
export const CARFINITY_MENU = SESSION_MENU;
