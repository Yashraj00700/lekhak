/**
 * WordGoalBar — shows daily writing progress + streak flame.
 * Lives at the top of the editor below the chapter title.
 */

import { Flame } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage.jsx';

export default function WordGoalBar({ todayCount, goal, percent, met, streak }) {
  const { formatNumber } = useLanguage();

  if (!goal) return null;

  return (
    <div className="px-4 py-2 flex items-center gap-3">
      {/* Progress bar */}
      <div className="flex-1 word-goal-bar">
        <div
          className={`word-goal-fill ${met ? 'complete' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Count / goal */}
      <div className="flex items-center gap-2 text-xs text-[var(--theme-text-soft)] flex-shrink-0">
        <span className={met ? 'text-[var(--color-gold)] font-semibold' : ''}>
          {formatNumber(todayCount)} / {formatNumber(goal)}
        </span>

        {/* Streak */}
        {streak > 0 && (
          <div className={`flex items-center gap-0.5 ${streak >= 7 ? 'text-[var(--color-saffron)]' : 'text-[var(--theme-text-soft)]'}`}>
            <Flame size={13} className={streak >= 3 ? 'text-orange-400' : ''} />
            <span className="font-semibold">{streak}</span>
          </div>
        )}
      </div>
    </div>
  );
}
