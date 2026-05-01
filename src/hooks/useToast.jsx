import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from './useLanguage.jsx';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { t } = useLanguage();

  const dismiss = useCallback((id) => {
    setToasts((arr) => arr.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (msg, { variant = 'info', duration = 3500 } = {}) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((arr) => [...arr, { id, msg, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  /**
   * Show a toast for a thrown error. Honours `.i18nKey` so the message
   * is rendered in the user's chosen language.
   */
  const showError = useCallback(
    (err, fallbackKey = 'errors.fallback') => {
      const key = err?.i18nKey || fallbackKey;
      const msg = t(key) || err?.message || t('errors.fallback');
      return show(msg, { variant: 'error' });
    },
    [show, t]
  );

  const value = {
    show,
    dismiss,
    showError,
    info: (m, opts) => show(m, { ...opts, variant: 'info' }),
    success: (m, opts) => show(m, { ...opts, variant: 'success' }),
    error: (m, opts) => show(m, { ...opts, variant: 'error' }),
    warning: (m, opts) => show(m, { ...opts, variant: 'warning' }),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0.32, 1] }}
              onClick={() => dismiss(toast.id)}
              className={
                'pointer-events-auto max-w-md w-full px-4 py-3 rounded-[12px] shadow-[0_8px_28px_rgba(139,69,19,0.25)] cursor-pointer text-base font-medium border ' +
                (toast.variant === 'success'
                  ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
                  : toast.variant === 'error'
                  ? 'bg-[var(--color-rust)] text-[var(--color-cream)] border-[var(--color-terracotta)]'
                  : toast.variant === 'warning'
                  ? 'bg-[var(--color-saffron)] text-[var(--color-ink)] border-[var(--color-gold)]'
                  : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
              }
            >
              {toast.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
