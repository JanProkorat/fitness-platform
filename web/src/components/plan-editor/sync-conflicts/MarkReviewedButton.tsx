import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';

interface Props {
  conflictId: string;
  model: SyncConflictsModel;
  /** Runs after the conflict was marked reviewed. */
  onDone?: () => void;
}

/** Marks one conflict reviewed; the conflict stays until the server confirms, and a failure toasts. */
export default function MarkReviewedButton({ conflictId, model, onDone }: Props) {
  const { t } = useTranslation();
  const busy = model.reviewingId === conflictId || model.reviewingAll;
  return (
    <Button
      type="button"
      size="sm"
      data-testid="conflict-mark-reviewed"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void model.onReview(conflictId).then((ok) => {
          if (ok) {
            onDone?.();
          }
        });
      }}
    >
      <Check aria-hidden="true" />
      {t('planEditor.syncConflicts.markReviewed')}
    </Button>
  );
}
