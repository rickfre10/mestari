// src/i18n.js - VERSÃO SIMPLIFICADA (SEM CARREGAMENTO DINÂMICO)
import { createI18n } from 'vue-i18n';

// Importa AMBOS os idiomas estaticamente de 'src'
import enMessages from './locales/en.json';
import ptMessages from './locales/pt.json';

function getInitialLocale() {
  const savedLocale = localStorage.getItem('mestariLocale');
  const availableLocales = ['pt', 'en'];
  if (savedLocale && availableLocales.includes(savedLocale)) {
    console.log(`[i18n SIMPLIFICADO] Idioma inicial pego do localStorage: ${savedLocale}`);
    return savedLocale;
  }
  console.log("[i18n SIMPLIFICADO] Nenhum idioma salvo/válido detectado, usando 'pt' como padrão.");
  return 'pt';
}

const initialLocale = getInitialLocale();

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    // Pré-carrega AMBOS os idiomas
    en: enMessages,
    pt: ptMessages
  },
  // Manter opções de warning se desejar
  silentTranslationWarn: true,
  silentFallbackWarn: true,
  missingWarn: false,
  fallbackWarn: false
});

// NÃO PRECISAMOS MAIS DE loadLocaleMessages NESTA VERSÃO

export default i18n;