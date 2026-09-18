<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed } from 'vue';
import { formatValue, pctChange, changeColor, badgeClass } from '@/composables/useFormatKpi';

const props = defineProps({
  data: { type: Array, default: () => [] },
  dataType: { type: String, default: 'int' },
  loading: { type: Boolean, default: false },
  dimension: { type: String, default: null },
});

const emit = defineEmits(['rowClick']);

const sortField = ref('current');
const sortOrder = ref(-1);
const searchQuery = ref('');
const currentPage = ref(0);
const pageSize = 20;

const filteredData = computed(() => {
  let result = [...props.data];
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(r => r.label?.toLowerCase().includes(q));
  }
  // Sort
  result.sort((a, b) => {
    const aVal = a[sortField.value] ?? 0;
    const bVal = b[sortField.value] ?? 0;
    return sortOrder.value === -1 ? bVal - aVal : aVal - bVal;
  });
  return result;
});

const paginatedData = computed(() => {
  const start = currentPage.value * pageSize;
  return filteredData.value.slice(start, start + pageSize);
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / pageSize));

function toggleSort(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === -1 ? 1 : -1;
  } else {
    sortField.value = field;
    sortOrder.value = -1;
  }
}

function sortIcon(field) {
  if (sortField.value !== field) return 'pi pi-sort-alt';
  return sortOrder.value === -1 ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up';
}

function rowHighlight(row) {
  if (row.variancePct == null) return '';
  if (row.variancePct >= 15) return 'bg-green-500/5 dark:bg-green-500/8';
  if (row.variancePct <= -15) return 'bg-red-500/5 dark:bg-red-500/8';
  return '';
}
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface overflow-hidden">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <ProgressSpinner style="width: 32px; height: 32px" />
    </div>

    <!-- Empty -->
    <div v-else-if="data.length === 0 && !loading" class="flex flex-col items-center justify-center py-12 text-center">
      <i class="pi pi-table text-3xl text-surface-300 mb-2"></i>
      <p class="text-sm text-surface-500">{{ dimension ? 'No breakdown data available' : 'Select a dimension above' }}</p>
    </div>

    <!-- Table -->
    <template v-else>
      <!-- Search -->
      <div v-if="data.length > 10" class="px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2">
        <div class="relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="w-full sm:max-w-xs pl-8 pr-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400"
          />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs sm:text-sm">
          <thead>
            <tr class="border-b border-surface-200 dark:border-surface-700">
              <th class="text-left px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200" @click="toggleSort('label')">
                Name <i :class="[sortIcon('label'), 'text-[10px] ml-1']"></i>
              </th>
              <th class="text-right px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200" @click="toggleSort('current')">
                Current <i :class="[sortIcon('current'), 'text-[10px] ml-1']"></i>
              </th>
              <th class="text-right px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200" @click="toggleSort('previous')">
                Prev <i :class="[sortIcon('previous'), 'text-[10px] ml-1']"></i>
              </th>
              <th class="text-right px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200 hidden sm:table-cell" @click="toggleSort('variance')">
                Change <i :class="[sortIcon('variance'), 'text-[10px] ml-1']"></i>
              </th>
              <th class="text-right px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200" @click="toggleSort('variancePct')">
                Chg% <i :class="[sortIcon('variancePct'), 'text-[10px] ml-1']"></i>
              </th>
              <th class="text-right px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold text-surface-500 dark:text-surface-400 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer hover:text-surface-700 dark:hover:text-surface-200 hidden md:table-cell" @click="toggleSort('lastYear')">
                Last Year <i :class="[sortIcon('lastYear'), 'text-[10px] ml-1']"></i>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in paginatedData"
              :key="i"
              class="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-100/50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
              :class="rowHighlight(row)"
              @click="emit('rowClick', row)"
            >
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 font-medium text-surface-800 dark:text-surface-200 max-w-[140px] sm:max-w-[250px] truncate">{{ row.label }}</td>
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 text-right font-semibold text-surface-800 dark:text-surface-100 tabular-nums whitespace-nowrap">{{ formatValue(row.current, dataType) }}</td>
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 text-right text-surface-500 tabular-nums whitespace-nowrap">{{ formatValue(row.previous, dataType) }}</td>
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 text-right tabular-nums hidden sm:table-cell whitespace-nowrap">
                <span
                  :class="{
                    'text-green-600 dark:text-green-400 font-semibold': row.variance > 0,
                    'text-red-600 dark:text-red-400 font-semibold': row.variance < 0,
                    'text-surface-400': !row.variance,
                  }"
                >{{ row.variance > 0 ? '+' : '' }}{{ formatValue(row.variance, dataType) }}</span>
              </td>
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 text-right tabular-nums whitespace-nowrap">
                <span v-if="row.variancePct != null"
                  class="px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold"
                  :class="{
                    'text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-400': row.variancePct > 0,
                    'text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400': row.variancePct < 0,
                    'text-surface-500': row.variancePct === 0,
                  }"
                >{{ row.variancePct > 0 ? '+' : '' }}{{ row.variancePct.toFixed(1) }}%</span>
                <span v-else class="text-surface-400">&mdash;</span>
              </td>
              <td class="px-2.5 sm:px-4 py-2 sm:py-2.5 text-right text-surface-500 tabular-nums hidden md:table-cell whitespace-nowrap">{{ row.lastYear != null ? formatValue(row.lastYear, dataType) : '\u2014' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-t border-surface-200 dark:border-surface-700">
        <span class="text-[10px] sm:text-xs text-surface-500">{{ filteredData.length }} rows</span>
        <div class="flex items-center gap-1">
          <button
            @click="currentPage = Math.max(0, currentPage - 1)"
            :disabled="currentPage === 0"
            class="px-2 py-1 rounded text-xs hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-30 cursor-pointer"
          ><i class="pi pi-chevron-left text-[10px]"></i></button>
          <span class="text-[10px] sm:text-xs text-surface-600 dark:text-surface-300 px-1.5 sm:px-2">{{ currentPage + 1 }} / {{ totalPages }}</span>
          <button
            @click="currentPage = Math.min(totalPages - 1, currentPage + 1)"
            :disabled="currentPage >= totalPages - 1"
            class="px-2 py-1 rounded text-xs hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-30 cursor-pointer"
          ><i class="pi pi-chevron-right text-[10px]"></i></button>
        </div>
      </div>
    </template>
  </div>
</template>
