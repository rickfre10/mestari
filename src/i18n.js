// src/i18n.js
import { createI18n } from 'vue-i18n';

/**
 * Detecta o idioma inicial a ser usado.
 * Prioriza o idioma salvo no localStorage, se válido.
 * Caso contrário, retorna 'pt' como padrão.
 */
function getInitialLocale() {
  const savedLocale = localStorage.getItem('mestariLocale');
  const availableLocales = ['pt', 'en']; // Idiomas disponíveis

  if (savedLocale && availableLocales.includes(savedLocale)) {
    console.log(`[i18n] Idioma inicial pego do localStorage: ${savedLocale}`);
    return savedLocale;
  }

  console.log("[i18n] Nenhum idioma salvo/válido detectado, usando 'pt' como padrão.");
  return 'pt'; // Idioma padrão
}

// Obtém o locale inicial antes de criar a instância
const initialLocale = getInitialLocale();

// Cria a instância do i18n
const i18n = createI18n({
  legacy: false, // Essencial para Composition API
  locale: initialLocale, // Define o idioma inicial
  fallbackLocale: 'en', // Se a tradução não for encontrada no idioma atual, tenta inglês
  messages: {}, // Inicia vazio, as mensagens serão carregadas dinamicamente
  // Opções para silenciar avisos comuns no console
  silentTranslationWarn: true,
  silentFallbackWarn: true,
  missingWarn: false,
  fallbackWarn: false
});

/**
 * Carrega as mensagens de tradução para um determinado idioma dinamicamente.
 * @param {string} locale - O código do idioma a ser carregado (ex: 'pt', 'en').
 */
export async function loadLocaleMessages(locale) {
  // Verifica se as mensagens para este idioma já existem na instância
  const messagesLoaded = i18n.global.getLocaleMessage(locale);
  const isEmpty = !messagesLoaded || Object.keys(messagesLoaded).length === 0;

  if (isEmpty) {
    // Se as mensagens não foram carregadas ainda, tenta carregá-las
    console.log(`[i18n] Tentando carregar mensagens para: ${locale} dinamicamente...`);
    try {
      // Usa import() dinâmico com caminho relativo à raiz do site
      const messages = await import(`/locales/${locale}.json`);

      // Verifica se o módulo importado e seu conteúdo 'default' são válidos
      if (!messages || !messages.default) {
        throw new Error(`Arquivo JSON para ${locale} veio inválido ou sem export default.`);
      }

      // Define as mensagens carregadas na instância global do i18n
      i18n.global.setLocaleMessage(locale, messages.default);
      console.log(`[i18n] Mensagens para ${locale} definidas via setLocaleMessage.`);

    } catch (error) {
      // Captura e loga erros durante o carregamento/processamento do JSON
      console.error(`[i18n] Erro CRÍTICO ao carregar/processar mensagens para ${locale}:`, error);
      // Importante: Aborta a função para não tentar definir um locale cujas mensagens falharam
      return;
    }
  } else {
    // Loga se as mensagens já estavam na memória
     console.log(`[i18n] Mensagens para '${locale}' já estavam carregadas na instância.`);
  }

  // Se chegou até aqui (mensagens carregadas ou já existiam), define o locale como ativo
  console.log(`[i18n] Definindo locale.value para: ${locale}`);
  i18n.global.locale.value = locale;

  // Salva a preferência no localStorage para persistência
  localStorage.setItem('mestariLocale', locale);
  console.log(`[i18n] Idioma efetivamente alterado para: ${locale}`);
}

// Exporta a instância criada para ser usada no app Vue (main.js)
export default i18n;