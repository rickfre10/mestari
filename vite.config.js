// vite.config.js

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// 1. Importa o plugin vue-i18n
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
// O import 'path' não é mais necessário se não usarmos __dirname no 'include'
// import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    // 2. Adiciona o plugin vueI18n
    vueI18n({
      // Deixe a opção 'compositionOnly' como estava no último teste que falhou,
      // ou remova a linha para usar o padrão (true).
      // Exemplo (mantendo false, se foi o último teste):
      // compositionOnly: false,

      // REMOVEMOS a opção 'include' daqui:
      // include: [path.resolve(__dirname, './src/locales/**')],
    })
    // O plugin viteStaticCopy foi removido em passos anteriores (assumindo locales em /public ou pré-carregados)
  ],
  // 3. Base continua '/' para seu domínio personalizado
  base: '/'
})