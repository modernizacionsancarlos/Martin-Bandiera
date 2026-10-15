// Inicia el sistema en MODO DEMO: base local en memoria, datos ficticios y sin conexión a Firebase.
// Uso: npm run demo   (abre http://localhost:3100)
import { spawn } from 'child_process';

const child = spawn('npx', ['tsx', 'server.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DEMO_MODE: '1', PORT: process.env.DEMO_PORT || '3100', GEMINI_API_KEY: '' }
});
child.on('exit', code => process.exit(code ?? 0));
