<script setup>
import { useLayout } from '@/layout/composables/layout';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppMenu from './AppMenu.vue';
import AppTopbar from './AppTopbar.vue';

const BREAKPOINT = 992;
const mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
const { layoutConfig, layoutState, isDesktop, isHorizontal, isSlim, isCompact, hasOpenOverlay, hasOverlaySubmenu, hasOpenOverlaySubmenu } = useLayout();
const route = useRoute();
const menuContainerRef = ref(null);
const sidebarRef = ref(null);

let timeout = null;
let observer = null;
let outsideClickListener = null;

watch(
    () => route.path,
    (newPath) => {
        if (hasOverlaySubmenu.value && isDesktop()) layoutState.activePath = null;
        else layoutState.activePath = newPath;

        layoutState.overlayMenuActive = false;
        layoutState.mobileMenuActive = false;
        layoutState.menuHoverActive = false;
    },
    { immediate: true }
);

watch(hasOpenOverlay, (newVal) => {
    if (isDesktop()) {
        if (newVal) bindOutsideClickListener();
        else unbindOutsideClickListener();
    }
});

watch(hasOpenOverlaySubmenu, (newValue) => {
    if (isDesktop()) {
        if (newValue) nextTick(setupIntersectionObserver);
        else unbindObserver();
    }
});

const screenChangeListener = () => {
    if (hasOverlaySubmenu.value) {
        layoutState.activePath = isDesktop() ? null : route.path;
        layoutState.menuHoverActive = false;
        unbindOutsideClickListener();
        unbindObserver();
    }
};

const bindOutsideClickListener = () => {
    if (!outsideClickListener) {
        outsideClickListener = (event) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false;

                if (hasOverlaySubmenu.value) {
                    layoutState.activePath = null;
                    layoutState.menuHoverActive = false;
                }
            }
        };

        document.addEventListener('click', outsideClickListener);
    }
};

const unbindOutsideClickListener = () => {
    if (outsideClickListener) {
        document.removeEventListener('click', outsideClickListener);
        outsideClickListener = null;
    }
};

const isOutsideClicked = (event) => {
    const topbarButtonEl = document.querySelector('.topbar-left > a');
    const topbarRightEl = document.querySelector('.topbar-right');

    return (
        topbarRightEl?.isSameNode(event.target) ||
        topbarRightEl?.contains(event.target) ||
        !(sidebarRef.value.isSameNode(event.target) || sidebarRef.value.contains(event.target) || topbarButtonEl?.isSameNode(event.target) || topbarButtonEl?.contains(event.target))
    );
};

const onMouseEnter = () => {
    if (!layoutState.anchored) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        layoutState.sidebarExpanded = true;
    }
};

const onMouseLeave = () => {
    if (!layoutState.anchored && !timeout) {
        timeout = setTimeout(() => (layoutState.sidebarExpanded = false), 300);
    }
};

const onAnchorToggle = () => {
    layoutState.anchored = !layoutState.anchored;
};

const onMenuScroll = () => {
    if (menuContainerRef.value) {
        if (isHorizontal.value) {
            menuContainerRef.value.style.setProperty('--menu-scroll-x', `-${menuContainerRef.value.scrollLeft}px`);
        } else if (isSlim.value || isCompact.value) {
            menuContainerRef.value.style.setProperty('--menu-scroll-y', `-${menuContainerRef.value.scrollTop}px`);
        }
    }

    if (hasOverlaySubmenu.value && isDesktop()) {
        layoutState.activePath = null;
    }
};

const setupIntersectionObserver = () => {
    if (!menuContainerRef.value) return;

    if (observer) {
        observer.disconnect();
    }

    const activeMenuItem = menuContainerRef.value.querySelector('.layout-root-menuitem.active-menuitem');
    if (!activeMenuItem) return;

    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (isDesktop() && !entry.isIntersecting && hasOverlaySubmenu.value && layoutState.activePath) {
                    layoutState.activePath = null;
                }
            });
        },
        {
            root: menuContainerRef.value,
            threshold: 0
        }
    );

    observer.observe(activeMenuItem);
};

const unbindObserver = () => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
};

mediaQuery.addEventListener('change', screenChangeListener);

onBeforeUnmount(() => {
    unbindOutsideClickListener();
    unbindObserver();
    mediaQuery.removeEventListener('change', screenChangeListener);
});
</script>

<template>
    <div ref="sidebarRef" class="layout-sidebar" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
        <div class="sidebar-header">
            <router-link :to="{ name: 'realtime-cashflow' }" class="logo">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 22px; height: 22px; color: var(--primary-color); flex-shrink: 0; margin-right: 8px;">
                    <path d="M11.644 1.59a.75.75 0 01.712 0l9.75 5.25a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l9.75-5.25z" />
                    <path d="M3.265 10.602l7.668 4.129a2.25 2.25 0 002.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.71 0l-9.75-5.25a.75.75 0 010-1.32l1.37-.738z" />
                    <path d="M3.265 15.602l7.668 4.129a2.25 2.25 0 002.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.71 0l-9.75-5.25a.75.75 0 010-1.32l1.37-.738z" />
                </svg>
                <span class="app-name title-h7">Rank<strong>matic</strong></span>
            </router-link>
            <button class="layout-sidebar-anchor" type="button" @click="onAnchorToggle" />
        </div>
        <div ref="menuContainerRef" class="layout-menu-container" @scroll="onMenuScroll">
            <AppMenu />
        </div>
        <AppTopbar v-if="isHorizontal" />
    </div>
</template>
