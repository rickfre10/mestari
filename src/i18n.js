// src/i18n.js
import { createI18n } from 'vue-i18n';
import enMessages from '/src/locales/en.json'; // <<< IMPORTANTE: Importa estaticamente de /public

// *** Atenção: ***
// Importar diretamente de /public pode não ser ideal ou suportado em todas as versões/configurações do Vite.
// Se a linha acima der erro no build, uma alternativa é:
// 1. Mover en.json de volta para src/locales/en.json
// 2. Importar de lá: import enMessages from './locales/en.json';
// 3. Garantir que viteStaticCopy (ou outra forma) copie src/locales/pt.json para /public/locales/pt.json
// OU manter tudo em /public e usar fetch para 'en' também dentro do createI18n (assíncrono, complica a inicialização).
// Vamos tentar a importação direta de /public primeiro, mas esteja ciente que pode precisar de ajuste.


function getInitialLocale() {
  const savedLocale = localStorage.getItem('mestariLocale');
  const availableLocales = ['pt', 'en'];
  if (savedLocale && availableLocales.includes(savedLocale)) {
    console.log(`[i18n] Idioma inicial pego do localStorage: ${savedLocale}`);
    return savedLocale;
  }
  console.log("[i18n] Nenhum idioma salvo/válido detectado, usando 'pt' como padrão.");
  return 'pt';
}

const initialLocale = getInitialLocale();

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    // <<< PRÉ-CARREGA 'en' DIRETAMENTE AQUI >>>
    en: enMessages
    // pt: {} // pt ainda será carregado dinamicamente
  },
  silentTranslationWarn: true,
  silentFallbackWarn: true,
  missingWarn: false,
  fallbackWarn: false
});

export async function loadLocaleMessages(locale) {
  // Otimização: Não usa fetch se as mensagens já existem (seja pré-carregada ou carregada antes)
  const messagesLoaded = i18n.global.getLocaleMessage(locale);
  const isEmpty = !messagesLoaded || Object.keys(messagesLoaded).length === 0;

  if (isEmpty) {
    console.log(`[i18n] Tentando carregar mensagens para: ${locale} via fetch...`);
    try {
      const response = await fetch(`/locales/${locale}.json`); // Busca apenas o que não foi pré-carregado
      if (!response.ok) {
        throw new Error(`Falha ao buscar /locales/${locale}.json: ${response.status} ${response.statusText}`);
      }
      const messages = await response.json();
      if (!messages) {
         throw new Error(`Arquivo JSON para ${locale} veio vazio ou inválido após parse.`);
      }
      i18n.global.setLocaleMessage(locale, messages);
      console.log(`[i18n] Mensagens para ${locale} definidas via setLocaleMessage (fetch).`);
    } catch (error) {
      console.error(`[i18n] Erro CRÍTICO ao carregar/processar mensagens para ${locale} via fetch:`, error);
      return; // Aborta
    }
  } else {
     console.log(`[i18n] Mensagens para '${locale}' já estavam carregadas na instância (pré-carregadas ou fetch anterior).`);
  }

  console.log(`[i18n] Definindo locale.value para: ${locale}`);
  i18n.global.locale.value = locale;
  localStorage.setItem('mestariLocale', locale);
  console.log(`[i18n] Idioma efetivamente alterado para: ${locale}`);
}

export default i18n;