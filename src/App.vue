<script setup>
// ----- BLOCO SCRIPT SETUP -----
import { ref, onMounted, onUnmounted, watchEffect, computed } from 'vue'

// --- ESTADO REATIVO ---
const event = ref({
  eventName: 'Meu Evento Padrão', // Nome padrão, será carregado/salvo
  blocks: []              // Array de Blocos
});
const newBlockName = ref('');         // Input Nome do Bloco
const newBlockDuration = ref(60);    // Input Duração do Bloco (segundos)
const currentBlockIndex = ref(null); // Índice do bloco ativo (-1 ou null = nenhum)
const isDarkMode = ref(false);        // Controle do Tema (false = claro)

// --- FUNÇÃO AUXILIAR DE TEMPO ---
// Converte segundos para formato "HH:MM:SS"
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || !isFinite(totalSeconds)) { return '00:00:00'; }
  const absSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = Math.floor(absSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- COMPUTED PROPERTIES (Valores Calculados Dinamicamente) ---

// Tempo total planejado
const totalPlannedDuration = computed(() => {
  const totalSeconds = event.value.blocks.reduce((sum, block) => sum + (block.duration || 0), 0);
  return formatTime(totalSeconds);
});

// Tempo total REAL decorrido no evento
const totalEventElapsedTime = computed(() => {
    let elapsedSeconds = 0;
    for(const block of event.value.blocks) {
        if (block.status === 'completed') { elapsedSeconds += block.duration; } // Conta duração planejada se completado SEM estourar
        else if (block.status === 'overrun') { elapsedSeconds += block.elapsedTime; } // Conta tempo real se estourou
        else if (block.status === 'running' || block.status === 'paused') {
             // Se está ativo ou pausado, conta o tempo decorrido nele e para
             const blockIndex = event.value.blocks.findIndex(b => b.id === block.id);
             if(blockIndex === currentBlockIndex.value) {
                 elapsedSeconds += block.elapsedTime;
                 break;
             } else if (block.status === 'paused') {
                 // Considera o tempo de blocos pausados *antes* do atual, se relevante
                 elapsedSeconds += block.elapsedTime;
             }
        }
    }
    return elapsedSeconds; // Retorna em segundos
});

// Atraso/Folga ACUMULADO baseado nos blocos concluídos
const cumulativeEventDelay = computed(() => {
    const totalDelaySeconds = event.value.blocks.reduce((sum, block) => {
        // Soma apenas se completionDelay for um número (bloco efetivamente concluído/marcado)
        return sum + (typeof block.completionDelay === 'number' ? block.completionDelay : 0);
    }, 0);
    const roundedDelay = Math.round(totalDelaySeconds);
    return {
        sign: roundedDelay > 5 ? '+' : (roundedDelay < -5 ? '-' : ''), // Tolerância 5s
        time: formatTime(Math.abs(roundedDelay)),
        seconds: roundedDelay
    };
});


// Retorna o objeto do bloco atual ou null
const currentBlock = computed(() => {
  if (currentBlockIndex.value !== null && currentBlockIndex.value >= 0 && currentBlockIndex.value < event.value.blocks.length) {
    return event.value.blocks[currentBlockIndex.value];
  }
  return null;
});


// --- PERSISTÊNCIA COM LOCALSTORAGE ---
watchEffect(() => {
  // Salva o objeto event (incluindo eventName, notes, completionDelay) e o tema
  localStorage.setItem('mestariEventData', JSON.stringify(event.value));
  localStorage.setItem('mestariTheme', JSON.stringify(isDarkMode.value));
  // console.log("Estado salvo."); // Log pode ser habilitado para debug
});

// --- GERENCIAMENTO DO TICKER GLOBAL ---
let intervalId = null;
onMounted(() => {
  // Carrega evento
  const savedEvent = localStorage.getItem('mestariEventData');
  if (savedEvent) {
    try {
      const loadedEvent = JSON.parse(savedEvent);
      // Garante estrutura mínima e restaura nome/blocos
      event.value = {
        eventName: loadedEvent?.eventName || 'Meu Evento Recuperado',
        blocks: Array.isArray(loadedEvent?.blocks) ? loadedEvent.blocks : []
      };
      // Garante que propriedades existam nos blocos carregados
      event.value.blocks.forEach(block => {
        if (block.completionDelay === undefined) block.completionDelay = null;
        if (block.elapsedTime === undefined) block.elapsedTime = 0;
        if (block.notes === undefined) block.notes = '';
        // Reseta status não-ociosos ao carregar
        if (block.status !== 'idle' && block.status !== 'completed') {
             block.status = 'idle'; // Começa parado ao carregar
        }
      });
    } catch (e) {
      console.error("Erro ao carregar evento:", e); localStorage.removeItem('mestariEventData');
      event.value = { eventName: 'Novo Evento (Erro ao Carregar)', blocks: [] };
    }
  } else {
    event.value.eventName = 'Meu Primeiro Evento'; // Nome inicial se nada salvo
  }

  // Carrega tema
  const savedTheme = localStorage.getItem('mestariTheme');
  if (savedTheme) { try { isDarkMode.value = JSON.parse(savedTheme); } catch(e) { console.error("Erro ao carregar tema", e); } }

  currentBlockIndex.value = null; // Nenhum bloco ativo ao iniciar
  intervalId = setInterval(tick, 1000); // Inicia ticker
});
onUnmounted(() => { clearInterval(intervalId); }); // Limpa ticker

// --- FUNÇÕES CORE ---
// 'tick': Atualiza tempo decorrido do bloco ativo
function tick() {
  if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
      currentBlock.value.elapsedTime++;
      // Muda para 'overrun' se tempo estourou E ainda estava 'running'
      if (currentBlock.value.status === 'running' && currentBlock.value.elapsedTime > currentBlock.value.duration) {
          console.log(`Tempo do bloco ${currentBlock.value.id} estourado!`);
          currentBlock.value.status = 'overrun';
          // TODO: Sinal visual/sonoro
      }
  }
}

// Marca bloco como completo e calcula seu delay/folga
function markBlockComplete(block) {
  if (!block || block.status === 'completed') return;
  // Calcula o desvio SÓ se não foi calculado antes
  if (block.completionDelay === null) {
      block.completionDelay = block.elapsedTime - block.duration;
  }
  block.status = 'completed';
  console.log(`Bloco ${block.id} marcado como completo com delay/folga de ${block.completionDelay}s`);
}

// Adiciona novo bloco
function addBlock() {
  const name = newBlockName.value.trim();
  const duration = newBlockDuration.value;
  if (typeof duration !== 'number' || duration <= 0) { return alert('Duração inválida.'); }
  const newBlock = { id: Date.now(), name: name || `Bloco ${event.value.blocks.length + 1}`,
    duration: duration, elapsedTime: 0, status: 'idle', notes: '', completionDelay: null };
  event.value.blocks.push(newBlock);
  newBlockName.value = ''; newBlockDuration.value = 60;
}

// --- FUNÇÕES DE CONTROLE ---
function startBlock(blockId) {
  const blockIndex = event.value.blocks.findIndex(b => b.id === blockId);
  if (blockIndex !== -1 && event.value.blocks[blockIndex].status === 'idle') {
    // Pausa o bloco anterior, se houver um rodando/estourado
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
     event.value.blocks.forEach((block, index) => { // Pausa outros por segurança
         if(index !== currentBlockIndex.value && (block.status === 'running' || block.status === 'overrun')) { block.status = 'paused'; }
     });
     // Volta para 'running' ou 'overrun' dependendo do tempo
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
    block.completionDelay = null; // Reseta delay
    if (wasCurrent) { currentBlockIndex.value = null; }
  }
}
function deleteBlock(blockId) {
  const index = event.value.blocks.findIndex(b => b.id === blockId);
  if (index !== -1) {
    const wasCurrent = (currentBlockIndex.value === index);
    const isBeforeCurrent = (currentBlockIndex.value !== null && index < currentBlockIndex.value);
    event.value.blocks.splice(index, 1);
    if (wasCurrent) { currentBlockIndex.value = null; }
    else if (isBeforeCurrent) { currentBlockIndex.value--; }
  }
}
// Avança para o próximo bloco manualmente
function goToNextBlock() {
    let nextIndex = -1;
    const currentIndex = currentBlockIndex.value;

    if (currentIndex === null) { // Inicia o primeiro idle se nenhum estiver ativo
        nextIndex = event.value.blocks.findIndex(b => b.status === 'idle');
    } else { // Avança a partir do atual
        const currentBlockRef = event.value.blocks[currentIndex];
        markBlockComplete(currentBlockRef); // Marca atual como completo (calcula delay)
        nextIndex = currentIndex + 1; // Próximo na sequência
        if (nextIndex >= event.value.blocks.length) { nextIndex = -1; } // Verifica fim da lista
    }

    if (nextIndex !== -1) { // Se encontrou um próximo
        currentBlockIndex.value = nextIndex;
        // Inicia o próximo bloco se ele estiver 'idle'
        if(event.value.blocks[nextIndex].status === 'idle'){
             event.value.blocks[nextIndex].status = 'running';
        } // Se não estiver 'idle', apenas o torna ativo (ex: se já estava pausado)
    } else { // Fim da lista
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

// --- FUNÇÕES DE UI ---
function toggleTheme() { isDarkMode.value = !isDarkMode.value; }
const themeButtonText = computed(() => { return isDarkMode.value ? '☀️ Modo Claro' : '🌙 Modo Noturno'; });

// ----- FIM DO BLOCO SCRIPT SETUP -----
</script>

<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }">
    <header>
      <h1>Mestari ⏱️</h1>
      <button @click="toggleTheme" class="theme-toggle-button">
        {{ themeButtonText }}
      </button>
    </header>

    <main>
      <section class="event-name-section">
          <label for="eventNameInput">Nome do Evento:</label>
          <input title="Nome do Evento" type="text" id="eventNameInput" v-model="event.eventName">
      </section>

      <section class="event-status">
        <h3>Status Geral do Evento</h3>
        <div class="status-grid">
          <div class="status-item">
            <span>Planejado</span>
            <strong>{{ totalPlannedDuration }}</strong>
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

      <section class="current-block" v-if="currentBlock">
        <h3>Agora:</h3>
        <div class="current-block-header">
           <h4>{{ currentBlock.name || 'Bloco Atual' }}</h4>
           <span class="current-block-timer" :class="{ 'overtime-indicator': currentBlock.elapsedTime > currentBlock.duration }">
             {{ formatTime(currentBlock.elapsedTime) }} / {{ formatTime(currentBlock.duration) }}
           </span>
        </div>
        <label :for="'notes-' + currentBlock.id">Pauta e Anotações:</label>
        <textarea :id="'notes-' + currentBlock.id" v-model="currentBlock.notes"></textarea>
         <button @click="goToNextBlock" class="next-block-button">
             Próximo Bloco ▶▶
         </button>
      </section>
      <section class="current-block" v-else>
         <h3>Nenhum bloco ativo</h3>
         <p v-if="event.blocks.length > 0 && event.blocks.some(b => b.status === 'idle')">Use o botão "Iniciar" na lista abaixo ou clique aqui para iniciar o próximo bloco ocioso.</p>
         <p v-else-if="event.blocks.length > 0">Todos os blocos foram concluídos ou estão pausados.</p>
         <p v-else>Adicione blocos ao evento para começar.</p>
         <button v-if="event.blocks.some(b => b.status === 'idle')" @click="goToNextBlock" class="next-block-button">
              Iniciar Evento / Próximo Bloco ▶▶
          </button>
      </section>

      <section class="add-timer-form">
        <h3>Adicionar Novo Bloco</h3>
        <div>
          <label for="blockName">Nome do Bloco: </label>
          <input type="text" id="blockName" v-model="newBlockName" placeholder="Nome do bloco"/>
        </div>
        <div>
          <label for="blockDuration">Duração (segundos): </label>
          <input type="number" id="blockDuration" v-model.number="newBlockDuration" min="1"/>
        </div>
        <button @click="addBlock">Adicionar Bloco</button>
      </section>

      <section class="timer-list-section">
        <h2>Blocos do Evento:</h2>
        <ul v-if="event.blocks.length > 0">
          <li v-for="(block, index) in event.blocks" :key="block.id" :class="{ active: index === currentBlockIndex }">
            <div class="block-content">
                <span>
                  {{ block.name || 'Sem nome' }} | {{ formatTime(block.duration) }} |
                  Dec: <span :class="{ 'overtime-indicator': block.elapsedTime > block.duration }">{{ formatTime(block.elapsedTime) }}</span> |
                  Status: {{ block.status }}
                  <span v-if="block.completionDelay !== null" :class="{ delay: block.completionDelay > 5, slack: block.completionDelay < -5 }">
                     (Desvio: {{ block.completionDelay >= 0 ? '+' : '' }}{{ formatTime(block.completionDelay) }})
                  </span>
                </span>
                <span> <button v-if="block.status === 'idle'" @click="startBlock(block.id)" class="control-button start" title="Iniciar">▶</button>
                  <button v-if="(block.status === 'running' || block.status === 'overrun') && index === currentBlockIndex" @click="pauseBlock()" class="control-button pause" title="Pausar">❚❚</button>
                  <button v-if="block.status === 'paused' && index === currentBlockIndex" @click="resumeBlock()" class="control-button resume" title="Retomar">►</button>
                  <button v-if="block.status !== 'idle'" @click="resetBlock(block.id)" class="control-button reset" title="Resetar">↻</button>
                  <button @click="deleteBlock(block.id)" class="control-button delete" title="Deletar">🗑</button>
                </span>
            </div>
             <div class="reorder-controls">
                <button @click="moveBlockUp(index)" :disabled="index === 0" title="Mover para cima">⬆️</button>
                <button @click="moveBlockDown(index)" :disabled="index === event.blocks.length - 1" title="Mover para baixo">⬇️</button>
            </div>
            <div class="notes-area">
                <textarea :id="'notes-li-' + block.id" v-model="block.notes" placeholder="Adicionar pauta/anotações..." rows="3"></textarea> </div>
          </li>
        </ul>
        <p v-else>Nenhum bloco adicionado a este evento ainda.</p>
      </section>
    </main>
  </div>
  </template>

<style scoped>
/* ----- BLOCO STYLE SCOPED ----- */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap');

/* Variáveis e Estilos Gerais */
:root { /* Variáveis definidas aqui para referência, mas aplicadas via .app-container */ }
.app-container {
  /* Cores Modo Claro */
  --primary-color: #6821ff; --primary-hover-color: #551adf;
  --bg-color: #ffffff; --text-color: #333333; --text-muted-color: #777777;
  --header-bg: var(--primary-color); --header-text: #ffffff; --button-text: #ffffff;
  --item-bg: #f8f9fa; --item-border: #dee2e6; --item-active-bg: #e8e0ff;
  --item-active-border: var(--primary-color); --input-bg: #ffffff; --input-border: #ced4da;
  --input-text: #495057; --shadow-color: rgba(0,0,0,0.05); --h2-border-color: #dddddd;
  --overtime-color: #dc3545; --delay-color: var(--overtime-color); --slack-color: #28a745;
  --btn-start-bg: #28a745; --btn-pause-bg: #ffc107; --btn-pause-text: #333;
  --btn-resume-bg: #17a2b8; --btn-reset-bg: #6c757d; --btn-delete-bg: #dc3545;
  --btn-reorder-bg: #f0f0f0; --btn-reorder-text: #555; --btn-reorder-hover-bg: #e0e0e0;

  font-family: 'Poppins', sans-serif; background-color: var(--bg-color); color: var(--text-color);
  min-height: 100vh; transition: background-color 0.3s ease, color 0.3s ease;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  max-width: 800px; margin: 0 auto; padding-bottom: 40px;
}
.app-container.dark-theme {
  /* Cores Modo Escuro */
  --primary-color: #8a5fff; --primary-hover-color: #a082ff;
  --bg-color: #1a1d24; --text-color: #e0e0e0; --text-muted-color: #a0a0a0;
  --header-bg: #2f1072; --header-text: #e0e0e0;
  --button-text: #ffffff; --item-bg: #2c3e50; --item-border: #4b5a6a;
  --item-active-bg: #3a2c50; --item-active-border: var(--primary-color);
  --input-bg: #252a33; --input-border: #4b5a6a; --input-text: #e0e0e0;
  --shadow-color: rgba(0,0,0,0.3); --h2-border-color: #4b5a6a;
  --overtime-color: #ff6b6b;
  --btn-pause-text: #333;
  --btn-reorder-bg: #3a4a5a; --btn-reorder-text: #ccc; --btn-reorder-hover-bg: #4b5a6a;
}

/* Header */
header { background-color: var(--header-bg); color: var(--header-text); padding: 15px 25px; margin-bottom: 30px; box-shadow: 0 2px 5px var(--shadow-color); border-radius: 0 0 10px 10px; display: flex; align-items: center; justify-content: space-between; }
h1 { color: var(--header-text); text-align: left; margin: 0; font-size: 1.7em; font-weight: 700; }
.theme-toggle-button { background-color: rgba(255, 255, 255, 0.15); color: var(--header-text); border: 1px solid rgba(255, 255, 255, 0.5); padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 0.8em; font-family: inherit; display: inline-block; margin: 0; transition: background-color 0.2s ease; }
.dark-theme .theme-toggle-button { background-color: rgba(0, 0, 0, 0.2); border-color: rgba(255, 255, 255, 0.4); }
.theme-toggle-button:hover { background-color: rgba(255, 255, 255, 0.3); }
.dark-theme .theme-toggle-button:hover { background-color: rgba(0, 0, 0, 0.4); }

/* Main, Sections, H2, H3 */
main { padding: 0 20px; }
section { margin-bottom: 35px; }
h2 { margin-top: 25px; border-bottom: 2px solid var(--h2-border-color); padding-bottom: 8px; color: var(--text-color); font-weight: 700; font-size: 1.4em; }
h3 { text-align: left; margin-top:0; margin-bottom: 20px; color: var(--text-muted-color); font-weight: 500; font-size: 1.2em; border-bottom: 1px solid var(--item-border); padding-bottom: 10px; }
section.add-timer-form h3 { text-align: center; border-bottom: none; }

/* Seção Nome do Evento */
.event-name-section { margin-bottom: 25px; background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 15px 20px; box-shadow: 0 1px 3px var(--shadow-color); display: flex; align-items: center; }
.event-name-section label { margin-right: 10px; font-weight: 500; color: var(--text-color); flex-shrink: 0; }
.event-name-section input { padding: 10px; border: 1px solid var(--input-border); border-radius: 4px; flex-grow: 1; font-size: 1.1em; font-weight: 500; font-family: inherit; background-color: var(--input-bg); color: var(--input-text); }

/* Formulário Add Bloco */
.add-timer-form { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.add-timer-form div { margin-bottom: 15px; display: flex; align-items: center; flex-wrap: wrap; }
.add-timer-form label { margin-right: 10px; width: 150px; text-align: right; flex-shrink: 0; font-weight: 500; color: var(--text-color); margin-bottom: 5px; }
.add-timer-form input { padding: 10px; border: 1px solid var(--input-border); border-radius: 4px; flex-grow: 1; font-size: 1em; font-family: inherit; background-color: var(--input-bg); color: var(--input-text); margin-bottom: 5px; }
.add-timer-form input::placeholder { color: var(--text-muted-color); opacity: 0.8; }
.add-timer-form button { margin-top: 10px; margin-bottom: 0; width: 100%; }

/* Botões Principais (Add Bloco, Próximo Bloco, Iniciar Evento) */
button { display: block; margin: 20px auto 10px auto; padding: 12px 25px; cursor: pointer; background-color: var(--primary-color); color: var(--button-text); border: none; border-radius: 5px; font-size: 1.1em; font-weight: 500; font-family: inherit; transition: background-color 0.2s ease; }
button:hover { background-color: var(--primary-hover-color); }
.next-block-button { background-color: var(--primary-color); } /* Garante cor primária */
.next-block-button:hover { background-color: var(--primary-hover-color); }

/* Status Geral */
.event-status { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 15px; text-align: center; }
.status-item span { display: block; font-size: 0.9em; color: var(--text-muted-color); margin-bottom: 5px; }
.status-item strong { font-size: 1.6em; font-weight: 700; color: var(--text-color); display: block; }
.status-item .delay { color: var(--delay-color); }
.status-item .slack { color: var(--slack-color); }

/* Bloco Atual / Agora */
.current-block { background-color: var(--item-active-bg); border: 1px solid var(--item-active-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.current-block h3 { border-bottom-color: var(--item-border); }
.current-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; }
.current-block-header h4 { margin: 0; font-size: 1.4em; font-weight: 700; color: var(--primary-color); }
.dark-theme .current-block-header h4 { color: var(--primary-color); }
.current-block-timer { font-size: 1.6em; font-weight: 700; color: var(--text-color); white-space: nowrap; }
.current-block-timer.overtime-indicator { color: var(--overtime-color); }
.current-block label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: 500; color: var(--text-muted-color); font-size: 0.9em;}
.current-block textarea { width: 100%; min-height: 120px; border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 10px; font-family: inherit; font-size: 1em; margin-top: 5px; box-sizing: border-box; resize: vertical; }

/* Lista de Blocos */
ul { list-style: none; padding: 0; }
li { background-color: var(--item-bg); border: 1px solid var(--item-border); color: var(--text-color); padding: 15px; margin-bottom: 12px; border-radius: 6px; font-size: 1em; display: block; box-shadow: 0 1px 3px var(--shadow-color); transition: box-shadow 0.2s ease, border-left 0.3s ease, background-color 0.3s ease; border-left: 5px solid transparent; }
li:hover { box-shadow: 0 3px 6px var(--shadow-color); }
li.active { background-color: var(--item-active-bg); border-left: 5px solid var(--item-active-border); font-weight: 500; }

.block-content { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 10px; }
.block-content > span:first-child { flex-grow: 1; margin-right: 15px; overflow-wrap: break-word; margin-bottom: 5px; line-height: 1.4; } /* Melhora leitura */
.block-content > span:last-child { white-space: nowrap; flex-shrink: 0; margin-left: auto; }
.notes-area { margin-top: 10px; width: 100%; }
.notes-area textarea { width: 100%; min-height: 60px; border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 8px; font-family: inherit; font-size: 0.95em; box-sizing: border-box; resize: vertical; }
.reorder-controls { margin-top: 10px; text-align: right; border-top: 1px solid var(--item-border); padding-top: 10px;}
.overtime-indicator { color: var(--overtime-color); font-weight: bold; }
.delay { color: var(--delay-color); }
.slack { color: var(--slack-color); }
li span .delay, li span .slack { /* Estilo para desvio dentro da linha do bloco */
    font-weight: bold;
    font-size: 0.9em;
    margin-left: 5px;
}


/* Mensagem de lista vazia */
p { text-align: center; color: var(--text-muted-color); margin-top: 30px; font-size: 1.1em; }

/* Botões de Controle na Lista*/
.control-button { display: inline-block; margin: 0; margin-left: 5px; padding: 5px 8px; font-size: 1em; line-height: 1; cursor: pointer; color: var(--button-text); border: none; border-radius: 4px; vertical-align: middle; font-weight: normal; font-family: inherit; transition: opacity 0.2s ease, background-color 0.2s ease; }
.control-button:hover { opacity: 0.85; }
.control-button.start { background-color: var(--btn-start-bg); }
.control-button.pause { background-color: var(--btn-pause-bg); color: var(--btn-pause-text); }
.control-button.resume { background-color: var(--btn-resume-bg); }
.control-button.reset { background-color: var(--btn-reset-bg); }
.control-button.delete { background-color: var(--btn-delete-bg); }

/* Botões Reordenar */
.reorder-controls button { background-color: var(--btn-reorder-bg); color: var(--btn-reorder-text); border: 1px solid var(--item-border); padding: 3px 8px; font-size: 1.2em; line-height: 1; margin-left: 5px; cursor: pointer; border-radius: 3px; vertical-align: middle; }
.reorder-controls button:disabled { opacity: 0.4; cursor: not-allowed; }
.reorder-controls button:hover:not(:disabled) { background-color: var(--btn-reorder-hover-bg); }

</style>