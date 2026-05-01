import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';
import { ToastProvider } from './hooks/useToast.jsx';

// Register service worker (auto-update). Failures are non-fatal — app still works.
if ('serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.info('[Lekhak] Ready for offline use');
      },
    });
  } catch (e) {
    console.warn('[Lekhak] SW registration deferred:', e);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
