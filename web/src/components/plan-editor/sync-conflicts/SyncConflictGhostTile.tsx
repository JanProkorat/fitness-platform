import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import SyncConflictPopoverBody from '@/components/plan-editor/sync-conflicts/SyncConflictPopoverBody';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';

interface Props {
  placed: PlacedConflict;
  model: SyncConflictsModel;
}

/** A week-grid tile for a meal the coach removed after the client ate it offline; opens the comparison. */
export default function SyncConflictGhostTile({ placed, model }: Props) {
  const { t, i18n } = useTranslation();
  const boundary = usePopoverBoundary();
  const open = model.openGhostId === placed.id;
  const items = placed.conflict.seenItems ?? [];
  const kcal = items.reduce((sum, item) => sum + (item.kcal ?? 0), 0);
  const close = () => model.onOpenGhost(null);

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          data-testid="sync-conflict-ghost"
          data-conflict-id={placed.id}
          data-day={placed.dayOfWeek ?? undefined}
          aria-expanded={open}
          aria-label={t('planEditor.syncConflicts.ghost.aria', {
            meal: placed.conflict.mealKind ? t(`mealKind.${placed.conflict.mealKind}`) : '',
          })}
          onClick={() => model.onOpenGhost(open ? null : placed.id)}
          className="flex min-h-0 min-w-0 flex-col items-stretch justify-between gap-1 rounded-xl border border-dashed border-caution-ink/60 bg-caution-soft p-3 text-left outline-none transition-colors hover:border-caution-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex items-center justify-between gap-1">
            <span className="truncate text-label font-bold tracking-label text-caution-ink uppercase">
              {t('planEditor.syncConflicts.ghost.badge')}
            </span>
            <History className="size-3.5 shrink-0 text-caution-ink" aria-hidden="true" />
          </span>
          <span className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
            {items.slice(0, 2).map((item, index) => (
              <span key={`${item.refId ?? ''}:${index}`} className="truncate text-copy font-semibold text-ink line-through">
                {item.name}
              </span>
            ))}
          </span>
          {kcal > 0 && (
            <span className="truncate text-body font-semibold text-muted-foreground">
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
          <SyncConflictPopoverBody placed={placed} model={model} onClose={close} />
        </PopoverContent>
      )}
    </Popover>
  );
}
