import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DayHeader, DayTotalCell, GridSurface, MacroBar } from '@/components/plan-editor/WeekGrid';
import {
  DAY_ORDER,
  formatKcal,
  GRID_CLASS,
  GRID_LABEL_CLASS,
  mealKindLabelKey,
  WEEK_GRID_CLASS,
  weekGridRows,
} from '@/components/plan-editor/plan-editor-format';
import {
  MEAL_SHARE_PERCENT,
  mealItemCount,
  mealKcalStatus,
  mealTotals,
  type ShareStatus,
} from '@/components/plan-editor/plan-editor-nutrition';
import { weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';
import { MealKind } from '@/api/generated';

const CELL_CLASS: Record<ShareStatus, string> = {
  none: 'border-raised-line bg-raised',
  on: 'border-transparent bg-success-soft',
  over: 'border-transparent bg-training-soft',
  under: 'border-raised-line bg-raised',
};
const CAPTION_CLASS: Record<ShareStatus, string> = {
  none: 'text-muted-foreground',
  on: 'text-success-ink',
  over: 'text-training-ink',
  under: 'text-muted-foreground',
};

interface CellProps {
  meal: EditorMeal | undefined;
  rowLabelKey: string;
  dailyKcalTarget: number | undefined;
}

function NutritionCell({ meal, rowLabelKey, dailyKcalTarget }: CellProps) {
  const { t, i18n } = useTranslation();
  if (!meal || mealItemCount(meal) === 0) {
    return (
      <div
        data-testid="nutrition-cell"
        data-status="empty"
        className="flex min-h-0 items-center justify-center rounded-xl border border-dashed border-line text-copy text-faint"
      >
        —
      </div>
    );
  }
  const totals = mealTotals(meal);
  const result = mealKcalStatus(totals.kcal, meal.kind, dailyKcalTarget);
  const ownKeyDiffers = mealKindLabelKey(meal.kind) !== rowLabelKey;
  const caption =
    result.status === 'on'
      ? t('planEditor.nutrition.onTarget')
      : result.status === 'none'
        ? null
        : `${result.deviationPercent > 0 ? '+' : '−'}${Math.abs(result.deviationPercent)} %`;

  return (
    <div
      data-testid="nutrition-cell"
      data-status={result.status}
      className={cn('flex min-h-0 min-w-0 flex-col justify-between gap-1 rounded-xl border p-3 shadow-raised', CELL_CLASS[result.status])}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {ownKeyDiffers && (
          <span className="truncate text-label font-bold tracking-label text-nutrition-ink uppercase">
            {t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`)}
          </span>
        )}
        <span className="flex flex-wrap items-baseline gap-x-1 font-display text-stat font-semibold text-ink">
          {formatKcal(totals.kcal, i18n.language)}
          <span className="text-body font-normal text-muted-foreground">{t('planEditor.nutrition.kcalUnit')}</span>
        </span>
        {caption && <span className={cn('text-body font-semibold', CAPTION_CLASS[result.status])}>{caption}</span>}
        <span className="text-body text-ink [overflow-wrap:anywhere]">
          {t('planEditor.nutrition.macros', {
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fat: Math.round(totals.fat),
          })}
        </span>
        <span className="truncate text-body text-muted-foreground">
          {t('planEditor.nutrition.fiber', { grams: Math.round(totals.fiber) })}
        </span>
      </div>
      <MacroBar totals={totals} />
    </div>
  );
}

const SHARE_ORDER: readonly { kind: MealKind; labelKey: string }[] = [
  { kind: MealKind.Breakfast, labelKey: 'breakfast' },
  { kind: MealKind.MorningSnack, labelKey: 'snack' },
  { kind: MealKind.Lunch, labelKey: 'lunch' },
  { kind: MealKind.Dinner, labelKey: 'dinner' },
  { kind: MealKind.AfternoonSnack, labelKey: 'secondSnack' },
];

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-body text-muted-foreground">
      <span className={cn('size-4 rounded-sm border', swatch)} aria-hidden="true" />
      {label}
    </span>
  );
}

interface Props {
  week: EditorWeek;
  dailyKcalTarget: number | undefined;
}

/** Read-only week grid that colours each meal by how its kcal compares with its share of the daily target. */
export default function NutritionView({ week, dailyKcalTarget }: Props) {
  const { t } = useTranslation();
  const rows = weekRows(week);
  const dayByNumber = new Map(week.days.map((day) => [day.dayOfWeek, day]));

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={t('planEditor.nutrition.label')}
        className={cn(WEEK_GRID_CLASS, 'flex-1')}
        style={weekGridRows(rows.length, 10)}
      >
        <GridSurface />
        <div className={cn(GRID_CLASS, 'pb-3')}>
          <span />
          {DAY_ORDER.map((dayOfWeek) => (
            <DayHeader key={dayOfWeek} day={dayByNumber.get(dayOfWeek) ?? { dayOfWeek, meals: [] }} />
          ))}
        </div>
        <div className={cn(GRID_CLASS, 'items-stretch')}>
          <span className={GRID_LABEL_CLASS}>
            {t('planEditor.dayTotal')}
          </span>
          {DAY_ORDER.map((dayOfWeek) => (
            <DayTotalCell key={dayOfWeek} day={dayByNumber.get(dayOfWeek)} target={dailyKcalTarget} />
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.index} className={cn(GRID_CLASS, 'items-stretch')}>
            <span className={GRID_LABEL_CLASS}>
              {t(`planEditor.rows.${mealKindLabelKey(row.kind)}`)}
            </span>
            {DAY_ORDER.map((dayOfWeek) => (
              <NutritionCell
                key={dayOfWeek}
                meal={dayByNumber.get(dayOfWeek)?.meals[row.index]}
                rowLabelKey={mealKindLabelKey(row.kind)}
                dailyKcalTarget={dailyKcalTarget}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
        {dailyKcalTarget ? (
          <>
            <Legend swatch="border-transparent bg-success-soft" label={t('planEditor.nutrition.legendOn')} />
            <Legend swatch="border-transparent bg-training-soft" label={t('planEditor.nutrition.legendOver')} />
            <Legend swatch="border-line bg-card" label={t('planEditor.nutrition.legendUnder')} />
            <span className="ml-auto text-body text-muted-foreground">
              {t('planEditor.nutrition.shares', {
                shares: SHARE_ORDER.map(
                  (share) =>
                    `${t(`planEditor.nutrition.share_${share.labelKey}`)} ${MEAL_SHARE_PERCENT[share.kind]} %`,
                ).join(' · '),
              })}
            </span>
          </>
        ) : (
          <span className="text-body text-muted-foreground">{t('planEditor.nutrition.noTarget')}</span>
        )}
      </div>
    </div>
  );
}
