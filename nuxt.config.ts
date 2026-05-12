export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-01-01',
})
