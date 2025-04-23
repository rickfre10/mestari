// src/main.js
import { createApp } from 'vue'
import App from './App.vue'


function initApp() {
  const app = createApp(App)

  app.mount('#app')
}

initApp()