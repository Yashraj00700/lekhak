import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { onSWUpdate } from '../lib/swUpdate.js';
import { useLanguage } from '../hooks/useLanguage.jsx';

export default function UpdateBanner() {
  const { t } = useLanguage();
  const [state, setState] = useState({ needsRefresh: false });

  useEffect(() => onSWUpdate(setState), []);

  return (
    <AnimatePresence>
      {state.needsRefresh && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0.32, 1] }}
          className="fixed top-0 left-0 right-0 z-[60] px-3 pointer-events-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <div className="pointer-events-auto max-w-md mx-auto bg-[var(--color-forest)] text-[var(--color-cream)] rounded-[12px] shadow-[0_8px_28px_rgba(45,80,22,0.35)] px-3 py-2.5 flex items-center gap-3">
            <RefreshCw size={18} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-tight">{t('sw.update.title')}</div>
              <div className="text-xs opacity-90 leading-tight">{t('sw.update.body')}</div>
            </div>
            <button
              onClick={() => state.update?.()}
              className="px-3 h-9 rounded-[8px] bg-[var(--color-cream)] text-[var(--color-forest)] font-bold text-sm hover:bg-white"
            >
              {t('sw.update.cta')}
            </button>
            <button
              onClick={() => setState((s) => ({ ...s, needsRefresh: false }))}
              className="text-[var(--color-cream)] opacity-80 hover:opacity-100 -mr-1"
              aria-label={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
