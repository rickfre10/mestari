<script setup>
// ----- BLOCO SCRIPT SETUP -----
import { ref, onMounted, onUnmounted, watchEffect, computed, watch, nextTick } from 'vue' 
import { useI18n } from 'vue-i18n'

// --- ESTADO REATIVO ---
const event = ref({ eventName: 'Meu Evento Padrão', blocks: [] });
const newBlockName = ref('');
const newBlockDurationString = ref('00:01:00'); // Input como string HH:MM:SS
const currentBlockIndex = ref(null);
const isDarkMode = ref(false);
const fileInputRef = ref(null);
const plannedTimeJustChanged = ref(false);
let plannedTimeChangeTimeout = null;
const addBlockNameInputRef = ref(null); 

// --- Obtém funcionalidades do i18n ---
const { locale, setLocaleMessage } = useI18n()

// --- VARIÁVEIS NÃO REATIVAS ---
let intervalId = null;
let lastVisibleTimestamp = null;

// --- Estado e Funções para Edição do Nome do Evento ---
const isEditingEventName = ref(false);
const eventNameBeforeEdit = ref('');

function startEditEventName() {
  eventNameBeforeEdit.value = event.value.eventName;
  isEditingEventName.value = true;
  // TODO: Adicionar foco ao input com nextTick se desejar
  // import { nextTick } from 'vue'; // Necessário importar
  // const eventNameInputRef = ref(null); // Necessário ref no input
  // nextTick(() => { eventNameInputRef.value?.focus(); });
}

function confirmEditEventName() {
  isEditingEventName.value = false;
  console.log("Nome do evento atualizado para:", event.value.eventName);
}

function cancelEditEventName() {
  event.value.eventName = eventNameBeforeEdit.value;
  isEditingEventName.value = false;
  console.log("Edição do nome do evento cancelada.");
}

// --- FUNÇÕES AUXILIARES ---
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || !isFinite(totalSeconds)) { return '00:00:00'; }
  const absSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = Math.floor(absSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseTimeToSeconds(timeString) {
  if (!timeString || typeof timeString !== 'string') return null;
  const parts = String(timeString).split(':').map(part => parseInt(part, 10));
  let seconds = 0;
  if (parts.length === 3) { // HH:MM:SS
    if (isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2]) || parts[1] >= 60 || parts[2] >= 60 || parts[1] < 0 || parts[2] < 0 || parts[0] < 0) return null;
    seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) { // MM:SS
    if (isNaN(parts[0]) || isNaN(parts[1]) || parts[0] >= 60 || parts[1] >= 60 || parts[0] < 0 || parts[1] < 0 ) return null;
    seconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 1) { // SS
    if (isNaN(parts[0]) || parts[0] < 0) return null;
    seconds = parts[0];
  } else {
    return null; // Formato inválido
  }
  return seconds;
}

const statusMap = {
  idle: 'Ocioso',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluído',
  overrun: 'Estourado'
};

function translateStatus(status) {
  return statusMap[status] || status;
}

// --- COMPUTED PROPERTIES ---
const totalPlannedDuration = computed(() => {
  const totalSeconds = event.value.blocks.reduce((sum, block) => sum + (block.duration || 0), 0);
  return formatTime(totalSeconds);
});

// Tempo total REAL decorrido no evento (LÓGICA REATORADA E SIMPLIFICADA)
const totalEventElapsedTime = computed(() => {
  console.log("Calculando totalEventElapsedTime (Lógica Refatorada)..."); // Log para debug
  // Soma o elapsedTime de TODOS os blocos que não estão 'idle'
  const elapsedSeconds = event.value.blocks.reduce((sum, block) => {
    // Se o bloco não está ocioso (ou seja, rodou, pausou, completou ou estourou),
    // adiciona o tempo real que foi gasto nele à soma.
    if (block.status !== 'idle') {
      return sum + (block.elapsedTime || 0); // Usa 0 se elapsedTime for undefined (segurança)
    }
    // Se o bloco está ocioso, não adiciona nada à soma.
    return sum;
  }, 0); // Inicia a soma com 0
  return elapsedSeconds; // Retorna o total de segundos realmente decorridos em blocos não-ociosos
});

const cumulativeEventDelay = computed(() => {
  const totalDelaySeconds = event.value.blocks.reduce((sum, block) => {
    return sum + (typeof block.completionDelay === 'number' ? block.completionDelay : 0);
  }, 0);
  const roundedDelay = Math.round(totalDelaySeconds);
  return {
    sign: roundedDelay > 5 ? '+' : (roundedDelay < -5 ? '-' : ''),
    time: formatTime(Math.abs(roundedDelay)),
    seconds: roundedDelay
  };
});

// --- FUNÇÕES I18N ---  
async function loadLocaleMessages(localeToLoad) {
  if (!['pt', 'en'].includes(localeToLoad)) {
    console.error(`[i18n] Tentativa de carregar locale inválido: ${localeToLoad}`);
    return false;
  }
  console.log(`[i18n] Tentando carregar mensagens para: ${localeToLoad}`);
  try {
    const response = await fetch(`/locales/${localeToLoad}.json`);
    if (!response.ok) {
      throw new Error(`Falha ao buscar ${localeToLoad}.json: ${response.statusText}`);
    }
    const messages = await response.json();
    setLocaleMessage(localeToLoad, messages); // Usa a função obtida do useI18n()
    console.log(`[i18n] Mensagens para ${localeToLoad} carregadas com sucesso.`);
    return true;
  } catch (error) {
    console.error(`[i18n] Erro ao carregar/processar mensagens para ${localeToLoad}:`, error);
    return false;
  }
}
// FIM FUNÇÕES I18N


watch(totalPlannedDuration, (newValue, oldValue) => {
  // Evita acionar na carga inicial ou se o valor não mudou
  if (oldValue !== undefined && newValue !== oldValue) {
    console.log(`Planejado mudou de ${oldValue} para ${newValue}. Acionando highlight.`);
    plannedTimeJustChanged.value = true; // Ativa a classe CSS

    // Limpa timeout anterior se houver (para mudanças rápidas)
    if (plannedTimeChangeTimeout) {
      clearTimeout(plannedTimeChangeTimeout);
    }

    // Define um timeout para remover a classe após a animação (ex: 1000ms)
    plannedTimeChangeTimeout = setTimeout(() => {
      plannedTimeJustChanged.value = false; // Desativa a classe CSS
      plannedTimeChangeTimeout = null;
      console.log("Highlight removido.");
    }, 1000); // Duração em ms (deve ser igual ou maior que a animação CSS)
  }
});

const currentBlock = computed(() => {
  if (currentBlockIndex.value !== null && currentBlockIndex.value >= 0 && currentBlockIndex.value < event.value.blocks.length) {
    return event.value.blocks[currentBlockIndex.value];
  }
  return null;
});

const currentBlockProgress = computed(() => {
  if (!currentBlock.value || !currentBlock.value.duration || currentBlock.value.duration === 0) { return 0; }
  const progress = (currentBlock.value.elapsedTime / currentBlock.value.duration) * 100;
  return Math.min(progress, 100);
});

const currentBlockDisplayTime = computed(() => {
  if (!currentBlock.value) { return '--:--:--'; }
  const remainingSeconds = currentBlock.value.duration - currentBlock.value.elapsedTime;
  const formattedTime = formatTime(remainingSeconds);
  return remainingSeconds < 0 ? `-${formattedTime}` : formattedTime;
});

const themeButtonText = computed(() => {
  return isDarkMode.value ? '☀️ Modo Claro' : '🌙 Modo Noturno';
});


// --- PERSISTÊNCIA COM LOCALSTORAGE - CAUSANDO O ERRO DE SALVAR O ESTADO INICIAL PADRÃO VAZIO E SOBREESCREVENDO O LOCALSTORAGE - COMENTADO PARA NÃO CAUSAR MAIS ---
/*watchEffect(() => {
  try {
      const currentEventState = JSON.parse(JSON.stringify(event.value)); // Clona para log
      const eventString = JSON.stringify(event.value);
      localStorage.setItem('mestariEventData', eventString);
      localStorage.setItem('mestariTheme', JSON.stringify(isDarkMode.value));
      // Log mais detalhado
      console.log(`--- DEBUG: watchEffect SALVANDO... Nome: ${currentEventState.eventName}, Blocos: ${currentEventState.blocks?.length ?? 0} ---`);
  } catch (error) {
      console.error("--- DEBUG: watchEffect ERRO ao salvar ---:", error);
  }
});*/

// NOVO: Observa mudanças profundas no objeto 'event' para salvar
watch(event, (newEventValue) => {
  // Este log só deve aparecer DEPOIS de uma mudança real no evento
  console.log("--- DEBUG: watch 'event' disparado ---");
  try {
    const eventString = JSON.stringify(newEventValue);
    localStorage.setItem('mestariEventData', eventString);
    console.log(`--- DEBUG: watch SALVANDO Evento... Blocos: ${newEventValue.blocks?.length ?? 0}`);
  } catch (error) {
    console.error("--- DEBUG: watch 'event' ERRO ao salvar ---:", error);
  }
}, { deep: true }); // deep: true é ESSENCIAL para detectar mudanças dentro de 'blocks'

// NOVO: Observa mudanças no 'isDarkMode' para salvar o tema
watch(isDarkMode, (newThemeValue) => {
  console.log("--- DEBUG: watch 'isDarkMode' disparado ---");
  try {
    localStorage.setItem('mestariTheme', JSON.stringify(newThemeValue));
    console.log("--- DEBUG: watch SALVANDO Tema ---");
  } catch (error) {
    console.error("--- DEBUG: watch 'isDarkMode' ERRO ao salvar Tema ---:", error);
  }
});

// --- GERENCIAMENTO DO TICKER E VISIBILIDADE ---
function handleVisibilityChange() {
  if (document.hidden) {
    if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
      lastVisibleTimestamp = Date.now();
    } else {
      lastVisibleTimestamp = null;
    }
  } else {
    if (lastVisibleTimestamp !== null) {
      const timeDiffSeconds = Math.round((Date.now() - lastVisibleTimestamp) / 1000);
      if (timeDiffSeconds > 1 && currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun' || currentBlock.value.status === 'paused')) {
        currentBlock.value.elapsedTime += timeDiffSeconds;
        if (currentBlock.value.status === 'running' && currentBlock.value.elapsedTime > currentBlock.value.duration) {
          currentBlock.value.status = 'overrun';
        }
      }
      lastVisibleTimestamp = null;
    }
  }
}

// Substitua seu onMounted por este:
onMounted(async () => { // <<< ADICIONADO 'async'
  console.log('onMounted: Iniciando...'); // Log mais simples

  const initialLocale = locale.value; // Usa a ref 'locale' do useI18n
  console.log(`onMounted: Carregando locale inicial '${initialLocale}'...`);
  await loadLocaleMessages(initialLocale); // <<< 'await' agora é válido
  console.log(`onMounted: Mensagens para '${initialLocale}' carregadas (ou falhou).`);

  // Carregamento do evento (lógica original)
  const savedEvent = localStorage.getItem('mestariEventData');
  if (savedEvent) {
    try {
      const loadedEvent = JSON.parse(savedEvent);
      event.value = {
        eventName: loadedEvent?.eventName || 'Evento Carregado',
        blocks: Array.isArray(loadedEvent?.blocks) ? loadedEvent.blocks : []
      };
      event.value.blocks.forEach(block => {
        if (block.completionDelay === undefined) block.completionDelay = null;
        if (block.elapsedTime === undefined) block.elapsedTime = 0;
        if (block.notes === undefined) block.notes = '';
        if (block.duration === undefined) block.duration = 60;
        if (block.status !== 'idle' && block.status !== 'completed') block.status = 'idle';
      });
      console.log("onMounted: Evento carregado do localStorage.");
    } catch (e) {
      console.error("onMounted: Erro ao carregar/parsear evento:", e);
      localStorage.removeItem('mestariEventData');
      event.value = { eventName: 'Novo Evento (Erro ao Carregar)', blocks: [] };
    }
  } else {
    console.log("onMounted: Nenhum evento salvo encontrado.");
    event.value.eventName = 'Meu Primeiro Evento';
    event.value.blocks = [];
  }

  // Carregamento do tema (lógica original)
  const savedTheme = localStorage.getItem('mestariTheme');
  if (savedTheme) { try { isDarkMode.value = JSON.parse(savedTheme); } catch(e) { console.error("Erro ao carregar tema", e); } }

  currentBlockIndex.value = null;

  // Inicia Ticker e Listener de Visibilidade (lógica original)
  intervalId = setInterval(tick, 1000); // Garanta que tick() está definida!
  document.addEventListener('visibilitychange', handleVisibilityChange); // Garanta que handleVisibilityChange está definida!

  // Foco inicial (lógica original)
  nextTick(() => {
    if (event.value.blocks.length === 0) {
      addBlockNameInputRef.value?.focus();
    }
  });
  console.log('onMounted: Finalizado.');
});

onUnmounted(() => {
  clearInterval(intervalId);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

// --- FUNÇÕES CORE ---
function tick() {
  if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
    currentBlock.value.elapsedTime++;
    if (currentBlock.value.status === 'running' && currentBlock.value.elapsedTime > currentBlock.value.duration) {
      currentBlock.value.status = 'overrun';
      console.log(`Tempo do bloco ${currentBlock.value.id} estourado!`);
    }
  }
}

function markBlockComplete(block) {
  if (!block || block.status === 'completed') return;
  if (block.completionDelay === null) {
    block.completionDelay = block.elapsedTime - block.duration;
  }
  block.status = 'completed';
}

function addBlock() {
  const name = newBlockName.value.trim();
  const durationInSeconds = parseTimeToSeconds(newBlockDurationString.value);
  if (durationInSeconds === null || durationInSeconds <= 0) {
    return alert('Formato de duração inválido. Use HH:MM:SS, MM:SS ou segundos.');
  }
  const newBlock = {
    id: Date.now(), name: name || `Bloco ${event.value.blocks.length + 1}`,
    duration: durationInSeconds, elapsedTime: 0, status: 'idle', notes: '', completionDelay: null
  };
  event.value.blocks.push(newBlock);
  newBlockName.value = '';
  newBlockDurationString.value = '00:01:00';
}

// --- FUNÇÕES DE CONTROLE ---
function startBlock(blockId) {
  const blockIndex = event.value.blocks.findIndex(b => b.id === blockId);
  if (blockIndex !== -1 && event.value.blocks[blockIndex].status === 'idle') {
    if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
      currentBlock.value.status = 'paused';
    }
    currentBlockIndex.value = blockIndex;
    event.value.blocks[blockIndex].status = 'running';
  }
}
function pauseBlock() {
  if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
    currentBlock.value.status = 'paused';
  }
}
function resumeBlock() {
  if (currentBlock.value && currentBlock.value.status === 'paused') {
    event.value.blocks.forEach((block, index) => {
      if(index !== currentBlockIndex.value && (block.status === 'running' || block.status === 'overrun')) {
        block.status = 'paused';
      }
    });
    currentBlock.value.status = (currentBlock.value.elapsedTime >= currentBlock.value.duration) ? 'overrun' : 'running';
  }
}
function resetBlock(blockId) {
  const blockIndex = event.value.blocks.findIndex(b => b.id === blockId);
  if (blockIndex !== -1) {
    const block = event.value.blocks[blockIndex];
    const wasCurrent = (currentBlockIndex.value === blockIndex);
    block.status = 'idle';
    block.elapsedTime = 0;
    block.completionDelay = null;
    if (wasCurrent) { currentBlockIndex.value = null; }
  }
}
function deleteBlock(blockId) {
    const index = event.value.blocks.findIndex(b => b.id === blockId);
    if (index !== -1) {
        const blockToDelete = event.value.blocks[index]; // Get block info before deleting
        const wasCurrent = (currentBlockIndex.value === index);
        const isBeforeCurrent = (currentBlockIndex.value !== null && index < currentBlockIndex.value);

        // Remove the block from the array
        event.value.blocks.splice(index, 1);
        console.log(`Bloco '${blockToDelete.name || blockToDelete.id}' deletado.`);

        if (wasCurrent) {
            console.log("Bloco ativo foi deletado. Procurando próximo bloco ocioso...");
            // Find the next idle block starting from the *same index*
            // because splice shifted subsequent elements down.
            let nextIdleIndex = -1;
            for (let i = index; i < event.value.blocks.length; i++) {
                 if (event.value.blocks[i].status === 'idle') {
                     nextIdleIndex = i;
                     break; // Found the first one
                 }
            }

            if (nextIdleIndex !== -1) {
                 // Found the next idle block
                 currentBlockIndex.value = nextIdleIndex;
                 event.value.blocks[nextIdleIndex].status = 'running'; // Start it
                 console.log(`Iniciando próximo bloco ocioso automaticamente: Índice ${nextIdleIndex} ('${event.value.blocks[nextIdleIndex].name}')`);
            } else {
                 // No subsequent idle block found
                 currentBlockIndex.value = null;
                 console.log("Nenhum bloco ocioso encontrado para iniciar após a deleção.");
            }
        } else if (isBeforeCurrent) {
            // If deleted a block BEFORE the active one, adjust the current index
            currentBlockIndex.value--;
            console.log("Índice do bloco ativo ajustado após deleção de item anterior.");
        }
        // If deleted block was AFTER current, currentBlockIndex remains unaffected.
    }
}
function goToNextBlock() {
  let nextIndex = -1;
  const currentIndex = currentBlockIndex.value;
  if (currentIndex === null) {
    nextIndex = event.value.blocks.findIndex(b => b.status === 'idle');
  } else {
    const currentBlockRef = event.value.blocks[currentIndex];
    markBlockComplete(currentBlockRef);
    nextIndex = currentIndex + 1;
    if (nextIndex >= event.value.blocks.length) { nextIndex = -1; }
  }
  if (nextIndex !== -1) {
    currentBlockIndex.value = nextIndex;
    if(event.value.blocks[nextIndex].status === 'idle'){
      event.value.blocks[nextIndex].status = 'running';
    }
  } else {
    currentBlockIndex.value = null;
  }
}



// --- Funções de Reordenação ---
function moveBlockUp(index) {
  if (index > 0) {
    const blocks = event.value.blocks;
    if (currentBlockIndex.value === index) { currentBlockIndex.value = index - 1; }
    else if (currentBlockIndex.value === index - 1) { currentBlockIndex.value = index; }
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
  }
}
function moveBlockDown(index) {
  if (index < event.value.blocks.length - 1) {
    const blocks = event.value.blocks;
    if (currentBlockIndex.value === index) { currentBlockIndex.value = index + 1; }
    else if (currentBlockIndex.value === index + 1) { currentBlockIndex.value = index; }
    [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
  }
}

// --- FUNÇÕES DE UI / EVENTO ---
function startNewEvent() {
  if (confirm('Isso limpará o evento atual (nome e blocos). Deseja continuar?')) {
    event.value = { eventName: 'Novo Evento', blocks: [] };
    currentBlockIndex.value = null;
  }
}
function resetEntireEvent() {
  if (confirm('Tem certeza que deseja resetar TODOS os blocos?')) {
    currentBlockIndex.value = null;
    event.value.blocks.forEach(block => {
      block.status = 'idle'; block.elapsedTime = 0; block.completionDelay = null;
    });
  }
}
function saveEventToFile() {
  try {
    const eventData = event.value;
    const dataStr = JSON.stringify(eventData, null, 2); // Pretty print JSON
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = (eventData.eventName || 'mestari-evento').replace(/[^a-z0-9_ .-]/gi, '_') + '.json';
    link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar evento."); }
}
function triggerFileInput() {
  fileInputRef.value?.click();
}
// Função atualizada para carregar e validar evento de arquivo JSON
function loadEventFromFile(e) {
  const file = e.target.files?.[0];
  console.log("Arquivo selecionado:", file?.name);
  if (!file) return; // Sai se nenhum arquivo

  // Verificação inicial de tipo (ajuda, mas não 100% garantido)
  if (file.type && file.type !== 'application/json') {
    alert('Arquivo inválido. Por favor, selecione um arquivo .json exportado pelo Mestari.');
    if(e.target) e.target.value = null;
    return;
  }

  const reader = new FileReader();

  reader.onload = (res) => {
    try {
      const fileContent = res.target?.result;
      if (typeof fileContent !== 'string') {
        throw new Error("Não foi possível ler o conteúdo do arquivo.");
      }
      const loadedData = JSON.parse(fileContent); // Tenta parsear

      // --- VALIDAÇÃO ROBUSTA DA ESTRUTURA ---
      // 1. Valida estrutura geral do evento
      if (typeof loadedData.eventName !== 'string' || !Array.isArray(loadedData.blocks)) {
        throw new Error("Estrutura do arquivo JSON inválida. Faltando 'eventName' ou 'blocks'.");
      }

      // 2. Valida cada bloco individualmente
      const validStatuses = Object.keys(statusMap); // Pega status válidos do nosso mapa
      const isValidBlocks = loadedData.blocks.every((block, index) => {
        const blockIsValid =
            typeof block.id === 'number' &&
            typeof block.name === 'string' &&
            typeof block.duration === 'number' && block.duration >= 0 && // Duração não pode ser negativa
            (block.notes === undefined || typeof block.notes === 'string') && // Notas são opcionais ou string
            // Campos de estado que serão resetados (não precisam validação estrita de tipo aqui, mas verificamos se existem se precisarmos deles)
            // typeof block.elapsedTime === 'number' && block.elapsedTime >= 0 &&
            // typeof block.status === 'string' && validStatuses.includes(block.status) &&
            (block.completionDelay === undefined || block.completionDelay === null || typeof block.completionDelay === 'number'); // completionDelay opcional/null/numero

         if (!blockIsValid) {
             console.error(`Bloco inválido no índice ${index}:`, block);
             // Poderia jogar erro mais específico aqui
         }
        return blockIsValid;
      });

      if (!isValidBlocks) {
        throw new Error("Dados inválidos encontrados em um ou mais blocos dentro do arquivo JSON.");
      }

      // --- ATUALIZAÇÃO DO ESTADO (Com Reset) ---
      // Se passou por todas as validações:
      event.value = {
        eventName: loadedData.eventName, // Mantém nome do evento carregado
        blocks: loadedData.blocks.map(b => ({ // Mapeia os blocos carregados
          // Mantém dados estruturais/descritivos:
          id: b.id, // Usa o ID original para consistência? Ou gera novo? Manter é melhor para referências.
          name: b.name ?? `Bloco ${Date.now()}`, // Nome original ou padrão se ausente
          duration: b.duration ?? 60,        // Duração original ou padrão se ausente
          notes: b.notes ?? '',               // Notas originais ou padrão se ausente
          // *** RESETA O ESTADO DINÂMICO ***
          elapsedTime: 0,                     // Sempre começa zerado
          status: 'idle',                     // Sempre começa como 'Ocioso'
          completionDelay: null             // Sempre começa sem delay/folga calculado
        }))
      };
      currentBlockIndex.value = null; // Garante que nenhum bloco está ativo
      alert('Evento carregado e resetado com sucesso! Pronto para iniciar.');
      console.log("Evento carregado do arquivo:", event.value);

    } catch (error) {
      console.error("Erro ao carregar ou processar o arquivo JSON:", error);
      // Mostra mensagem de erro mais específica para o usuário
      alert(`Erro ao carregar o arquivo: ${error.message}\n\nVerifique se o arquivo é um JSON válido exportado pelo Mestari.`);
    } finally {
      // Limpa o valor do input para permitir carregar o mesmo arquivo novamente
      if (e.target) e.target.value = null;
    }
  };

  reader.onerror = (err) => {
    console.error("Erro ao ler o arquivo:", err);
    alert("Ocorreu um erro ao tentar ler o arquivo selecionado.");
    if (e.target) e.target.value = null;
  };

  // Inicia a leitura
  reader.readAsText(file);

}
function toggleTheme() { isDarkMode.value = !isDarkMode.value; }


// ---  FUNÇÃO PARA TROCAR IDIOMA --- 
async function changeLanguage(newLocale) {
  if (locale.value !== newLocale && (newLocale === 'pt' || newLocale === 'en')) {
    console.log(`[i18n] Tentando mudar idioma para: ${newLocale}`);
    const loaded = await loadLocaleMessages(newLocale); // Chama a função de carregar
    if (loaded) {
      locale.value = newLocale; // Usa a ref 'locale' obtida do useI18n()
      localStorage.setItem('mestariLocale', newLocale);
      console.log(`[i18n] Idioma alterado para: ${newLocale}`);
    } else {
      console.warn(`[i18n] Não foi possível carregar ${newLocale}, idioma não alterado.`);
    }
  }
}
// FIM FUNÇÃO TROCAR IDIOMA

// ----- FIM DO BLOCO SCRIPT SETUP -----
</script>

<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }">
    <header>
<h1 class="app-title">
      Mestari <img src="/favicon.png" alt="Logo Mestari" class="header-logo">
    </h1>
      <div class="header-actions">
        <a href="http://link.mercadopago.com.br/rickfre" target="_blank" rel="noopener noreferrer"
           class="theme-toggle-button coffee-button"
           title="Apoie o desenvolvedor!">
           Me paga um café? ☕️
        </a>
         <button @click="toggleTheme" class="theme-toggle-button" :title="`Mudar para Modo ${isDarkMode ? 'Claro' : 'Noturno'}`"> 
         {{ themeButtonText }}
        </button>
      </div>
    </header>

    <main>
      <section class="global-event-actions">
        <button @click="startNewEvent" class="header-button new-event" title="Limpar e Iniciar Novo Evento"> 
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        Novo evento
        </button>
        <button @click="triggerFileInput" class="header-button" title="Carregar Evento de Arquivo JSON">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Subir evento
        </button>
        <input type="file" accept=".json,application/json" @change="loadEventFromFile" ref="fileInputRef" style="display: none;">
        <button @click="saveEventToFile" class="header-button" title="Salvar Evento Atual em Arquivo JSON"> 
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        Salvar evento
        </button>
        <button @click="resetEntireEvent" class="header-button reset-event" title="Resetar Todos os Blocos">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Resetar Evento
        </button>
      </section>

      <section class="event-name-section">
        <label for="eventNameInput">Nome do Evento:</label>
        <div v-if="!isEditingEventName" class="event-name-view">
          <span class="event-name-display">{{ event.eventName }}</span>
          <button @click="startEditEventName" class="inline-edit-button" title="Editar Nome">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
      </div>
        <div v-else class="event-name-edit">
          <input
            type="text"
            id="eventNameInput"
            v-model="event.eventName"
            @keyup.enter="confirmEditEventName"
            @keyup.esc="cancelEditEventName"
            ref="eventNameInputRef"
            placeholder="Digite o nome do evento"
          >

          <label for="eventNameInput">Nome do Evento:</label>

          <button @click="confirmEditEventName" class="inline-confirm-button" title="Confirmar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true" ><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button @click="cancelEditEventName" class="inline-cancel-button" title="Cancelar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </section>

      <section class="event-status-section">
        <h3>Status Geral do Evento</h3>
        <div class="status-grid">
          <div class="status-item">
      <span>Planejado</span>
      <strong :class="{ 'highlight-change': plannedTimeJustChanged }">
          {{ totalPlannedDuration }}
      </strong>
          </div>
          <div class="status-item">
            <span>Decorrido</span>
            <strong>{{ formatTime(totalEventElapsedTime) }}</strong>
          </div>
          <div class="status-item">
            <span>Atraso / Folga Acumulado</span>
            <strong :class="{ delay: cumulativeEventDelay.seconds > 5, slack: cumulativeEventDelay.seconds < -5 }">
              {{ cumulativeEventDelay.sign }}{{ cumulativeEventDelay.time }}
            </strong>
          </div>
        </div>
      </section>

      <section class="current-block-section" v-if="currentBlock" :class="{ 'overrun-bg': currentBlock.status === 'overrun' || currentBlock.elapsedTime > currentBlock.duration }">
        <h3>Agora:</h3>
        <div class="current-block-header">
          <h4>{{ currentBlock.name || 'Bloco Atual' }}</h4>
          <span class="current-block-timer" :class="{ 'overtime-indicator': currentBlock.elapsedTime > currentBlock.duration }">
            {{ currentBlockDisplayTime }}
          </span>
        </div>
        <div class="progress-bar-container" :title="`Progresso: ${Math.min(currentBlock.elapsedTime, currentBlock.duration)} / ${currentBlock.duration}s`">
          <div class="progress-bar" :style="{ width: currentBlockProgress + '%' }" :class="{ 'progress-overrun': currentBlock.elapsedTime > currentBlock.duration }"></div>
        </div>
        <label :for="'notes-' + currentBlock.id">Pauta e Anotações:</label>
        <textarea :id="'notes-' + currentBlock.id" v-model="currentBlock.notes"></textarea>
        <button @click="goToNextBlock" class="next-block-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
        Próximo Bloco
        </button>
      </section>

      <section class="current-block-section" v-else>
        <h3>Nenhum bloco ativo</h3>
        <p v-if="event.blocks.length > 0 && event.blocks.some(b => b.status === 'idle')">Use o botão "Iniciar" na lista abaixo ou clique aqui para iniciar o próximo bloco ocioso.</p>
        <p v-else-if="event.blocks.length > 0">Todos os blocos foram concluídos.</p>
        <p v-else>Adicione blocos ao evento para começar.</p>
        <button v-if="event.blocks.some(b => b.status === 'idle')" @click="goToNextBlock" class="next-block-button">
          Iniciar Evento / Próximo Bloco
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
        </button>
      </section>

      <section class="add-block-form-section">
        <h3>Adicionar Novo Bloco</h3>
        <div>
          <label for="blockName">Nome do Bloco: </label>
          <input type="text" id="blockName" v-model="newBlockName" placeholder="Nome do bloco"/>
        </div>
        <div>
          <label for="blockDuration">Duração (HH:MM:SS): </label>
          <input type="text" id="blockDuration" v-model="newBlockDurationString" placeholder="HH:MM:SS ou Segundos"/>
        </div>
        <button @click="addBlock" class="add-block-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        Adicionar Bloco</button>
      </section>

      <section class="block-list-section">
      <h2>Blocos do Evento:</h2>
      <TransitionGroup v-if="event.blocks.length > 0" tag="ul" name="list" class="block-list-ul">
        <li v-for="(block, index) in event.blocks" :key="block.id" :class="{ active: index === currentBlockIndex }">
          <div class="block-info">
             <span>
               {{ block.name || 'Sem nome' }} | {{ formatTime(block.duration) }} |
               Dec: <span :class="{ 'overtime-indicator': block.elapsedTime > block.duration }">{{ formatTime(block.elapsedTime) }}</span> |
               Status: {{ translateStatus(block.status) }}
               <span v-if="block.completionDelay !== null" :class="{ delay: block.completionDelay > 5, slack: block.completionDelay < -5 }">
                 (Desvio: {{ block.completionDelay >= 0 ? '+' : '' }}{{ formatTime(block.completionDelay) }})
               </span>
             </span>
           </div>
           <div class="block-actions-row">
             <span class="control-buttons-group">
               <button v-if="block.status === 'idle'" @click="startBlock(block.id)" class="control-button start" title="Iniciar Bloco"> 
                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"> <polygon points="5 3 19 12 5 21 5 3"> </polygon> </svg>
               </button>
               <button v-if="(block.status === 'running' || block.status === 'overrun') && index === currentBlockIndex" @click="pauseBlock()" class="control-button pause" title="Pausar Bloco">
                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"> <rect x="6" y="4" width="4" height="16"> </rect><rect x="14" y="4" width="4" height="16"> </rect> </svg>
               </button>
               <button v-if="block.status === 'paused' && index === currentBlockIndex" @click="resumeBlock()" class="control-button resume" title="Retomar Bloco">
                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"> <polygon points="5 3 19 12 5 21 5 3"> </polygon></svg>
               </button>
               <button v-if="block.status !== 'idle'" @click="resetBlock(block.id)" class="control-button reset" title="Resetar Bloco (Voltar para Ocioso)">
                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill=none stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"> <polyline points="23 4 23 10 17 10"> </polyline><polyline points="1 20 1 14 7 14"> </polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
               <button @click="deleteBlock(block.id)" class="control-button delete" title="Deletar Bloco">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"> <polyline points="3 6 5 6 21 6"> </polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
               </button>
             </span>
             <span class="reorder-buttons-group">
               <button @click="moveBlockUp(index)" :disabled="index === 0" title="Mover Bloco Para Cima">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><polyline points="18 15 12 9 6 15"></polyline></svg>
               </button>
               <button @click="moveBlockDown(index)" :disabled="index === event.blocks.length - 1" title="Mover Bloco Para Baixo">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><polyline points="6 9 12 15 18 9"></polyline></svg>
               </button>
             </span>
           </div>
           <div class="notes-area">
             <textarea :id="'notes-li-' + block.id" v-model="block.notes" placeholder="Adicionar pauta/anotações..." rows="3"></textarea>
           </div>
        </li>
      </TransitionGroup>
      <div v-else class="empty-list-message">
          <p>Nenhum bloco adicionado a este evento ainda.</p>
          <p><em>Use o formulário 'Adicionar Novo Bloco' para começar!</em></p>
      </div>
    </section>
    </main>


    <footer class="app-footer-revised">
      <div class="footer-left">
        <h1 class="footer-app-name">Mestari</h1>
        <img src="/favicon.png" alt="Logo Mestari" class="footer-logo-app"/>
      </div>
      <div class="footer-center">
        <p class="footer-about-text">Gerenciador de tempo e cronômetro ideal para controlar eventos, palestras e apresentações ao vivo. Mantenha sua pauta sob controle.</p>
        <p class="footer-about-text">Nota de privacidade: todos os inseridos no Mestari são armazenados apenas localmente no seu navegador.</p>
        <p class="footer-copyright">
          <span>&copy; {{ new Date().getFullYear() }} Rickfre</span> |
          <a href="/LICENSE.txt" target="blank" rel="noopener noreferrer">Licença MIT</a>
        </p>
      </div>
      <nav class="footer-right">
        <span>feito no Brasil por:</span>
        <a href="https://rickfre.com.br" target="_blank" rel="noopener noreferrer" title="Acesse meu site">
           <img src="/logo rck.svg" alt="Logo Rickfre" class="footer-logo-personal"/>
        </a>
      </nav>
    </footer>


  </div>

 

  </template>

<style scoped>
/* ----- BLOCO STYLE SCOPED ----- */

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

/* --- Variáveis e Base --- */
.app-container {
  /* Cores Modo Claro */
  --primary-color: #6821ff;
  --primary-hover-color: #551adf;
  --bg-color: #ffffff;
  --text-color: #333333;
  --text-muted-color: #777777;
  --header-bg: var(--primary-color);
  --header-text: #ffffff;
  --button-text: #ffffff;
  --item-bg: #f8f9fa;
  --item-border: #dee2e6;
  --item-active-bg: #e8e0ff;
  --item-active-border: var(--primary-color);
  --input-bg: #ffffff;
  --input-border: #ced4da;
  --input-text: #495057;
  --shadow-color: rgba(0,0,0,0.05);
  --h2-border-color: #dddddd;
  --overtime-color: #dc3545;
  --delay-color: var(--overtime-color);
  --slack-color: #28a745;
  --progress-track-color: #e9ecef;
  --progress-overrun-bg: var(--overtime-color);
  --current-block-overrun-bg: #ffebee;
  --btn-start-bg: #28a745;
  --btn-pause-bg: #ffc107;
  --btn-pause-text: #333;
  --btn-resume-bg: #17a2b8;
  --btn-reset-bg: #6c757d;
  --btn-delete-bg: #dc3545;
  --btn-reorder-bg: #f0f0f0;
  --btn-reorder-text: #555;
  --btn-reorder-hover-bg: #e0e0e0;
  --btn-reset-event-bg: #fd7e14;
  --btn-reset-event-hover-bg: #e86a00;
  --btn-coffee-bg: #3c2a1e;
  --btn-coffee-hover-bg: #5a4030;
  --btn-new-event-bg: #0dcaf0;
  --btn-new-event-hover-bg: #0baccc;

  /* Estilos Base */
  font-family: 'Poppins', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  min-height: 100vh;
  transition: background-color 0.3s ease, color 0.3s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  max-width: none; /* Removido para ocupar tela */
  margin: 0;       /* Removido auto */
  padding-bottom: 40px;
}

.app-container.dark-theme {
  /* Cores Modo Escuro */
  --primary-color: #8a5fff; 
  --primary-hover-color: #a082ff; 
  --bg-color: #1a1d24; --text-color: #e0e0e0; 
  --text-muted-color: #cfcae3; --header-bg: #2f1072; 
  --header-text: #e0e0e0; --button-text: #ffffff; 
  --item-bg: #2c3e50; --item-border: #4b5a6a; 
  --item-active-bg: #3a2c50; --item-active-border: var(--primary-color); 
  --input-bg: #252a33; --input-border: #4b5a6a; --input-text: #e0e0e0; 
  --shadow-color: rgba(0,0,0,0.3); --h2-border-color: #4b5a6a; 
  --overtime-color: #ff6b6b; --progress-track-color: #495057; 
  --progress-overrun-bg: var(--overtime-color); 
  --current-block-overrun-bg: #4d2a2f; --btn-pause-text: #333; 
  --btn-reorder-bg: #3a4a5a; --btn-reorder-text: #ccc; 
  --btn-reorder-hover-bg: #4b5a6a; --btn-reset-event-bg: #fd7e14; 
  --btn-reset-event-hover-bg: #e86a00; --btn-coffee-bg: #c6a78a; 
  --btn-coffee-hover-bg: #ddbb9f; --btn-new-event-bg: #0dcaf0; 
  --btn-new-event-hover-bg: #31d2f2;
}

/* --- Header --- */
header {
  background-color: var(--header-bg);
  color: var(--header-text);
  padding: 15px 25px;
  margin-bottom: 0;
  box-shadow: 0 2px 5px var(--shadow-color);
  border-radius: 0 0 10px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

h1 {
  color: var(--header-text);
  text-align: left;
  margin: 0;
  font-size: 1.7em;
  font-weight: 700;
  flex-grow: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Estilo base para botões/links de ação no header OU na seção global */
.header-button,
.theme-toggle-button {
  background-color: rgba(255, 255, 255, 0.15);
  color: var(--header-text);
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 6px 12px;
  border-radius: 5px; /* Padrão menos redondo */
  font-size: 0.85em;
  cursor: pointer;
  margin: 0;
  transition: background-color 0.2s ease;
  font-family: inherit;
  display: inline-block;
  text-decoration: none;
  white-space: nowrap;
  vertical-align: middle;
}
.dark-theme .header-button,
.dark-theme .theme-toggle-button {
  background-color: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}
.header-button:hover,
.theme-toggle-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
.dark-theme .header-button:hover,
.dark-theme .theme-toggle-button:hover {
  background-color: rgba(0, 0, 0, 0.4);
}

/* Overrides para botões específicos */
.header-button.reset-event { background-color: var(--btn-reset-event-bg); border-color: transparent; }
.header-button.reset-event:hover { background-color: var(--btn-reset-event-hover-bg); }
.header-button.new-event { background-color: var(--btn-new-event-bg); border-color: transparent; color: #000; }
.header-button.new-event:hover { background-color: var(--btn-new-event-hover-bg); }

/* Estilo específico botão de tema (arredondado) */
.theme-toggle-button {
  border-radius: 20px;
}
/* Estilo específico link do café (cor + importante para sobrescrever background base) */
a.coffee-button {
  background-color: var(--btn-coffee-bg) !important;
  border-color: transparent !important;
}
a.coffee-button:hover {
  background-color: var(--btn-coffee-hover-bg) !important;
}

/* --- Main Content --- */
main {
  padding: 20px;
}

section {
  margin-bottom: 20px; /* Espaçamento padrão reduzido */
}

h2 {
  margin-top: 0; /* Resetado no grid */
  border-bottom: 2px solid var(--h2-border-color);
  padding-bottom: 8px;
  color: var(--text-color);
  font-weight: 700;
  font-size: 1.4em;
  margin-bottom: 20px;
}

h3 {
  text-align: left;
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--text-muted-color);
  font-weight: 500;
  font-size: 1.2em;
  border-bottom: 1px solid var(--item-border);
  padding-bottom: 10px;
}

/* --- Seções Específicas --- */

/* Ações Globais do Evento (Mobile: Grid, Desktop: Flex) */
.global-event-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px; /* Aumentado gap */
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--item-border);
}
.global-event-actions .header-button {
  font-size: 0.9em;
  background-color: var(--primary-color); /* Base roxa */
  border-color: transparent;
  color: var(--button-text);
  border-radius: 5px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}
.global-event-actions .header-button:hover { background-color: var(--primary-hover-color); }
.global-event-actions .header-button.reset-event { background-color: var(--btn-reset-event-bg); }
.global-event-actions .header-button.reset-event:hover { background-color: var(--btn-reset-event-hover-bg); }
.global-event-actions .header-button.new-event { background-color: var(--btn-new-event-bg); color: #000; }
.global-event-actions .header-button.new-event:hover { background-color: var(--btn-new-event-hover-bg); }

/* Nome do Evento */
.event-name-section {
  margin-bottom: 25px; 
  background-color: var(--item-bg);
  border: 1px solid var(--item-border);
  border-radius: 6px;
  padding: 15px 20px;
  box-shadow: 0 1px 3px var(--shadow-color);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}
.event-name-section label {
  font-weight: 500;
  color: var(--text-color);
  flex-shrink: 0;
}
.event-name-view {
  display: flex;
  align-items: center; 
  flex-grow: 1;
  gap: 8px;
}

div.event-name-view span.event-name-display {
  font-size: 1.2em;        /* 1.3x tamanho padrão */
  font-weight: 600;     
  color: var(--text-color);/* Cor do tema */
  line-height: 1.4;        /* Ajuda no alinhamento vertical */
  flex-grow: 1;            
  padding: 0px 0;         
  /* Garante que não herda bordas/margens */
  border: none;
  margin: 0;
  padding-bottom: 0;
  /* Para nomes longos */
  overflow-wrap: break-word;
  word-break: break-all;
}


.event-name-edit {
  display: flex;
  align-items: center;
  flex-grow: 1;
  gap: 8px;
}
.event-name-edit input {
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  flex-grow: 1;
  font-size: 1.1em;
  font-weight: 500;
  font-family: inherit;
  background-color: var(--input-bg);
  color: var(--input-text);
  min-width: 200px;
}
.inline-edit-button,
.inline-confirm-button,
.inline-cancel-button {
  background: none;
  border: none;
  padding: 2px 5px;
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  color: var(--text-muted-color);
  margin: 0;
  display: inline-block;
  vertical-align: middle;
}
.inline-edit-button:hover,
.inline-confirm-button:hover,
.inline-cancel-button:hover { opacity: 0.7; }
.inline-confirm-button { color: var(--btn-start-bg); }
.inline-cancel-button { color: var(--btn-delete-bg); }

/* Formulário Add Bloco */
.add-block-form-section {
  background-color: var(--item-bg);
  border: 1px solid var(--item-border);
  border-radius: 6px;
  padding: 20px;
  box-shadow: 0 1px 3px var(--shadow-color);
}
.add-block-form-section h3 { text-align: center; border-bottom: none; }
.add-block-form-section div { margin-bottom: 15px; display: flex; align-items: center; flex-wrap: wrap; }
.add-block-form-section label { margin-right: 10px; width: 150px; text-align: right; flex-shrink: 0; font-weight: 500; color: var(--text-color); margin-bottom: 5px; }
.add-block-form-section input { padding: 10px; border: 1px solid var(--input-border); border-radius: 4px; flex-grow: 1; font-size: 1em; font-family: inherit; background-color: var(--input-bg); color: var(--input-text); margin-bottom: 5px; }
.add-block-form-section input::placeholder { color: var(--text-muted-color); opacity: 0.8; }
/* Estilo Botão Adicionar Bloco */
.add-block-button {
  display: block; margin: 10px 0 0 0; padding: 12px 25px; cursor: pointer;
  background-color: var(--primary-color); color: var(--button-text); border: none;
  border-radius: 5px; font-size: 1.1em; font-weight: 500; font-family: inherit;
  transition: background-color 0.2s ease; width: 100%;
}
.add-block-button:hover { background-color: var(--primary-hover-color); }

/* Botão Próximo Bloco / Iniciar Evento */
button.next-block-button {
  display: block; margin: 20px auto 10px auto; padding: 12px 25px; cursor: pointer;
  background-color: var(--primary-color); color: var(--button-text); border: none;
  border-radius: 5px; font-size: 1.1em; font-weight: 500; font-family: inherit;
  transition: background-color 0.2s ease;
}
button.next-block-button:hover { background-color: var(--primary-hover-color); }

/* Status Geral */
.event-status-section { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 15px; text-align: center; }
.status-item span { display: block; font-size: 0.9em; color: var(--text-muted-color); margin-bottom: 5px; }
.status-item strong { font-size: 1.6em; font-weight: 700; color: var(--text-color); display: block; }
.status-item .delay { color: var(--delay-color); }
.status-item .slack { color: var(--slack-color); }

/* Bloco Atual / Agora */
.current-block-section { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); transition: background-color 0.3s ease; display: flex; flex-direction: column; /* Necessário para flex-grow na textarea */ }
.current-block-section.overrun-bg { background-color: var(--current-block-overrun-bg); }
.current-block-section h3 { border-bottom-color: var(--item-border); }
.current-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
.current-block-header h4 { margin: 0; font-size: 1.4em; font-weight: 700; color: var(--primary-color); }
.dark-theme .current-block-header h4 { color: var(--text-color); }
.current-block-timer { font-size: 1.6em; font-weight: 700; color: var(--text-color); white-space: nowrap; }
.current-block-timer.overtime-indicator { color: var(--overtime-color); }
.progress-bar-container { width: 100%; height: 10px; background-color: var(--progress-track-color); border-radius: 5px; overflow: hidden; margin-top: 8px; margin-bottom: 15px; }
.progress-bar { height: 100%; background-color: var(--primary-color); border-radius: 5px 0 0 5px; transition: width 0.2s linear, background-color 0.3s ease; }
.progress-bar.progress-overrun { background-color: var(--progress-overrun-bg); border-radius: 5px; }
.current-block-section label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: 500; color: var(--text-muted-color); font-size: 0.9em;}
.current-block-section textarea { width: 100%; min-height: 120px; /* Altura mínima */ flex-grow: 1; /* Ocupa espaço vertical disponível */ border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 10px; font-family: inherit; font-size: 1em; margin-top: 5px; box-sizing: border-box; resize: vertical; }

/* Lista de Blocos */
ul { list-style: none; padding: 0; }
li { background-color: var(--item-bg); border: 1px solid var(--item-border); color: var(--text-color); padding: 15px; margin-bottom: 12px; border-radius: 6px; font-size: 1em; display: block; box-shadow: 0 1px 3px var(--shadow-color); transition: box-shadow 0.2s ease, border-left 0.3s ease, background-color 0.3s ease; border-left: 5px solid transparent; }
li:hover { box-shadow: 0 3px 6px var(--shadow-color); }
li.active { background-color: var(--item-active-bg); border-left: 5px solid var(--item-active-border); font-weight: 500; }
.block-info { margin-bottom: 10px; line-height: 1.4; overflow-wrap: break-word; }
.block-actions-row { display: flex; justify-content: space-between; align-items: center; /* flex-wrap: wrap; */ /* Removido para forçar linha única */ gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--item-border); }
.control-buttons-group { display: inline-flex; gap: 5px; flex-wrap: wrap; }
.reorder-buttons-group { display: inline-flex; gap: 5px; flex-shrink: 0; }
.notes-area { margin-top: 12px; width: 100%; }
.notes-area textarea { width: 100%; min-height: 60px; border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 8px; font-family: inherit; font-size: 0.95em; box-sizing: border-box; resize: vertical; }
.overtime-indicator { color: var(--overtime-color); font-weight: bold; }
.delay { color: var(--delay-color); }
.slack { color: var(--slack-color); }
.block-info span .delay, .block-info span .slack { font-weight: bold; font-size: 0.9em; margin-left: 5px; }

/* Mensagem de lista vazia */
p { text-align: center; color: var(--text-muted-color); margin-top: 30px; font-size: 1.1em; }

/* Botões de Controle na Lista */
.control-button { display: inline-block; margin: 0; padding: 5px 8px; font-size: 1em; line-height: 1; cursor: pointer; color: var(--button-text); border: none; border-radius: 4px; vertical-align: middle; font-weight: normal; font-family: inherit; transition: opacity 0.2s ease, background-color 0.2s ease; }
.control-button:hover { opacity: 0.85; }
.control-button.start { background-color: var(--btn-start-bg); }
.control-button.pause { background-color: var(--btn-pause-bg); color: var(--btn-pause-text); }
.control-button.resume { background-color: var(--btn-resume-bg); }
.control-button.reset { background-color: var(--btn-reset-bg); }
.control-button.delete { background-color: var(--btn-delete-bg); }

/* Botões Reordenar */
.reorder-buttons-group button { background-color: var(--btn-reorder-bg); color: var(--btn-reorder-text); border: 1px solid var(--item-border); padding: 3px 8px; font-size: 1.2em; line-height: 1; cursor: pointer; border-radius: 3px; vertical-align: middle; }
.reorder-buttons-group button:disabled { opacity: 0.4; cursor: not-allowed; }
.reorder-buttons-group button:hover:not(:disabled) { background-color: var(--btn-reorder-hover-bg); }

/* Estilos Grid Layout para Telas Maiores */
@media (min-width: 992px) {
  main { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(400px, 1.5fr); grid-template-rows: auto auto auto 1fr auto; /* Adicionada linha 5 para lista */ gap: 15px 30px; align-items: stretch; /* Tenta esticar itens */ }
  .global-event-actions { grid-column: 1 / 3; grid-row: 1; padding-bottom: 15px; margin-bottom: 0; border-bottom: 1px solid var(--item-border); justify-content: flex-start; display:flex; flex-wrap: wrap; gap: 10px; align-self: start; } /* Garante flex e alinha topo */
  .global-event-actions .header-button { width: auto; }
  .event-name-section { grid-column: 1; grid-row: 2; align-self: start; } /* Col 1, Linha 2 */
  .event-status-section { grid-column: 1; grid-row: 3; align-self: start; } /* Col 1, Linha 3 */
  .add-block-form-section { grid-column: 1; grid-row: 4; align-self: start; } /* Col 1, Linha 4 */
  .current-block-section { grid-column: 2; grid-row: 2 / span 3; /* Col 2, Linhas 2-4 */ display: flex; flex-direction: column; align-self: stretch; } /* Ocupa altura */
  .current-block-section textarea { flex-grow: 1; min-height: 200px; } /* Textarea cresce */
  .block-list-section { grid-column: 1 / 3; grid-row: 5; align-self: start; } /* Linha 5, Col 1-2 */
  main section { margin-bottom: 0; }
  .global-event-actions, .event-name-section, .event-status-section, .add-block-form-section, .current-block-section { margin-bottom: 15px; } /* Aplica gap vertical via margem (exceto última linha) */
  /* Zera margem topo para títulos dentro do grid */
  .add-block-form-section h3, .timer-list-section h2, .event-status-section h3, .current-block-section h3 { margin-top: 0; }
}

/* Define a animação de pulso/flash */
@keyframes pulse-bg-light {
  0%   { background-color: transparent; transform: scale(1); }
  50%  { background-color: rgba(104, 33, 255, 0.2); /* Roxo primário claro semi-transparente */ transform: scale(1.05); }
  100% { background-color: transparent; transform: scale(1); }
}

@keyframes pulse-bg-dark {
  0%   { background-color: transparent; transform: scale(1); }
  50%  { background-color: rgba(138, 95, 255, 0.3); /* Roxo primário escuro semi-transparente */ transform: scale(1.05); }
  100% { background-color: transparent; transform: scale(1); }
}

/* Aplica a animação ao <strong> quando a classe está presente */
.status-item strong.highlight-change {
  animation: pulse-bg-light 1s ease-out; /* Duração de 1s */
  border-radius: 4px; /* Para o fundo ficar contido */
  /* display: inline-block; */ /* Talvez necessário se strong não se comportar bem */
  padding: 0 4px; /* Pequeno padding para o fundo não colar no texto */
  margin: 0 -4px; /* Compensa o padding */
  transition: background-color 0.2s; /* Suaviza */
}

/* Sobrescreve a animação no tema escuro */
.dark-theme .status-item strong.highlight-change {
   animation-name: pulse-bg-dark;
}

.app-title {
  display: flex; /* Coloca a imagem e o texto lado a lado */
  align-items: center; /* Alinha verticalmente a imagem e o texto no centro */
  gap: 8px; /* Adiciona um espaço entre a imagem e o texto (ajuste conforme necessário) */
  /* Você pode adicionar outros estilos ao h1 aqui se precisar, como font-size, color, margin, etc. */
  margin: 1; /* Exemplo: remove margens padrão do h1 se necessário */
}

.header-logo {
  height: 1.2em; /* Define a altura da imagem relativa ao tamanho da fonte do h1. Ajuste! */
  /* Alternativamente, use um valor fixo: height: 30px; */
  transform: translateY(-2px);
  width: auto; /* Mantém a proporção da imagem */
}

.dark-theme .header-actions a.coffee-button {
   color: #333 !important; /* << Define um texto BEM ESCURO para contraste */
   /* Alternativa: Usar uma variável se tiver: var(--texto-sobre-fundo-claro); */
}


/* Estilos para a lista UL renderizada pelo TransitionGroup */
/* Substitui a regra 'ul { ... }' */
.block-list-ul {
  list-style: none;
  padding: 0;
  position: relative; /* Necessário para posicionar itens que saem */
}

/* Transições da Lista (prefixo 'list-' baseado no name="list") */

/* Estado inicial ao ENTRAR e estado final ao SAIR */
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px); /* Começa/termina deslizando da direita */
}

/* Define a duração e easing para ENTRADA e SAÍDA */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease; /* Meio segundo de animação suave */
}

/* Importante para animações de MOVER: */
/* Faz com que os itens saindo não ocupem espaço físico, */
/* permitindo que os outros itens se movam suavemente para suas novas posições. */
.list-leave-active {
  position: absolute; /* Tira o item do fluxo normal */
  width: 100%; /* Mantém a largura para evitar colapso */
}

/* Transição para itens que se MOVEM (reordenação) */
.list-move {
  transition: transform 0.5s ease; /* Anima apenas a mudança de posição (transform) */
}

/* ----- NOVO: Estilos do Footer Revisado ----- */
.app-footer-revised {
  display: flex;
  justify-content: space-between; /* Espaça os 3 blocos */
  align-items: center; /* Alinha verticalmente */
  flex-wrap: wrap; /* Quebra linha em telas pequenas */
  gap: 15px 30px; /* Espaçamento vertical e horizontal */
  padding: 25px 30px; /* Padding interno */
  margin-top: 50px; /* Espaço acima do footer */
  border-top: 1px solid var(--item-border); /* Linha separadora */
  font-size: 0.8em; /* Texto geral menor */
  color: var(--text-muted-color); /* Cor padrão mais suave */
}

/* Blocos Esquerda, Centro, Direita */
.footer-left,
.footer-center,
.footer-right {
  display: flex;
  align-items: center;
  gap: 8px; /* Espaço entre itens dentro de cada bloco */
}

.footer-left {
  flex-shrink: 0; /* Não encolhe */
}
.footer-logo-app {
  max-height: 20px;
  vertical-align: middle;
}
.footer-app-name {
  font-weight: 500;
  color: var(--text-color); /* Destaca nome do app */
}

.footer-center {
  flex-grow: 1; /* Ocupa espaço central */
  flex-direction: column; /* Empilha "Sobre" e "Copyright" */
  text-align: center;
  gap: 5px; /* Espaço entre as linhas */
}
.footer-about-text,
.footer-copyright {
  margin: 0;
  line-height: 1.3;
}
.footer-copyright a { /* Link da licença */
  color: var(--text-muted-color);
  text-decoration: underline;
  transition: color 0.2s ease;
}
.footer-copyright a:hover {
  color: var(--primary-color);
}

.footer-right {
  flex-shrink: 0;
  justify-content: flex-end; /* Alinha à direita */
}
.footer-right span {
   margin-right: 5px; /* Espaço texto -> logo */
}
.footer-logo-personal {
  max-height: 40px; /* Ajuste a altura do seu logo */
  vertical-align: middle;
}

/* Footer Responsivo (Empilha no Mobile) */
@media (max-width: 768px) {
  .app-footer-revised {
    flex-direction: column; /* Empilha os 3 blocos */
    gap: 20px; /* Aumenta gap vertical */
  }
  .footer-center { order: 1; } /* Sobre/Copyright primeiro */
  .footer-right { order: 2; justify-content: center; } /* Feito por... segundo */
  .footer-left { order: 3; }  /* Logo/Nome app por último */
}


.button-icon {
  width: 1em; /* Tamanho relativo à fonte do botão */
  height: 1em; /* Mantém proporção quadrada */
  /* Ajuste fino de alinhamento vertical com o texto (se houver) */
  /* Common values: middle, text-bottom, -0.15em, etc. Experiment! */
  vertical-align: -0.15em;
  display: inline-block; /* Para alinhar corretamente */

  /* Para ícones baseados em linhas (stroke) como Feather Icons: */
  fill: noner; /* Geralmente não preenchemos */
  stroke: currentColor; /* <<< MÁGICA: Herda a cor do texto do botão! */
  stroke-width: 2; /* Ajuste conforme o set de ícones (Feather usa 2) */

}

/* Pode ser necessário ajustar padding dos botões se o SVG mudar o tamanho percebido */
.control-button, .inline-edit-button, .reorder-buttons-group button /* etc */ {
    /* Verifique se o padding ainda parece bom com o SVG */
    /* padding: 5px 8px; */
    /* line-height pode ajudar a centralizar o SVG verticalmente */
    /* line-height: 1; */
}


</style>