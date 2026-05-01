import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { LanguageProvider } from './hooks/useLanguage.jsx';
import { setSWUpdateController } from './lib/swUpdate.js';

// Register the Workbox-generated service worker. The hook surfaces the
// "needRefresh" / "offlineReady" signals via swUpdate so the UI can prompt.
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setSWUpdateController({ needsRefresh: true, update: () => updateSW(true) });
        },
        onOfflineReady() {
          setSWUpdateController({ offlineReady: true });
        },
      });
    })
    .catch((e) => console.warn('[Lekhak] SW registration deferred:', e));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
