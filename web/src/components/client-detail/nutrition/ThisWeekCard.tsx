import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatShortDate, todayCalendarDate, type PlanDetailState } from '@/components/client-detail/nutrition/nutritionPlanView';
import {
  buildThisWeek,
  formatWeekday,
  type DayTile,
  type MacroAverages,
  type ThisWeekModel,
} from '@/components/client-detail/nutrition/thisWeek';

interface Props {
  detail: PlanDetailState;
  onRetry: () => void;
}

const MACROS: {
  key: keyof MacroAverages;
  labelKey: string;
  fillClass: string;
  dotClass: string;
}[] = [
  { key: 'kcal', labelKey: 'kcal', fillClass: 'bg-nutrition', dotClass: 'bg-nutrition' },
  { key: 'protein', labelKey: 'protein', fillClass: 'bg-macro-protein', dotClass: 'bg-macro-protein' },
  { key: 'carbs', labelKey: 'carbs', fillClass: 'bg-macro-carbs', dotClass: 'bg-macro-carbs' },
  { key: 'fat', labelKey: 'fat', fillClass: 'bg-macro-fat', dotClass: 'bg-macro-fat' },
];

function tileClass(tile: DayTile): string {
  if (tile.state === 'today') {
    return 'border-dashed border-line bg-card';
  }
  return tile.state === 'future' ? 'border-line bg-sunken' : 'border-line bg-card';
}

/**
 * "This week" card of the Nutrition tab: meals ticked off on finished days of
 * the current plan week, a tile per day, a by-meal breakdown and the eaten
 * macros as a daily average against the plan targets. Always renders; when
 * there is no adherence data yet it says why.
 */
export default function ThisWeekCard({ detail, onRetry }: Props) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const locale = i18n.language;
  const model: ThisWeekModel | undefined = detail.plan ? buildThisWeek(detail.plan, todayCalendarDate()) : undefined;

  const hasCounted = (model?.planned ?? 0) > 0;
  let subtitle = '';
  if (model?.status === 'ready' && model.weekNumber !== undefined && model.loggedFrom && model.loggedTo) {
    const from = formatWeekday(model.loggedFrom, locale);
    const to = formatWeekday(model.loggedTo, locale);
    subtitle =
      model.loggedFrom.getTime() === model.loggedTo.getTime()
        ? t('clientDetail.nutrition.thisWeek.subtitleDay', { week: model.weekNumber, day: from })
        : t('clientDetail.nutrition.thisWeek.subtitleRange', { week: model.weekNumber, from, to });
  } else if (model?.weekNumber !== undefined) {
    subtitle = t('clientDetail.nutrition.thisWeek.subtitleWeek', { week: model.weekNumber });
  }

  const statusMessage = (): string => {
    switch (model?.status) {
      case 'notActive':
        return t('clientDetail.nutrition.thisWeek.notActive');
      case 'notStarted':
        return t('clientDetail.nutrition.thisWeek.notStarted', {
          date: model.planStart ? formatShortDate(model.planStart, locale) : '',
        });
      case 'ended':
        return t('clientDetail.nutrition.thisWeek.ended');
      default:
        return t('clientDetail.nutrition.thisWeek.noWeek');
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-body font-semibold text-ink">
          {t('clientDetail.nutrition.thisWeek.heading')}
        </h2>
        {subtitle && <span className="text-caption text-muted-foreground">{subtitle}</span>}
      </div>

      {detail.isError && (
        <div className="flex items-center gap-3">
          <p className="text-caption text-muted-foreground">{t('clientDetail.nutrition.thisWeek.error')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!detail.isError && detail.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!detail.isError && !detail.isPending && model && model.status !== 'ready' && (
        <p role="status" className="text-body text-muted-foreground">
          {statusMessage()}
        </p>
      )}

      {!detail.isError && !detail.isPending && model?.status === 'ready' && (
        <>
          {hasCounted ? (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-stat font-semibold text-ink">
                <span data-testid="this-week-eaten">{model.eaten.toLocaleString(locale)}</span>{' '}
                <span className="text-body font-normal text-muted-foreground">
                  {t('clientDetail.nutrition.thisWeek.ofMeals', { count: model.planned })}
                </span>
              </span>
              <span className="text-body text-muted-foreground">
                {t('clientDetail.nutrition.thisWeek.ticked', { percent: model.percent })}
              </span>
            </div>
          ) : (
            <p role="status" className="text-body text-muted-foreground">
              {t('clientDetail.nutrition.thisWeek.nothingLogged')}
            </p>
          )}

          <ol className="flex gap-2" aria-label={t('clientDetail.nutrition.thisWeek.daysLabel')}>
            {model.tiles.map((tile) => {
              const weekday = formatWeekday(tile.date, locale);
              const ratio = tile.planned > 0 ? tile.eaten / tile.planned : 0;
              const showFill = tile.state === 'past' && tile.planned > 0;
              return (
                <li
                  key={tile.date.getTime()}
                  data-state={tile.state}
                  data-low={tile.low ? 'true' : 'false'}
                  className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5"
                >
                  <div
                    className={`relative h-11 w-full overflow-hidden rounded-lg border ${tileClass(tile)}`}
                    title={t('clientDetail.nutrition.thisWeek.tileTitle', {
                      day: weekday,
                      eaten: tile.eaten,
                      planned: tile.planned,
                    })}
                  >
                    {showFill && (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 ${tile.low ? 'bg-training/50' : 'bg-nutrition/50'}`}
                        style={{ height: `${Math.round(ratio * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="text-tick font-semibold text-ink">{weekday}</span>
                  <span className="text-tick text-muted-foreground">
                    {tile.state === 'today'
                      ? t('clientDetail.nutrition.thisWeek.today')
                      : tile.state === 'future'
                        ? ''
                        : tile.planned === 0
                          ? '–'
                          : `${tile.eaten}/${tile.planned}`}
                  </span>
                </li>
              );
            })}
          </ol>

          {hasCounted && (
            <>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-tick font-bold uppercase tracking-wider text-muted-foreground">
              {t('clientDetail.nutrition.thisWeek.byMeal')}
            </span>
            <ul className="flex flex-col gap-2">
              {model.rows.map((row) => (
                <li
                  key={row.group}
                  data-group={row.group}
                  data-flagged={row.flagged ? 'true' : 'false'}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-x-2.5 gap-y-0.5 text-caption sm:grid-cols-[4.5rem_minmax(0,1fr)_2.5rem_9rem]"
                >
                  <span className="font-semibold text-ink">{t(`clientDetail.nutrition.thisWeek.group.${row.group}`)}</span>
                  <div className="h-1.5 rounded-full bg-line">
                    <div
                      className={`h-1.5 rounded-full ${row.flagged ? 'bg-error' : 'bg-ink-2'}`}
                      style={{ width: `${Math.round((row.eaten / row.planned) * 100)}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground">
                    {row.eaten}/{row.planned}
                  </span>
                  {row.note === 'skipped' ? (
                    <span className="col-span-3 font-bold text-error sm:col-span-1">
                      {t('clientDetail.nutrition.thisWeek.skipped', { count: row.skipped })}
                    </span>
                  ) : row.note === 'always' ? (
                    <span className="col-span-3 text-muted-foreground sm:col-span-1">
                      {t('clientDetail.nutrition.thisWeek.always')}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="hidden sm:block" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          <ul
            className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-3 sm:grid-cols-4"
            aria-label={t('clientDetail.nutrition.thisWeek.macrosLabel')}
          >
            {MACROS.map(({ key, labelKey, fillClass, dotClass }) => {
              const value = Math.round(model.averages[key]);
              const target = model.targets[key];
              const unit = key === 'kcal' ? '' : ` ${t('clientDetail.nutrition.thisWeek.grams')}`;
              const fillPct = target ? Math.min(100, Math.round((model.averages[key] / target) * 100)) : 0;
              return (
                <li key={key} data-macro={key} className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-muted-foreground">
                    <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />
                    <span>{t(`clientDetail.nutrition.thisWeek.macro.${labelKey}`)}</span>
                    <strong className="text-ink">{value.toLocaleString(locale)}</strong>
                    {target !== undefined && (
                      <span>
                        / {target.toLocaleString(locale)}
                        {unit}
                      </span>
                    )}
                  </span>
                  <div className="h-0.5 rounded-full bg-line">
                    <div className={`h-0.5 rounded-full ${fillClass}`} style={{ width: `${fillPct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
