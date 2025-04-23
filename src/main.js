import { createApp } from 'vue'
import App from './App.vue'
import i18n, { loadLocaleMessages } from './i18n'

async function initApp() {
  const locale = i18n.global.locale.value
  await loadLocaleMessages(locale)

  const app = createApp(App)
  app.use(i18n)
  app.mount('#app')
}

initApp()

