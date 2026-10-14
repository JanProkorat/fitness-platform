import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getClients, type ClientSummary } from '@/api/clients';
import { getClientPlans } from '@/api/client-plans';
import { copyNutritionPlan } from '@/api/plans';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { showApiError, showSuccess } from '@/lib/api-errors';
import {
  formatShortDate,
  parseCalendarDate,
} from '@/components/client-detail/nutrition/nutritionPlanView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client the copy is made for (ClientProfile.PublicId); never offered as a source. */
  clientId: string;
}

const CLIENT_PAGE_SIZE = 20;

function fullName(client: ClientSummary): string {
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email || '';
}

/** Picks another of the coach's clients, then one of their meal plans, and copies it to this client as a Draft. */
export default function CopyPlanFromClientDialog({ open, onOpenChange, clientId }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<ClientSummary | undefined>();
  const debounced = useDebouncedValue(search.trim());

  const clientsQuery = useQuery({
    queryKey: ['clients', 'copy-source', debounced],
    queryFn: () =>
      getClients({ page: 1, pageSize: CLIENT_PAGE_SIZE, tagIds: [], search: debounced || undefined }),
    enabled: open && !source,
  });
  const sourceId = source?.publicId;
  const plansQuery = useQuery({
    queryKey: ['client-plans', sourceId],
    queryFn: () => getClientPlans(sourceId ?? ''),
    enabled: open && Boolean(sourceId),
  });

  const clients = (clientsQuery.data?.clients ?? []).filter((c) => c.publicId && c.publicId !== clientId);
  const plans = (plansQuery.data?.plans ?? []).filter((p) => p.planType === 'Nutrition' && p.planId);

  const copyMutation = useMutation({
    mutationFn: (planId: string) => copyNutritionPlan(planId, { clientId }),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] }),
      ]);
      showSuccess('clientDetail.nutrition.past.duplicateSuccess');
      handleOpenChange(false);
      if (response.planId) {
        navigate(`/clients/${clientId}/nutrition/plans/${response.planId}`);
      }
    },
    onError: (error) => {
      showApiError(error, 'clientDetail.nutrition.past.duplicateError');
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch('');
      setSource(undefined);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !copyMutation.isPending && handleOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('clientDetail.nutrition.copyDialog.title')}</DialogTitle>
          <DialogDescription>
            {source
              ? t('clientDetail.nutrition.copyDialog.plansDescription', { name: fullName(source) })
              : t('clientDetail.nutrition.copyDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {!source && (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('clientDetail.nutrition.copyDialog.search')}
                aria-label={t('clientDetail.nutrition.copyDialog.search')}
                className="h-10 pl-10"
              />
            </div>
            <div className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto">
              {clientsQuery.isPending ? (
                <>
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </>
              ) : clientsQuery.isError ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-body text-muted-foreground">{t('clientDetail.nutrition.copyDialog.clientsError')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void clientsQuery.refetch()}>
                    {t('clients.retry')}
                  </Button>
                </div>
              ) : clients.length === 0 ? (
                <p className="m-auto text-body text-muted-foreground">{t('clientDetail.nutrition.copyDialog.noClients')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {clients.map((client) => (
                    <li key={client.publicId}>
                      <button
                        type="button"
                        onClick={() => setSource(client)}
                        className="flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border border-line bg-card px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="truncate text-copy font-semibold text-ink">{fullName(client)}</span>
                        {client.email && <span className="truncate text-meta text-muted-foreground">{client.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {source && (
          <>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={copyMutation.isPending}
                onClick={() => setSource(undefined)}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t('clientDetail.nutrition.copyDialog.changeClient')}
              </Button>
            </div>
            <div className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto">
              {plansQuery.isPending ? (
                <>
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </>
              ) : plansQuery.isError ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-body text-muted-foreground">{t('clientDetail.nutrition.copyDialog.plansError')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void plansQuery.refetch()}>
                    {t('clients.retry')}
                  </Button>
                </div>
              ) : plans.length === 0 ? (
                <p className="m-auto text-body text-muted-foreground">{t('clientDetail.nutrition.copyDialog.noPlans')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {plans.map((plan) => {
                    const start = parseCalendarDate(plan.periodStart);
                    const meta = [
                      t(`clientDetail.nutrition.copyDialog.status.${plan.status}`, { defaultValue: plan.status ?? '' }),
                      plan.weekCount ? t('clientDetail.nutrition.past.weeks', { count: plan.weekCount }) : undefined,
                      start ? formatShortDate(start, i18n.language) : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li key={plan.planId} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-copy font-semibold text-ink">{plan.name}</span>
                          <span className="truncate text-meta text-muted-foreground">{meta}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={copyMutation.isPending}
                          onClick={() => plan.planId && copyMutation.mutate(plan.planId)}
                        >
                          {t('clientDetail.nutrition.copyDialog.copy')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
