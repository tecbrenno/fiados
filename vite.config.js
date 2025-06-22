// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fiados/', // <-- Certifique-se que o nome é EXATAMENTE o nome do seu repositório
  // Adicione a função para configurar o ambiente
  // A função de configuração recebe `mode` e `command`
  // Isso garante que `process.env` esteja disponível no momento certo
  build: {
    rollupOptions: {
      output: {
        // Garante que o nome do arquivo JS principal não mude a cada build
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  plugins: [{
    name: 'debug-env',
    config(config, { mode }) {
      console.log('--- Debugging Vite Config Environment ---');
      console.log('Mode:', mode);
      console.log('process.env.VITE_FIREBASE_API_KEY:', process.env.VITE_FIREBASE_API_KEY);
      console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
      console.log('All process.env keys:', Object.keys(process.env));
      console.log('--- End Debugging Vite Config Environment ---');
      // Adicione mais logs para outras variáveis Firebase se necessário
    }
  }]
});