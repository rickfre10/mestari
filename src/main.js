import { createApp } from 'vue'
import App from './App.vue'
// Importa APENAS a instância padrão 'i18n' (não importa mais loadLocaleMessages)
import i18n from './i18n'

// Removemos a necessidade de 'initApp' ser async e de chamar loadLocaleMessages
function initApp() {
  // Não precisamos mais pegar locale ou chamar loadLocaleMessages aqui
  // const locale = i18n.global.locale.value // Removido
  // await loadLocaleMessages(locale)      // Removido

  const app = createApp(App)
  app.use(i18n) // Usa a instância i18n (que já tem PT e EN carregados)
  app.mount('#app')
}

// Chama a função de inicialização (agora síncrona)
initApp()