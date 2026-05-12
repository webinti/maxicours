<script setup lang="ts">
import type { Session } from '~/composables/useSessionsStore'

// ─── Store local + UI ────────────────────────────────────────────────────────
const store = useSessionsStore()
const toast = useToast()
const colorMode = useColorMode()

// ─── State ───────────────────────────────────────────────────────────────────
const saving = ref(false)
const loading = ref(true)
const sessions = ref<Session[]>([])

const form = reactive({
  prenom: '',
  date: new Date().toISOString().split('T')[0],
  debut: '',
  fin: '',
  notes: '',
})

// ─── Calculs durée ───────────────────────────────────────────────────────────
const parseTime = (t: string) => {
  const p = t.split(':').map(Number)
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0)
}

const dureeSecondes = computed(() => {
  if (!form.debut || !form.fin) return null
  const diff = parseTime(form.fin) - parseTime(form.debut)
  return diff > 0 ? diff : null
})

const formatDuree = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`)
  return parts.join(' ')
}

const dureeFormatee = computed(() => dureeSecondes.value ? formatDuree(dureeSecondes.value) : null)

// ─── Validation ───────────────────────────────────────────────────────────────
const canSave = computed(() =>
  form.prenom.trim() &&
  form.debut &&
  form.fin &&
  dureeSecondes.value !== null
)

// ─── Groupement par semaine ───────────────────────────────────────────────────
const getWeekKey = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay() || 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day + 1)
  return monday.toISOString().split('T')[0]
}

const formatWeekLabel = (weekKey: string) => {
  const monday = new Date(weekKey + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('fr-FR', opts)} – ${sunday.toLocaleDateString('fr-FR', opts)}`
}

const sessionsByWeek = computed(() => {
  const groups: Record<string, { sessions: Session[]; total: number }> = {}
  for (const s of sessions.value) {
    const key = getWeekKey(s.date)
    if (!groups[key]) groups[key] = { sessions: [], total: 0 }
    groups[key].sessions.push(s)
    groups[key].total += s.duree_secondes
  }
  for (const key in groups) {
    groups[key].sessions.sort((a, b) =>
      b.date.localeCompare(a.date) || b.heure_debut.localeCompare(a.heure_debut)
    )
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, val]) => ({ weekKey: key, label: formatWeekLabel(key), ...val }))
})

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = computed(() => ({
  total: sessions.value.reduce((acc, s) => acc + s.duree_secondes, 0),
  eleves: new Set(sessions.value.map(s => s.eleve_prenom)).size,
  sessions: sessions.value.length,
}))

// ─── Initiales avatar ─────────────────────────────────────────────────────────
const initiales = (prenom: string) =>
  `${prenom[0] || ''}${prenom[1] || ''}`.toUpperCase()

// ─── CRUD ─────────────────────────────────────────────────────────────────────
const fetchSessions = () => {
  loading.value = true
  try {
    sessions.value = store.list()
  } catch (e: any) {
    toast.add({ title: 'Erreur chargement', description: e?.message, color: 'error' })
  }
  loading.value = false
}

const saveSession = () => {
  if (!canSave.value) {
    toast.add({ title: 'Formulaire incomplet', color: 'warning' })
    return
  }
  saving.value = true
  try {
    store.add({
      eleve_prenom: form.prenom.trim(),
      date: form.date,
      heure_debut: form.debut,
      heure_fin: form.fin,
      notes: form.notes.trim() || null,
    })
    toast.add({ title: 'Session enregistrée', icon: 'i-heroicons-check-circle', color: 'success' })
    resetForm()
    fetchSessions()
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.message, color: 'error' })
  }
  saving.value = false
}

const deleteSession = (id: string) => {
  try {
    store.remove(id)
    sessions.value = sessions.value.filter(s => s.id !== id)
    toast.add({ title: 'Session supprimée', color: 'neutral' })
  } catch {
    toast.add({ title: 'Erreur suppression', color: 'error' })
  }
}

const resetForm = () => {
  form.prenom = ''
  form.date = new Date().toISOString().split('T')[0]
  form.debut = ''
  form.fin = ''
  form.notes = ''
}

// ─── Export / Import ──────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)

const exportSessions = () => {
  if (!sessions.value.length) {
    toast.add({ title: 'Rien à exporter', color: 'warning' })
    return
  }
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eleve-tracker-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Export téléchargé', icon: 'i-heroicons-arrow-down-tray', color: 'success' })
}

const triggerImport = () => fileInput.value?.click()

const onImportFile = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const { added, total } = store.importJson(text, 'merge')
    fetchSessions()
    toast.add({
      title: 'Import réussi',
      description: `${added} session(s) ajoutée(s) — ${total} au total`,
      icon: 'i-heroicons-arrow-up-tray',
      color: 'success',
    })
  } catch (err: any) {
    toast.add({ title: 'Erreur import', description: err?.message, color: 'error' })
  } finally {
    input.value = ''
  }
}

onMounted(fetchSessions)
</script>

<template>
  <div class="min-h-screen bg-default">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="bg-elevated border-b border-default sticky top-0 z-20 backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <UIcon name="i-heroicons-academic-cap" class="text-white text-sm" />
          </div>
          <span class="font-semibold text-highlighted text-base tracking-tight">Élève Tracker</span>
        </div>

        <UButton
          :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
        />
      </div>
    </header>

    <div class="max-w-4xl mx-auto px-6 py-10 space-y-8">

      <!-- ── Stats ──────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-muted text-xs font-medium uppercase tracking-wider mb-1">Sessions</p>
          <p class="text-highlighted text-3xl font-bold font-mono">{{ stats.sessions }}</p>
        </div>
        <div class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-muted text-xs font-medium uppercase tracking-wider mb-1">Élèves</p>
          <p class="text-highlighted text-3xl font-bold font-mono">{{ stats.eleves }}</p>
        </div>
        <div class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-muted text-xs font-medium uppercase tracking-wider mb-1">Temps total</p>
          <p class="text-primary text-3xl font-bold font-mono">{{ formatDuree(stats.total) }}</p>
        </div>
      </div>

      <!-- ── Formulaire ─────────────────────────────────────────────────────── -->
      <div class="bg-elevated rounded-2xl border border-default overflow-hidden">
        <!-- Titre -->
        <div class="px-6 py-4 border-b border-default flex items-center gap-2">
          <UIcon name="i-heroicons-plus-circle" class="text-primary" />
          <h2 class="text-highlighted font-semibold">Nouvelle session</h2>
        </div>

        <div class="p-6 space-y-5">
          <!-- Élève -->
          <UFormField label="Prénom">
            <UInput v-model="form.prenom" placeholder="Marie" class="w-full" />
          </UFormField>

          <!-- Date -->
          <UFormField label="Date">
            <UInput v-model="form.date" type="date" class="w-full max-w-xs" />
          </UFormField>

          <!-- Heures -->
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Début" hint="HH:MM:SS">
              <UInput
                v-model="form.debut"
                placeholder="14:30:00"
                class="w-full font-mono"
                leading-icon="i-heroicons-play"
              />
            </UFormField>
            <UFormField label="Fin" hint="HH:MM:SS">
              <UInput
                v-model="form.fin"
                placeholder="15:45:00"
                class="w-full font-mono"
                leading-icon="i-heroicons-stop"
              />
            </UFormField>
          </div>

          <!-- Preview durée -->
          <Transition name="slide-down">
            <div
              v-if="dureeSecondes"
              class="rounded-xl bg-primary/10 border border-primary/20 px-5 py-4 flex items-center justify-between"
            >
              <div>
                <p class="text-primary/70 text-[11px] font-semibold uppercase tracking-widest mb-0.5">Durée</p>
                <p class="text-primary text-4xl font-bold font-mono leading-none">{{ dureeFormatee }}</p>
              </div>
              <div class="text-right space-y-0.5">
                <p class="text-muted text-sm font-mono">{{ dureeSecondes.toLocaleString('fr-FR') }} <span class="text-dimmed">sec</span></p>
                <p class="text-muted text-sm font-mono">{{ (dureeSecondes / 60).toFixed(1) }} <span class="text-dimmed">min</span></p>
                <p class="text-muted text-sm font-mono">{{ (dureeSecondes / 3600).toFixed(2) }} <span class="text-dimmed">h</span></p>
              </div>
            </div>
          </Transition>

          <!-- Notes -->
          <UFormField label="Notes" hint="Optionnel">
            <UTextarea
              v-model="form.notes"
              placeholder="Ex: Révision chapitre 3…"
              :rows="2"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Footer formulaire -->
        <div class="px-6 py-4 border-t border-default bg-default/40 flex items-center justify-between">
          <UButton variant="ghost" color="neutral" size="sm" @click="resetForm">
            Réinitialiser
          </UButton>
          <UButton
            :loading="saving"
            :disabled="!canSave"
            leading-icon="i-heroicons-check"
            @click="saveSession"
          >
            Enregistrer
          </UButton>
        </div>
      </div>

      <!-- ── Historique ─────────────────────────────────────────────────────── -->
      <div class="space-y-3">
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-heroicons-calendar-days" class="text-muted" />
          <h2 class="text-highlighted font-semibold">Historique</h2>
          <UBadge v-if="sessions.length" :label="String(sessions.length)" variant="subtle" color="neutral" size="sm" />

          <div class="ml-auto flex items-center gap-1.5">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              leading-icon="i-heroicons-arrow-up-tray"
              @click="triggerImport"
            >
              Importer
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              leading-icon="i-heroicons-arrow-down-tray"
              :disabled="!sessions.length"
              @click="exportSessions"
            >
              Exporter
            </UButton>
            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="hidden"
              @change="onImportFile"
            />
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-16">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-primary text-2xl" />
        </div>

        <!-- Empty -->
        <div v-else-if="!sessions.length" class="bg-elevated rounded-2xl border border-default border-dashed p-16 text-center">
          <UIcon name="i-heroicons-inbox" class="text-dimmed text-4xl mb-3" />
          <p class="text-muted text-sm">Aucune session pour l'instant</p>
        </div>

        <!-- Semaines -->
        <div v-else class="space-y-3">
          <div
            v-for="week in sessionsByWeek"
            :key="week.weekKey"
            class="bg-elevated rounded-2xl border border-default overflow-hidden"
          >
            <!-- En-tête semaine -->
            <div class="px-5 py-3 border-b border-default flex items-center justify-between bg-default/30">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar" class="text-dimmed text-sm" />
                <span class="text-muted text-sm font-medium">{{ week.label }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-dimmed text-xs">Total :</span>
                <span class="text-primary font-bold font-mono text-sm">{{ formatDuree(week.total) }}</span>
                <span class="text-dimmed text-xs font-mono">({{ week.total.toLocaleString('fr-FR') }}s)</span>
              </div>
            </div>

            <!-- Sessions -->
            <div class="divide-y divide-default">
              <div
                v-for="session in week.sessions"
                :key="session.id"
                class="px-5 py-3.5 flex items-center gap-4 group hover:bg-accented/30 transition-colors"
              >
                <!-- Avatar initiales -->
                <div class="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span class="text-primary font-bold text-xs font-mono">
                    {{ initiales(session.eleve_prenom) }}
                  </span>
                </div>

                <!-- Infos -->
                <div class="flex-1 min-w-0">
                  <p class="text-highlighted font-medium text-sm">
                    {{ session.eleve_prenom }}
                  </p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-dimmed text-xs">
                      {{ new Date(session.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }}
                    </span>
                    <span class="text-dimmed text-xs">·</span>
                    <span class="text-muted text-xs font-mono">
                      {{ session.heure_debut.slice(0, 5) }} → {{ session.heure_fin.slice(0, 5) }}
                    </span>
                  </div>
                  <p v-if="session.notes" class="text-dimmed text-xs italic mt-0.5 truncate">{{ session.notes }}</p>
                </div>

                <!-- Durée -->
                <div class="text-right shrink-0">
                  <p class="text-highlighted font-bold font-mono text-sm">{{ formatDuree(session.duree_secondes) }}</p>
                  <p class="text-dimmed text-xs font-mono">{{ session.duree_secondes.toLocaleString('fr-FR') }}s</p>
                </div>

                <!-- Supprimer -->
                <UButton
                  icon="i-heroicons-trash"
                  variant="ghost"
                  color="error"
                  size="xs"
                  class="opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="deleteSession(session.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
