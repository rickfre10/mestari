import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    vue(),
    /*viteStaticCopy({
       targets: [
        {
          src: 'src/locales', // caminho dos arquivos de tradução
          dest: ''            // copia direto para a raiz do dist
        }
      ]
    })*/
  ],
  base: '/' // importante para GitHub Pages
})

