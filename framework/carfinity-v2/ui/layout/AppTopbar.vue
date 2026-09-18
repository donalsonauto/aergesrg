<script setup>
import { useLayout } from '@/layout/composables/layout';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import { useScopeStore } from '@/stores/scope';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import AppBreadcrumb from './AppBreadcrumb.vue';
import DateFilter from '@/components/cashflow/DateFilter.vue';
import PropertySelector from '@/components/cashflow/PropertySelector.vue';
import CreateGroupDialog from '@/components/cashflow/CreateGroupDialog.vue';
import Ga4StatusIndicator from '@/components/cashflow/Ga4StatusIndicator.vue';

const { layoutState, isDarkTheme, toggleMenu, toggleConfigSidebar } = useLayout();
const authStore = useAuthStore();
const userStore = useUserStore();
const scope = useScopeStore();
const router = useRouter();
const toast = useToast();

// authStore (GET /api/auth/me) is the populated session user — name, email
// and Google profile `picture`. userStore is left for legacy callers.
const sessionUser = computed(() => authStore.user || userStore.user || null);

const userName = computed(() => {
    const u = sessionUser.value;
    return (u && (u.name || u.email)) || 'User';
});

const userEmail = computed(() => sessionUser.value?.email || '');

const userInitial = computed(() => {
    return userName.value.charAt(0).toUpperCase();
});

// Google profile picture — hidden if it 404s / fails so the initial shows.
const pictureFailed = ref(false);
const userPicture = computed(() => {
    const p = sessionUser.value?.picture;
    return (!pictureFailed.value && p) ? p : null;
});

// --- Group / scope selector (global scope store) ---
const showGroupPicker = ref(false);
const groupPickerRef = ref(null);
const autoGenerating = ref(false);
// Create Group dialog visibility — controlled here, opened from the dropdown.
const showCreateGroup = ref(false);

// The group picker shows the GROUP only — never the drilled-down property —
// so its label tracks `scope.group`, not `scope.current`. When no group is
// selected the label is "All Groups" so it never collides with the
// PROPERTY selector (which shows "All Properties").
const currentGroupName = computed(() => scope.group?.name || 'All Groups');

function selectAllProperties() {
    // setGroup(null) clears the group AND resets the property to "all".
    scope.setGroup(null);
    showGroupPicker.value = false;
}

function selectGroup(group) {
    // setGroup resets the single-property selection back to "all in group".
    scope.setGroup({ id: group.id, name: group.name });
    showGroupPicker.value = false;
}

function isActiveGroup(group) {
    return !!scope.group && String(scope.group.id) === String(group.id);
}

function openCreateGroup() {
    showGroupPicker.value = false;
    showCreateGroup.value = true;
}

async function autoGenerateGroups() {
    if (autoGenerating.value) return;
    autoGenerating.value = true;
    try {
        const res = await scope.autoGenerate();
        const n = res?.created?.length || 0;
        if (n > 0) {
            toast.add({
                severity: 'success',
                summary: `Created ${n} group${n === 1 ? '' : 's'}`,
                detail: res.created.map(g => g.name).join(', '),
                life: 4000,
            });
        } else {
            toast.add({
                severity: 'info',
                summary: 'No new groups',
                detail: 'No clusters of similar properties were found.',
                life: 4000,
            });
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Auto-create failed', detail: e?.message || 'Try again later.', life: 4000 });
    } finally {
        autoGenerating.value = false;
        showGroupPicker.value = false;
    }
}

function handleGroupOutsideClick(e) {
    if (showGroupPicker.value && groupPickerRef.value && !groupPickerRef.value.contains(e.target)) {
        showGroupPicker.value = false;
    }
}

onMounted(() => {
    document.addEventListener('mousedown', handleGroupOutsideClick);
    document.addEventListener('mousedown', handleNotifOutsideClick);
    // Load the user's real property groups for the scope picker.
    scope.loadGroups().catch(() => {});
    // Ensure the session user (name / email / picture) is loaded.
    if (!authStore.user) authStore.checkAuth().catch(() => {});
});
onUnmounted(() => {
    document.removeEventListener('mousedown', handleGroupOutsideClick);
    document.removeEventListener('mousedown', handleNotifOutsideClick);
});

// --- Notifications ---
const showNotifications = ref(false);
const notifRef = ref(null);

// Notifications are not wired to a real data source yet. Ship an empty list
// (no placeholder alerts, no unread badge) until the feed is live.
const notifications = ref([]);

const unreadCount = computed(() => notifications.value.filter(n => n.unread).length);

function handleNotifOutsideClick(e) {
    if (showNotifications.value && notifRef.value && !notifRef.value.contains(e.target)) {
        showNotifications.value = false;
    }
}

function markAllRead() {
    notifications.value.forEach(n => n.unread = false);
}

function toggleSearchBar() {
    layoutState.searchBarActive = !layoutState.searchBarActive;
}

function showRightMenu() {
    layoutState.rightMenuVisible = !layoutState.rightMenuVisible;
}

async function handleLogout() {
    await authStore.logout();
    router.push({ name: 'login' });
}
</script>

<template>
    <div class="layout-topbar">
        <div class="topbar-left">
            <a tabindex="0" class="menu-button" @click="toggleMenu">
                <i class="pi pi-chevron-left" />
            </a>
            <img class="horizontal-logo" src="/layout/images/logo-white.svg" alt="carfinity" />
            <span class="topbar-separator" />
            <AppBreadcrumb />
            <img class="mobile-logo" :src="`/layout/images/logo-${isDarkTheme ? 'white' : 'dark'}.svg`" alt="carfinity" />
        </div>

        <div class="topbar-right">
            <ul class="topbar-menu">
                <!-- Property Selector (first, opens right) -->
                <li class="flex items-center">
                    <PropertySelector />
                </li>

                <!-- Group / scope selector -->
                <li class="relative flex items-center" ref="groupPickerRef">
                    <button
                        @click="showGroupPicker = !showGroupPicker"
                        class="flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                        :class="showGroupPicker
                            ? 'text-primary-400 bg-primary-500/10'
                            : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-50 hover:bg-surface-100 dark:hover:bg-surface-800'"
                    >
                        <i class="pi pi-building text-xs opacity-60"></i>
                        <span class="hidden sm:inline max-w-[180px] truncate">{{ currentGroupName }}</span>
                        <i class="pi pi-chevron-down text-[10px] opacity-50 hidden sm:inline"></i>
                    </button>
                    <Transition name="pop-group">
                        <div
                            v-if="showGroupPicker"
                            class="absolute top-full left-0 mt-2 z-[999] bg-surface-0 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 shadow-xl overflow-hidden min-w-[240px]"
                        >
                            <div class="p-1.5">
                                <div class="px-2.5 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Dealer Groups</div>

                                <!-- All Properties (whole account — no group) -->
                                <button
                                    @click="selectAllProperties"
                                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer"
                                    :class="!scope.group
                                        ? 'bg-primary-500/10 text-primary-400'
                                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800'"
                                >
                                    <i class="pi pi-globe text-xs" :class="!scope.group ? 'text-primary-400' : 'text-surface-400'"></i>
                                    <span class="truncate">All Properties</span>
                                </button>

                                <!-- Property Groups -->
                                <button
                                    v-for="group in scope.groups"
                                    :key="group.id"
                                    @click="selectGroup(group)"
                                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer"
                                    :class="isActiveGroup(group)
                                        ? 'bg-primary-500/10 text-primary-400'
                                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800'"
                                >
                                    <i class="pi pi-building text-xs" :class="isActiveGroup(group) ? 'text-primary-400' : 'text-surface-400'"></i>
                                    <span class="truncate flex-1">{{ group.name }}</span>
                                    <span class="text-[10px] text-surface-400 dark:text-surface-500">{{ (group.property_ids || []).length }}</span>
                                </button>

                                <div
                                    v-if="!scope.groups.length && !scope.loading"
                                    class="px-2.5 py-1.5 text-xs text-surface-400"
                                >No groups yet.</div>

                                <!-- Divider + group-creation actions -->
                                <div class="my-1 border-t border-surface-200 dark:border-surface-700/60"></div>
                                <button
                                    @click="openCreateGroup"
                                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10"
                                >
                                    <i class="pi pi-plus text-xs"></i>
                                    <span class="truncate">New Group</span>
                                </button>
                                <button
                                    @click="autoGenerateGroups"
                                    :disabled="autoGenerating"
                                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 disabled:opacity-60 disabled:cursor-wait"
                                >
                                    <i class="text-xs" :class="autoGenerating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
                                    <span class="truncate">{{ autoGenerating ? 'Creating groups…' : 'Auto-create groups from my properties' }}</span>
                                </button>
                            </div>
                        </div>
                    </Transition>
                </li>

                <!-- Date Filter -->
                <li class="flex items-center">
                    <DateFilter />
                </li>

                <li class="right-sidebar-item hidden sm:list-item">
                    <a class="right-sidebar-button cursor-pointer" @click="toggleSearchBar">
                        <i class="pi pi-search" />
                    </a>
                </li>

                <!-- GA4 API status indicator -->
                <li class="flex items-center">
                    <Ga4StatusIndicator />
                </li>

                <!-- Notifications Bell -->
                <li class="relative flex items-center" ref="notifRef">
                    <button
                        @click="showNotifications = !showNotifications"
                        class="relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        :class="showNotifications
                            ? 'text-primary-400 bg-primary-500/10'
                            : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'"
                    >
                        <i class="pi pi-bell text-lg"></i>
                        <span
                            v-if="unreadCount > 0"
                            class="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
                        >{{ unreadCount }}</span>
                    </button>
                    <Transition name="pop-notif">
                        <div
                            v-if="showNotifications"
                            class="absolute top-full right-0 mt-2 z-[999] bg-surface-0 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 shadow-xl overflow-hidden w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px]"
                        >
                            <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
                                <span class="text-sm font-semibold text-surface-900 dark:text-surface-0">Notifications</span>
                                <button
                                    v-if="unreadCount > 0"
                                    @click="markAllRead"
                                    class="text-xs text-primary-400 hover:text-primary-300 font-medium cursor-pointer"
                                >Mark all read</button>
                            </div>
                            <div class="max-h-[320px] overflow-y-auto">
                                <div v-if="notifications.length === 0" class="px-4 py-8 text-center">
                                    <i class="pi pi-check-circle text-green-400 text-xl"></i>
                                    <p class="text-sm text-surface-500 dark:text-surface-400 mt-2">You're all caught up</p>
                                </div>
                                <div
                                    v-for="n in notifications"
                                    :key="n.id"
                                    class="flex gap-3 px-4 py-3 transition-colors"
                                    :class="n.unread ? 'bg-primary-500/5' : ''"
                                >
                                    <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-surface-100 dark:bg-surface-800">
                                        <i :class="[n.icon, n.color, 'text-sm']"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-semibold text-surface-900 dark:text-surface-0 truncate">{{ n.title }}</span>
                                            <span v-if="n.unread" class="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0"></span>
                                        </div>
                                        <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">{{ n.detail }}</p>
                                        <span class="text-[10px] text-surface-400 dark:text-surface-500 mt-1 block">{{ n.time }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>
                </li>

                <li class="profile-item static sm:relative">
                    <a
                        class="bg-none! border-none! outline-none!"
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveActiveClass: 'p-anchored-overlay-leave-active', leaveToClass: 'hidden', hideOnOutsideClick: true }"
                    >
                        <div class="w-10 h-10 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                            <img
                                v-if="userPicture"
                                :src="userPicture"
                                alt=""
                                referrerpolicy="no-referrer"
                                class="w-full h-full object-cover"
                                @error="pictureFailed = true"
                            />
                            <span v-else>{{ userInitial }}</span>
                        </div>
                    </a>
                    <div
                        class="list-none p-2 m-0 rounded-2xl border border-surface overflow-hidden absolute bg-surface-0 dark:bg-surface-900 hidden origin-top w-52 mt-2 right-0 z-[999] top-auto shadow-[0px_56px_16px_0px_rgba(0,0,0,0.00),0px_36px_14px_0px_rgba(0,0,0,0.01),0px_20px_12px_0px_rgba(0,0,0,0.02),0px_9px_9px_0px_rgba(0,0,0,0.03),0px_2px_5px_0px_rgba(0,0,0,0.04)]"
                    >
                        <div class="px-3 py-2 mb-1">
                            <p class="label-small text-surface-950 dark:text-surface-0 font-semibold truncate">{{ userName }}</p>
                            <p v-if="userEmail" class="text-xs text-surface-500 dark:text-surface-400 truncate">{{ userEmail }}</p>
                        </div>
                        <ul class="flex flex-col gap-1">
                            <li>
                                <a class="label-small dark:text-surface-400 flex gap-2 py-2 px-2.5 rounded-lg items-center hover:bg-emphasis transition-colors duration-150 cursor-pointer" @click="handleLogout">
                                    <i class="pi pi-power-off" />
                                    <span>Log out</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </li>

                <li class="right-sidebar-item hidden lg:list-item">
                    <a tabindex="0" class="right-sidebar-button" @click="showRightMenu">
                        <i class="pi pi-align-right" />
                    </a>
                </li>
            </ul>
        </div>

        <!-- Create Group dialog — opened from the group selector dropdown -->
        <CreateGroupDialog v-model:visible="showCreateGroup" />
    </div>
</template>

<style scoped>
.pop-group-enter-active {
    transition: all 0.15s ease-out;
}
.pop-group-leave-active {
    transition: all 0.1s ease-in;
}
.pop-group-enter-from,
.pop-group-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
}
.pop-notif-enter-active {
    transition: all 0.15s ease-out;
}
.pop-notif-leave-active {
    transition: all 0.1s ease-in;
}
.pop-notif-enter-from,
.pop-notif-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
}
</style>
