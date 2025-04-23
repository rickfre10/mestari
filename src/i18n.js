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
  locale: initialLocale,   // Define o idioma inicial
  fallbackLocale: 'en',  // Se a tradução não for encontrada, tenta inglês
  messages: {},          // Inicia vazio, mensagens serão carregadas via fetch
  silentTranslationWarn: true, // Silencia avisos sobre chaves não encontradas (opcional)
  silentFallbackWarn: true,    // Silencia avisos sobre uso do fallbackLocale (opcional)
  missingWarn: false,        // Silencia avisos sobre chaves faltando completamente (opcional)
  fallbackWarn: false        // Silencia avisos sobre fallback para idioma (opcional)
}); // Fim do objeto de configuração

/**
 * Carrega as mensagens de tradução para um determinado idioma dinamicamente
 * usando fetch, pois os arquivos .json devem estar na pasta /public.
 * @param {string} locale - O código do idioma a ser carregado (ex: 'pt', 'en').
 */
export async function loadLocaleMessages(locale) {
  // Verifica se as mensagens para este idioma já existem na instância i18n
  const messagesLoaded = i18n.global.getLocaleMessage(locale);
  const isEmpty = !messagesLoaded || Object.keys(messagesLoaded).length === 0;

  if (isEmpty) {
    // Se as mensagens não foram carregadas ainda, tenta buscá-las via fetch
    console.log(`[i18n] Tentando carregar mensagens para: ${locale} via fetch...`);
    try {
      // Busca o arquivo JSON da pasta /public usando fetch
      // O caminho começa com '/' porque `public` é mapeado para a raiz do site
      const response = await fetch(`/locales/${locale}.json`);

      // Verifica se a busca (request) foi bem-sucedida (status 200-299)
      if (!response.ok) {
        throw new Error(`Falha ao buscar /locales/${locale}.json: ${response.status} ${response.statusText}`);
      }

      // Extrai o conteúdo JSON do corpo da resposta
      const messages = await response.json();

      // Verifica se o JSON parseado não é nulo ou indefinido (precaução extra)
      if (!messages) {
         throw new Error(`Arquivo JSON para ${locale} veio vazio ou inválido após parse.`);
      }

      // Define as mensagens carregadas na instância global do i18n
      // Usa 'messages' diretamente, pois fetch + .json() já retorna o objeto parseado
      i18n.global.setLocaleMessage(locale, messages);
      console.log(`[i18n] Mensagens para ${locale} definidas via setLocaleMessage (fetch).`);

    } catch (error) {
      // Captura e loga erros que ocorreram durante o fetch ou o parse do JSON
      console.error(`[i18n] Erro CRÍTICO ao carregar/processar mensagens para ${locale} via fetch:`, error);
      // Importante: Aborta a função para não tentar definir um locale cujas mensagens falharam
      return;
    }
  } else {
     // Loga se as mensagens já estavam na memória (carregadas anteriormente)
     console.log(`[i18n] Mensagens para '${locale}' já estavam carregadas na instância.`);
  }

  // Se chegou até aqui, as mensagens estão carregadas (ou já estavam)
  // Agora, define o locale como ativo na instância i18n
  console.log(`[i18n] Definindo locale.value para: ${locale}`);
  i18n.global.locale.value = locale;

  // Salva a preferência no localStorage para persistir entre visitas
  localStorage.setItem('mestariLocale', locale);
  console.log(`[i18n] Idioma efetivamente alterado para: ${locale}`);
}

// Exporta a instância i18n criada para ser usada no app Vue (via main.js)
export default i18n;