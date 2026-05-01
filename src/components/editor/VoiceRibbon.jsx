/**
 * VoiceRibbon — displays interim speech recognition text BELOW the editor.
 *
 * The interim text is shown here (not inserted into the editor) to avoid
 * cursor jumping. When recognition produces a final result, the text is
 * inserted into the editor and the ribbon clears.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Mic } from 'lucide-react';

export default function VoiceRibbon({ interimText, isListening }) {
  if (!isListening && !interimText) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        className="flex items-start gap-2 px-4 py-2.5 bg-[var(--theme-bg-card)] border-t border-[var(--theme-border)]"
      >
        {/* Pulsing mic indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {isListening ? (
            <div className="relative flex items-center justify-center w-6 h-6">
              <div className="absolute w-6 h-6 rounded-full bg-red-500 opacity-20 animate-ping" />
              <Mic size={14} className="text-red-500 relative z-10" />
            </div>
          ) : (
            <Mic size={14} className="text-[var(--theme-text-soft)]" />
          )}
        </div>

        {/* Interim text */}
        <div className="flex-1 min-w-0">
          {interimText ? (
            <p className="text-sm leading-snug text-[var(--theme-text-soft)] italic line-clamp-2">
              {interimText}
            </p>
          ) : (
            <p className="text-xs text-[var(--theme-text-soft)] opacity-60">
              ऐकत आहे… बोला
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
