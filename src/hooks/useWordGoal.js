/**
 * useWordGoal — track daily word count and writing streak.
 *
 * Stores per-day totals in IndexedDB `wordStats` store.
 * A "streak" is consecutive days with ≥ 1 word written.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings, saveWordStat, getWordStats } from '../lib/db.js';

const MS_PER_DAY = 86_400_000;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useWordGoal(bookId) {
  const [goal, setGoal] = useState(500);        // words per day
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const lastWordCountRef = useRef(0);

  // Load settings + today's count on mount
  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const s = await getSettings();
      if (s.wordGoal) setGoal(s.wordGoal);

      const stats = await getWordStats(bookId);
      const key = todayKey();
      const todayStat = stats.find((s) => s.date === key);
      if (todayStat) setTodayCount(todayStat.words);

      // Calculate streak
      const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
      let s2 = 0;
      let expected = key;
      for (const stat of sorted) {
        if (stat.date === expected && stat.words > 0) {
          s2++;
          const d = new Date(stat.date);
          d.setDate(d.getDate() - 1);
          expected = d.toISOString().slice(0, 10);
        } else {
          break;
        }
      }
      setStreak(s2);
    })();
  }, [bookId]);

  /**
   * Called whenever the editor word count changes.
   * Only records the delta (new words written today).
   */
  const updateWordCount = useCallback(
    async (currentTotal) => {
      if (!bookId) return;
      const prev = lastWordCountRef.current;
      if (currentTotal <= prev) {
        lastWordCountRef.current = currentTotal;
        return;
      }
      const delta = currentTotal - prev;
      lastWordCountRef.current = currentTotal;

      const newToday = todayCount + delta;
      setTodayCount(newToday);

      await saveWordStat({ bookId, date: todayKey(), words: newToday });
    },
    [bookId, todayCount]
  );

  const percent = goal > 0 ? Math.min(100, Math.round((todayCount / goal) * 100)) : 0;
  const met = todayCount >= goal;

  return { goal, todayCount, streak, percent, met, updateWordCount };
}
