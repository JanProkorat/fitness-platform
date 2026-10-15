import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MAX_MEALS_PER_DAY } from '@/components/plan-editor/plan-editor-types';

export type LabelChoice = 'swap' | 'replace' | 'append';

export interface LabelDropRequest {
  /** Names of the dragged and the target row or day. */
  from: string;
  to: string;
  /** Weekdays a Replace or Append would leave out because they would pass the daily meal cap. */
  skippedCopy: number[];
  /** Weekdays a Swap would leave out for the same reason. */
  skippedSwap: number[];
}

interface Props {
  /** The pending move; null keeps the dialog closed. */
  drop: LabelDropRequest | null;
  onChoose: (choice: LabelChoice) => void;
  onCancel: () => void;
}

/** Asks what a row or day dropped on a filled one should do. Escape and Cancel change nothing. */
export default function LabelDropDialog({ drop, onChoose, onCancel }: Props) {
  const { t } = useTranslation();
  const dayList = (days: number[]) => days.map((day) => t(`planEditor.daysLong.${day}`)).join(', ');
  const from = drop?.from ?? '';
  const to = drop?.to ?? '';

  return (
    <Dialog open={drop !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-115" data-testid="label-drop-dialog">
        <DialogHeader>
          <DialogTitle>{t('planEditor.labelDrop.title', { to })}</DialogTitle>
          <DialogDescription>
            <Trans
              i18nKey="planEditor.labelDrop.body"
              values={{ from, to }}
              components={{ b: <b className="font-semibold text-ink" /> }}
            />
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-xl bg-nutrition-soft px-3 py-2.5 text-meta text-nutrition-ink">
          <span>
            <b>{t('planEditor.labelDrop.swapLabel')}</b>
            {' — '}
            {t('planEditor.labelDrop.swapBody', { from, to })}
          </span>
          <span>
            <b>{t('planEditor.labelDrop.replaceLabel')}</b>
            {' — '}
            {t('planEditor.labelDrop.replaceBody', { from, to })}
          </span>
          <span>
            <b>{t('planEditor.labelDrop.appendLabel')}</b>
            {' — '}
            {t('planEditor.labelDrop.appendBody', { from, to })}
          </span>
        </div>

        {drop && (drop.skippedCopy.length > 0 || drop.skippedSwap.length > 0) && (
          <ul data-testid="label-drop-skipped" className="flex flex-col gap-1 text-meta text-error">
            {drop.skippedCopy.length > 0 && (
              <li>
                {t('planEditor.labelDrop.skippedCopy', { days: dayList(drop.skippedCopy), max: MAX_MEALS_PER_DAY })}
              </li>
            )}
            {drop.skippedSwap.length > 0 && (
              <li>
                {t('planEditor.labelDrop.skippedSwap', { days: dayList(drop.skippedSwap), max: MAX_MEALS_PER_DAY })}
              </li>
            )}
          </ul>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onChoose('append')}>
              {t('planEditor.labelDrop.appendLabel')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onChoose('replace')}>
              {t('planEditor.labelDrop.replaceLabel')}
            </Button>
            <Button type="button" onClick={() => onChoose('swap')}>
              {t('planEditor.labelDrop.swapLabel')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
