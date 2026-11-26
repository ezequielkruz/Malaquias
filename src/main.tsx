import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function registerServiceWorker() {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.info('[PWA] Service Worker registrado:', registration.scope);
    })
    .catch(() => {
      // Falha silenciosa caso o ambiente bloqueie Service Workers
    });
}

if ('serviceWorker' in navigator) {
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, {once: true});
  }
}

createRoot(document.getElementById('root')!).render(<App />);
