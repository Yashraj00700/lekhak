import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  detectDefaultLang,
  formatDate as fmtDate,
  formatNumber as fmtNum,
  translate,
} from '../lib/i18n.js';
import { getSettings, saveSettings } from '../lib/db.js';

const Ctx = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSettings();
      if (cancelled) return;
      const stored = s.language;
      if (stored && SUPPORTED_LANGS.includes(stored)) {
        setLangState(stored);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Reflect current language at the document level for accessibility.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'mr' ? 'mr' : 'en';
    }
  }, [lang]);

  const setLang = useCallback(async (next) => {
    if (!SUPPORTED_LANGS.includes(next)) return;
    setLangState(next);
    try {
      await saveSettings({ language: next });
    } catch (e) {
      console.warn('Could not persist language', e);
    }
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      ready,
      formatNumber: (n) => fmtNum(n, lang),
      formatDate: (ts) => fmtDate(ts, lang),
      isMarathi: lang === 'mr',
    }),
    [lang, setLang, t, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

/**
 * Convenience wrapper for components that only need t().
 */
export function useT() {
  return useLanguage().t;
}

export { DEFAULT_LANG, SUPPORTED_LANGS };
