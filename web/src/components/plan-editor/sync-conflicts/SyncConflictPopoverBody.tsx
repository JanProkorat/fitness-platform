import { useTranslation } from 'react-i18next';
import { ChevronRight, History, X } from 'lucide-react';
import ConflictComparison from '@/components/plan-editor/sync-conflicts/ConflictComparison';
import MarkReviewedButton from '@/components/plan-editor/sync-conflicts/MarkReviewedButton';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { useConflictFacts } from '@/components/plan-editor/sync-conflicts/useConflictFacts';

interface Props {
  placed: PlacedConflict;
  model: SyncConflictsModel;
  onClose: () => void;
}

/** The week view's conflict popover: what happened, the two columns, "Open <day>" and "Mark reviewed". */
export default function SyncConflictPopoverBody({ placed, model, onClose }: Props) {
  const { t } = useTranslation();
  const facts = useConflictFacts(placed, model);
  const key = facts.removed ? 'removed' : 'changed';
  const client = model.clientName;

  return (
    <div data-testid="sync-conflict-popover" data-conflict-id={placed.id} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-caution-soft text-caution-ink">
          <History className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-display text-card-title font-semibold text-ink">
            {t(`planEditor.syncConflicts.popover.title.${key}`, { meal: facts.meal })}
          </h3>
          <p className="text-body text-muted-foreground">
            {t(`planEditor.syncConflicts.popover.intro.${key}`, { client, date: facts.date, time: facts.time })}
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

      {facts.comparison ? (
        <ConflictComparison
          comparison={facts.comparison}
          clientName={client}
          sawVersion={facts.sawVersion}
          nowVersion={facts.nowVersion}
          variant="popover"
        />
      ) : (
        <p data-testid="conflict-text-only" className="rounded-xl border border-line bg-muted px-4 py-3 text-body text-ink">
          {t('planEditor.syncConflicts.textOnly', {
            client,
            based: facts.sawVersion ?? '–',
            current: facts.nowVersion ?? '–',
          })}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {placed.dayOfWeek !== null ? (
          <button
            type="button"
            data-testid="conflict-open-day"
            onClick={() => model.onOpenDay(placed)}
            className="inline-flex cursor-pointer items-center gap-1 text-body font-semibold text-ink underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('planEditor.syncConflicts.openDay', { day: t(`planEditor.daysLong.${placed.dayOfWeek}`) })}
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        <MarkReviewedButton conflictId={placed.id} model={model} onDone={onClose} />
      </div>
    </div>
  );
}
