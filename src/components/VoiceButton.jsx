import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { createVoiceRecognizer, isVoiceSupported } from '../lib/voice.js';
import { useToast } from '../hooks/useToast.jsx';

/**
 * Press-to-talk style mic button.
 *  - Tap to start, tap to stop.
 *  - Final transcripts call onTranscript(text) (appended).
 *  - Interim transcripts call onInterim(text) (live preview).
 */
export default function VoiceButton({ onTranscript, onInterim, lang = 'mr-IN', size = 'md' }) {
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef(null);
  const toast = useToast();

  useEffect(() => () => recognizerRef.current?.stop(), []);

  if (!isVoiceSupported()) {
    return (
      <button
        type="button"
        onClick={() => toast.warning('हे ब्राउझर मराठी आवाज ओळखत नाही. Safari किंवा Chrome वापरा.')}
        className="btn-icon rounded-[10px] text-[var(--color-ink-soft)] opacity-50"
        aria-label="आवाज समर्थन नाही"
      >
        <MicOff size={size === 'lg' ? 24 : 20} />
      </button>
    );
  }

  const start = () => {
    const r = createVoiceRecognizer({
      lang,
      onInterim: (t) => onInterim?.(t),
      onFinal: (t) => onTranscript?.(t),
      onError: (err) => {
        if (err?.message === 'not-allowed' || err?.message === 'permission-denied') {
          toast.error('मायक्रोफोनला परवानगी द्या');
        } else if (err?.message !== 'aborted') {
          toast.error('आवाज ओळखता आला नाही');
        }
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    recognizerRef.current = r;
    r.start();
    setListening(true);
  };

  const stop = () => {
    recognizerRef.current?.stop();
    setListening(false);
  };

  return (
    <motion.button
      type="button"
      onClick={listening ? stop : start}
      whileTap={{ scale: 0.94 }}
      className={
        'btn-icon rounded-[10px] transition-all relative ' +
        (listening
          ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] shadow-[0_3px_0_var(--color-terracotta-dark),0_4px_18px_rgba(196,98,45,0.4)]'
          : 'bg-[var(--color-cream)] text-[var(--color-terracotta)] border border-[var(--color-gold)] hover:bg-[rgba(196,98,45,0.08)]')
      }
      aria-label={listening ? 'थांबा' : 'बोलून लिहा'}
      aria-pressed={listening}
    >
      <Mic size={size === 'lg' ? 24 : 20} />
      {listening && (
        <motion.span
          className="absolute inset-0 rounded-[10px] border-2 border-[var(--color-cream)] pointer-events-none"
          animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
