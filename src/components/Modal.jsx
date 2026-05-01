import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const sizeCls =
    size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-md';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(42,24,16,0.55)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={
              'w-full ' +
              sizeCls +
              ' bg-[var(--color-cream)] rounded-t-[18px] sm:rounded-[18px] border border-[var(--color-gold)] shadow-[0_-8px_40px_rgba(139,69,19,0.3)] sm:shadow-[0_20px_60px_rgba(139,69,19,0.3)] max-h-[92vh] overflow-hidden flex flex-col'
            }
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,151,58,0.4)]">
                <h3 className="font-tiro text-[1.4rem] text-[var(--color-ink)] m-0">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="btn-icon -mr-2 text-[var(--color-ink-soft)] hover:text-[var(--color-terracotta)]"
                  aria-label="बंद करा"
                >
                  <X size={22} />
                </button>
              </div>
            )}
            <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
            {footer && (
              <div className="px-5 py-3 border-t border-[rgba(201,151,58,0.4)] bg-[rgba(245,237,214,0.6)]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
