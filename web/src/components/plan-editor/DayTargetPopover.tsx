import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import {
  STATUS_BAR_CLASS,
  STATUS_TEXT_CLASS,
  TARGET_NEAR_BAND,
  TARGET_NUTRIENTS,
  TARGET_ON_BAND,
  targetStatus,
  type TargetNutrient,
  type TargetStatus,
  type Totals,
} from '@/components/plan-editor/plan-editor-nutrition';
import type { PlanTargets } from '@/components/plan-editor/plan-editor-types';

const LEGEND_ORDER: readonly TargetStatus[] = ['on', 'near', 'off', 'none'];

function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

function formatValue(nutrient: TargetNutrient, value: number, language: string, gramUnit: string, kcalUnit: string): string {
  return nutrient === 'kcal' ? `${formatKcal(value, language)} ${kcalUnit}` : `${Math.round(value)} ${gramUnit}`;
}

function StatusLegend() {
  const { t } = useTranslation();
  const text: Record<TargetStatus, string> = {
    on: t('planEditor.target.legendOn', { percent: toPercent(TARGET_ON_BAND) }),
    near: t('planEditor.target.legendNear', { from: toPercent(TARGET_ON_BAND), to: toPercent(TARGET_NEAR_BAND) }),
    off: t('planEditor.target.legendOff', { percent: toPercent(TARGET_NEAR_BAND) }),
    none: t('planEditor.target.legendNone'),
  };
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3" data-testid="day-target-legend">
      <span className="text-label font-bold tracking-label text-muted-foreground uppercase">
        {t('planEditor.target.legendTitle')}
      </span>
      {LEGEND_ORDER.map((status) => (
        <span key={status} data-status={status} className="flex items-center gap-2 text-body text-muted-foreground">
          <span className={cn('size-2 shrink-0 rounded-full', STATUS_BAR_CLASS[status])} aria-hidden="true" />
          {text[status]}
        </span>
      ))}
    </div>
  );
}

interface Props {
  dayOfWeek: number;
  /** The day's planned totals; null when the day has no data. */
  totals: Totals | null;
  targets: PlanTargets;
  /** The colour of the tile, so the tile and the popover never disagree. */
  status: TargetStatus;
  children: ReactNode;
}

/**
 * The "Day total" tile as a button that opens a popover with planned versus target for every nutrient.
 * It opens only on click, tap, Enter or Space; Escape, an outside click or another click on the tile closes it.
 */
export default function DayTargetPopover({ dayOfWeek, totals, targets, status, children }: Props) {
  const { t, i18n } = useTranslation();
  const boundary = usePopoverBoundary();
  const [open, setOpen] = useState(false);
  const dayName = t(`planEditor.daysLong.${dayOfWeek}`);
  const gramUnit = t('planEditor.units.g');
  const kcalUnit = t('planEditor.nutrition.kcalUnit');

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="day-total"
          data-status={status}
          aria-label={t('planEditor.target.aria', { day: dayName })}
          className="flex h-full min-h-30 min-w-0 cursor-pointer flex-col justify-between gap-1 rounded-xl border border-raised-line bg-raised p-3 text-left shadow-raised outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {children}
        </button>
      </PopoverTrigger>
      {open && (
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          collisionBoundary={boundary}
          // No top padding: the popover may reach the top of the scroll area but never the fixed top bar.
          collisionPadding={{ top: 0, right: 16, bottom: 16, left: 16 }}
          data-testid="day-target-popover"
          aria-label={t('planEditor.target.title')}
          className="flex max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-2xl border-line bg-card p-4"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <span className="text-body font-semibold text-ink">
            {t('planEditor.target.title')} · {dayName}
          </span>
          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1.5">
            <span />
            <span className="text-right text-label font-bold tracking-label text-muted-foreground uppercase">
              {t('planEditor.target.planned')}
            </span>
            <span className="text-right text-label font-bold tracking-label text-muted-foreground uppercase">
              {t('planEditor.target.goal')}
            </span>
            {TARGET_NUTRIENTS.map((nutrient) => {
              const planned = totals?.[nutrient] ?? 0;
              const rawTarget = targets[nutrient];
              // A missing or non-positive target reads "No target"; it is never shown as 0 and never divides.
              const target = typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : undefined;
              const rowStatus = targetStatus(planned, target);
              return (
                <div
                  key={nutrient}
                  data-testid="day-target-row"
                  data-nutrient={nutrient}
                  data-status={rowStatus}
                  className="col-span-3 grid grid-cols-subgrid items-baseline"
                >
                  <span className="text-body text-ink">{t(`planEditor.target.nutrient.${nutrient}`)}</span>
                  <span className={cn('text-right text-body font-semibold', STATUS_TEXT_CLASS[rowStatus])}>
                    {formatValue(nutrient, planned, i18n.language, gramUnit, kcalUnit)}
                  </span>
                  <span className="text-right text-body text-muted-foreground">
                    {target !== undefined
                      ? formatValue(nutrient, target, i18n.language, gramUnit, kcalUnit)
                      : t('planEditor.target.noTarget')}
                  </span>
                </div>
              );
            })}
          </div>
          <StatusLegend />
        </PopoverContent>
      )}
    </Popover>
  );
}
