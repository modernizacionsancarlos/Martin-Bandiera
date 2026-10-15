import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Aplicación instalable que abre sin señal: el service worker solo se registra en la versión publicada
// (en desarrollo guardaría módulos cambiantes y confundiría las pruebas).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[PWA] No se pudo registrar el service worker:', err));
  });
}
