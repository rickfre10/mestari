<script setup>
// ----- BLOCO SCRIPT SETUP -----
import { ref, onMounted, onUnmounted } from 'vue'

// --- ESTADO REATIVO ---
const timers = ref([]);
const newAnnotation = ref('');
const newDuration = ref(60);

// --- GERENCIAMENTO DO TICKER GLOBAL ---
let intervalId = null;

onMounted(() => {
  intervalId = setInterval(tick, 1000);
  console.log("Ticker global iniciado com ID:", intervalId);
});

onUnmounted(() => {
  clearInterval(intervalId);
  console.log("Ticker global parado. ID:", intervalId);
});

// --- FUNÇÕES CORE ---
// Função chamada a cada segundo pelo intervalo
function tick() {
  timers.value.forEach(timer => {
    if (timer.status === 'running' && timer.remainingTime > 0) {
      timer.remainingTime--;
    } else if (timer.status === 'running' && timer.remainingTime <= 0) {
      timer.status = 'completed';
      console.log(`Timer ${timer.id} (${timer.annotation || 'Sem Anotação'}) completado!`);
      // Poderíamos adicionar notificação sonora/visual aqui
    }
  });
}

// Função para adicionar um novo timer à lista
function addTimer() {
  const annotation = newAnnotation.value.trim();
  const duration = newDuration.value;

  if (typeof duration !== 'number' || duration <= 0) {
    alert('Por favor, insira uma duração válida em segundos (maior que zero).');
    return;
  }

  const newTimer = {
    id: Date.now(),
    totalTime: duration,
    remainingTime: duration,
    annotation: annotation,
    status: 'idle' // Sempre começa como 'idle'
  };
  timers.value.push(newTimer);

  newAnnotation.value = '';
  newDuration.value = 60;
}

// Função para mudar o status de um timer para 'running'
function startTimer(timerId) {
  const timer = timers.value.find(t => t.id === timerId);
  if (timer && timer.status === 'idle') {
    timer.status = 'running';
    console.log(`Iniciando timer ${timerId}`);
  }
}

// --- NOVO: Função para Pausar um Timer ---
function pauseTimer(timerId) {
  // Encontra o timer pelo ID
  const timer = timers.value.find(t => t.id === timerId);
  // Se encontrou e está rodando ('running')
  if (timer && timer.status === 'running') {
    // Muda o status para 'paused'
    timer.status = 'paused';
    console.log(`Pausando timer ${timerId}`);
  }
}
// --- FIM NOVO ---

// --- NOVO: Função para Resetar um Timer ---
function resetTimer(timerId) {
  // Encontra o timer pelo ID
  const timer = timers.value.find(t => t.id === timerId);
  // Se encontrou o timer
  if (timer) {
    // Muda o status de volta para 'idle'
    timer.status = 'idle';
    // Restaura o tempo restante para o tempo total original
    timer.remainingTime = timer.totalTime;
    console.log(`Resetando timer ${timerId}`);
  }
}
// --- FIM NOVO ---

// ----- FIM DO BLOCO SCRIPT SETUP -----
</script>

<template>
  <div>
    <h1>Fila de Timers</h1>

    <div>
      <label for="annotation">Anotação: </label>
      <input type="text" id="annotation" v-model="newAnnotation" placeholder="Descrição do timer"/>
    </div>
    <div>
      <label for="duration">Duração (segundos): </label>
      <input type="number" id="duration" v-model.number="newDuration" min="1"/>
    </div>
    <button @click="addTimer">Adicionar Timer</button>

    <h2>Fila:</h2>
    <ul v-if="timers.length > 0">
      <li v-for="timer in timers" :key="timer.id">
        <span> Anotação: {{ timer.annotation || 'Sem anotação' }} |
          Total: {{ timer.totalTime }}s |
          Restante: {{ timer.remainingTime }}s |
          Status: {{ timer.status }}
          </span>

        <span> <button v-if="timer.status === 'idle'" @click="startTimer(timer.id)" class="control-button start">
            ▶ Iniciar
          </button>
          <button v-if="timer.status === 'running'" @click="pauseTimer(timer.id)" class="control-button pause">
            ❚❚ Pausar
          </button>
          <button v-if="timer.status !== 'idle'" @click="resetTimer(timer.id)" class="control-button reset">
            ↻ Resetar
          </button>
        </span>
      </li>
    </ul>
    <p v-else>
      Nenhum timer na fila ainda. Adicione um!
    </p>

  </div>
  </template>

<style scoped>
/* ----- BLOCO STYLE SCOPED ----- */
/* CSS aplicado apenas a este componente. */

h1 {
  color: #42b883; /* Verde Vue */
  text-align: center;
  margin-bottom: 20px;
}

/* Formulário */
div > label {
  margin-right: 5px;
  display: inline-block;
  width: 140px;
  text-align: right;
  vertical-align: middle;
}
div > input {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  vertical-align: middle;
}

/* Botão principal */
button {
  display: block;
  margin: 15px auto;
  padding: 10px 20px;
  cursor: pointer;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1em;
}
button:hover {
  background-color: #34a074;
}

/* Lista */
h2 {
  margin-top: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}
ul {
  list-style: none;
  padding: 0;
}

/* Item da Lista (<li>) */
li {
  background-color: #f4f4f4;
  padding: 12px 15px;
  margin-bottom: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 0.95em;
  /* Usa Flexbox para alinhar o texto à esquerda e os botões à direita */
  display: flex;
  align-items: center;
  justify-content: space-between;
}
/* Agrupador de texto dentro do li */
li > span:first-child {
  flex-grow: 1; /* Faz o texto ocupar o espaço disponível */
  margin-right: 10px; /* Espaço antes dos botões */
}
/* Agrupador de botões dentro do li */
li > span:last-child {
  white-space: nowrap; /* Evita que os botões quebrem linha */
}


/* Mensagem de lista vazia */
p {
  text-align: center;
  color: #777;
  margin-top: 20px;
}

/* Botões de Controle dentro da lista */
.control-button {
  display: inline-block; /* Permite margem e padding */
  margin: 0; /* Remove margem do botão geral */
  margin-left: 8px; /* Espaço entre os botões de controle */
  padding: 5px 10px; /* Padding menor */
  font-size: 0.85em; /* Fonte menor */
  cursor: pointer;
  color: white;
  border: none;
  border-radius: 3px;
  vertical-align: middle; /* Alinha com o texto */
}
.control-button:hover {
  opacity: 0.85; /* Efeito hover leve */
}

/* Cores específicas para os botões de controle (NOVO) */
.control-button.start {
  background-color: #28a745; /* Verde */
}
.control-button.pause {
  background-color: #ffc107; /* Amarelo */
  color: #333; /* Texto escuro para contraste */
}
.control-button.reset {
  background-color: #6c757d; /* Cinza */
}

/* ----- FIM DO BLOCO STYLE ----- */
</style>