<script setup>
// ----- BLOCO SCRIPT SETUP -----
import { ref, onMounted, onUnmounted, watchEffect, computed } from 'vue'

// --- ESTADO REATIVO ---
const event = ref({ eventName: 'Meu Evento Padrão', blocks: [] });
const newBlockName = ref('');
const newBlockDurationString = ref('00:01:00');
const currentBlockIndex = ref(null);
const isDarkMode = ref(false);
const fileInputRef = ref(null);

// --- VARIÁVEIS NÃO REATIVAS ---
let intervalId = null; // ID do ticker principal
// NOVO: Guarda o timestamp de quando a aba ficou inativa
let lastVisibleTimestamp = null;

// --- FUNÇÕES AUXILIARES ---
function formatTime(totalSeconds) { /* ... (sem mudanças) ... */ if (isNaN(totalSeconds) || !isFinite(totalSeconds)) { return '00:00:00'; } const absSeconds = Math.abs(totalSeconds); const hours = Math.floor(absSeconds / 3600); const minutes = Math.floor((absSeconds % 3600) / 60); const seconds = Math.floor(absSeconds % 60); return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
function parseTimeToSeconds(timeString) { /* ... (sem mudanças) ... */ if (!timeString || typeof timeString !== 'string') return null; const parts = String(timeString).split(':').map(part => parseInt(part, 10)); let seconds = 0; if (parts.length === 3) { if (isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2]) || parts[1] >= 60 || parts[2] >= 60 || parts[1] < 0 || parts[2] < 0 || parts[0] < 0) return null; seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2]; } else if (parts.length === 2) { if (isNaN(parts[0]) || isNaN(parts[1]) || parts[0] >= 60 || parts[1] >= 60 || parts[0] < 0 || parts[1] < 0 ) return null; seconds = (parts[0] * 60) + parts[1]; } else if (parts.length === 1) { if (isNaN(parts[0]) || parts[0] < 0) return null; seconds = parts[0]; } else { return null; } return seconds; }
const statusMap = { idle: 'Ocioso', running: 'Rodando', paused: 'Pausado', completed: 'Concluído', overrun: 'Estourado' };
function translateStatus(status) { return statusMap[status] || status; }

// --- COMPUTED PROPERTIES ---
// (Nenhuma mudança nas computed properties)
const totalPlannedDuration = computed(() => { /* ... */ const totalSeconds = event.value.blocks.reduce((sum, block) => sum + (block.duration || 0), 0); return formatTime(totalSeconds); });
const totalEventElapsedTime = computed(() => { /* ... */ let elapsedSeconds = 0; for(const block of event.value.blocks) { if (block.status === 'completed' || block.status === 'overrun') { elapsedSeconds += block.elapsedTime; } else if (block.status === 'running' || block.status === 'paused') { const blockIndex = event.value.blocks.findIndex(b => b.id === block.id); if(blockIndex === currentBlockIndex.value) { elapsedSeconds += block.elapsedTime; break; } else if (block.status === 'paused') { elapsedSeconds += block.elapsedTime; } } } return elapsedSeconds; });
const cumulativeEventDelay = computed(() => { /* ... */ const totalDelaySeconds = event.value.blocks.reduce((sum, block) => { return sum + (typeof block.completionDelay === 'number' ? block.completionDelay : 0); }, 0); const roundedDelay = Math.round(totalDelaySeconds); return { sign: roundedDelay > 5 ? '+' : (roundedDelay < -5 ? '-' : ''), time: formatTime(Math.abs(roundedDelay)), seconds: roundedDelay }; });
const currentBlock = computed(() => { /* ... */ if (currentBlockIndex.value !== null && currentBlockIndex.value >= 0 && currentBlockIndex.value < event.value.blocks.length) { return event.value.blocks[currentBlockIndex.value]; } return null; });
const currentBlockProgress = computed(() => { /* ... */ if (!currentBlock.value || !currentBlock.value.duration || currentBlock.value.duration === 0) { return 0; } const progress = (currentBlock.value.elapsedTime / currentBlock.value.duration) * 100; return Math.min(progress, 100); });
const currentBlockDisplayTime = computed(() => { /* ... */ if (!currentBlock.value) { return '--:--:--'; } const remainingSeconds = currentBlock.value.duration - currentBlock.value.elapsedTime; const formattedTime = formatTime(remainingSeconds); return remainingSeconds < 0 ? `-${formattedTime}` : formattedTime; });

// --- PERSISTÊNCIA COM LOCALSTORAGE ---
watchEffect(() => { /* ... (sem mudanças) ... */ localStorage.setItem('mestariEventData', JSON.stringify(event.value)); localStorage.setItem('mestariTheme', JSON.stringify(isDarkMode.value)); });

// --- GERENCIAMENTO DO TICKER E VISIBILIDADE ---

// NOVO: Função chamada quando a visibilidade da aba muda
function handleVisibilityChange() {
  // Se a aba ficou escondida
  if (document.hidden) {
    // Guarda o timestamp atual se um bloco estiver rodando/estourado
    if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) {
        lastVisibleTimestamp = Date.now();
        console.log(`Tab escondida. Bloco ${currentBlock.value.id} estava ${currentBlock.value.status}. Timestamp: ${lastVisibleTimestamp}`);
    } else {
        lastVisibleTimestamp = null; // Garante que não há timestamp se nada rodava
        console.log("Tab escondida. Nenhum bloco rodando.");
    }
  }
  // Se a aba ficou visível novamente
  else {
    console.log("Tab visível novamente.");
    // Se tínhamos um timestamp guardado (significa que um bloco rodava quando escondeu)
    if (lastVisibleTimestamp !== null) {
      const timeDiffSeconds = Math.round((Date.now() - lastVisibleTimestamp) / 1000);
      console.log(`Tempo escondido: ${timeDiffSeconds}s`);
      // Se passou um tempo significativo (> 1s) e ainda temos um bloco atual
      // E o bloco atual é o mesmo que estava rodando (verificação extra opcional)
      // E ele ainda deveria estar rodando ou pausado (não foi resetado/deletado enquanto escondido)
      if (timeDiffSeconds > 1 && currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun' || currentBlock.value.status === 'paused')) {
         console.log(`Corrigindo elapsedTime do bloco ${currentBlock.value.id} em +${timeDiffSeconds}s`);
         // Adiciona o tempo perdido ao tempo decorrido
         currentBlock.value.elapsedTime += timeDiffSeconds;
         // Se estava rodando e a correção o fez estourar, atualiza o status
         if (currentBlock.value.status === 'running' && currentBlock.value.elapsedTime > currentBlock.value.duration) {
             currentBlock.value.status = 'overrun';
         }
      }
       // Limpa o timestamp após o cálculo
      lastVisibleTimestamp = null;
    }
  }
}

onMounted(() => {
  // Carrega evento e tema... (como antes)
   const savedEvent = localStorage.getItem('mestariEventData'); if (savedEvent) { try { const loadedEvent = JSON.parse(savedEvent); event.value = { eventName: loadedEvent?.eventName || 'Evento Carregado', blocks: Array.isArray(loadedEvent?.blocks) ? loadedEvent.blocks : [] }; event.value.blocks.forEach(block => { if (block.completionDelay === undefined) block.completionDelay = null; if (block.elapsedTime === undefined) block.elapsedTime = 0; if (block.notes === undefined) block.notes = ''; if (block.duration === undefined) block.duration = 60; if (block.status !== 'idle' && block.status !== 'completed') block.status = 'idle'; }); } catch (e) { console.error("Erro ao carregar evento:", e); localStorage.removeItem('mestariEventData'); event.value = { eventName: 'Novo Evento (Erro ao Carregar)', blocks: [] }; } } else { event.value.eventName = 'Meu Primeiro Evento'; } const savedTheme = localStorage.getItem('mestariTheme'); if (savedTheme) { try { isDarkMode.value = JSON.parse(savedTheme); } catch(e) { console.error("Erro ao carregar tema", e); } } currentBlockIndex.value = null;
  // Inicia ticker
  intervalId = setInterval(tick, 1000);
  // NOVO: Adiciona o listener para visibilidade da página
  document.addEventListener('visibilitychange', handleVisibilityChange);
  console.log("Listener de visibilidade adicionado.");
});

onUnmounted(() => {
  clearInterval(intervalId); // Limpa ticker
  // NOVO: Remove o listener para visibilidade da página
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  console.log("Ticker parado e listener de visibilidade removido.");
});

// --- FUNÇÕES CORE ---
function tick() { /* ... (lógica anterior sem mudanças) ... */ if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) { currentBlock.value.elapsedTime++; if (currentBlock.value.status === 'running' && currentBlock.value.elapsedTime > currentBlock.value.duration) { currentBlock.value.status = 'overrun'; console.log(`Tempo do bloco ${currentBlock.value.id} estourado!`);} } }
function markBlockComplete(block) { /* ... (lógica anterior sem mudanças) ... */ if (!block || block.status === 'completed') return; if (block.completionDelay === null) { block.completionDelay = block.elapsedTime - block.duration; } block.status = 'completed'; }
function addBlock() { /* ... (lógica anterior sem mudanças) ... */ const name = newBlockName.value.trim(); const durationInSeconds = parseTimeToSeconds(newBlockDurationString.value); if (durationInSeconds === null || durationInSeconds <= 0) { return alert('Formato de duração inválido. Use HH:MM:SS, MM:SS ou segundos.'); } const newBlock = { id: Date.now(), name: name || `Bloco ${event.value.blocks.length + 1}`, duration: durationInSeconds, elapsedTime: 0, status: 'idle', notes: '', completionDelay: null }; event.value.blocks.push(newBlock); newBlockName.value = ''; newBlockDurationString.value = '00:01:00'; }

// --- FUNÇÕES DE CONTROLE ---
// (Nenhuma mudança nas funções: startBlock, pauseBlock, resumeBlock, resetBlock, deleteBlock, goToNextBlock)
function startBlock(blockId) { const blockIndex = event.value.blocks.findIndex(b => b.id === blockId); if (blockIndex !== -1 && event.value.blocks[blockIndex].status === 'idle') { if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) { currentBlock.value.status = 'paused'; } currentBlockIndex.value = blockIndex; event.value.blocks[blockIndex].status = 'running'; } }
function pauseBlock() { if (currentBlock.value && (currentBlock.value.status === 'running' || currentBlock.value.status === 'overrun')) { currentBlock.value.status = 'paused'; } }
function resumeBlock() { if (currentBlock.value && currentBlock.value.status === 'paused') { event.value.blocks.forEach((block, index) => { if(index !== currentBlockIndex.value && (block.status === 'running' || block.status === 'overrun')) { block.status = 'paused'; } }); currentBlock.value.status = (currentBlock.value.elapsedTime >= currentBlock.value.duration) ? 'overrun' : 'running'; } }
function resetBlock(blockId) { const blockIndex = event.value.blocks.findIndex(b => b.id === blockId); if (blockIndex !== -1) { const block = event.value.blocks[blockIndex]; const wasCurrent = (currentBlockIndex.value === blockIndex); block.status = 'idle'; block.elapsedTime = 0; block.completionDelay = null; if (wasCurrent) { currentBlockIndex.value = null; } } }
function deleteBlock(blockId) { const index = event.value.blocks.findIndex(b => b.id === blockId); if (index !== -1) { const wasCurrent = (currentBlockIndex.value === index); const isBeforeCurrent = (currentBlockIndex.value !== null && index < currentBlockIndex.value); event.value.blocks.splice(index, 1); if (wasCurrent) { currentBlockIndex.value = null; } else if (isBeforeCurrent) { currentBlockIndex.value--; } } }
function goToNextBlock() { let nextIndex = -1; const currentIndex = currentBlockIndex.value; if (currentIndex === null) { nextIndex = event.value.blocks.findIndex(b => b.status === 'idle'); } else { const currentBlockRef = event.value.blocks[currentIndex]; markBlockComplete(currentBlockRef); nextIndex = currentIndex + 1; if (nextIndex >= event.value.blocks.length) { nextIndex = -1; } } if (nextIndex !== -1) { currentBlockIndex.value = nextIndex; if(event.value.blocks[nextIndex].status === 'idle'){ event.value.blocks[nextIndex].status = 'running'; } } else { currentBlockIndex.value = null; } }

// --- Funções de Reordenação ---
// (Nenhuma mudança nas funções: moveBlockUp, moveBlockDown)
function moveBlockUp(index) { if (index > 0) { const blocks = event.value.blocks; if (currentBlockIndex.value === index) { currentBlockIndex.value = index - 1; } else if (currentBlockIndex.value === index - 1) { currentBlockIndex.value = index; } [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; } }
function moveBlockDown(index) { if (index < event.value.blocks.length - 1) { const blocks = event.value.blocks; if (currentBlockIndex.value === index) { currentBlockIndex.value = index + 1; } else if (currentBlockIndex.value === index + 1) { currentBlockIndex.value = index; } [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; } }

// --- FUNÇÕES DE UI / EVENTO ---
// (Nenhuma mudança nas funções: startNewEvent, resetEntireEvent, saveEventToFile, triggerFileInput, loadEventFromFile, toggleTheme, themeButtonText)
function startNewEvent() { if (confirm('Isso limpará o evento atual (nome e blocos). Deseja continuar?')) { event.value = { eventName: 'Novo Evento', blocks: [] }; currentBlockIndex.value = null; console.log("Novo evento iniciado."); } }
function resetEntireEvent() { if (confirm('Tem certeza que deseja resetar TODOS os blocos?')) { currentBlockIndex.value = null; event.value.blocks.forEach(block => { block.status = 'idle'; block.elapsedTime = 0; block.completionDelay = null; }); console.log("Evento resetado."); } }
function saveEventToFile() { try { const eventData = event.value; const dataStr = JSON.stringify(eventData, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; const filename = (eventData.eventName || 'mestari-evento').replace(/[^a-z0-9_ .-]/gi, '_') + '.json'; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar evento."); } }
function triggerFileInput() { fileInputRef.value?.click(); console.log("Acionando input file..."); }
function loadEventFromFile(e) { const file = e.target.files?.[0]; console.log("Arquivo selecionado:", file?.name); if (!file) return; if (file.type && file.type !== 'application/json') { alert('Selecione um arquivo .json.'); if(e.target) e.target.value = null; return; } const reader = new FileReader(); reader.onload = (res) => { try { const fileContent = res.target?.result; if (typeof fileContent !== 'string') throw new Error("Não foi possível ler o conteúdo."); const loadedData = JSON.parse(fileContent); if (typeof loadedData.eventName === 'string' && Array.isArray(loadedData.blocks)) { const isValidBlocks = loadedData.blocks.every(b => typeof b.id === 'number' && typeof b.name === 'string' && typeof b.duration === 'number' && b.duration >= 0 && typeof b.elapsedTime === 'number' && b.elapsedTime >= 0 && typeof b.status === 'string'); if (isValidBlocks) { event.value = { eventName: loadedData.eventName, blocks: loadedData.blocks.map(b => ({ id: b.id, name: b.name, duration: b.duration, elapsedTime: b.elapsedTime ?? 0, status: b.status ?? 'idle', notes: b.notes ?? '', completionDelay: b.completionDelay ?? null })) }; currentBlockIndex.value = null; alert('Evento carregado!'); } else { throw new Error("Estrutura de blocos inválida."); } } else { throw new Error("Estrutura de evento inválida."); } } catch (error) { console.error("Erro ao carregar:", error); alert(`Erro ao carregar: ${error.message}`); } finally { if (e.target) e.target.value = null; } }; reader.onerror = (err) => { console.error("Erro ao ler:", err); alert("Erro ao ler arquivo."); if(e.target) e.target.value = null; }; reader.readAsText(file); }
function toggleTheme() { isDarkMode.value = !isDarkMode.value; }
const themeButtonText = computed(() => { return isDarkMode.value ? '☀️ Modo Claro' : '🌙 Modo Noturno'; });

// ----- FIM DO BLOCO SCRIPT SETUP -----
</script>

<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }"> <header> <h1>Mestari ⏱️</h1> <div class="header-actions"> <a href="http://link.mercadopago.com.br/rickfre" target="_blank" rel="noopener noreferrer" class="theme-toggle-button coffee-button" title="Apoie o desenvolvedor!"> Me paga um café? ☕️ </a> <button @click="toggleTheme" class="theme-toggle-button"> {{ themeButtonText }} </button> </div> </header> <main> <section class="global-event-actions"> <button @click="startNewEvent" class="header-button new-event" title="Limpar e Iniciar Novo Evento">✨ Novo evento</button> <button @click="triggerFileInput" class="header-button" title="Carregar Evento de Arquivo JSON">⬆️ Subir evento</button> <input type="file" accept=".json,application/json" @change="loadEventFromFile" ref="fileInputRef" style="display: none;"> <button @click="saveEventToFile" class="header-button" title="Salvar Evento Atual em Arquivo JSON">💾 Salvar evento</button> <button @click="resetEntireEvent" class="header-button reset-event" title="Resetar Todos os Blocos">↻ Resetar Evento</button> </section> <section class="event-name-section"> <label for="eventNameInput">Nome do Evento:</label> <input title="Nome do Evento" type="text" id="eventNameInput" v-model="event.eventName"> </section> <section class="event-status-section"> <h3>Status Geral do Evento</h3><div class="status-grid"><div class="status-item"><span>Planejado</span><strong>{{ totalPlannedDuration }}</strong></div><div class="status-item"><span>Decorrido</span><strong>{{ formatTime(totalEventElapsedTime) }}</strong></div><div class="status-item"><span>Atraso / Folga Acumulado</span><strong :class="{ delay: cumulativeEventDelay.seconds > 5, slack: cumulativeEventDelay.seconds < -5 }">{{ cumulativeEventDelay.sign }}{{ cumulativeEventDelay.time }}</strong></div></div> </section> <section class="current-block-section" v-if="currentBlock" :class="{ 'overrun-bg': currentBlock.status === 'overrun' || currentBlock.elapsedTime > currentBlock.duration }"> <h3>Agora:</h3><div class="current-block-header"><h4>{{ currentBlock.name || 'Bloco Atual' }}</h4><span class="current-block-timer" :class="{ 'overtime-indicator': currentBlock.elapsedTime > currentBlock.duration }">{{ currentBlockDisplayTime }}</span></div><div class="progress-bar-container" :title="`Progresso: ${Math.min(currentBlock.elapsedTime, currentBlock.duration)} / ${currentBlock.duration}s`"><div class="progress-bar" :style="{ width: currentBlockProgress + '%' }" :class="{ 'progress-overrun': currentBlock.elapsedTime > currentBlock.duration }"></div></div><label :for="'notes-' + currentBlock.id">Pauta e Anotações:</label><textarea :id="'notes-' + currentBlock.id" v-model="currentBlock.notes"></textarea><button @click="goToNextBlock" class="next-block-button">Próximo Bloco ▶▶</button> </section> <section class="current-block-section" v-else> <h3>Nenhum bloco ativo</h3><p v-if="event.blocks.length > 0 && event.blocks.some(b => b.status === 'idle')">Use o botão "Iniciar" na lista abaixo ou clique aqui para iniciar o próximo bloco ocioso.</p><p v-else-if="event.blocks.length > 0">Todos os blocos foram concluídos.</p><p v-else>Adicione blocos ao evento para começar.</p><button v-if="event.blocks.some(b => b.status === 'idle')" @click="goToNextBlock" class="next-block-button">Iniciar Evento / Próximo Bloco ▶▶</button> </section> <section class="add-block-form-section"> <h3>Adicionar Novo Bloco</h3><div><label for="blockName">Nome do Bloco: </label><input type="text" id="blockName" v-model="newBlockName" placeholder="Nome do bloco"/></div><div><label for="blockDuration">Duração (HH:MM:SS): </label><input type="text" id="blockDuration" v-model="newBlockDurationString" placeholder="HH:MM:SS ou Segundos"/></div><button @click="addBlock" class="add-block-button">Adicionar Bloco</button> </section> <section class="block-list-section"> <h2>Blocos do Evento:</h2> <ul v-if="event.blocks.length > 0"> <li v-for="(block, index) in event.blocks" :key="block.id" :class="{ active: index === currentBlockIndex }"><div class="block-info"><span>{{ block.name || 'Sem nome' }} | {{ formatTime(block.duration) }} | Dec: <span :class="{ 'overtime-indicator': block.elapsedTime > block.duration }">{{ formatTime(block.elapsedTime) }}</span> | Status: {{ translateStatus(block.status) }} <span v-if="block.completionDelay !== null" :class="{ delay: block.completionDelay > 5, slack: block.completionDelay < -5 }"> (Desvio: {{ block.completionDelay >= 0 ? '+' : '' }}{{ formatTime(block.completionDelay) }})</span></span></div><div class="block-actions-row"><span class="control-buttons-group"><button v-if="block.status === 'idle'" @click="startBlock(block.id)" class="control-button start" title="Iniciar">▶</button><button v-if="(block.status === 'running' || block.status === 'overrun') && index === currentBlockIndex" @click="pauseBlock()" class="control-button pause" title="Pausar">❚❚</button><button v-if="block.status === 'paused' && index === currentBlockIndex" @click="resumeBlock()" class="control-button resume" title="Retomar">►</button><button v-if="block.status !== 'idle'" @click="resetBlock(block.id)" class="control-button reset" title="Resetar">↻</button><button @click="deleteBlock(block.id)" class="control-button delete" title="Deletar">🗑</button></span><span class="reorder-buttons-group"><button @click="moveBlockUp(index)" :disabled="index === 0" title="Mover para cima">⬆️</button><button @click="moveBlockDown(index)" :disabled="index === event.blocks.length - 1" title="Mover para baixo">⬇️</button></span></div><div class="notes-area"><textarea :id="'notes-li-' + block.id" v-model="block.notes" placeholder="Adicionar pauta/anotações..." rows="3"></textarea></div></li> </ul> <p v-else>Nenhum bloco adicionado a este evento ainda.</p> </section> </main>
  </div>
  </template>

<style scoped>
/* ----- BLOCO STYLE SCOPED ----- */
/* (Todo o CSS exatamente como antes, sem mudanças necessárias aqui) */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap');
.app-container { --primary-color: #6821ff; --primary-hover-color: #551adf; --bg-color: #ffffff; --text-color: #333333; --text-muted-color: #777777; --header-bg: var(--primary-color); --header-text: #ffffff; --button-text: #ffffff; --item-bg: #f8f9fa; --item-border: #dee2e6; --item-active-bg: #e8e0ff; --item-active-border: var(--primary-color); --input-bg: #ffffff; --input-border: #ced4da; --input-text: #495057; --shadow-color: rgba(0,0,0,0.05); --h2-border-color: #dddddd; --overtime-color: #dc3545; --delay-color: var(--overtime-color); --slack-color: #28a745; --progress-track-color: #e9ecef; --progress-overrun-bg: var(--overtime-color); --current-block-overrun-bg: #ffebee; --btn-start-bg: #28a745; --btn-pause-bg: #ffc107; --btn-pause-text: #333; --btn-resume-bg: #17a2b8; --btn-reset-bg: #6c757d; --btn-delete-bg: #dc3545; --btn-reorder-bg: #f0f0f0; --btn-reorder-text: #555; --btn-reorder-hover-bg: #e0e0e0; --btn-reset-event-bg: #fd7e14; --btn-reset-event-hover-bg: #e86a00; --btn-coffee-bg: #3c2a1e; --btn-coffee-hover-bg: #5a4030; --btn-new-event-bg: #0dcaf0; --btn-new-event-hover-bg: #0baccc; font-family: 'Poppins', sans-serif; background-color: var(--bg-color); color: var(--text-color); min-height: 100vh; transition: background-color 0.3s ease, color 0.3s ease; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; max-width: auto; margin: 0 auto; padding-bottom: 40px; }
.app-container.dark-theme { --primary-color: #8a5fff; --primary-hover-color: #a082ff; --bg-color: #1a1d24; --text-color: #e0e0e0; --text-muted-color: #a0a0a0; --header-bg: #2f1072; --header-text: #e0e0e0; --button-text: #ffffff; --item-bg: #2c3e50; --item-border: #4b5a6a; --item-active-bg: #3a2c50; --item-active-border: var(--primary-color); --input-bg: #252a33; --input-border: #4b5a6a; --input-text: #e0e0e0; --shadow-color: rgba(0,0,0,0.3); --h2-border-color: #4b5a6a; --overtime-color: #ff6b6b; --progress-track-color: #495057; --progress-overrun-bg: var(--overtime-color); --current-block-overrun-bg: #4d2a2f; --btn-pause-text: #333; --btn-reorder-bg: #3a4a5a; --btn-reorder-text: #ccc; --btn-reorder-hover-bg: #4b5a6a; --btn-reset-event-bg: #fd7e14; --btn-reset-event-hover-bg: #e86a00; --btn-coffee-bg: #c6a78a; --btn-coffee-hover-bg: #ddbb9f; --btn-new-event-bg: #0dcaf0; --btn-new-event-hover-bg: #31d2f2;}
header { background-color: var(--header-bg); color: var(--header-text); padding: 15px 25px; margin-bottom: 0; box-shadow: 0 2px 5px var(--shadow-color); border-radius: 0 0 10px 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
h1 { color: var(--header-text); text-align: left; margin: 0; font-size: 1.7em; font-weight: 700; flex-grow: 1; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.header-button { /* Estilo base para botões que podem ir no header ou global actions */ background-color: rgba(255, 255, 255, 0.15); color: var(--header-text); border: 1px solid rgba(255, 255, 255, 0.5); padding: 6px 12px; border-radius: 5px; font-size: 0.85em; cursor: pointer; margin: 0; transition: background-color 0.2s ease; font-family: inherit; display: inline-block; text-decoration: none; white-space: nowrap; vertical-align: middle; }
.dark-theme .header-button { background-color: rgba(0, 0, 0, 0.2); border-color: rgba(255, 255, 255, 0.4); }
.header-button:hover { background-color: rgba(255, 255, 255, 0.3); }
.dark-theme .header-button:hover { background-color: rgba(0, 0, 0, 0.4); }
.header-button.reset-event { background-color: var(--btn-reset-event-bg); border-color: transparent; }
.header-button.reset-event:hover { background-color: var(--btn-reset-event-hover-bg); }
.header-button.new-event { background-color: var(--btn-new-event-bg); border-color: transparent; color: #000; }
.header-button.new-event:hover { background-color: var(--btn-new-event-hover-bg); }
.theme-toggle-button { background-color: rgba(255, 255, 255, 0.15); color: var(--header-text); border: 1px solid rgba(255, 255, 255, 0.5); padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 0.8em; font-family: inherit; display: inline-block; margin: 0; transition: background-color 0.2s ease; text-decoration: none; white-space: nowrap; vertical-align: middle; }
.dark-theme .theme-toggle-button { background-color: rgba(0, 0, 0, 0.2); border-color: rgba(255, 255, 255, 0.4); }
.theme-toggle-button:hover { background-color: rgba(255, 255, 255, 0.3); }
.dark-theme .theme-toggle-button:hover { background-color: rgba(0, 0, 0, 0.4); }
a.coffee-button { background-color: var(--btn-coffee-bg) !important; border-color: transparent !important; color: #fff !important; }
a.coffee-button:hover { background-color: var(--btn-coffee-hover-bg) !important; }
main { padding: 20px; }
section { margin-bottom: 30px; }
h2 { margin-top: 0; border-bottom: 2px solid var(--h2-border-color); padding-bottom: 8px; color: var(--text-color); font-weight: 700; font-size: 1.4em; margin-bottom: 20px; }
h3 { text-align: left; margin-top:0; margin-bottom: 20px; color: var(--text-muted-color); font-weight: 500; font-size: 1.2em; border-bottom: 1px solid var(--item-border); padding-bottom: 10px; }
section.add-block-form-section h3 { text-align: center; border-bottom: none; }
.global-event-actions { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid var(--item-border); }
.global-event-actions .header-button { font-size: 0.9em; background-color: var(--primary-color); border-color: transparent; color: var(--button-text); border-radius: 5px; }
.global-event-actions .header-button:hover { background-color: var(--primary-hover-color); }
.global-event-actions .header-button.reset-event { background-color: var(--btn-reset-event-bg); }
.global-event-actions .header-button.reset-event:hover { background-color: var(--btn-reset-event-hover-bg); }
.global-event-actions .header-button.new-event { background-color: var(--btn-new-event-bg); color: #000; }
.global-event-actions .header-button.new-event:hover { background-color: var(--btn-new-event-hover-bg); }
.event-name-section { margin-bottom: 30px; background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 15px 20px; box-shadow: 0 1px 3px var(--shadow-color); display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.event-name-section label { font-weight: 500; color: var(--text-color); flex-shrink: 0; }
.event-name-section input { padding: 10px; border: 1px solid var(--input-border); border-radius: 4px; flex-grow: 1; font-size: 1.1em; font-weight: 500; font-family: inherit; background-color: var(--input-bg); color: var(--input-text); min-width: 200px; }
.add-block-form-section { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.add-block-form-section div { margin-bottom: 15px; display: flex; align-items: center; flex-wrap: wrap; }
.add-block-form-section label { margin-right: 10px; width: 150px; text-align: right; flex-shrink: 0; font-weight: 500; color: var(--text-color); margin-bottom: 5px; }
.add-block-form-section input { padding: 10px; border: 1px solid var(--input-border); border-radius: 4px; flex-grow: 1; font-size: 1em; font-family: inherit; background-color: var(--input-bg); color: var(--input-text); margin-bottom: 5px; }
.add-block-form-section input::placeholder { color: var(--text-muted-color); opacity: 0.8; }
.add-block-button { display: block; margin: 10px 0 0 0; padding: 12px 25px; cursor: pointer; background-color: var(--primary-color); color: var(--button-text); border: none; border-radius: 5px; font-size: 1.1em; font-weight: 500; font-family: inherit; transition: background-color 0.2s ease; width: 100%; }
.add-block-button:hover { background-color: var(--primary-hover-color); }
button.next-block-button { display: block; margin: 20px auto 10px auto; padding: 12px 25px; cursor: pointer; background-color: var(--primary-color); color: var(--button-text); border: none; border-radius: 5px; font-size: 1.1em; font-weight: 500; font-family: inherit; transition: background-color 0.2s ease; }
button.next-block-button:hover { background-color: var(--primary-hover-color); }
.event-status-section { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); }
.status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 15px; text-align: center; }
.status-item span { display: block; font-size: 0.9em; color: var(--text-muted-color); margin-bottom: 5px; }
.status-item strong { font-size: 1.6em; font-weight: 700; color: var(--text-color); display: block; }
.status-item .delay { color: var(--delay-color); }
.status-item .slack { color: var(--slack-color); }
.current-block-section { background-color: var(--item-bg); border: 1px solid var(--item-border); border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px var(--shadow-color); transition: background-color 0.3s ease; }
.current-block-section.overrun-bg { background-color: var(--current-block-overrun-bg); }
.current-block-section h3 { border-bottom-color: var(--item-border); }
.current-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
.current-block-header h4 { margin: 0; font-size: 1.4em; font-weight: 700; color: var(--primary-color); }
.dark-theme .current-block-header h4 { color: var(--primary-color); }
.current-block-timer { font-size: 1.6em; font-weight: 700; color: var(--text-color); white-space: nowrap; }
.current-block-timer.overtime-indicator { color: var(--overtime-color); }
.progress-bar-container { width: 100%; height: 10px; background-color: var(--progress-track-color); border-radius: 5px; overflow: hidden; margin-top: 8px; margin-bottom: 15px; }
.progress-bar { height: 100%; background-color: var(--primary-color); border-radius: 5px 0 0 5px; transition: width 0.2s linear, background-color 0.3s ease; }
.progress-bar.progress-overrun { background-color: var(--progress-overrun-bg); border-radius: 5px; }
.current-block-section label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: 500; color: var(--text-muted-color); font-size: 0.9em;}
.current-block-section textarea { width: 100%; min-height: 120px; border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 10px; font-family: inherit; font-size: 1em; margin-top: 5px; box-sizing: border-box; resize: vertical; }
ul { list-style: none; padding: 0; }
li { background-color: var(--item-bg); border: 1px solid var(--item-border); color: var(--text-color); padding: 15px; margin-bottom: 12px; border-radius: 6px; font-size: 1em; display: block; box-shadow: 0 1px 3px var(--shadow-color); transition: box-shadow 0.2s ease, border-left 0.3s ease, background-color 0.3s ease; border-left: 5px solid transparent; }
li:hover { box-shadow: 0 3px 6px var(--shadow-color); }
li.active { background-color: var(--item-active-bg); border-left: 5px solid var(--item-active-border); font-weight: 500; }
.block-info { margin-bottom: 10px; line-height: 1.4; overflow-wrap: break-word; }
.block-actions-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--item-border); }
.control-buttons-group { display: inline-flex; gap: 5px; flex-wrap: wrap; }
.reorder-buttons-group { display: inline-flex; gap: 5px; flex-shrink: 0; }
.notes-area { margin-top: 12px; width: 100%; }
.notes-area textarea { width: 100%; min-height: 60px; border: 1px solid var(--input-border); background-color: var(--input-bg); color: var(--input-text); border-radius: 4px; padding: 8px; font-family: inherit; font-size: 0.95em; box-sizing: border-box; resize: vertical; }
.overtime-indicator { color: var(--overtime-color); font-weight: bold; }
.delay { color: var(--delay-color); }
.slack { color: var(--slack-color); }
.block-info span .delay, .block-info span .slack { font-weight: bold; font-size: 0.9em; margin-left: 5px; }
p { text-align: center; color: var(--text-muted-color); margin-top: 30px; font-size: 1.1em; }
.control-button { display: inline-block; margin: 0; padding: 5px 8px; font-size: 1em; line-height: 1; cursor: pointer; color: var(--button-text); border: none; border-radius: 4px; vertical-align: middle; font-weight: normal; font-family: inherit; transition: opacity 0.2s ease, background-color 0.2s ease; }
.control-button:hover { opacity: 0.85; }
.control-button.start { background-color: var(--btn-start-bg); }
.control-button.pause { background-color: var(--btn-pause-bg); color: var(--btn-pause-text); }
.control-button.resume { background-color: var(--btn-resume-bg); }
.control-button.reset { background-color: var(--btn-reset-bg); }
.control-button.delete { background-color: var(--btn-delete-bg); }
.reorder-buttons-group button { background-color: var(--btn-reorder-bg); color: var(--btn-reorder-text); border: 1px solid var(--item-border); padding: 3px 8px; font-size: 1.2em; line-height: 1; cursor: pointer; border-radius: 3px; vertical-align: middle; }
.reorder-buttons-group button:disabled { opacity: 0.4; cursor: not-allowed; }
.reorder-buttons-group button:hover:not(:disabled) { background-color: var(--btn-reorder-hover-bg); }

/* Estilos Grid Layout para Telas Maiores */
@media (min-width: 992px) {
  main { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(400px, 1.5fr); gap: 25px 30px; align-items: start; }
  .global-event-actions { grid-column: 1 / 3; grid-row: 1; padding-bottom: 20px; margin-bottom: 0; border-bottom: 1px solid var(--item-border); justify-content: flex-start; }
  .event-name-section { grid-column: 1 / 3; grid-row: 2; }
  .event-status-section { grid-column: 1; grid-row: 3; }
  .add-block-form-section { grid-column: 1; grid-row: 4; }
  .current-block-section { grid-column: 2; grid-row: 3; grid-row-end: span 2; } /* Ocupa linha 3 e 4 da coluna direita */
  .block-list-section { grid-column: 1; grid-row: 5; grid-column-end: span 2; } /* Lista vai para linha 5 abaixo de tudo no grid */ /* << AJUSTE AQUI? */

   /* Ajustes de margem */
   main section { margin-bottom: 0; }
   .global-event-actions, .event-name-section, .event-status-section, .current-block-section { margin-bottom: 25px; }
   .add-block-form-section h3, .timer-list-section h2, .event-status-section h3, .current-block-section h3 { margin-top: 0; }
}

</style>