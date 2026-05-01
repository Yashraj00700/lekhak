import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BottomNav from './components/BottomNav.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { getSettings } from './lib/db.js';

const Home         = lazy(() => import('./routes/Home.jsx'));
const BookEditor   = lazy(() => import('./routes/BookEditor.jsx'));
const ImageStudio  = lazy(() => import('./routes/ImageStudio.jsx'));
const Characters   = lazy(() => import('./routes/Characters.jsx'));
const Glossary     = lazy(() => import('./routes/Glossary.jsx'));
const ExportPage   = lazy(() => import('./routes/Export.jsx'));
const SettingsPage = lazy(() => import('./routes/Settings.jsx'));

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="lekhak-card-paper px-6 py-4 text-[var(--theme-text-soft)]">
        क्षणभर थांबा…
      </div>
    </div>
  );
}

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

/**
 * ThemeWatcher — reads the saved theme from settings and applies it to <html>
 * via data-theme. Runs once on mount, then listens for a custom event
 * 'lekhak:theme-change' dispatched by Settings.jsx on save.
 */
function ThemeWatcher() {
  useEffect(() => {
    const apply = (theme) => {
      document.documentElement.setAttribute('data-theme', theme || 'parchment');
    };

    getSettings().then((s) => apply(s.theme));

    const handler = (e) => apply(e.detail);
    window.addEventListener('lekhak:theme-change', handler);
    return () => window.removeEventListener('lekhak:theme-change', handler);
  }, []);
  return null;
}

export default function App() {
  const location = useLocation();

  // Hide bottom nav when inside book editor (it has its own navigation)
  const hideNav = location.pathname.startsWith('/book/');

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <ThemeWatcher />
      <ScrollReset />
      <UpdateBanner />

      <main
        className="flex-1"
        style={{
          paddingBottom: hideNav ? 0 : '88px',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <AnimatePresence mode="sync" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/"                           element={<Home />} />
              <Route path="/book/:bookId"               element={<BookEditor />} />
              <Route path="/book/:bookId/images"        element={<ImageStudio />} />
              <Route path="/book/:bookId/characters"    element={<Characters />} />
              <Route path="/book/:bookId/glossary"      element={<Glossary />} />
              <Route path="/book/:bookId/export"        element={<ExportPage />} />
              <Route path="/images"                     element={<ImageStudio />} />
              <Route path="/characters"                 element={<Characters />} />
              <Route path="/glossary"                   element={<Glossary />} />
              <Route path="/settings"                   element={<SettingsPage />} />
              <Route path="*"                           element={<Home />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        </ErrorBoundary>
      </main>

      {!hideNav && <BottomNav />}
    </div>
  );
}
