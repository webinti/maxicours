export interface Session {
  id: string
  eleve_prenom: string
  date: string
  heure_debut: string
  heure_fin: string
  duree_secondes: number
  notes: string | null
  created_at: string
}

export interface NewSession {
  eleve_prenom: string
  date: string
  heure_debut: string
  heure_fin: string
  notes: string | null
}

const STORAGE_KEY = 'eleve-tracker:sessions'

const parseTime = (t: string) => {
  const p = t.split(':').map(Number)
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0)
}

const readAll = (): Session[] => {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeAll = (data: Session[]) => {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

export const useSessionsStore = () => {
  const list = (): Session[] => {
    return readAll().sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.heure_debut.localeCompare(a.heure_debut)
    )
  }

  const add = (input: NewSession): Session => {
    const duree = parseTime(input.heure_fin) - parseTime(input.heure_debut)
    const session: Session = {
      id: uid(),
      eleve_prenom: input.eleve_prenom,
      date: input.date,
      heure_debut: input.heure_debut,
      heure_fin: input.heure_fin,
      duree_secondes: duree > 0 ? duree : 0,
      notes: input.notes,
      created_at: new Date().toISOString(),
    }
    const all = readAll()
    all.push(session)
    writeAll(all)
    return session
  }

  const update = (id: string, input: NewSession): Session => {
    const all = readAll()
    const idx = all.findIndex(s => s.id === id)
    if (idx === -1) throw new Error('Session introuvable')
    const duree = parseTime(input.heure_fin) - parseTime(input.heure_debut)
    const updated: Session = {
      ...all[idx],
      ...input,
      duree_secondes: duree > 0 ? duree : 0,
    }
    all[idx] = updated
    writeAll(all)
    return updated
  }

  const remove = (id: string) => {
    writeAll(readAll().filter(s => s.id !== id))
  }

  const clear = () => writeAll([])

  const exportJson = (): string => JSON.stringify(readAll(), null, 2)

  const importJson = (
    raw: string,
    mode: 'replace' | 'merge' = 'merge'
  ): { added: number; total: number } => {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Format invalide : tableau attendu')

    const required = ['eleve_prenom', 'date', 'heure_debut', 'heure_fin']
    const normalized: Session[] = parsed.map((s: any, i: number) => {
      for (const k of required) {
        if (typeof s?.[k] !== 'string') {
          throw new Error(`Entrée ${i} : champ "${k}" manquant ou invalide`)
        }
      }
      const duree =
        typeof s.duree_secondes === 'number'
          ? s.duree_secondes
          : Math.max(0, parseTime(s.heure_fin) - parseTime(s.heure_debut))
      return {
        id: typeof s.id === 'string' ? s.id : uid(),
        eleve_prenom: s.eleve_prenom,
        date: s.date,
        heure_debut: s.heure_debut,
        heure_fin: s.heure_fin,
        duree_secondes: duree,
        notes: typeof s.notes === 'string' ? s.notes : null,
        created_at: typeof s.created_at === 'string' ? s.created_at : new Date().toISOString(),
      }
    })

    if (mode === 'replace') {
      writeAll(normalized)
      return { added: normalized.length, total: normalized.length }
    }

    const existing = readAll()
    const ids = new Set(existing.map(s => s.id))
    const toAdd = normalized.filter(s => !ids.has(s.id))
    const merged = existing.concat(toAdd)
    writeAll(merged)
    return { added: toAdd.length, total: merged.length }
  }

  return { list, add, update, remove, clear, exportJson, importJson }
}
