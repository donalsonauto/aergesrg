// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import SettingsAPI from '../api/SettingsAPI'

export const useSettingsStore = defineStore('chatSettings', () => {
  const properties = ref([])
  const storeMappings = ref([])
  const searchConsoleSites = ref([])
  const syncStatus = ref({})
  const activePropertyId = ref(null)
  const loading = ref(false)
  const propertyGroups = ref([])

  const activeProperty = computed(() =>
    properties.value.find(p => p.id === activePropertyId.value)
  )

  const activeProperties = computed(() =>
    properties.value.filter(p => p.active)
  )

  async function fetchProperties() {
    loading.value = true
    try {
      properties.value = await SettingsAPI.getProperties()
      if (!activePropertyId.value && properties.value.length) {
        activePropertyId.value = properties.value.find(p => p.active)?.id || properties.value[0].id
      }
    } catch {
      properties.value = []
    } finally {
      loading.value = false
    }
  }

  async function discoverProperties() {
    loading.value = true
    try {
      const discovered = await SettingsAPI.discoverProperties()
      properties.value = discovered
      return discovered
    } catch (e) {
      throw e
    } finally {
      loading.value = false
    }
  }

  async function saveProperties(props) {
    await SettingsAPI.saveProperties(props)
    await fetchProperties()
  }

  async function toggleProperty(id, active) {
    await SettingsAPI.toggleProperty(id, active)
    const prop = properties.value.find(p => p.id === id)
    if (prop) prop.active = active
  }

  async function fetchStoreMappings() {
    try { storeMappings.value = await SettingsAPI.getStoreMappings() } catch { storeMappings.value = [] }
  }

  async function saveStoreMapping(propertyId, data) {
    await SettingsAPI.saveStoreMapping(propertyId, data)
    await fetchStoreMappings()
  }

  async function fetchSearchConsoleSites() {
    try { searchConsoleSites.value = await SettingsAPI.getSearchConsoleSites() } catch { searchConsoleSites.value = [] }
  }

  async function linkSearchConsoleSite(siteUrl) {
    await SettingsAPI.linkSearchConsoleSite(siteUrl)
    await fetchSearchConsoleSites()
  }

  async function fetchSyncStatus() {
    try { syncStatus.value = await SettingsAPI.getSyncStatus() } catch { syncStatus.value = {} }
  }

  async function triggerSync(propertyId) {
    await SettingsAPI.triggerSync(propertyId)
    await fetchSyncStatus()
  }

  // Property Groups (custom user-defined collections)
  async function fetchPropertyGroups() {
    try {
      const res = await fetch('/api/property-groups', { credentials: 'include' })
      propertyGroups.value = res.ok ? await res.json() : []
    } catch { propertyGroups.value = [] }
  }
  async function createPropertyGroup({ name, description, color, property_ids }) {
    const res = await fetch('/api/property-groups', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color, property_ids }),
    })
    await fetchPropertyGroups()
    return res.ok ? res.json() : null
  }
  async function updatePropertyGroup(id, patch) {
    await fetch(`/api/property-groups/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await fetchPropertyGroups()
  }
  async function deletePropertyGroup(id) {
    await fetch(`/api/property-groups/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchPropertyGroups()
  }

  return {
    properties, storeMappings, searchConsoleSites, syncStatus,
    activePropertyId, activeProperty, activeProperties, loading,
    propertyGroups,
    fetchProperties, discoverProperties, saveProperties, toggleProperty,
    fetchStoreMappings, saveStoreMapping,
    fetchSearchConsoleSites, linkSearchConsoleSite,
    fetchSyncStatus, triggerSync,
    fetchPropertyGroups, createPropertyGroup, updatePropertyGroup, deletePropertyGroup,
  }
})
