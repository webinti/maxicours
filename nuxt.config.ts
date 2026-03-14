export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    },
  },
  compatibilityDate: '2025-01-01',
})
