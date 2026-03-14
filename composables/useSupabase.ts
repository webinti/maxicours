import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

export const useSupabase = () => {
  if (!_client) {
    const config = useRuntimeConfig()
    _client = createClient(
      config.public.supabaseUrl as string,
      config.public.supabaseKey as string
    )
  }
  return _client
}

export interface Session {
  id: string
  eleve_nom: string
  eleve_prenom: string
  date: string
  heure_debut: string
  heure_fin: string
  duree_secondes: number
  notes: string | null
  created_at: string
}
