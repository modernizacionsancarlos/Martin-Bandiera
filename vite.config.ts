import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  // MODO DEMO (npm run demo): reemplaza Firebase por una base local en memoria con datos
  // ficticios. En cualquier otro modo estos alias no existen y el sistema funciona como siempre.
  const isDemo = mode === 'demo';
  const demoAliases = isDemo
    ? [
        {find: /^firebase\/firestore$/, replacement: path.resolve(__dirname, 'src/demo/firestoreShim.ts')},
        {find: /^firebase\/auth$/, replacement: path.resolve(__dirname, 'src/demo/authShim.ts')},
        {find: /^firebase\/app$/, replacement: path.resolve(__dirname, 'src/demo/appShim.ts')},
        {find: /^(\.\.?\/)+data\/initialData$/, replacement: path.resolve(__dirname, 'src/demo/initialDataDemo.ts')},
      ]
    : [];
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __DEMO__: JSON.stringify(isDemo),
    },
    resolve: {
      alias: [
        {find: '@', replacement: path.resolve(__dirname, '.')},
        ...demoAliases,
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
