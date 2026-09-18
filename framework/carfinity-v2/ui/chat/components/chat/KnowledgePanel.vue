<!-- Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help. -->
<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { marked } from 'marked'
import AiAPI from '../../api/AiAPI'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  openDocId: { type: Number, default: null },
})

const emit = defineEmits(['close'])

const docs = ref([])
const activeDoc = ref(null)
const search = ref('')
const activeCategory = ref('all')
const commentText = ref('')
const loading = ref(true)
const submittingComment = ref(false)
const showRevisions = ref(false)

// Editing
const editingContent = ref(false)
const editorRef = ref(null)

// New document
const creatingNew = ref(false)
const newDocTitle = ref('')
const newDocCategory = ref('General')
const newDocKpiName = ref('')
const newDocEditorRef = ref(null)
const savingNew = ref(false)

// Comment management
const respondingToId = ref(null)
const adminResponseText = ref('')

// AI generation
const aiPrompt = ref('')
const generating = ref(false)

async function generateWithAI() {
  if (!aiPrompt.value.trim()) return
  generating.value = true
  try {
    const result = await AiAPI.generateKnowledgeDoc(aiPrompt.value.trim(), newDocTitle.value.trim())
    if (result.content && newDocEditorRef.value) {
      newDocEditorRef.value.innerHTML = renderContent(result.content)
    }
  } catch (err) {
    console.error('Generate error:', err)
  }
  generating.value = false
}

const categories = computed(() => {
  const cats = new Set(docs.value.map(d => d.category || 'General'))
  return ['all', ...cats]
})

const filtered = computed(() => {
  let list = docs.value
  if (activeCategory.value !== 'all') {
    list = list.filter(d => (d.category || 'General') === activeCategory.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.content || '').toLowerCase().includes(q)
    )
  }
  return list
})

onMounted(async () => {
  try { docs.value = await AiAPI.getKnowledgeDocs() } catch { docs.value = [] }
  loading.value = false
})

watch(() => props.openDocId, async (id) => {
  if (id) {
    creatingNew.value = false
    await openDoc(id)
  }
}, { immediate: true })

async function openDoc(id) {
  try { activeDoc.value = await AiAPI.getKnowledgeDoc(id) } catch { /* ignore */ }
}

function backToList() {
  activeDoc.value = null
  editingContent.value = false
  commentText.value = ''
  creatingNew.value = false
  respondingToId.value = null
  showRevisions.value = false
}

function renderContent(content) {
  if (!content) return ''
  return marked.parse(content)
}

// WYSIWYG helpers
function execCmd(cmd, value = null) {
  document.execCommand(cmd, false, value)
}

// Content editing
function startEditContent() {
  editingContent.value = true
  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = renderContent(activeDoc.value.content)
      editorRef.value.focus()
    }
  })
}

async function saveContent() {
  if (!activeDoc.value || !editorRef.value) return
  const html = editorRef.value.innerHTML
  // Simple HTML to markdown-ish conversion (preserve as HTML for now, marked can handle it)
  await AiAPI.updateKnowledgeDoc(activeDoc.value.id, { content: html })
  editingContent.value = false
  await openDoc(activeDoc.value.id)
  // Refresh list
  try { docs.value = await AiAPI.getKnowledgeDocs() } catch {}
}

// New document
function startNewDoc() {
  creatingNew.value = true
  newDocTitle.value = ''
  newDocCategory.value = 'General'
  newDocKpiName.value = ''
  activeDoc.value = null
  nextTick(() => {
    if (newDocEditorRef.value) {
      newDocEditorRef.value.innerHTML = '<p>Start writing...</p>'
      newDocEditorRef.value.focus()
      const range = document.createRange()
      range.selectNodeContents(newDocEditorRef.value)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  })
}

async function saveNewDoc() {
  if (!newDocTitle.value.trim() || !newDocEditorRef.value) return
  savingNew.value = true
  try {
    const content = newDocEditorRef.value.innerHTML
    if (!content.trim() || content === '<p><br></p>') return
    await AiAPI.createKnowledgeDoc({
      title: newDocTitle.value.trim(),
      content,
      category: newDocCategory.value.trim() || 'General',
      kpi_name: newDocKpiName.value.trim() || null,
    })
    creatingNew.value = false
    docs.value = await AiAPI.getKnowledgeDocs()
  } finally {
    savingNew.value = false
  }
}

async function deleteDoc() {
  if (!activeDoc.value) return
  if (!confirm('Delete this document?')) return
  await AiAPI.deleteKnowledgeDoc(activeDoc.value.id)
  activeDoc.value = null
  docs.value = await AiAPI.getKnowledgeDocs()
}

// Comments
async function submitComment() {
  if (!commentText.value.trim() || !activeDoc.value || submittingComment.value) return
  submittingComment.value = true
  try {
    await AiAPI.addKnowledgeComment(activeDoc.value.id, commentText.value.trim())
    commentText.value = ''
    await openDoc(activeDoc.value.id)
  } catch { /* ignore */ }
  submittingComment.value = false
}

function startRespond(commentId) {
  respondingToId.value = commentId
  adminResponseText.value = ''
}

async function approveComment(commentId) {
  await AiAPI.updateKnowledgeComment(activeDoc.value.id, commentId, {
    status: 'approved',
    adminResponse: adminResponseText.value || null
  })
  respondingToId.value = null
  adminResponseText.value = ''
  await openDoc(activeDoc.value.id)
  docs.value = await AiAPI.getKnowledgeDocs()
}

async function rejectComment(commentId) {
  await AiAPI.updateKnowledgeComment(activeDoc.value.id, commentId, {
    status: 'rejected',
    adminResponse: adminResponseText.value || null
  })
  respondingToId.value = null
  adminResponseText.value = ''
  await openDoc(activeDoc.value.id)
}

async function removeComment(commentId) {
  await AiAPI.deleteKnowledgeComment(activeDoc.value.id, commentId)
  await openDoc(activeDoc.value.id)
  docs.value = await AiAPI.getKnowledgeDocs()
}

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}
</script>

<template>
  <div class="flex flex-col h-full bg-brand-dark border-l border-white/10">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <button
          v-if="activeDoc || creatingNew"
          @click="backToList"
          class="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <svg class="w-4 h-4 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span class="text-sm font-semibold text-white">
          {{ creatingNew ? 'New Document' : activeDoc ? 'Document' : 'Knowledge Base' }}
        </span>
        <span v-if="!activeDoc && !creatingNew" class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">
          {{ docs.length }}
        </span>
      </div>
      <button
        @click="emit('close')"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- New document form -->
    <template v-if="creatingNew">
      <div class="flex-1 overflow-y-auto kb-scroll">
        <div class="px-4 py-3 space-y-3">
          <div>
            <label class="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">Title</label>
            <input
              v-model="newDocTitle"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
              placeholder="Document title..."
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">Category</label>
            <input
              v-model="newDocCategory"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
              placeholder="e.g. GA4 Metrics, ASC Events..."
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">KPI Name <span class="font-normal opacity-50">(optional)</span></label>
            <input
              v-model="newDocKpiName"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
              placeholder="e.g. Sessions, Bounce Rate..."
            />
          </div>
          <!-- AI Generation -->
          <div>
            <label class="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">AI Generate</label>
            <div class="space-y-2">
              <textarea
                v-model="aiPrompt"
                rows="3"
                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-brand-purple transition-colors"
                placeholder="Describe what you want documented... e.g. 'Write about asc_form_submission event, what it tracks, common issues, and how to troubleshoot missing form submissions'"
              ></textarea>
              <button
                @click="generateWithAI"
                :disabled="!aiPrompt.trim() || generating"
                class="px-4 py-2 rounded-lg bg-sick-gradient text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:shadow-brand-glow transition-shadow flex items-center gap-2"
              >
                <svg v-if="generating" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {{ generating ? 'Generating...' : 'Generate with AI' }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">Content</label>
            <!-- Toolbar -->
            <div class="flex items-center gap-0.5 px-2 py-1.5 rounded-t-lg border border-b-0 border-white/10 bg-white/5">
              <button @click="execCmd('bold')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold" title="Bold">B</button>
              <button @click="execCmd('italic')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs italic" title="Italic">I</button>
              <div class="w-px h-4 bg-white/10 mx-0.5"></div>
              <button @click="execCmd('formatBlock', 'h2')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[11px] font-bold" title="Heading 2">H2</button>
              <button @click="execCmd('formatBlock', 'h3')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-bold" title="Heading 3">H3</button>
              <div class="w-px h-4 bg-white/10 mx-0.5"></div>
              <button @click="execCmd('insertUnorderedList')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Bullet list">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <button @click="execCmd('insertOrderedList')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Numbered list">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
            </div>
            <div
              ref="newDocEditorRef"
              contenteditable="true"
              class="w-full min-h-[200px] max-h-[400px] px-3 py-2 rounded-b-lg border border-white/10 bg-white/5 text-xs text-white/80 focus:outline-none focus:border-brand-purple leading-relaxed overflow-y-auto kb-editor"
            ></div>
          </div>
          <div class="flex gap-2 pt-1">
            <button
              @click="saveNewDoc"
              :disabled="!newDocTitle.trim() || savingNew"
              class="px-4 py-2 rounded-lg bg-sick-gradient text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:shadow-brand-glow transition-shadow"
            >{{ savingNew ? 'Creating...' : 'Create Document' }}</button>
            <button
              @click="creatingNew = false"
              class="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >Cancel</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Document list view -->
    <template v-else-if="!activeDoc">
      <!-- Search + New button -->
      <div class="shrink-0 px-4 py-3 border-b border-white/10 flex gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search documents..."
            class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-purple transition-colors"
          />
        </div>
        <button
          @click="startNewDoc"
          class="shrink-0 w-9 h-9 rounded-lg bg-sick-gradient text-white flex items-center justify-center hover:shadow-brand-glow transition-shadow cursor-pointer"
          title="New Document"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- Category pills -->
      <div class="shrink-0 px-4 py-2 border-b border-white/10">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in categories"
            :key="cat"
            @click="activeCategory = cat"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
            :class="activeCategory === cat
              ? 'bg-brand-purple text-white'
              : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'"
          >{{ cat === 'all' ? 'All' : cat }}</button>
        </div>
      </div>

      <!-- Doc list -->
      <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1 kb-scroll">
        <div v-if="loading" class="text-center py-12 text-white/30 text-sm">Loading...</div>

        <div
          v-for="doc in filtered"
          :key="doc.id"
          @click="openDoc(doc.id)"
          class="group px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">{{ doc.title }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 font-medium">
                  {{ doc.category || 'General' }}
                </span>
                <span v-if="doc.kpi_name" class="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple font-medium">
                  {{ doc.kpi_name }}
                </span>
              </div>
            </div>
            <svg class="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 mt-0.5 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div v-if="!loading && !filtered.length" class="text-center py-12">
          <svg class="w-8 h-8 text-white/10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p class="text-sm text-white/30">No documents found</p>
        </div>
      </div>
    </template>

    <!-- Document detail view -->
    <template v-else>
      <div class="flex-1 overflow-y-auto kb-scroll">
        <!-- Title + metadata -->
        <div class="px-4 py-4 border-b border-white/10">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-base font-semibold text-white leading-snug">{{ activeDoc.title }}</h3>
            <button
              @click="deleteDoc"
              class="shrink-0 w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete document"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple font-medium">
              {{ activeDoc.category || 'General' }}
            </span>
            <span v-if="activeDoc.kpi_name" class="text-[10px] px-2 py-0.5 rounded-full bg-brand-cyan/20 text-brand-cyan font-medium">
              {{ activeDoc.kpi_name }}
            </span>
            <span v-if="activeDoc.updated_at" class="text-[10px] text-white/30">
              Updated {{ new Date(activeDoc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </span>
          </div>
        </div>

        <!-- Content -->
        <div class="px-4 py-4 border-b border-white/10">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-semibold text-white/50 uppercase tracking-wide">Content</span>
            <button
              v-if="!editingContent"
              @click="startEditContent"
              class="text-[10px] px-2 py-1 rounded-md text-brand-purple hover:bg-brand-purple/10 transition-colors cursor-pointer font-medium"
            >Edit</button>
          </div>

          <!-- View mode -->
          <div
            v-if="!editingContent"
            class="markdown-content text-sm text-white/80 leading-relaxed max-h-[400px] overflow-y-auto kb-scroll"
            v-html="renderContent(activeDoc.content)"
          ></div>

          <!-- Edit mode -->
          <div v-else class="space-y-2">
            <!-- Toolbar -->
            <div class="flex items-center gap-0.5 px-2 py-1.5 rounded-t-lg border border-b-0 border-white/10 bg-white/5">
              <button @click="execCmd('bold')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold" title="Bold">B</button>
              <button @click="execCmd('italic')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs italic" title="Italic">I</button>
              <div class="w-px h-4 bg-white/10 mx-0.5"></div>
              <button @click="execCmd('formatBlock', 'h2')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[11px] font-bold" title="Heading 2">H2</button>
              <button @click="execCmd('formatBlock', 'h3')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-bold" title="Heading 3">H3</button>
              <div class="w-px h-4 bg-white/10 mx-0.5"></div>
              <button @click="execCmd('insertUnorderedList')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Bullet list">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <button @click="execCmd('insertOrderedList')" class="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Numbered list">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
            </div>
            <div
              ref="editorRef"
              contenteditable="true"
              class="w-full min-h-[200px] max-h-[400px] px-3 py-2 rounded-b-lg border border-white/10 bg-white/5 text-xs text-white/80 focus:outline-none focus:border-brand-purple leading-relaxed overflow-y-auto kb-editor"
            ></div>
            <div class="flex gap-2">
              <button
                @click="saveContent"
                class="px-3 py-1.5 rounded-lg bg-sick-gradient text-white text-xs font-medium hover:shadow-brand-glow transition-shadow cursor-pointer"
              >Save Changes</button>
              <button
                @click="editingContent = false"
                class="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >Cancel</button>
            </div>
          </div>
        </div>

        <!-- Comments section -->
        <div class="px-4 py-4">
          <h4 class="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
            Comments ({{ activeDoc.comments?.length || 0 }})
          </h4>

          <!-- Add comment form -->
          <div class="space-y-2 mb-4">
            <textarea
              v-model="commentText"
              rows="3"
              class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-brand-purple transition-colors"
              placeholder="Suggest an edit or add a note..."
              @keydown.ctrl.enter="submitComment"
            ></textarea>
            <button
              @click="submitComment"
              :disabled="!commentText.trim() || submittingComment"
              class="px-4 py-2 rounded-lg bg-sick-gradient text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:shadow-brand-glow transition-shadow"
            >{{ submittingComment ? 'Posting...' : 'Post Comment' }}</button>
          </div>

          <!-- Comment list -->
          <div class="space-y-2">
            <div
              v-for="c in (activeDoc.comments || [])"
              :key="c.id"
              class="bg-white/5 rounded-lg p-3 border border-white/5"
            >
              <div class="flex items-start justify-between gap-2 mb-1">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="STATUS_COLORS[c.status] || STATUS_COLORS.pending"
                >{{ c.status || 'pending' }}</span>
                <div class="flex items-center gap-1">
                  <button
                    v-if="c.status === 'pending'"
                    @click="startRespond(c.id)"
                    class="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-brand-purple transition-colors cursor-pointer"
                    title="Respond"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  </button>
                  <button
                    @click="removeComment(c.id)"
                    class="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <p class="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{{ c.content }}</p>
              <p class="text-[10px] text-white/30 mt-1.5">
                {{ c.user_name || 'User' }} &middot; {{ new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
              </p>

              <!-- Admin response -->
              <div v-if="c.admin_response" class="mt-2 pl-3 border-l-2 border-brand-purple/50">
                <p class="text-[10px] font-semibold text-white/40 mb-0.5">Response:</p>
                <p class="text-xs text-white/60 leading-relaxed">{{ c.admin_response }}</p>
              </div>

              <!-- Respond form -->
              <div v-if="respondingToId === c.id" class="mt-2 space-y-2">
                <textarea
                  v-model="adminResponseText"
                  rows="2"
                  class="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-brand-purple transition-colors"
                  placeholder="Optional response..."
                ></textarea>
                <div class="flex gap-1.5">
                  <button
                    @click="approveComment(c.id)"
                    class="px-2.5 py-1 rounded-md bg-green-500/80 text-white text-[10px] font-medium hover:bg-green-500 transition-colors cursor-pointer"
                  >Approve & Update Doc</button>
                  <button
                    @click="rejectComment(c.id)"
                    class="px-2.5 py-1 rounded-md bg-red-500/80 text-white text-[10px] font-medium hover:bg-red-500 transition-colors cursor-pointer"
                  >Reject</button>
                  <button
                    @click="respondingToId = null"
                    class="px-2.5 py-1 rounded-md text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Revisions -->
        <div class="px-4 py-4 border-t border-white/10">
          <button
            @click="showRevisions = !showRevisions"
            class="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wide cursor-pointer hover:text-white/70 transition-colors"
          >
            <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-90': showRevisions }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            Revision History ({{ activeDoc.revisions?.length || 0 }})
          </button>

          <div v-if="showRevisions && activeDoc.revisions?.length" class="mt-3 space-y-2">
            <div
              v-for="rev in activeDoc.revisions"
              :key="rev.id"
              class="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
            >
              <div class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                :class="{
                  'bg-green-500/20 text-green-400': rev.action === 'created',
                  'bg-blue-500/20 text-blue-400': rev.action === 'edited',
                  'bg-yellow-500/20 text-yellow-400': rev.action === 'comment_added',
                  'bg-green-500/20 text-green-400': rev.action === 'comment_approved',
                  'bg-red-500/20 text-red-400': rev.action === 'comment_rejected',
                }"
              >
                <svg v-if="rev.action === 'created'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                <svg v-else-if="rev.action === 'edited'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-white/70">{{ rev.diff_summary }}</p>
                <p class="text-[10px] text-white/30 mt-0.5">
                  {{ rev.user_name || 'System' }} &middot; {{ new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kb-scroll::-webkit-scrollbar {
  width: 4px;
}
.kb-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.kb-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.kb-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

<style>
/* Editor styling */
.kb-editor h1, .kb-editor h2, .kb-editor h3 {
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  color: rgba(255, 255, 255, 0.9);
}
.kb-editor h2 { font-size: 0.9375rem; }
.kb-editor h3 { font-size: 0.8125rem; }
.kb-editor p { margin: 0.25rem 0; }
.kb-editor ul, .kb-editor ol { padding-left: 1.25rem; margin: 0.25rem 0; }
.kb-editor li { margin: 0.15rem 0; }
.kb-editor strong { font-weight: 600; }
.kb-editor em { font-style: italic; }
</style>
