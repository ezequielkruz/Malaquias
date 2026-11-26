import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Fail gracefully if service worker registration is blocked
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
