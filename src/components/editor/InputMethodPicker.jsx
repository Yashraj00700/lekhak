/**
 * InputMethodPicker — three-tab input selector for the book editor.
 *
 * Tab 1: मराठी  — use native OS Marathi keyboard (no JS needed, just sets lang attr)
 * Tab 2: Roman  — Roman text → Devanagari transliteration via indic-transliteration
 * Tab 3: 🎤 Voice — Chrome Speech Recognition in Marathi (mr-IN)
 *
 * The active tab drives how text gets inserted into the TipTap editor.
 * Voice interim text is shown in VoiceRibbon below the editor, NOT inside it.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Keyboard, Languages, Mic, MicOff } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage.jsx';

// Lazy-load sanscript to avoid blocking the main bundle
let Sanscript = null;
async function getSanscript() {
  if (Sanscript) return Sanscript;
  const mod = await import('@indic-transliteration/sanscript');
  Sanscript = mod.default ?? mod.Sanscript ?? mod;
  return Sanscript;
}

const TABS = ['marathi', 'roman', 'voice'];

export default function InputMethodPicker({
  activeTab,
  onTabChange,
  onInsertText,   // called with final committed text
  onVoiceInterim, // called with interim voice text
  onVoiceStop,    // called when voice stops
  editorRef,
}) {
  const { t } = useLanguage();
  const [romanBuffer, setRomanBuffer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);
  const interimRef = useRef('');

  /* ─── Roman → Devanagari transliteration ─── */
  const handleRomanInput = useCallback(
    async (e) => {
      const raw = e.target.value;
      setRomanBuffer(raw);

      if (!raw) return;

      try {
        const sc = await getSanscript();
        // HK → Devanagari is the most natural Roman-Marathi mapping
        const devanagari = sc.t(raw, 'hk', 'devanagari');
        onInsertText?.(devanagari);
        setRomanBuffer('');
        e.target.value = '';
      } catch {
        // Fallback: insert as-is
        onInsertText?.(raw);
        setRomanBuffer('');
        e.target.value = '';
      }
    },
    [onInsertText]
  );

  /* ─── Voice recognition (Chrome-only, mr-IN) ─── */
  const startListening = useCallback(() => {
    const SR =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SR) {
      alert(t('voice.unsupported'));
      return;
    }

    const rec = new SR();
    rec.lang = 'mr-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        interimRef.current = interim;
        onVoiceInterim?.(interim);
      }

      if (finalText) {
        interimRef.current = '';
        onVoiceInterim?.('');
        onInsertText?.(finalText + ' ');
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        alert(t('voice.permissionDenied'));
      }
      setIsListening(false);
    };

    rec.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognizerRef.current === rec && isListening) {
        try { rec.start(); } catch { setIsListening(false); }
      } else {
        setIsListening(false);
        onVoiceStop?.();
      }
    };

    recognizerRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [t, onInsertText, onVoiceInterim, onVoiceStop, isListening]);

  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.onend = null;
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setIsListening(false);
    interimRef.current = '';
    onVoiceInterim?.('');
    onVoiceStop?.();
  }, [onVoiceInterim, onVoiceStop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      }
    };
  }, []);

  const tabLabel = (tab) => {
    if (tab === 'marathi') return <><Keyboard size={14} /> <span>मराठी</span></>;
    if (tab === 'roman')   return <><Languages size={14} /> <span>A→अ</span></>;
    if (tab === 'voice')   return isListening
      ? <><MicOff size={14} className="text-red-400" /> <span>{t('voice.stop')}</span></>
      : <><Mic size={14} /> <span>{t('voice.start').split(' ')[0]}</span></>;
    return tab;
  };

  const handleTabClick = (tab) => {
    if (tab === 'voice') {
      if (isListening) {
        stopListening();
      } else {
        onTabChange?.(tab);
        startListening();
      }
      return;
    }
    // Stop voice if switching away
    if (isListening) stopListening();
    onTabChange?.(tab);
  };

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[var(--theme-toolbar-bg)] border-b border-[var(--theme-border)]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={
              'flex items-center gap-1.5 px-3 h-8 rounded-[7px] text-sm font-medium transition-colors flex-shrink-0 ' +
              (activeTab === tab || (tab === 'voice' && isListening)
                ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)]'
                : 'text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.10)]')
            }
          >
            {tabLabel(tab)}
          </button>
        ))}

        {/* Hint */}
        <span className="ml-auto text-xs text-[var(--theme-text-soft)] hidden sm:block">
          {activeTab === 'marathi' && 'नेहमीचे मराठी कीबोर्ड'}
          {activeTab === 'roman' && 'Type in English → converts to Marathi'}
          {activeTab === 'voice' && !isListening && 'Chrome only · mr-IN'}
          {isListening && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              ऐकत आहे…
            </span>
          )}
        </span>
      </div>

      {/* Roman input box (visible only on roman tab) */}
      {activeTab === 'roman' && (
        <div className="px-3 py-2 bg-[var(--theme-bg)]">
          <input
            type="text"
            placeholder="Type Roman here → auto-converts to Marathi"
            className="input text-sm py-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleRomanInput(e);
              }
            }}
            onBlur={handleRomanInput}
            autoFocus
          />
          <div className="text-xs text-[var(--theme-text-soft)] mt-1 px-1">
            Press Space or Enter to insert
          </div>
        </div>
      )}
    </div>
  );
}
