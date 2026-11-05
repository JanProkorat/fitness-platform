import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { MealLockState } from '@/api/generated';
import { lockedTileSurfaceClass } from '@/components/plan-editor/meal-locks';
import { cn } from '@/lib/utils';

const SWATCHES = [
  { state: MealLockState.Eaten, key: 'eaten' },
  { state: MealLockState.PartlyEaten, key: 'partlyEaten' },
  { state: MealLockState.Missed, key: 'missed' },
] as const;

/** Names the tile colours and the lock mark of a client's week grid. */
export default function MealLockLegend() {
  const { t } = useTranslation();
  return (
    <ul
      data-testid="meal-lock-legend"
      aria-label={t('planEditor.locks.legend.label')}
      className="flex shrink-0 items-center gap-3 text-meta whitespace-nowrap text-muted-foreground"
    >
      {SWATCHES.map(({ state, key }) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-xs border', lockedTileSurfaceClass(state))} aria-hidden="true" />
          {t(`planEditor.locks.legend.${key}`)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <Lock className="size-3" aria-hidden="true" />
        {t('planEditor.locks.legend.locked')}
      </li>
    </ul>
  );
}
