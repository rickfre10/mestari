import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vueI18n from '@intlify/unplugin-vue-i18n/vite' 
import path from 'path' 

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({ // <-- 3. Adicione o plugin aqui
      // Usamos compositionOnly: true (padrão) porque você usa <script setup>
      // compositionOnly: true, // Pode omitir, pois é o padrão

      // Se seus arquivos de locale NÃO estão em 'src/locales', ajuste o 'include'
      // Se eles estão em 'src/locales' (como movido na versão simplificada),
      // este 'include' pode não ser estritamente necessário, mas é bom ter.
      // **Ajuste o caminho se necessário!**
      include: [path.resolve(__dirname, './src/locales/**')],

    })
  ],
  base: '/' // importante para GitHub Pages
})

