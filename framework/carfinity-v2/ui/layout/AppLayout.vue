<script setup>
import { useLayout } from '@/layout/composables/layout';
import { computed, watch } from 'vue';
import AppBreadcrumb from './AppBreadcrumb.vue';
import AppConfig from './AppConfig.vue';
import AppFooter from './AppFooter.vue';
import AppRightMenu from './AppRightMenu.vue';
import AppSearch from './AppSearch.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';
import ChatDock from '@/chat/ChatDock.vue';
import KpiThreadPanel from '@/components/comments/KpiThreadPanel.vue';
import { useRoute } from 'vue-router';
import { usePulseStore } from '@/stores/pulse';
import { useScopeStore } from '@/stores/scope';

const { layoutConfig, layoutState, hideMobileMenu } = useLayout();
const pulse = usePulseStore();
const scope = useScopeStore();
const route = useRoute();

// Full-bleed routes (e.g. /ai-chat) skip the padded content box, breadcrumb
// and footer so the chat can own the whole viewport below the topbar.
const isFullBleed = computed(() => !!route.meta.fullBleed);

// Refresh the Daily Pulse summary (drives the sidebar badge) whenever the
// global scope (topbar group / property) changes.
watch(() => `${scope.current.type}::${scope.current.id ?? ''}`, () => {
  pulse.fetchSummary(scope.current);
}, { immediate: true });

const containerClass = computed(() => {
    return [
        `layout-sidebar-${layoutConfig.menuTheme}`,
        `layout-card-${layoutConfig.cardStyle}`,
        {
            'layout-overlay': layoutConfig.menuMode === 'overlay',
            'layout-static': layoutConfig.menuMode === 'static',
            'layout-slim': layoutConfig.menuMode === 'slim',
            'layout-horizontal': layoutConfig.menuMode === 'horizontal',
            'layout-compact': layoutConfig.menuMode === 'compact',
            'layout-reveal': layoutConfig.menuMode === 'reveal',
            'layout-drawer': layoutConfig.menuMode === 'drawer',
            'layout-overlay-active': layoutState.overlayMenuActive,
            'layout-mobile-active': layoutState.mobileMenuActive,
            'layout-static-inactive': layoutState.staticMenuInactive,
            'layout-sidebar-expanded': layoutState.sidebarExpanded,
            'layout-sidebar-anchored': layoutState.anchored
        }
    ];
});
</script>

<template>
    <div class="layout-wrapper" :class="containerClass">
        <AppSidebar />
        <div class="layout-content-wrapper" :class="{ 'layout-content-wrapper--bleed': isFullBleed }">
            <div class="layout-content-wrapper-inside">
                <AppTopbar />
                <router-view v-if="isFullBleed" />
                <template v-else>
                    <div class="layout-content">
                        <AppBreadcrumb />
                        <router-view />
                    </div>
                    <AppFooter />
                </template>
            </div>
        </div>
        <AppConfig />
        <AppSearch />
        <AppRightMenu />
        <ChatDock />
        <KpiThreadPanel />
        <Toast />
        <Transition name="p-overlay-mask">
            <div v-if="layoutState.mobileMenuActive" class="layout-mask" @click="hideMobileMenu" />
        </Transition>
    </div>
</template>
