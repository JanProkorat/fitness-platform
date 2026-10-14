import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWeekNumbers, previewApply } from '@/components/client-plan-editor/applyTemplate';
import { planEndDate } from '@/components/client-plan-editor/clientPlanDates';
import type { EditorDocument } from '@/components/plan-editor/plan-editor-types';

export interface PendingTemplate {
  name: string;
  /** How many weeks the template has. */
  weekCount: number;
}

interface Props {
  pending: PendingTemplate | null;
  doc: EditorDocument;
  /** Week numbers the client already sees; they stay as they are. */
  publishedWeeks: readonly number[];
  clientFirstName: string;
  onConfirm: (keepLength: boolean) => void;
  onCancel: () => void;
}

/** Asks before a template replaces the draft weeks of a plan that already has meals. */
export default function ReplaceWithTemplateDialog({
  pending,
  doc,
  publishedWeeks,
  clientFirstName,
  onConfirm,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation();
  const keepId = useId();
  const [keepLength, setKeepLength] = useState(false);

  const base = pending ? previewApply(doc, publishedWeeks, pending.weekCount, false) : null;
  // Without the choice on offer the default applies, even if the box was ticked for an earlier template.
  const keeping = keepLength && base?.canKeepLength === true;
  const shown = pending && base ? (keeping ? previewApply(doc, publishedWeeks, pending.weekCount, true) : base) : null;

  function weeksLabel(weeks: readonly number[]): string {
    return t('clientPlanEditor.templates.weeksLabel', { count: weeks.length, range: formatWeekNumbers(weeks) });
  }

  function close() {
    setKeepLength(false);
    onCancel();
  }

  function formatEnding(resultLength: number): string {
    if (!doc.startDate) {
      return '';
    }
    const [year, month, day] = planEndDate(doc.startDate, resultLength).split('-').map(Number);
    const date = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(Date.UTC(year, month - 1, day));
    return t('clientPlanEditor.templates.ending', { date });
  }

  const planLength = doc.weeks.length;
  const lengthLine =
    pending && shown && shown.resultLength !== planLength
      ? t(
          shown.resultLength < planLength
            ? 'clientPlanEditor.templates.lengthShrinks'
            : 'clientPlanEditor.templates.lengthGrows',
          {
            template: t('clientPlanEditor.templates.weekCount', { count: pending.weekCount }),
            result: t('clientPlanEditor.templates.weekCount', { count: shown.resultLength }),
            ending: formatEnding(shown.resultLength),
          },
        )
      : null;

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent data-testid="replace-with-template-dialog">
        <DialogHeader>
          <DialogTitle>{t('clientPlanEditor.templates.replaceTitle', { name: pending?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('clientPlanEditor.templates.replaceBody')}</DialogDescription>
        </DialogHeader>

        {pending && shown && (
          <ul className="flex flex-col gap-2 text-body text-ink">
            {shown.draftWeeks.length > 0 && (
              <li>
                {t('clientPlanEditor.templates.draftsGet', { weeks: weeksLabel(shown.draftWeeks) })}
              </li>
            )}
            {shown.publishedWeeks.length > 0 && (
              <li>
                {t('clientPlanEditor.templates.publishedKept', {
                  count: shown.publishedWeeks.length,
                  weeks: weeksLabel(shown.publishedWeeks),
                  name: clientFirstName,
                })}
              </li>
            )}
            {lengthLine && <li>{lengthLine}</li>}
          </ul>
        )}

        {pending && base?.canKeepLength && (
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={keepId}
              checked={keepLength}
              onCheckedChange={(checked) => setKeepLength(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor={keepId} className="cursor-pointer text-body text-ink">
              {t('clientPlanEditor.templates.keepLength', {
                weeks: t('clientPlanEditor.templates.weekCount', { count: planLength }),
              })}
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setKeepLength(false);
              onConfirm(keeping);
            }}
          >
            {t('clientPlanEditor.templates.replaceConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
