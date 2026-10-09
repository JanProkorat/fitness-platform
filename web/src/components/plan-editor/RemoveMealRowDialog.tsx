import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PendingRowRemoval {
  /** Row label key, e.g. `lunch`, as used under `planEditor.rows`. */
  rowLabelKey: string;
  weekNumber: number;
  /** Weekdays of this week that have food in the row. */
  days: number[];
}

interface Props {
  /** The row about to be removed; null keeps the dialog closed. */
  removal: PendingRowRemoval | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before a row that holds food is dropped from the current week. Escape and Cancel change nothing. */
export default function RemoveMealRowDialog({ removal, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const meal = removal ? t(`planEditor.rows.${removal.rowLabelKey}`) : '';

  return (
    <Dialog open={removal !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-115" data-testid="remove-row-dialog">
        <DialogHeader>
          <DialogTitle>{t('planEditor.removeRow.title', { meal, week: removal?.weekNumber })}</DialogTitle>
          <DialogDescription>
            {t('planEditor.removeRow.body', {
              meal,
              count: removal?.days.length ?? 0,
              days: removal?.days.map((day) => t(`planEditor.daysLong.${day}`)).join(', '),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {t('planEditor.removeRow.confirm', { meal })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
