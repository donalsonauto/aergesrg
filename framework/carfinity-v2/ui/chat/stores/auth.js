// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import AuthAPI from '../api/AuthAPI'

export const useAuthStore = defineStore('chatAuth', () => {
  const user = ref(null)
  const isAuthenticated = ref(false)
  const loading = ref(true)
  const v2Enabled = computed(() => !!user.value?.v2_enabled)

  async function checkAuth() {
    loading.value = true
    try {
      const data = await AuthAPI.getMe()
      if (data && data.user) {
        user.value = data.user
        isAuthenticated.value = true
      } else {
        user.value = null
        isAuthenticated.value = false
      }
    } catch {
      user.value = null
      isAuthenticated.value = false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await AuthAPI.logout()
    user.value = null
    isAuthenticated.value = false
  }

  return { user, isAuthenticated, loading, v2Enabled, checkAuth, logout }
})
