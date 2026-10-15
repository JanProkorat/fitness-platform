import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import GoalDot from '@/components/plan-templates/GoalDot';
import MacroDots from '@/components/plan-editor/MacroDots';
import { toEditorWeeks } from '@/components/plan-editor/plan-editor-mapping';
import { weekSummary } from '@/components/plan-editor/plan-editor-nutrition';
import { usePlanTemplate } from '@/hooks/usePlanTemplatesQueries';
import { getErrorStatus } from '@/lib/api-errors';

interface Props {
  templateId: string;
  name: string;
  language: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Lets the card keep a press on its own button from also counting as an outside click. */
  onInteractOutside: (event: Event) => void;
}

/** Goal, size and the per-week averages of a template, for the Templates library tab; the card's Use button stays on the card. */
export default function TemplateInfoPopover({ templateId, name, language, onClose, onCloseAutoFocus, onInteractOutside }: Props) {
  const { t } = useTranslation();
  const query = usePlanTemplate(templateId);
  const detail = query.data;
  const weeks = useMemo(() => (detail ? toEditorWeeks(detail.weeks).map(weekSummary) : []), [detail]);
  const goalLabel = detail?.goal ? t(`clients.values.${detail.goal}`, { defaultValue: detail.goal }) : undefined;

  let body;
  if (query.isError) {
    const gone = getErrorStatus(query.error) === 404 || getErrorStatus(query.error) === 403;
    body = gone ? (
      <p className="text-body text-muted-foreground">{t('clientPlanEditor.templates.info.unavailable')}</p>
    ) : (
      <div className="flex flex-col items-start gap-2">
        <p className="text-body text-muted-foreground">{t('clientPlanEditor.templates.info.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('planEditor.library.retry')}
        </Button>
      </div>
    );
  } else if (!detail) {
    body = (
      <div className="flex flex-col gap-2" role="status" aria-label={t('planEditor.library.info.loading')}>
        <Skeleton className="h-5 w-2/3 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  } else {
    const meta = [
      t('clientPlanEditor.templates.weeksShort', { count: detail.weekCount ?? 0 }),
      detail.mealsPerDay !== undefined && detail.mealsPerDay !== null
        ? t('clientPlanEditor.templates.info.mealsPerDay', { value: detail.mealsPerDay })
        : null,
      detail.avgKcalPerDay !== undefined && detail.avgKcalPerDay !== null
        ? t('planEditor.cell.kcal', { kcal: Math.round(detail.avgKcalPerDay).toLocaleString(language) })
        : null,
    ].filter((part): part is string => part !== null);

    body = (
      <>
        <div className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
          {detail.goal && <GoalDot goal={detail.goal} />}
          {goalLabel && <span className="shrink-0 font-semibold text-ink">{goalLabel}</span>}
          <span className="truncate">{meta.join(' · ')}</span>
        </div>
        {detail.description && (
          <p className="text-body text-ink-2 [overflow-wrap:anywhere]">{detail.description}</p>
        )}
        {weeks.length > 0 && (
          <div className="flex flex-col">
            <span className="pb-1 text-label font-semibold tracking-label text-muted-foreground uppercase">
              {t('clientPlanEditor.templates.info.weeksHeading')}
            </span>
            <ul>
              {weeks.map((week, index) => (
                <li
                  key={index}
                  data-testid="template-info-week"
                  className="flex items-center gap-2.5 border-t border-line py-1.5"
                >
                  <span className="min-w-0 flex-1 text-body text-ink">
                    {t('clientPlanEditor.templates.info.weekLabel', { week: index + 1 })}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-body font-semibold text-ink">
                      {t('planEditor.cell.kcal', { kcal: Math.round(week.average.kcal).toLocaleString(language) })}
                    </span>
                    <span className="text-meta text-muted-foreground">
                      <MacroDots
                        protein={week.average.protein}
                        carbs={week.average.carbs}
                        fat={week.average.fat}
                        fiber={week.average.fiber}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={12}
      collisionPadding={16}
      aria-label={name}
      data-testid="template-info"
      onCloseAutoFocus={onCloseAutoFocus}
      onInteractOutside={onInteractOutside}
      className="flex max-h-(--radix-popover-content-available-height) w-90 flex-col gap-3 overflow-y-auto rounded-2xl border-line bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 font-display text-panel-title font-semibold text-ink [overflow-wrap:anywhere]">
          {detail?.name || name}
        </span>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {body}
    </PopoverContent>
  );
}
