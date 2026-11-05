import { useTranslation } from 'react-i18next';
import { ChevronRight, History, Lock, X } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import {
  eatenSnapshotKcal,
  eatenViewState,
  lockedTileSurfaceClass,
  type RemovedGhost,
} from '@/components/plan-editor/meal-locks';
import { formatKcal, mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import EatenSnapshotList from '@/components/plan-editor/sync-conflicts/EatenSnapshotList';
import SyncConflictPopoverBody from '@/components/plan-editor/sync-conflicts/SyncConflictPopoverBody';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';

interface Props {
  ghost: RemovedGhost;
  /** The unreviewed conflict on this meal; absent once reviewed, and the tile then stays as a plain eaten tile. */
  placed: PlacedConflict | undefined;
  model: SyncConflictsModel | null;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leaves the week view for the ghost's weekday. */
  onOpenDay: (dayOfWeek: number) => void;
}

function RemovedMealBody({
  ghost,
  clientName,
  onClose,
  onOpenDay,
}: {
  ghost: RemovedGhost;
  clientName: string;
  onClose: () => void;
  onOpenDay: (dayOfWeek: number) => void;
}) {
  const { t } = useTranslation();
  const kind = t(`planEditor.rows.${mealKindLabelKey(ghost.kind)}`);
  const dayLong = t(`planEditor.daysLong.${ghost.dayOfWeek}`);
  return (
    <div data-testid="removed-meal-popover" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-display text-card-title font-semibold text-ink">
            {t('planEditor.syncConflicts.removedMeal.title', { meal: kind })}
          </h3>
          <p className="text-body text-muted-foreground">
            {t('planEditor.syncConflicts.removedMeal.intro', { client: clientName })}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('planEditor.syncConflicts.close')}
          onClick={onClose}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <EatenSnapshotList eaten={ghost.lock} />
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          {t('planEditor.syncConflicts.removedMeal.locked')}
        </p>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => onOpenDay(ghost.dayOfWeek)}>
          {t('planEditor.locks.openDay', { day: dayLong })}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** A week-grid tile for a meal the client ate that the coach has since removed: read-only, never saved, opens what was eaten. */
export default function SyncConflictGhostTile({ ghost, placed, model, clientName, open, onOpenChange, onOpenDay }: Props) {
  const { t, i18n } = useTranslation();
  const boundary = usePopoverBoundary();
  const eaten = ghost.lock;
  const kcal = eatenSnapshotKcal(eaten);
  const kindLabel = t(`mealKind.${ghost.kind}`);

  return (
    <Popover open={open} modal={false} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <button
          type="button"
          data-testid="sync-conflict-ghost"
          data-conflict-id={ghost.id}
          data-meal-id={ghost.lock.mealId}
          data-day={ghost.dayOfWeek}
          data-unreviewed={placed ? 'true' : undefined}
          aria-expanded={open}
          aria-label={t('planEditor.syncConflicts.ghost.aria', { meal: kindLabel })}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'flex min-h-0 min-w-0 flex-col items-stretch justify-between gap-1 rounded-xl border border-dashed p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
            lockedTileSurfaceClass(eatenViewState(eaten)),
            placed && 'border-caution-ink/60 hover:border-caution-ink',
          )}
        >
          <span className="flex items-center justify-between gap-1">
            <span
              className={cn(
                'truncate text-label font-bold tracking-label uppercase',
                placed ? 'text-caution-ink' : 'text-muted-foreground',
              )}
            >
              {t('planEditor.syncConflicts.ghost.badge')}
            </span>
            {placed ? (
              <History className="size-3.5 shrink-0 text-caution-ink" aria-hidden="true" />
            ) : (
              <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <span className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
            {eaten.snapshot.slice(0, 2).map((item, index) => (
              <span key={`${item.itemId ?? ''}:${index}`} className="truncate text-copy font-semibold text-ink">
                {item.name}
              </span>
            ))}
          </span>
          {kcal > 0 && (
            <span className="truncate text-body font-semibold text-ink">
              {t('planEditor.cell.kcal', { kcal: formatKcal(kcal, i18n.language) })}
            </span>
          )}
        </button>
      </PopoverAnchor>
      {open && (
        <PopoverContent
          side="bottom"
          align="center"
          collisionBoundary={boundary}
          collisionPadding={{ top: 0, right: 16, bottom: 16, left: 16 }}
          sideOffset={8}
          className="max-h-(--radix-popover-content-available-height) w-140 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-line bg-card p-5"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[data-plan-library],[data-testid="sync-conflict-ghost"]')) {
              event.preventDefault();
            }
          }}
        >
          {placed && model ? (
            <SyncConflictPopoverBody placed={placed} model={model} eaten={eaten} onClose={() => onOpenChange(false)} />
          ) : (
            <RemovedMealBody ghost={ghost} clientName={clientName} onClose={() => onOpenChange(false)} onOpenDay={onOpenDay} />
          )}
        </PopoverContent>
      )}
    </Popover>
  );
}
