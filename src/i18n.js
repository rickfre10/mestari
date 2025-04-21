// src/i18n.js - Configuração inicial para carregamento assíncrono

import { createI18n } from 'vue-i18n';

// Função para obter o idioma inicial (lê do localStorage ou default 'pt')
function getInitialLocale() {
    const savedLocale = localStorage.getItem('mestariLocale');
    const availableLocales = ['pt', 'en']; // Idiomas suportados
    if (savedLocale && availableLocales.includes(savedLocale)) {
        console.log(`[i18n] Idioma inicial pego do localStorage: ${savedLocale}`);
        return savedLocale;
    }
    console.log("[i18n] Nenhum idioma salvo/detectado, usando 'pt' como padrão.");
    return 'pt'; // Define 'pt' como padrão
}

// Cria a instância i18n
const i18n = createI18n({
  legacy: false, // Essencial para Vue 3 Composition API
  locale: getInitialLocale(), // Define o locale ativo inicial
  fallbackLocale: 'en', // Idioma de fallback
  // NÃO passamos 'messages' aqui - serão carregadas depois com fetch
  silentTranslationWarn: true, // Suprime avisos de chave não encontrada (útil na inicialização)
  silentFallbackWarn: true,    // Suprime avisos de fallback
});

// Exporta a instância para ser usada no main.js
export default i18n;