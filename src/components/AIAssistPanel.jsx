import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { fixGrammar, suggestContinuation, suggestAlternatives, summarize } from '../lib/gemini.js';
import { useToast } from '../hooks/useToast.jsx';

const ACTIONS = [
  { key: 'continue', label: 'पुढे लिहा', icon: Sparkles, hint: 'पुढील परिच्छेद सुचवा' },
  { key: 'fix', label: 'व्याकरण', icon: Wand2, hint: 'चुका दुरुस्त करा' },
  { key: 'alt', label: 'पर्यायी वाक्ये', icon: RefreshCw, hint: 'निवडलेल्या वाक्यासाठी' },
  { key: 'summary', label: 'सारांश', icon: Sparkles, hint: 'थोडक्यात' },
];

export default function AIAssistPanel({ chapterText, selection, onAccept, onClose, onReplace }) {
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const toast = useToast();

  const run = async (key) => {
    setActive(key);
    setBusy(true);
    setResult('');
    try {
      let out = '';
      if (key === 'continue') {
        out = await suggestContinuation(chapterText || '');
      } else if (key === 'fix') {
        const target = selection?.trim() || chapterText || '';
        if (!target.trim()) {
          toast.warning('दुरुस्तीसाठी मजकूर नाही');
          setBusy(false);
          return;
        }
        out = await fixGrammar(target);
      } else if (key === 'alt') {
        if (!selection?.trim()) {
          toast.warning('कृपया एक वाक्य निवडा');
          setBusy(false);
          return;
        }
        out = await suggestAlternatives(selection);
      } else if (key === 'summary') {
        if (!chapterText?.trim()) {
          toast.warning('प्रकरण रिकामे आहे');
          setBusy(false);
          return;
        }
        out = await summarize(chapterText);
      }
      setResult(out);
    } catch (err) {
      toast.error(err.marathiMessage || 'AI ला उत्तर देता आले नाही');
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!result) return;
    if (active === 'fix' && selection) {
      onReplace?.(result);
    } else if (active === 'alt') {
      onReplace?.(result.split('\n')[0]?.replace(/^\d+[.)]\s*/, '').trim() || result);
    } else {
      onAccept?.(result);
    }
    setResult('');
    setActive(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
      className="lekhak-card-paper p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-tiro text-[1.2rem] m-0 flex items-center gap-2 text-[var(--color-terracotta)]">
          <Sparkles size={18} />
          AI सहाय्यक
        </h3>
        <button
          onClick={onClose}
          className="btn-icon text-[var(--color-ink-soft)] -mr-2"
          aria-label="बंद करा"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {ACTIONS.map(({ key, label, icon: Icon, hint }) => (
          <button
            key={key}
            onClick={() => run(key)}
            disabled={busy}
            className={
              'p-3 rounded-[10px] border transition-all text-left disabled:opacity-50 ' +
              (active === key
                ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
                : 'bg-[var(--color-cream)] border-[var(--color-gold)] hover:bg-[rgba(196,98,45,0.08)]')
            }
          >
            <div className="flex items-center gap-2 font-semibold">
              <Icon size={16} />
              {label}
            </div>
            <div className={'text-xs mt-0.5 ' + (active === key ? 'opacity-90' : 'text-[var(--color-ink-soft)]')}>
              {hint}
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {(busy || result) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--color-parchment)] border border-[var(--color-gold)] rounded-[10px] p-3 mt-1 max-h-64 overflow-y-auto">
              {busy ? (
                <div className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                  <Loader2 size={18} className="animate-spin" />
                  AI विचार करत आहे…
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[var(--color-ink)] leading-relaxed m-0">
                  {result}
                </p>
              )}
            </div>
            {!busy && result && (
              <div className="flex gap-2 mt-3 justify-end">
                <button onClick={() => setResult('')} className="btn btn-ghost">
                  नाकारा
                </button>
                <button onClick={accept} className="btn btn-primary">
                  <Check size={18} />
                  {active === 'fix' || active === 'alt' ? 'बदला' : 'जोडा'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
