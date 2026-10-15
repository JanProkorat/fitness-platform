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

interface Props {
  /** One-based number of the week about to be removed; null keeps the dialog closed. */
  weekNumber: number | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before the last, unpublished week is dropped and the plan saved. Escape and Cancel change nothing. */
export default function RemoveWeekDialog({ weekNumber, busy, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={weekNumber !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-115" data-testid="remove-week-dialog">
        <DialogHeader>
          <DialogTitle>{t('planEditor.removeWeek.title', { week: weekNumber })}</DialogTitle>
          <DialogDescription>{t('planEditor.removeWeek.body', { week: weekNumber })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
            {t('planEditor.removeWeek.confirm', { week: weekNumber })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
