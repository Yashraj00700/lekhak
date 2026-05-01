/**
 * Web Speech API wrapper for Marathi (mr-IN) dictation.
 * Returns a controller object: { start, stop, isSupported }.
 */

export function isVoiceSupported() {
  return typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createVoiceRecognizer({
  lang = 'mr-IN',
  onInterim,
  onFinal,
  onError,
  onEnd,
} = {}) {
  if (!isVoiceSupported()) {
    return {
      start: () => onError?.(new Error('VOICE_UNSUPPORTED')),
      stop: () => {},
      isSupported: false,
    };
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new Recognition();
  recog.lang = lang;
  recog.continuous = true;
  recog.interimResults = true;
  recog.maxAlternatives = 1;

  let stoppedManually = false;

  recog.onresult = (e) => {
    let finalText = '';
    let interimText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const txt = res[0]?.transcript || '';
      if (res.isFinal) finalText += txt;
      else interimText += txt;
    }
    if (interimText) onInterim?.(interimText);
    if (finalText) onFinal?.(finalText);
  };

  recog.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    onError?.(new Error(e.error || 'voice-error'));
  };

  recog.onend = () => {
    if (!stoppedManually) {
      // Auto-restart on iOS Safari (it stops every ~60s)
      try { recog.start(); } catch { /* noop */ }
    } else {
      onEnd?.();
    }
  };

  return {
    start() {
      stoppedManually = false;
      try { recog.start(); }
      catch (err) { onError?.(err); }
    },
    stop() {
      stoppedManually = true;
      try { recog.stop(); } catch { /* noop */ }
    },
    isSupported: true,
  };
}
