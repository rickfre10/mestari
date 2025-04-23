// src/i18n.js
import { createI18n } from 'vue-i18n'

function getInitialLocale() {
  const savedLocale = localStorage.getItem('mestariLocale')
  const availableLocales = ['pt', 'en']
  if (savedLocale && availableLocales.includes(savedLocale)) {
    console.log(`[i18n] Idioma inicial pego do localStorage: ${savedLocale}`)
    return savedLocale
  }
  console.log("[i18n] Nenhum idioma salvo/detectado, usando 'pt' como padrão.")
  return 'pt'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {}, // mensagens serão carregadas dinamicamente
  silentTranslationWarn: true,
  silentFallbackWarn: true
})

// 🔁 Carregador de mensagens dinâmico
export async function loadLocaleMessages(locale) {
  const messagesLoaded = i18n.global.getLocaleMessage(locale)
const isEmpty = !messagesLoaded || Object.keys(messagesLoaded).length === 0

if (isEmpty) {
  const messages = await import(`./locales/${locale}.json`)
  i18n.global.setLocaleMessage(locale, messages.default)
}

  
  i18n.global.locale.value = locale
  localStorage.setItem('mestariLocale', locale)
}

export default i18n