<script setup>
// ----- BLOCO SCRIPT SETUP -----
// Define a lógica e o estado reativo do componente usando a Composition API do Vue 3.

// Importa as funções necessárias do Vue.
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'

// --- ESTADO REATIVO ---
// 'timers': Array reativo que guarda a fila de objetos de timer. Inicializado como vazio.
const timers = ref([]);
// 'newAnnotation': Ref reativa para o valor do input de texto da anotação.
const newAnnotation = ref('');
// 'newDuration': Ref reativa para o valor do input numérico da duração, inicializada com 60.
const newDuration = ref(60);

// --- PERSISTÊNCIA COM LOCALSTORAGE (SALVAR) ---
// 'watchEffect' observa as dependências reativas (neste caso, 'timers.value').
// Ele roda imediatamente na montagem e depois sempre que 'timers.value' muda.
watchEffect(() => {
  // Converte o array 'timers' para uma string JSON.
  const timersJson = JSON.stringify(timers.value);
  // Salva a string JSON no localStorage do navegador sob a chave 'mestariTimerData'.
  localStorage.setItem('mestariTimerData', timersJson);
  // Log para indicar que o salvamento ocorreu (útil para debugging).
  console.log("Estado dos timers salvo no localStorage.");
});

// --- GERENCIAMENTO DO TICKER GLOBAL ---
// 'intervalId': Variável para armazenar o ID retornado por setInterval,
// permitindo que o intervalo seja cancelado depois.
let intervalId = null;

// 'onMounted': Hook de ciclo de vida. O código aqui executa *depois* que o componente
// foi renderizado e inserido na página pela primeira vez.
onMounted(() => {
  // --- PERSISTÊNCIA (CARREGAR) ---
  // Tenta obter a string JSON salva no localStorage.
  const savedTimers = localStorage.getItem('mestariTimerData');
  console.log("Tentando carregar timers do localStorage...");
  if (savedTimers) {
    try {
      // Se dados foram encontrados, tenta converter a string JSON de volta para um array.
      // Atualiza o array reativo 'timers.value' com os dados carregados.
      timers.value = JSON.parse(savedTimers);
      console.log("Timers carregados do localStorage:", timers.value);
    } catch (e) {
      // Se ocorrer um erro ao parsear (ex: dados corrompidos), loga o erro
      // e remove o item inválido do localStorage para evitar erros futuros.
      console.error("Erro ao carregar/parsear timers do localStorage:", e);
      localStorage.removeItem('mestariTimerData');
    }
  } else {
    console.log("Nenhum timer salvo encontrado no localStorage.");
  }

  // Inicia o intervalo que chama a função 'tick' a cada 1000ms (1 segundo).
  intervalId = setInterval(tick, 1000);
  console.log("Ticker global iniciado com ID:", intervalId);
});

// 'onUnmounted': Hook de ciclo de vida. O código aqui executa *antes* que o componente
// seja removido da página (ex: ao navegar para outra rota, se houvesse).
onUnmounted(() => {
  // Limpa o intervalo usando o ID armazenado. Essencial para evitar vazamentos de memória.
  clearInterval(intervalId);
  console.log("Ticker global parado. ID:", intervalId);
});

// --- FUNÇÕES CORE ---
// 'tick': Função executada a cada segundo pelo 'setInterval'.
function tick() {
  // Percorre cada objeto 'timer' dentro do array reativo 'timers.value'.
  timers.value.forEach(timer => {
    // Se o timer está 'running' e ainda tem tempo restante.
    if (timer.status === 'running' && timer.remainingTime > 0) {
      // Decrementa o tempo restante em 1. A reatividade do Vue atualizará a UI.
      timer.remainingTime--;
    }
    // Se o timer estava 'running' mas o tempo acabou (<= 0).
    else if (timer.status === 'running' && timer.remainingTime <= 0) {
      // Muda o status para 'completed'. A UI refletirá a mudança.
      timer.status = 'completed';
      console.log(`Timer ${timer.id} (${timer.annotation || 'Sem Anotação'}) completado!`);
    }
  });
}

// 'addTimer': Função chamada pelo botão "Adicionar Timer".
function addTimer() {
  // Obtém os valores atuais dos inputs reativos, usando '.value'.
  const annotation = newAnnotation.value.trim(); // Remove espaços extras.
  const duration = newDuration.value;

  // Validação simples da duração.
  if (typeof duration !== 'number' || duration <= 0) {
    alert('Por favor, insira uma duração válida em segundos (maior que zero).');
    return; // Aborta a função se inválido.
  }

  // Cria um novo objeto representando o timer.
  const newTimer = {
    id: Date.now(), // ID único.
    totalTime: duration,
    remainingTime: duration,
    annotation: annotation,
    status: 'idle' // Estado inicial.
  };
  // Adiciona o novo timer ao array reativo 'timers'.
  timers.value.push(newTimer);

  // Limpa os campos de input para a próxima adição.
  newAnnotation.value = '';
  newDuration.value = 60;
}

// 'startTimer': Muda o status de 'idle' para 'running'.
function startTimer(timerId) {
  const timer = timers.value.find(t => t.id === timerId);
  if (timer && timer.status === 'idle') {
    timer.status = 'running';
  }
}

// 'pauseTimer': Muda o status de 'running' para 'paused'.
function pauseTimer(timerId) {
  const timer = timers.value.find(t => t.id === timerId);
  if (timer && timer.status === 'running') {
    timer.status = 'paused';
  }
}

// 'resumeTimer': Muda o status de 'paused' para 'running'.
function resumeTimer(timerId) {
  const timer = timers.value.find(t => t.id === timerId);
  if (timer && timer.status === 'paused') {
    timer.status = 'running';
  }
}

// 'resetTimer': Muda o status para 'idle' e restaura o tempo.
function resetTimer(timerId) {
  const timer = timers.value.find(t => t.id === timerId);
  if (timer) {
    timer.status = 'idle';
    timer.remainingTime = timer.totalTime;
  }
}

// 'deleteTimer': Remove um timer do array 'timers'.
function deleteTimer(timerId) {
  // Encontra o índice do timer no array.
  const index = timers.value.findIndex(t => t.id === timerId);
  // Se o índice for encontrado (não for -1).
  if (index !== -1) {
    // Remove 1 elemento a partir do índice encontrado.
    timers.value.splice(index, 1);
    // O watchEffect cuidará de salvar a lista atualizada no localStorage.
  }
}

// ----- FIM DO BLOCO SCRIPT SETUP -----
</script>

<template>
  <div class="app-container">

    <header>
      <h1>Mestari ⏱️</h1>
    </header>

    <main>
      <section class="add-timer-form">
        <div>
          <label for="annotation">Anotação: </label>
          <input type="text" id="annotation" v-model="newAnnotation" placeholder="Descrição do timer"/>
        </div>
        <div>
          <label for="duration">Duração (segundos): </label>
          <input type="number" id="duration" v-model.number="newDuration" min="1"/>
        </div>
        <button @click="addTimer">Adicionar Timer</button>
      </section>

      <section class="timer-list-section">
        <h2>Fila:</h2>
        <ul v-if="timers.length > 0">
          <li v-for="timer in timers" :key="timer.id">
            <span>
              Anotação: {{ timer.annotation || 'Sem anotação' }} |
              Total: {{ timer.totalTime }}s |
              Restante: {{ timer.remainingTime }}s |
              Status: {{ timer.status }}
            </span>
            <span>
              <button v-if="timer.status === 'idle'" @click="startTimer(timer.id)" class="control-button start">▶ Iniciar</button>
              <button v-if="timer.status === 'running'" @click="pauseTimer(timer.id)" class="control-button pause">❚❚ Pausar</button>
              <button v-if="timer.status === 'paused'" @click="resumeTimer(timer.id)" class="control-button resume">► Retomar</button>
              <button v-if="timer.status !== 'idle'" @click="resetTimer(timer.id)" class="control-button reset">↻ Resetar</button>
              <button @click="deleteTimer(timer.id)" class="control-button delete">🗑 Deletar</button>
            </span>
          </li>
        </ul>
        <p v-else>Nenhum timer na fila ainda. Adicione um!</p>
      </section>
    </main> </div> </template>

<style scoped>
/* ----- BLOCO STYLE SCOPED ----- */
/* CSS aplicado apenas a este componente ('scoped'). */

/* NOVO: Importa a fonte Poppins do Google Fonts. Deve ser a primeira regra no <style>. */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap');

/* NOVO: Aplica a fonte Poppins ao container principal e melhora a renderização do texto. */
.app-container {
  font-family: 'Poppins', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  max-width: 800px; /* Limita a largura máxima para melhor leitura em telas grandes */
  margin: 0 auto; /* Centraliza o container na página */
  padding-bottom: 40px; /* Espaço extra no final */
}

/* NOVO: Estilos para o <header>. */
header {
  background-color: #42b883; /* Verde Vue */
  color: white;
  padding: 20px; /* Aumenta o padding */
  margin-bottom: 30px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.15); /* Sombra um pouco mais pronunciada */
  border-radius: 0 0 8px 8px; /* Cantos inferiores arredondados */
}

/* Estilo para o <h1> dentro do <header>. */
h1 {
  color: white;
  text-align: center;
  margin: 0;
  font-size: 2em; /* Tamanho de fonte maior */
  font-weight: 700; /* Usa o peso 'bold' da Poppins */
}

/* NOVO: Estilos para o <main>. */
main {
  padding: 0 20px; /* Espaçamento lateral */
}

/* Estilos para as seções dentro do <main>. */
section {
  margin-bottom: 30px; /* Espaço entre as seções */
}

/* Estilos para o formulário de adição */
.add-timer-form div { /* Aplica a cada linha do formulário */
  margin-bottom: 12px;
  display: flex; /* Alinha label e input */
  align-items: center;
}
.add-timer-form label {
  margin-right: 10px; /* Aumenta espaço */
  width: 150px; /* Aumenta largura */
  text-align: right;
  flex-shrink: 0; /* Impede que o label encolha */
  font-weight: 500; /* Usa o peso 'medium' da Poppins */
}
.add-timer-form input {
  padding: 10px; /* Aumenta padding */
  border: 1px solid #ccc;
  border-radius: 4px;
  flex-grow: 1; /* Faz o input ocupar o espaço restante */
  font-size: 1em; /* Garante tamanho da fonte */
  font-family: inherit; /* Herda a fonte Poppins */
}

/* Botão principal de Adicionar */
button { /* Estilos aplicados ao botão principal fora da lista */
  display: block;
  margin: 20px auto 10px auto; /* Ajusta margem */
  padding: 12px 25px; /* Aumenta padding */
  cursor: pointer;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 5px; /* Aumenta arredondamento */
  font-size: 1.1em; /* Aumenta fonte */
  font-weight: 500; /* Usa peso 'medium' */
  font-family: inherit; /* Herda a fonte Poppins */
  transition: background-color 0.2s ease; /* Adiciona transição suave */
}
button:hover {
  background-color: #34a074;
}

/* Seção da lista */
h2 {
  margin-top: 20px; /* Reduz margem superior */
  border-bottom: 2px solid #42b883; /* Borda inferior mais grossa e verde */
  padding-bottom: 8px;
  color: #333;
  font-weight: 700; /* Bold */
}
ul { list-style: none; padding: 0; }

/* Item da lista <li> */
li {
  background-color: white; /* Fundo branco */
  padding: 15px; /* Aumenta padding */
  margin-bottom: 12px; /* Aumenta margem */
  border-radius: 6px; /* Aumenta arredondamento */
  border: 1px solid #e0e0e0; /* Borda mais suave */
  font-size: 1em; /* Tamanho padrão da fonte */
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05); /* Sombra muito leve */
  transition: box-shadow 0.2s ease; /* Transição na sombra */
}
li:hover {
  box-shadow: 0 3px 6px rgba(0,0,0,0.1); /* Sombra maior no hover */
}

/* Spans dentro do li */
li > span:first-child { /* Informações */
  flex-grow: 1; margin-right: 15px; overflow-wrap: break-word; /* Quebra palavras longas */
}
li > span:last-child { /* Botões */
  white-space: nowrap; flex-shrink: 0;
}

/* Mensagem de lista vazia */
p { text-align: center; color: #777; margin-top: 30px; font-size: 1.1em; }

/* Botões de Controle (Start, Pause, Resume, Reset, Delete) */
.control-button {
  display: inline-block; margin: 0; margin-left: 8px; padding: 6px 12px; /* Ajusta padding */
  font-size: 0.9em; /* Ajusta fonte */
  cursor: pointer; color: white; border: none; border-radius: 4px; vertical-align: middle;
  font-weight: 500; /* Medium */
  font-family: inherit; /* Herda Poppins */
  transition: opacity 0.2s ease, background-color 0.2s ease; /* Adiciona transição */
}
.control-button:hover { opacity: 0.85; }
.control-button.start { background-color: #28a745; }
.control-button.pause { background-color: #ffc107; color: #333; }
.control-button.resume { background-color: #17a2b8; }
.control-button.reset { background-color: #6c757d; }
.control-button.delete { background-color: #dc3545; }

/* ----- FIM DO BLOCO STYLE ----- */
</style>