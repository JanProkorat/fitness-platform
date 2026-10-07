import { useTranslation } from 'react-i18next';
import { Check, Copy, Plus, Utensils } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { COMMON_MEAL_KINDS } from '@/components/plan-editor/plan-editor-ops';
import { cn } from '@/lib/utils';

const ADD_CHIPS: readonly { kind: MealKind; labelKey: string }[] = [
  { kind: MealKind.Breakfast, labelKey: 'breakfast' },
  { kind: MealKind.MorningSnack, labelKey: 'snack' },
  { kind: MealKind.Lunch, labelKey: 'lunch' },
  { kind: MealKind.Dinner, labelKey: 'dinner' },
];

interface Props {
  /** True once at least one row exists, so the card offers "Done" instead of the preset. */
  hasRows: boolean;
  onApplyCommon: () => void;
  onAddKind: (kind: MealKind) => void;
  onDone: () => void;
  /** Shown as a link on an empty week when the host can offer another template's meals. */
  onCopyMeals?: () => void;
}

/** Empty-week card that turns a choice of meals into the week's rows. */
export default function MealPicker({ hasRows, onApplyCommon, onAddKind, onDone, onCopyMeals }: Props) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="plan-editor-picker-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-card"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-nutrition-soft text-nutrition-ink">
          <Utensils className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="plan-editor-picker-title" className="font-display text-panel-title font-semibold text-ink">
            {t('planEditor.picker.title')}
          </h2>
          <p className="text-body text-muted-foreground">{t('planEditor.picker.body')}</p>
        </div>
      </div>

      {!hasRows && (
        <button
          type="button"
          onClick={onApplyCommon}
          className="flex items-center gap-3 rounded-xl border-2 border-ink bg-card px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-copy font-semibold text-ink">
            {COMMON_MEAL_KINDS.map((kind) => t(`planEditor.rows.${mealKindLabelKey(kind)}`)).join(' · ')}
          </span>
          <span className="text-body text-muted-foreground">{t('planEditor.picker.mostCommon')}</span>
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        <span className="text-label font-semibold tracking-label text-muted-foreground uppercase">
          {t('planEditor.picker.addOneByOne')}
        </span>
        <div className="flex flex-wrap gap-2">
          {ADD_CHIPS.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              onClick={() => onAddKind(chip.kind)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-body font-medium text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
              )}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t(`planEditor.rows.${chip.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      {!hasRows && onCopyMeals && (
        <div className="flex items-center gap-2 border-t border-line pt-4 text-body text-muted-foreground">
          <Copy className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t('planEditor.picker.copyPrefix')}{' '}
            <button
              type="button"
              onClick={onCopyMeals}
              className="cursor-pointer font-semibold text-ink underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t('planEditor.picker.copyLink')}
            </button>
          </span>
        </div>
      )}

      {hasRows && (
        <button
          type="button"
          onClick={onDone}
          className="w-fit rounded-lg bg-ink px-4 py-2 text-body font-semibold text-primary-foreground"
        >
          {t('planEditor.picker.done')}
        </button>
      )}
    </section>
  );
}
