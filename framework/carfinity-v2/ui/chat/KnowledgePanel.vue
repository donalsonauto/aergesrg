<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useAiStore } from '@/stores/ai';
import { marked } from 'marked';
import TurndownService from 'turndown';

marked.setOptions({ breaks: true, gfm: true });
const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const props = defineProps({
  openDocId: { type: Number, default: null },
});

const emit = defineEmits(['close']);
const aiStore = useAiStore();

const searchQuery = ref('');
const commentText = ref('');
const adminResponseText = ref('');
const respondingToId = ref(null);
const editingContent = ref(false);
const editorRef = ref(null);

// New document form
const creatingNew = ref(false);
const newDocTitle = ref('');
const newDocKpiName = ref('');
const newDocType = ref('troubleshooting');
const newDocEditorRef = ref(null);
const savingNew = ref(false);

onMounted(() => {
  aiStore.fetchKnowledgeDocs();
});

// When openDocId prop changes, load that doc
watch(() => props.openDocId, (id) => {
  if (id) {
    creatingNew.value = false;
    aiStore.loadKnowledgeDoc(id);
  }
}, { immediate: true });

const filteredDocs = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return aiStore.knowledgeDocs;
  return aiStore.knowledgeDocs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    (d.kpiName && d.kpiName.toLowerCase().includes(q))
  );
});

const doc = computed(() => aiStore.activeKnowledgeDoc);

function renderDocContent(content) {
  if (!content) return '';
  return marked.parse(content);
}

function selectDoc(id) {
  creatingNew.value = false;
  aiStore.loadKnowledgeDoc(id);
}

function backToList() {
  aiStore.activeKnowledgeDoc = null;
  editingContent.value = false;
  commentText.value = '';
  creatingNew.value = false;
}

async function submitComment() {
  if (!commentText.value.trim() || !doc.value) return;
  await aiStore.addKnowledgeComment(doc.value.id, commentText.value.trim());
  commentText.value = '';
  aiStore.fetchKnowledgeDocs();
}

function startEditContent() {
  editingContent.value = true;
  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = renderDocContent(doc.value.content);
    }
  });
}

function execCmd(cmd, value = null) {
  document.execCommand(cmd, false, value);
  editorRef.value?.focus();
}

async function saveContent() {
  if (!doc.value || !editorRef.value) return;
  const html = editorRef.value.innerHTML;
  const markdown = turndown.turndown(html);
  await aiStore.updateKnowledgeDoc(doc.value.id, { content: markdown });
  editingContent.value = false;
  await aiStore.loadKnowledgeDoc(doc.value.id);
}

function startRespond(commentId) {
  respondingToId.value = commentId;
  adminResponseText.value = '';
}

async function approveComment(commentId) {
  await aiStore.approveKnowledgeComment(doc.value.id, commentId, adminResponseText.value || null);
  respondingToId.value = null;
  adminResponseText.value = '';
  aiStore.fetchKnowledgeDocs();
}

async function rejectComment(commentId) {
  await aiStore.rejectKnowledgeComment(doc.value.id, commentId, adminResponseText.value || null);
  respondingToId.value = null;
  adminResponseText.value = '';
}

async function removeComment(commentId) {
  await aiStore.deleteKnowledgeComment(doc.value.id, commentId);
  aiStore.fetchKnowledgeDocs();
}

// New document
function startNewDoc() {
  creatingNew.value = true;
  newDocTitle.value = '';
  newDocKpiName.value = '';
  newDocType.value = 'troubleshooting';
  aiStore.activeKnowledgeDoc = null;
  nextTick(() => {
    if (newDocEditorRef.value) {
      newDocEditorRef.value.innerHTML = '<p>Start writing your document here...</p>';
      newDocEditorRef.value.focus();
      // Select the placeholder text
      const range = document.createRange();
      range.selectNodeContents(newDocEditorRef.value);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}

async function saveNewDoc() {
  if (!newDocTitle.value.trim() || !newDocEditorRef.value) return;
  savingNew.value = true;
  try {
    const html = newDocEditorRef.value.innerHTML;
    const markdown = turndown.turndown(html);
    if (!markdown.trim()) return;
    await aiStore.createKnowledgeDoc({
      title: newDocTitle.value.trim(),
      content: markdown,
      kpiName: newDocKpiName.value.trim() || null,
      type: newDocType.value,
    });
    creatingNew.value = false;
    aiStore.fetchKnowledgeDocs();
  } finally {
    savingNew.value = false;
  }
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};
</script>

<template>
  <div class="flex flex-col h-full bg-surface-0 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700/50">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
      <div class="flex items-center gap-2">
        <button v-if="doc || creatingNew" @click="backToList" class="w-6 h-6 rounded flex items-center justify-center text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors cursor-pointer">
          <i class="pi pi-arrow-left text-xs"></i>
        </button>
        <i class="pi pi-book text-primary-500 text-sm"></i>
        <span class="text-sm font-semibold text-surface-800 dark:text-surface-100">
          {{ creatingNew ? 'New Document' : doc ? 'Document' : 'Knowledge Base' }}
        </span>
        <span v-if="!doc && !creatingNew" class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 font-medium">
          {{ aiStore.knowledgeDocs.length }}
        </span>
      </div>
      <button
        @click="emit('close')"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
      >
        <i class="pi pi-times text-xs"></i>
      </button>
    </div>

    <!-- New document form -->
    <template v-if="creatingNew">
      <div class="flex-1 overflow-y-auto knowledge-scroll">
        <div class="px-4 py-3 space-y-3">
          <!-- Title -->
          <div>
            <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-1 block">Title</label>
            <input
              v-model="newDocTitle"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Document title..."
            />
          </div>

          <!-- KPI Name (optional) -->
          <div>
            <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-1 block">KPI Name <span class="font-normal">(optional)</span></label>
            <input
              v-model="newDocKpiName"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Total Sales, Closing Ratio..."
            />
          </div>

          <!-- Type -->
          <div>
            <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-1 block">Type</label>
            <div class="flex gap-2">
              <button
                @click="newDocType = 'troubleshooting'"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                :class="newDocType === 'troubleshooting'
                  ? 'bg-orange-500 text-white'
                  : 'border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'"
              >
                Troubleshooting
              </button>
              <button
                @click="newDocType = 'best-practice'"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                :class="newDocType === 'best-practice'
                  ? 'bg-blue-500 text-white'
                  : 'border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'"
              >
                Best Practice
              </button>
            </div>
          </div>

          <!-- Content editor -->
          <div>
            <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-1 block">Content</label>
            <!-- Toolbar -->
            <div class="flex items-center gap-0.5 px-1 py-1 rounded-t-lg border border-b-0 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
              <button @click="execCmd('bold')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Bold (Ctrl+B)">
                <i class="pi pi-bold text-[11px]"></i>
              </button>
              <button @click="execCmd('italic')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Italic (Ctrl+I)">
                <i class="pi pi-italic text-[11px]"></i>
              </button>
              <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-0.5"></div>
              <button @click="execCmd('formatBlock', 'h2')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer text-[11px] font-bold" title="Heading 2">
                H2
              </button>
              <button @click="execCmd('formatBlock', 'h3')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer text-[10px] font-bold" title="Heading 3">
                H3
              </button>
              <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-0.5"></div>
              <button @click="execCmd('insertUnorderedList')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Bullet list">
                <i class="pi pi-list text-[11px]"></i>
              </button>
              <button @click="execCmd('insertOrderedList')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Numbered list">
                <i class="pi pi-sort-numeric-up text-[11px]"></i>
              </button>
            </div>
            <div
              ref="newDocEditorRef"
              contenteditable="true"
              class="w-full min-h-[200px] px-3 py-2 rounded-b-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed overflow-y-auto max-h-[400px] knowledge-editor"
            ></div>
          </div>

          <!-- Save / Cancel -->
          <div class="flex gap-2 pt-1">
            <button
              @click="saveNewDoc"
              :disabled="!newDocTitle.trim() || savingNew"
              class="px-4 py-2 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {{ savingNew ? 'Creating...' : 'Create Document' }}
            </button>
            <button
              @click="creatingNew = false"
              class="px-4 py-2 rounded-lg text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Document list view -->
    <template v-else-if="!doc">
      <!-- Search + New button -->
      <div class="shrink-0 px-4 py-2 border-b border-surface-200 dark:border-surface-700/50 flex gap-2">
        <div class="relative flex-1">
          <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search documents..."
          />
        </div>
        <button
          @click="startNewDoc"
          class="shrink-0 w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors cursor-pointer"
          title="New Document"
        >
          <i class="pi pi-plus text-xs"></i>
        </button>
      </div>

      <!-- Doc list -->
      <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1 knowledge-scroll">
        <div v-if="!filteredDocs.length" class="text-center py-8">
          <i class="pi pi-book text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
          <p class="text-sm text-surface-400 dark:text-surface-500">No documents found</p>
        </div>

        <div
          v-for="d in filteredDocs"
          :key="d.id"
          @click="selectDoc(d.id)"
          class="group p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-surface-800 dark:text-surface-200 leading-snug">{{ d.title }}</div>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span v-if="d.kpiName" class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium">
                  {{ d.kpiName }}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="d.type === 'troubleshooting' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'">
                  {{ d.type }}
                </span>
                <span v-if="d.pendingComments" class="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                  {{ d.pendingComments }} pending
                </span>
              </div>
            </div>
            <i class="pi pi-chevron-right text-[10px] text-surface-400 mt-1"></i>
          </div>
        </div>
      </div>
    </template>

    <!-- Document detail view -->
    <template v-else>
      <div class="flex-1 overflow-y-auto knowledge-scroll">
        <!-- Title + metadata -->
        <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
          <h3 class="text-sm font-semibold text-surface-800 dark:text-surface-100 leading-snug">{{ doc.title }}</h3>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            <span v-if="doc.kpiName" class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium">
              {{ doc.kpiName }}
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :class="doc.type === 'troubleshooting' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'">
              {{ doc.type }}
            </span>
          </div>
        </div>

        <!-- Content -->
        <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-700/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Content</span>
            <button
              v-if="!editingContent"
              @click="startEditContent"
              class="text-[10px] px-2 py-1 rounded-md text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer font-medium"
            >
              Edit
            </button>
          </div>
          <!-- View mode (rendered markdown) -->
          <div
            v-if="!editingContent"
            class="knowledge-doc-view text-xs text-surface-600 dark:text-surface-300 leading-relaxed max-h-[400px] overflow-y-auto knowledge-content-scroll"
            v-html="renderDocContent(doc.content)"
          ></div>
          <!-- Edit mode (contenteditable WYSIWYG) -->
          <div v-else class="space-y-2">
            <!-- Toolbar -->
            <div class="flex items-center gap-0.5 px-1 py-1 rounded-t-lg border border-b-0 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
              <button @click="execCmd('bold')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Bold (Ctrl+B)">
                <i class="pi pi-bold text-[11px]"></i>
              </button>
              <button @click="execCmd('italic')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Italic (Ctrl+I)">
                <i class="pi pi-italic text-[11px]"></i>
              </button>
              <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-0.5"></div>
              <button @click="execCmd('formatBlock', 'h2')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer text-[11px] font-bold" title="Heading 2">
                H2
              </button>
              <button @click="execCmd('formatBlock', 'h3')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer text-[10px] font-bold" title="Heading 3">
                H3
              </button>
              <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-0.5"></div>
              <button @click="execCmd('insertUnorderedList')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Bullet list">
                <i class="pi pi-list text-[11px]"></i>
              </button>
              <button @click="execCmd('insertOrderedList')" class="w-7 h-7 rounded flex items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer" title="Numbered list">
                <i class="pi pi-sort-numeric-up text-[11px]"></i>
              </button>
            </div>
            <div
              ref="editorRef"
              contenteditable="true"
              class="w-full min-h-[200px] px-3 py-2 rounded-b-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed overflow-y-auto max-h-[400px] knowledge-editor"
            ></div>
            <div class="flex gap-2">
              <button
                @click="saveContent"
                class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
              <button
                @click="editingContent = false"
                class="px-3 py-1.5 rounded-lg text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Comments / Suggestions section -->
        <div class="px-4 py-3">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">
              Comments ({{ doc.comments?.length || 0 }})
            </span>
          </div>

          <!-- Add comment form -->
          <div class="mb-3 space-y-2">
            <textarea
              v-model="commentText"
              rows="2"
              class="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-xs text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Suggest an edit or add a note..."
              @keydown.enter.ctrl="submitComment"
            ></textarea>
            <button
              @click="submitComment"
              :disabled="!commentText.trim()"
              class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Add Comment
            </button>
          </div>

          <!-- Comment list -->
          <div class="space-y-2">
            <div
              v-for="c in (doc.comments || [])"
              :key="c.id"
              class="p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50"
            >
              <div class="flex items-start justify-between gap-2 mb-1">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="STATUS_COLORS[c.status] || STATUS_COLORS.pending"
                >
                  {{ c.status }}
                </span>
                <div class="flex items-center gap-0.5">
                  <button
                    v-if="c.status === 'pending'"
                    @click="startRespond(c.id)"
                    class="w-5 h-5 rounded flex items-center justify-center text-surface-400 hover:text-primary-500 transition-colors cursor-pointer"
                    title="Respond"
                  >
                    <i class="pi pi-reply text-[10px]"></i>
                  </button>
                  <button
                    @click="removeComment(c.id)"
                    class="w-5 h-5 rounded flex items-center justify-center text-surface-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <i class="pi pi-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
              <p class="text-xs text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">{{ c.content }}</p>
              <p class="text-[10px] text-surface-400 mt-1">{{ new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>

              <!-- Admin response -->
              <div v-if="c.admin_response" class="mt-2 pl-3 border-l-2 border-primary-400">
                <p class="text-[10px] font-semibold text-surface-500 mb-0.5">Response:</p>
                <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{{ c.admin_response }}</p>
              </div>

              <!-- Respond form -->
              <div v-if="respondingToId === c.id" class="mt-2 space-y-2">
                <textarea
                  v-model="adminResponseText"
                  rows="2"
                  class="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-xs text-surface-800 dark:text-surface-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional response..."
                ></textarea>
                <div class="flex gap-1.5">
                  <button
                    @click="approveComment(c.id)"
                    class="px-2.5 py-1 rounded-md bg-green-500 text-white text-[10px] font-medium hover:bg-green-600 transition-colors cursor-pointer"
                  >
                    Approve & Update Doc
                  </button>
                  <button
                    @click="rejectComment(c.id)"
                    class="px-2.5 py-1 rounded-md bg-red-500 text-white text-[10px] font-medium hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    @click="respondingToId = null"
                    class="px-2.5 py-1 rounded-md text-[10px] text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.knowledge-scroll::-webkit-scrollbar,
.knowledge-content-scroll::-webkit-scrollbar {
  width: 4px;
}
.knowledge-scroll::-webkit-scrollbar-track,
.knowledge-content-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.knowledge-scroll::-webkit-scrollbar-thumb,
.knowledge-content-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
.app-dark .knowledge-scroll::-webkit-scrollbar-thumb,
.app-dark .knowledge-content-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
</style>

<style>
/* Rendered markdown in knowledge doc view */
.knowledge-doc-view h1,
.knowledge-doc-view h2,
.knowledge-doc-view h3 {
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.375rem;
  line-height: 1.4;
}
.knowledge-doc-view h1 { font-size: 1rem; }
.knowledge-doc-view h2 { font-size: 0.9375rem; }
.knowledge-doc-view h3 { font-size: 0.8125rem; }
.knowledge-doc-view h1:first-child,
.knowledge-doc-view h2:first-child,
.knowledge-doc-view h3:first-child {
  margin-top: 0;
}
.knowledge-doc-view p {
  margin: 0.375rem 0;
}
.knowledge-doc-view p:first-child { margin-top: 0; }
.knowledge-doc-view p:last-child { margin-bottom: 0; }
.knowledge-doc-view ul, .knowledge-doc-view ol {
  margin: 0.375rem 0;
  padding-left: 1.25rem;
}
.knowledge-doc-view li {
  margin: 0.2rem 0;
}
.knowledge-doc-view strong {
  font-weight: 600;
}
.knowledge-doc-view em {
  font-style: italic;
}
.knowledge-doc-view code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  font-size: 0.75rem;
}
.app-dark .knowledge-doc-view code {
  background: rgba(255, 255, 255, 0.1);
}
.knowledge-doc-view blockquote {
  border-left: 3px solid var(--p-primary-500);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: var(--p-surface-500);
}
.knowledge-doc-view table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.75rem;
}
.knowledge-doc-view th, .knowledge-doc-view td {
  padding: 0.375rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.app-dark .knowledge-doc-view th,
.app-dark .knowledge-doc-view td {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.knowledge-doc-view th {
  font-weight: 600;
}

/* Contenteditable editor styling */
.knowledge-editor h1, .knowledge-editor h2, .knowledge-editor h3 {
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}
.knowledge-editor h2 { font-size: 0.9375rem; }
.knowledge-editor h3 { font-size: 0.8125rem; }
.knowledge-editor p { margin: 0.25rem 0; }
.knowledge-editor ul, .knowledge-editor ol {
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.knowledge-editor li { margin: 0.15rem 0; }
.knowledge-editor strong { font-weight: 600; }
.knowledge-editor em { font-style: italic; }
</style>
