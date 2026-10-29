import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import ConflictComparison from '@/components/plan-editor/sync-conflicts/ConflictComparison';
import MarkReviewedButton from '@/components/plan-editor/sync-conflicts/MarkReviewedButton';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { useConflictFacts } from '@/components/plan-editor/sync-conflicts/useConflictFacts';

interface Props {
  placed: PlacedConflict;
  model: SyncConflictsModel;
}

/** The day view's panel inside a changed meal's card: what the client saw next to the meal now. */
export default function SyncConflictDayPanel({ placed, model }: Props) {
  const { t } = useTranslation();
  const facts = useConflictFacts(placed, model);
  const client = model.clientName;

  return (
    <div
      data-testid="sync-conflict-panel"
      data-conflict-id={placed.id}
      className="flex flex-col gap-3 rounded-xl border border-caution-ink/40 bg-caution-soft p-3"
      // The card is a button-like row (select on click); the panel must not toggle it.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-3">
        <History className="size-4 shrink-0 text-caution-ink" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-body text-caution-ink">
          <b className="font-semibold">
            {t('planEditor.syncConflicts.day.lead', { client, date: facts.date, time: facts.time })}
          </b>{' '}
          {t('planEditor.syncConflicts.day.versions', {
            client,
            based: facts.sawVersion ?? '–',
            current: facts.nowVersion ?? '–',
          })}
        </p>
        <MarkReviewedButton conflictId={placed.id} model={model} />
      </div>
      {facts.comparison && (
        <ConflictComparison
          comparison={facts.comparison}
          clientName={client}
          sawVersion={facts.sawVersion}
          nowVersion={facts.nowVersion}
          variant="day"
        />
      )}
    </div>
  );
}
