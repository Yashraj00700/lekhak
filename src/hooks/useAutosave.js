import { useEffect, useRef, useState } from 'react';

/**
 * Debounced autosave with periodic flush.
 *  - Saves at most every `interval` ms (default 30s)
 *  - Also saves immediately on visibility change / unload
 *
 * `value` should be referentially stable when nothing changed (e.g. wrap object/string).
 */
export default function useAutosave(value, save, { interval = 30_000, immediateOnHide = true } = {}) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const lastSaved = useRef(value);
  const timeoutRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = async () => {
    const cur = valueRef.current;
    if (cur === lastSaved.current) return;
    setStatus('saving');
    try {
      await saveRef.current(cur);
      lastSaved.current = cur;
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch (e) {
      console.error('Autosave failed', e);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (value === lastSaved.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(flush, interval);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, interval]);

  useEffect(() => {
    if (!immediateOnHide) return;
    const onHide = () => { flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediateOnHide]);

  return { status, flush };
}
