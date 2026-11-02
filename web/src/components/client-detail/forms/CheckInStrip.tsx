import { useTranslation } from 'react-i18next';
import { FormResponseState, type ClientFormItem } from '@/api/questionnaires';
import { isoWeekNumber, weekStrip } from '@/components/client-detail/forms/clientFormsModel';
import { cn } from '@/lib/utils';

const STATE_CLASS: Record<FormResponseState, string> = {
  [FormResponseState.Answered]: 'bg-success',
  [FormResponseState.Missed]: 'bg-error',
  [FormResponseState.Waiting]: 'bg-muted',
};

interface Props {
  current: readonly ClientFormItem[];
  selected: ClientFormItem;
  onSelect: (item: ClientFormItem) => void;
}

/** The latest check-in weeks as coloured cells: answered, missed or still waiting. Answered weeks open on click. */
export default function CheckInStrip({ current, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const weeks = weekStrip(current);
  if (weeks.length === 0) {
    return null;
  }

  return (
    <ol data-testid="check-in-strip" aria-label={t('clientForms.page.stripLabel')} className="flex gap-2">
      {weeks.map((week) => {
        const state = week.state ?? FormResponseState.Waiting;
        const number = isoWeekNumber(week);
        const label = t('clientForms.page.weekShort', { week: number });
        const stateLabel = t(`clientForms.page.strip.${state}`);
        const isSelected = week.responsePublicId === selected.responsePublicId;
        const cell = cn('h-6 w-full rounded-md', STATE_CLASS[state], isSelected && 'ring-2 ring-ink ring-offset-2 ring-offset-card');
        return (
          <li key={week.responsePublicId ?? number} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {state === FormResponseState.Answered ? (
              <button
                type="button"
                aria-label={`${label}, ${stateLabel}`}
                aria-pressed={isSelected}
                data-testid="strip-week"
                data-state={state}
                onClick={() => onSelect(week)}
                className={cn(cell, 'cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50')}
              />
            ) : (
              <span role="img" aria-label={`${label}, ${stateLabel}`} data-testid="strip-week" data-state={state} className={cell} />
            )}
            <span className={cn('text-meta text-muted-foreground', isSelected && 'font-bold text-ink')} aria-hidden="true">
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
