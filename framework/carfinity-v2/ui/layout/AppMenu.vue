<script setup>
import { computed } from 'vue';
import AppMenuItem from './AppMenuItem.vue';
import { usePulseStore } from '@/stores/pulse';
import { useTractionStore } from '@/stores/traction';
import { useTasksStore } from '@/stores/tasks';

const pulse = usePulseStore();
const traction = useTractionStore();
const tasks = useTasksStore();

const pulseBadge = computed(() => pulse.actionableCount > 0 ? String(pulse.actionableCount) : null);
const tractionBadge = computed(() => traction.openAssignmentCount > 0 ? String(traction.openAssignmentCount) : null);
const tasksBadge = computed(() => tasks.openFindingsCount > 0 ? String(tasks.openFindingsCount) : null);

const model = computed(() => [
    {
        label: 'Home',
        icon: 'pi pi-home',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-objects-column',
                to: '/'
            },
            {
                label: 'Operations',
                icon: 'pi pi-fw pi-gauge',
                to: '/operations'
            },
            {
                label: 'My Focus',
                icon: 'pi pi-fw pi-bullseye',
                to: '/focus',
                badge: tractionBadge.value,
                badgeSeverity: 'warning'
            },
            {
                label: 'Daily Pulse',
                icon: 'pi pi-fw pi-bolt',
                to: '/need-attention',
                badge: pulseBadge.value,
                badgeSeverity: 'danger'
            },
            {
                label: 'Tasks & Agent',
                icon: 'pi pi-fw pi-bolt',
                to: '/tasks',
                badge: tasksBadge.value,
                badgeSeverity: 'danger'
            },
            {
                label: 'My KPIs',
                icon: 'pi pi-fw pi-chart-bar',
                to: '/my-kpis'
            },
            {
                label: 'Conversations',
                icon: 'pi pi-fw pi-comments',
                to: '/conversations'
            },
            {
                label: 'Store Comparison',
                icon: 'pi pi-fw pi-clone',
                to: '/compare'
            },
            {
                label: 'Benchmarking',
                icon: 'pi pi-fw pi-chart-bar',
                to: '/benchmarking'
            },
            {
                label: 'Did You Know',
                icon: 'pi pi-fw pi-sparkles',
                to: '/did-you-know'
            },
            {
                label: 'Market Intelligence',
                icon: 'pi pi-fw pi-chart-pie',
                to: '/market-share'
            },
            {
                label: 'Revenue Recovery',
                icon: 'pi pi-fw pi-replay',
                to: '/revenue-recovery'
            },
            {
                label: '404 Recovery',
                icon: 'pi pi-fw pi-times-circle',
                to: '/dead-pages'
            },
            {
                label: 'Lead Source Intel',
                icon: 'pi pi-fw pi-chart-scatter',
                to: '/lead-source-intelligence'
            }
        ]
    },
    { separator: true },
    {
        label: 'Intelligence',
        icon: 'pi pi-fw pi-microchip-ai',
        items: [
            {
                label: 'Analyst Hub',
                icon: 'pi pi-fw pi-th-large',
                to: '/intelligence'
            },
            {
                label: 'Marketing ROI',
                icon: 'pi pi-fw pi-chart-scatter',
                to: '/intelligence/marketing-roi'
            },
            {
                label: 'Deal Desk',
                icon: 'pi pi-fw pi-dollar',
                to: '/intelligence/deal-desk'
            },
            {
                label: 'Sales Team',
                icon: 'pi pi-fw pi-users',
                to: '/intelligence/sales-team'
            },
            {
                label: 'Fixed Ops',
                icon: 'pi pi-fw pi-wrench',
                to: '/intelligence/fixed-ops'
            },
            {
                label: 'Lot Intelligence',
                icon: 'pi pi-fw pi-car',
                to: '/intelligence/lot'
            },
            {
                label: 'Market Radar',
                icon: 'pi pi-fw pi-wifi',
                to: '/intelligence/market-radar'
            },
            {
                label: 'Acquisition',
                icon: 'pi pi-fw pi-shopping-bag',
                to: '/intelligence/acquisition'
            },
            {
                label: 'Strategy',
                icon: 'pi pi-fw pi-crown',
                to: '/intelligence/strategy'
            }
        ]
    },
    { separator: true },
    {
        label: 'Traction',
        icon: 'pi pi-fw pi-th-large',
        items: [
            {
                label: 'Scorecard',
                icon: 'pi pi-fw pi-th-large',
                to: '/traction'
            },
            {
                label: '10-20-30 Reports',
                icon: 'pi pi-fw pi-file-edit',
                to: '/traction/reports'
            },
            {
                label: 'Intelligence',
                icon: 'pi pi-fw pi-eye',
                to: '/traction/intelligence'
            },
            {
                label: 'Goals & Pace',
                icon: 'pi pi-fw pi-flag',
                to: '/traction/goals'
            }
        ]
    },
    { separator: true },
    {
        label: 'Performance',
        icon: 'pi pi-fw pi-chart-line',
        items: [
            {
                label: 'Sales',
                icon: 'pi pi-fw pi-shopping-cart',
                to: '/sales'
            },
            {
                label: 'Lead Sources',
                icon: 'pi pi-fw pi-filter',
                to: '/lead-sources'
            },
            {
                label: 'Service',
                icon: 'pi pi-fw pi-wrench',
                to: '/service'
            },
            {
                label: 'Group Overview',
                icon: 'pi pi-fw pi-building-columns',
                to: '/dealer-overview'
            }
        ]
    },
    { separator: true },
    {
        label: 'Channels',
        icon: 'pi pi-fw pi-share-alt',
        items: [
            {
                label: 'Website',
                icon: 'pi pi-fw pi-globe',
                to: '/website'
            },
            {
                label: 'Site Performance',
                icon: 'pi pi-fw pi-gauge',
                to: '/site-performance'
            },
            {
                label: 'Paid Search',
                icon: 'pi pi-fw pi-megaphone',
                to: '/ppc'
            },
            {
                label: 'SEO',
                icon: 'pi pi-fw pi-search',
                to: '/seo'
            }
        ]
    },
    { separator: true },
    {
        label: 'Inventory',
        icon: 'pi pi-fw pi-car',
        items: [
            {
                label: 'Stock Report',
                icon: 'pi pi-fw pi-list',
                to: '/inventory'
            },
            {
                label: 'VDP Analysis',
                icon: 'pi pi-fw pi-eye',
                to: '/vdp-report'
            },
            {
                label: 'Market Pricing',
                icon: 'pi pi-fw pi-tag',
                to: '/market-price'
            }
        ]
    },
    { separator: true },
    {
        label: 'Strategy',
        icon: 'pi pi-fw pi-compass',
        items: [
            {
                label: 'Budget',
                icon: 'pi pi-fw pi-wallet',
                to: '/budget'
            },
            {
                label: 'Planner',
                icon: 'pi pi-fw pi-calendar-plus',
                to: '/planner'
            },
            {
                label: 'Report Builder',
                icon: 'pi pi-fw pi-sliders-h',
                to: '/report-builder'
            },
            {
                label: 'Enterprise',
                icon: 'pi pi-fw pi-building',
                to: '/enterprise-reporting'
            }
        ]
    },
    { separator: true },
    {
        label: 'Integrations',
        icon: 'pi pi-fw pi-server',
        items: [
            {
                label: 'MCP Server',
                icon: 'pi pi-fw pi-server',
                to: '/mcp'
            }
        ]
    },
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, index) in model" :key="item.label + '_' + (item.to || item.path || index)">
            <AppMenuItem v-if="!item.separator" :item="item" :index="index" root />
            <li v-else class="menu-separator" />
        </template>
    </ul>
</template>
