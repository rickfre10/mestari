// src/languageStore.js
import { ref, computed } from 'vue';

// Importa as mensagens estaticamente
import ptMessages from './locales/pt.json'; // Certifique-se que pt.json está em src/locales
import enMessages from './locales/en.json'; // Certifique-se que en.json está em src/locales

// Guarda todas as mensagens carregadas
const messages = {
    pt: ptMessages,
    en: enMessages
};

// Estado reativo para o locale atual (inicializa do localStorage ou padrão)
const getInitialLocale = () => {
    const saved = localStorage.getItem('mestariLocale');
    return (saved === 'pt' || saved === 'en') ? saved : 'pt'; // Default 'pt'
};
export const currentLocale = ref(getInitialLocale());

// Propriedade computada que retorna as mensagens do idioma ATIVO
export const translations = computed(() => {
    return messages[currentLocale.value] || messages.en; // Usa 'en' como fallback se algo der errado
});

// Função para trocar o idioma
export function setLocale(lang) {
    if (lang === 'pt' || lang === 'en') {
        console.log(`[Store] Alterando idioma para: ${lang}`);
        currentLocale.value = lang;
        localStorage.setItem('mestariLocale', lang);
    } else {
        console.warn(`[Store] Tentativa de definir idioma inválido: ${lang}`);
    }
}