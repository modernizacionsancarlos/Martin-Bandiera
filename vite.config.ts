import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

// Marca public/sw.js con un identificador distinto en cada build. Si el archivo no cambiara de un build a otro,
// el navegador no instalaría el service worker nuevo y los archivos nuevos de la app no quedarían guardados
// para abrir sin señal.
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const file = path.resolve(__dirname, outDir, 'sw.js');
      if (!fs.existsSync(file)) return;
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('__BUILD_ID__', stamp));
    }
  };
}

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
    plugins: [react(), tailwindcss(), stampServiceWorker()],
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
