<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  groupedConversations: { type: Object, default: () => ({ today: [], yesterday: [], thisWeek: [], older: [] }) },
  activeConversationId: { type: [String, Number], default: null },
  loading: { type: Boolean, default: false },
  usage: { type: Object, default: () => ({}) },
  showMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['newChat', 'select', 'delete', 'toggleInstructions', 'toggleEvents', 'toggleKnowledge'])
const hoverConvId = ref(null)
const showUserMenu = ref(false)

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div
    class="flex flex-col bg-white/[0.02] border-r border-white/10 transition-transform duration-200 z-50"
    :class="[
      'fixed inset-y-0 left-0 w-[260px] md:static md:translate-x-0',
      showMobile ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Header -->
    <div class="shrink-0 flex items-center px-4 py-4">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-sick-gradient flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 2 5.5-6L21 5M21 5h-5M21 5v5" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-white/90">RankMatic AI</span>
      </div>
    </div>

    <!-- New chat -->
    <div class="px-3 pb-3">
      <button
        @click="emit('newChat')"
        class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New chat
      </button>
    </div>

    <!-- Conversation list -->
    <div class="flex-1 overflow-y-auto px-2 space-y-4">
      <template v-for="(group, key) in { 'Today': groupedConversations.today, 'Yesterday': groupedConversations.yesterday, 'This Week': groupedConversations.thisWeek, 'Older': groupedConversations.older }" :key="key">
        <div v-if="group.length">
          <div class="px-2 py-1.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">{{ key }}</div>
          <div class="space-y-0.5">
            <div
              v-for="conv in group"
              :key="conv.id"
              @click="emit('select', conv.id)"
              @mouseenter="hoverConvId = conv.id"
              @mouseleave="hoverConvId = null"
              class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
              :class="activeConversationId === conv.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'"
            >
              <span class="flex-1 truncate text-sm">{{ conv.title || 'New Chat' }}</span>
              <button
                v-show="hoverConvId === conv.id"
                @click.stop="emit('delete', conv.id)"
                class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <div v-if="!conversations.length && !loading" class="px-3 py-6 text-center">
        <p class="text-sm text-white/30">No conversations yet</p>
      </div>
    </div>

    <!-- Bottom section: nav + user -->
    <div class="shrink-0 border-t border-white/10">
      <!-- Quick nav -->
      <div class="px-2 py-2 space-y-0.5">
        <button
          @click="emit('toggleInstructions')"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Instructions
        </button>
        <button
          @click="emit('toggleEvents')"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Business Events
        </button>
        <button
          @click="emit('toggleKnowledge')"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Knowledge Base
        </button>
        <button
          @click="router.push('/settings')"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>

      <!-- User profile -->
      <div class="px-3 py-3 border-t border-white/10">
        <div class="flex items-center gap-3">
          <img
            v-if="auth.user?.picture"
            :src="auth.user.picture"
            :alt="auth.user.name"
            class="w-8 h-8 rounded-full shrink-0"
            referrerpolicy="no-referrer"
          />
          <div v-else class="w-8 h-8 rounded-full bg-brand-purple/30 flex items-center justify-center shrink-0">
            <span class="text-xs font-bold text-brand-purple">{{ (auth.user?.name || '?')[0] }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white/80 truncate">{{ auth.user?.name || 'User' }}</p>
            <p class="text-[11px] text-white/30 truncate">{{ auth.user?.email || '' }}</p>
          </div>
          <button
            @click="handleLogout"
            class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
            title="Sign out"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
