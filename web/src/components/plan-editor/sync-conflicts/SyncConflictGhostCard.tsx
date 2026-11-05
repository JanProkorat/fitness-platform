import { useTranslation } from 'react-i18next';
import { History, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  eatenSnapshotKcal,
  eatenViewState,
  lockedTileSurfaceClass,
  type RemovedGhost,
} from '@/components/plan-editor/meal-locks';
import { formatKcal, mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import EatenSnapshotList from '@/components/plan-editor/sync-conflicts/EatenSnapshotList';
import MarkReviewedButton from '@/components/plan-editor/sync-conflicts/MarkReviewedButton';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { useConflictFacts } from '@/components/plan-editor/sync-conflicts/useConflictFacts';

interface NoticeProps {
  placed: PlacedConflict;
  model: SyncConflictsModel;
  ghost: RemovedGhost;
}

function GhostNotice({ placed, model, ghost }: NoticeProps) {
  const { t } = useTranslation();
  const facts = useConflictFacts(placed, model, ghost.lock);
  return (
    <div
      data-testid="sync-conflict-panel"
      data-conflict-id={placed.id}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-caution-ink/40 bg-caution-soft p-3"
    >
      <History className="size-4 shrink-0 text-caution-ink" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-body text-caution-ink">
        <b className="font-semibold">
          {t('planEditor.syncConflicts.ghost.lead', { meal: facts.meal, client: model.clientName })}
        </b>{' '}
        {t('planEditor.syncConflicts.ghost.body', { client: model.clientName, date: facts.date, time: facts.time })}
      </p>
      <MarkReviewedButton conflictId={placed.id} model={model} />
    </div>
  );
}

interface Props {
  ghost: RemovedGhost;
  /** The unreviewed conflict on this meal; absent once it is reviewed (the card stays, the notice goes). */
  placed: PlacedConflict | undefined;
  model: SyncConflictsModel | null;
}

/** The day view's read-only card for a meal the client ate that the coach has since removed. It is never saved. */
export default function SyncConflictGhostCard({ ghost, placed, model }: Props) {
  const { t, i18n } = useTranslation();
  const eaten = ghost.lock;
  const state = eatenViewState(eaten);
  const kindLabel = t(`planEditor.rows.${mealKindLabelKey(ghost.kind)}`);

  return (
    <li
      data-testid="sync-conflict-ghost-card"
      data-conflict-id={ghost.id}
      data-meal-id={ghost.lock.mealId}
      data-day={ghost.dayOfWeek}
      className={cn('flex flex-col gap-3 rounded-2xl border border-dashed p-5', lockedTileSurfaceClass(state))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-display text-card-title font-semibold text-ink">{kindLabel}</h3>
        <span className="text-copy font-semibold text-ink">
          {t('planEditor.cell.kcal', { kcal: formatKcal(eatenSnapshotKcal(eaten), i18n.language) })}
        </span>
        <span className="inline-flex items-center rounded-full bg-card/70 px-2.5 py-1 text-meta font-semibold text-muted-foreground">
          {t('planEditor.syncConflicts.ghost.badge')}
        </span>
      </div>
      {placed && model && <GhostNotice placed={placed} model={model} ghost={ghost} />}
      {eaten.snapshot.length > 0 ? (
        <EatenSnapshotList eaten={eaten} />
      ) : (
        <p className="text-body text-muted-foreground">{t('planEditor.syncConflicts.ghost.noItems')}</p>
      )}
    </li>
  );
}
