import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Plus, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { instantiatePlanTemplate, searchPlanTemplates } from '@/api/nutrition-plan-templates';
import { createPlan } from '@/api/plans';
import CopyPlanFromClientDialog from '@/components/client-detail/nutrition/CopyPlanFromClientDialog';
import { getErrorStatus, showApiError, showSuccess } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { GetClientDashboardResponse } from '@/api/generated';
import {
  nextMondayIso,
  rankTemplates,
  type MatchLevel,
  type RankedTemplate,
} from '@/components/client-detail/nutrition/nutritionPlanView';

interface Props {
  clientId: string;
  dashboard: GetClientDashboardResponse;
}

const TEMPLATE_POOL_SIZE = 50;

function MatchLine({ level, children }: { level: MatchLevel; children: string }) {
  if (level === 'none') {
    return null;
  }
  return (
    <li className="flex items-center gap-1 text-body text-muted-foreground">
      <span aria-hidden="true" className={cn('font-bold', level === 'match' ? 'text-nutrition-ink' : 'text-error')}>
        {level === 'match' ? <Check className="size-3.5" /> : '~'}
      </span>
      {children}
    </li>
  );
}

/**
 * Nutrition tab for a client with neither an Active plan nor a Draft: a hero
 * card with up to three templates matched on goal, dietary style and kcal, and
 * the ways to start. "Use <template>" and "Start blank" create a Draft that
 * starts next Monday; "Copy from another client" opens a picker.
 */
export default function NutritionEmptyState({ clientId, dashboard }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const headingId = useId();
  const navigate = useNavigate();
  const [pickedId, setPickedId] = useState<string | undefined>();
  const [copyOpen, setCopyOpen] = useState(false);
  const locale = i18n.language;
  const firstName = dashboard.firstName ?? '';
  const onboarding = dashboard.onboarding;
  const clientKcal = onboarding?.adjustedKcal;

  const templatesQuery = useQuery({
    queryKey: ['plan-templates', 'client-match', TEMPLATE_POOL_SIZE],
    queryFn: () => searchPlanTemplates({ page: 1, pageSize: TEMPLATE_POOL_SIZE }),
  });

  const ranked = useMemo(
    () =>
      rankTemplates(templatesQuery.data?.templates ?? [], {
        goal: onboarding?.primaryGoal,
        dietaryStyle: onboarding?.dietaryStyle,
        kcal: clientKcal,
      }),
    [templatesQuery.data, onboarding?.primaryGoal, onboarding?.dietaryStyle, clientKcal],
  );

  const selected: RankedTemplate | undefined =
    ranked.find((r) => r.template.templateId === pickedId) ?? ranked[0];
  const bestMatchId = ranked[0] && ranked[0].score > 0 ? ranked[0].template.templateId : undefined;

  const instantiateMutation = useMutation({
    mutationFn: (template: RankedTemplate) =>
      instantiatePlanTemplate(template.template.templateId ?? '', {
        clientId: dashboard.clientPublicId ?? clientId,
        name: template.template.name ?? '',
        startDate: nextMondayIso(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
      void queryClient.invalidateQueries({ queryKey: ['nutrition-plan-detail'] });
      showSuccess('clientDetail.nutrition.empty.useSuccess');
    },
    onError: (error) => {
      showApiError(error, 'clientDetail.nutrition.empty.useError');
      void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
    },
  });

  const blankMutation = useMutation({
    mutationFn: () =>
      createPlan({
        clientId,
        name: t('clientDetail.nutrition.empty.blankPlanName'),
        weekCount: 1,
        startDate: nextMondayIso(),
      }),
    onSuccess: async (plan) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] }),
      ]);
      if (plan.planId) {
        navigate(`/clients/${clientId}/nutrition/plans/${plan.planId}`);
      }
    },
    onError: (error) => {
      showApiError(error, 'clientDetail.nutrition.empty.blankError');
      if (getErrorStatus(error) === 409) {
        void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
      }
    },
  });

  const matchedParts = [
    onboarding?.primaryGoal ? t('clientDetail.nutrition.empty.matchGoal', { goal: t(`nutritionGoals.goal_${onboarding.primaryGoal}`) }) : undefined,
    clientKcal ? t('clientDetail.nutrition.empty.matchKcal', { kcal: clientKcal.toLocaleString(locale) }) : undefined,
  ].filter((part): part is string => Boolean(part));

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-nutrition-soft">
          <Utensils className="size-6 text-nutrition-ink" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-nutrition" />
            <span className="text-caption font-semibold uppercase tracking-wider text-nutrition-ink">
              {t('clientDetail.nutrition.empty.label')}
            </span>
          </div>
          <h2 id={headingId} className="text-stat font-bold text-ink">
            {t('clientDetail.nutrition.empty.heading', { name: firstName })}
          </h2>
          <p className="max-w-xl text-copy text-muted-foreground">{t('clientDetail.nutrition.empty.body')}</p>
        </div>
      </div>

      <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
        {[t('clientDetail.nutrition.empty.matchedTo', { name: firstName }), ...matchedParts].join(' · ')}
      </p>

      {templatesQuery.isPending && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      )}

      {templatesQuery.isError && (
        <div className="flex items-center gap-3">
          <p className="text-caption text-muted-foreground">{t('clientDetail.nutrition.empty.templatesError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void templatesQuery.refetch()}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!templatesQuery.isPending && !templatesQuery.isError && ranked.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-copy text-muted-foreground">
          {t('clientDetail.nutrition.empty.noTemplates')}
        </p>
      )}

      {ranked.length > 0 && (
        <div
          role="radiogroup"
          aria-label={t('clientDetail.nutrition.empty.templatesLabel')}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          {ranked.map((item) => {
            const id = item.template.templateId;
            const isSelected = selected?.template.templateId === id;
            const kcal = item.template.avgKcalPerDay;
            const dietKey = item.template.dietaryStyle;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setPickedId(id)}
                className={cn(
                  'flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  isSelected ? 'border-2 border-nutrition' : 'border-border hover:bg-muted',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-nutrition-soft">
                    <Utensils className="size-4 text-nutrition-ink" aria-hidden="true" />
                  </span>
                  {id === bestMatchId && (
                    <span className="rounded-md bg-nutrition-soft px-2 py-1 text-caption font-bold uppercase tracking-wider text-nutrition-ink">
                      {t('clientDetail.nutrition.empty.bestMatch')}
                    </span>
                  )}
                </span>
                <span className="text-subhead font-bold text-ink">{item.template.name}</span>
                <span className="line-clamp-2 min-h-8 text-body text-muted-foreground">{item.template.description}</span>
                <span className="text-body font-semibold text-ink">
                  {[
                    t('clientDetail.nutrition.empty.weeks', { count: item.template.weekCount ?? 0 }),
                    kcal ? t('clientDetail.nutrition.current.kcalPerDay', { kcal: kcal.toLocaleString(locale) }) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">
                  <MatchLine level={item.goal}>{onboarding?.primaryGoal ? t(`nutritionGoals.goal_${onboarding.primaryGoal}`) : ''}</MatchLine>
                  <MatchLine level={item.kcal}>
                    {kcal ? t('clientDetail.nutrition.empty.kcalMatch', { kcal: kcal.toLocaleString(locale) }) : ''}
                  </MatchLine>
                  <MatchLine level={item.diet}>{dietKey ? t(`clientDetail.nutrition.diet.${dietKey}`) : ''}</MatchLine>
                </ul>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        {selected && (
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={instantiateMutation.isPending}
            onClick={() => instantiateMutation.mutate(selected)}
          >
            <Check className="size-4" aria-hidden="true" />
            {t('clientDetail.nutrition.empty.use', { name: selected.template.name })}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="gap-2"
          disabled={blankMutation.isPending}
          onClick={() => setCopyOpen(true)}
        >
          <Copy className="size-4" aria-hidden="true" />
          {t('clientDetail.nutrition.empty.copyFromClient')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="gap-2"
          disabled={blankMutation.isPending || instantiateMutation.isPending}
          onClick={() => blankMutation.mutate()}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('clientDetail.nutrition.empty.startBlank')}
        </Button>
        <Link
          to="/plan-templates"
          className="ml-auto text-body font-semibold text-ink underline underline-offset-4 hover:no-underline"
        >
          {t('clientDetail.nutrition.empty.browseAll')}
        </Link>
      </div>
      <CopyPlanFromClientDialog open={copyOpen} onOpenChange={setCopyOpen} clientId={clientId} />
    </section>
  );
}
