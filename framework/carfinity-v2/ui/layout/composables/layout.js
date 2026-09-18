import { computed, reactive } from 'vue';
import { useRoute } from 'vue-router';

const layoutConfig = reactive({
    preset: 'Aura',
    primary: 'indigo',
    surface: null,
    darkTheme: true,
    menuMode: 'static',
    menuTheme: 'primary',
    cardStyle: 'transparent'
});

const layoutState = reactive({
    staticMenuInactive: false,
    overlayMenuActive: false,
    rightMenuVisible: false,
    configSidebarVisible: false,
    mobileMenuActive: false,
    searchBarActive: false,
    sidebarExpanded: false,
    menuHoverActive: false,
    activePath: null,
    anchored: false
});

export { layoutConfig, layoutState };

export function useLayout() {
    const route = useRoute();

    const toggleMenu = () => {
        if (isDesktop()) {
            if (layoutConfig.menuMode === 'static') {
                layoutState.staticMenuInactive = !layoutState.staticMenuInactive;
            }

            if (layoutConfig.menuMode === 'overlay') {
                layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
            }
        } else {
            layoutState.mobileMenuActive = !layoutState.mobileMenuActive;
        }
    };

    const toggleConfigSidebar = () => {
        layoutState.configSidebarVisible = !layoutState.configSidebarVisible;
    };

    const hideMobileMenu = () => {
        layoutState.mobileMenuActive = false;
    };

    const changeMenuMode = (menuMode) => {
        layoutConfig.menuMode = menuMode;
        layoutState.staticMenuInactive = false;
        layoutState.overlayMenuActive = false;
        layoutState.mobileMenuActive = false;
        layoutState.sidebarExpanded = false;
        layoutState.menuHoverActive = false;
        layoutState.anchored = false;

        if (isDesktop()) {
            layoutState.activePath = hasOverlaySubmenu.value ? null : route.path;
        }
    };

    const isDarkTheme = computed(() => layoutConfig.darkTheme);
    const isDesktop = () => window.innerWidth > 991;
    const isHorizontal = computed(() => layoutConfig.menuMode === 'horizontal');
    const isCompact = computed(() => layoutConfig.menuMode === 'compact');
    const isSlim = computed(() => layoutConfig.menuMode === 'slim');

    const hasOverlaySubmenu = computed(() => layoutConfig.menuMode === 'slim' || layoutConfig.menuMode === 'compact' || layoutConfig.menuMode === 'horizontal');
    const hasOpenOverlaySubmenu = computed(() => hasOverlaySubmenu.value && layoutState.activePath !== null && layoutState.activePath !== '/');
    const hasOpenOverlay = computed(() => layoutState.overlayMenuActive || hasOpenOverlaySubmenu.value);

    return {
        layoutConfig,
        layoutState,
        isDarkTheme,
        toggleConfigSidebar,
        toggleMenu,
        hasOpenOverlay,
        hasOverlaySubmenu,
        hasOpenOverlaySubmenu,
        hideMobileMenu,
        changeMenuMode,
        isHorizontal,
        isCompact,
        isSlim,
        isDesktop
    };
}
