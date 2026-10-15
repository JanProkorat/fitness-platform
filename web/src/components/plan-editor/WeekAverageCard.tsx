import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import {
  STATUS_BAR_CLASS,
  STATUS_TEXT_CLASS,
  targetStatus,
  weekSummary,
} from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorWeek, PlanTargets } from '@/components/plan-editor/plan-editor-types';

const SECTION_LABEL_CLASS = 'text-label font-semibold tracking-label text-ink-2 uppercase';

const MACRO_ROWS = [
  { key: 'protein', dotClass: 'bg-macro-protein' },
  { key: 'carbs', dotClass: 'bg-macro-carbs' },
  { key: 'fat', dotClass: 'bg-macro-fat' },
  { key: 'fiber', dotClass: 'bg-macro-fibre' },
] as const;

/** Share of the target reached, 0-100; 0 when there is no target. */
function fillPercent(value: number, target: number | undefined): number {
  return target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
}

/** A signed percentage with a real minus sign, e.g. "+4" or "−12". */
function formatDeviation(value: number): string {
  if (value === 0) {
    return '0';
  }
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

function Bar({ fill, heightClass, fillClass }: { fill: number; heightClass: string; fillClass: string }) {
  return (
    <span className={cn('block overflow-hidden rounded-full bg-muted', heightClass)} aria-hidden="true">
      <span className={cn('block h-full rounded-full', fillClass)} style={{ width: `${fill}%` }} />
    </span>
  );
}

interface Props {
  week: EditorWeek;
  weekNumber: number;
  targets: PlanTargets;
}

/** "Week N, average per day" card: kcal against target with deviation, the week total and the four nutrient averages. */
export default function WeekAverageCard({ week, weekNumber, targets }: Props) {
  const { t, i18n } = useTranslation();
  const summary = weekSummary(week);
  const { average } = summary;
  const kcalStatus = targetStatus(average.kcal, targets.kcal);
  const kcalDeviation = targets.kcal && average.kcal > 0 ? Math.round((average.kcal / targets.kcal - 1) * 100) : null;

  return (
    <div
      data-testid="info-week-average"
      className="flex flex-col gap-3 rounded-xl border border-raised-line bg-raised p-3.5 shadow-raised"
    >
      <div className="flex items-baseline gap-1.5">
        <span className={SECTION_LABEL_CLASS}>{t('planEditor.info.average', { week: weekNumber })}</span>
        <span className="ml-auto text-meta text-muted-foreground">
          {t('planEditor.info.weekTotal', { kcal: formatKcal(summary.total.kcal, i18n.language) })}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span data-testid="info-average-kcal" data-status={kcalStatus} className={STATUS_TEXT_CLASS[kcalStatus]}>
            <span className="font-display text-stat font-semibold">{formatKcal(average.kcal, i18n.language)}</span>
          </span>
          <span className="text-body text-muted-foreground">
            {targets.kcal === undefined
              ? t('planEditor.info.targets.kcalUnit')
              : t('planEditor.info.ofTarget', { target: formatKcal(targets.kcal, i18n.language) })}
          </span>
          {kcalDeviation !== null && (
            <span className={cn('ml-auto text-body font-semibold', STATUS_TEXT_CLASS[kcalStatus])}>
              {t('planEditor.info.deviation', { value: formatDeviation(kcalDeviation) })}
            </span>
          )}
        </div>
        <Bar fill={fillPercent(average.kcal, targets.kcal)} heightClass="h-1.5" fillClass={STATUS_BAR_CLASS[kcalStatus]} />
      </div>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        {MACRO_ROWS.map(({ key, dotClass }) => (
          <div key={key} data-testid={`info-average-${key}`} className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-body text-ink">
              <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
              {t(`planEditor.info.targets.${key}`)}
              <span className="ml-auto">
                <b className="font-semibold">{Math.round(average[key])}</b>
                {targets[key] !== undefined && <span className="text-muted-foreground">/{targets[key]}</span>}
              </span>
            </span>
            <Bar fill={fillPercent(average[key], targets[key])} heightClass="h-1" fillClass={dotClass} />
          </div>
        ))}
      </div>
    </div>
  );
}
