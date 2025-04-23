// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({
      // TENTATIVA: Forçar compositionOnly para false
      compositionOnly: false, // <<< ADICIONE ESTA LINHA

      // Mantenha o include se ele estiver correto para sua estrutura
      include: [path.resolve(__dirname, './src/locales/**')],
    })
  ],
  base: '/' // importante para GitHub Pages
})

