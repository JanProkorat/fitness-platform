import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { GetPlanResponse, OnboardingDataDto } from '@/api/generated';
import { fetchPlanForEditor } from '@/api/plans';
import ClientAvatar from '@/components/clients/ClientAvatar';
import ClientPlanInfoPanel from '@/components/client-plan-editor/ClientPlanInfoPanel';
import TemplatesLibraryTab from '@/components/client-plan-editor/TemplatesLibraryTab';
import PlanEditor from '@/components/plan-editor/PlanEditor';
import CopyMealsDialog from '@/components/plan-templates/CopyMealsDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isClosedPlan, useClientPlanEditor } from '@/hooks/useClientPlanEditor';
import { getErrorStatus } from '@/lib/api-errors';

interface LoadedProps {
  plan: GetPlanResponse;
  clientId: string;
  clientName: string;
  firstName?: string;
  lastName?: string;
  onboarding?: OnboardingDataDto;
  onReload: () => void;
}

/** Hosts the shared plan editor for one loaded client plan. Mounted once per load, so edits stay local. */
function LoadedClientPlanEditor({ plan, clientId, clientName, firstName, lastName, onboarding, onReload }: LoadedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { initial, saveState, save, primaryAction, weekStatus, savedStartDate } = useClientPlanEditor(plan, clientId);

  return (
    <PlanEditor
      initial={initial}
      renderCopyMeals={(slot) => (
        <CopyMealsDialog
          open={slot.open}
          onOpenChange={slot.onOpenChange}
          currentTemplateId={undefined}
          onApply={slot.onApply}
        />
      )}
      readOnly={isClosedPlan(plan)}
      readOnlyNotice={t('clientPlanEditor.readOnly')}
      breadcrumb={{
        label: clientName,
        onNavigate: () => navigate(`/clients/${clientId}/nutrition`),
        leading: <ClientAvatar firstName={firstName} lastName={lastName} className="size-7.5" />,
      }}
      primaryAction={primaryAction}
      secondarySave
      renderInfoPanel={(context) => (
        <ClientPlanInfoPanel
          {...context}
          clientId={clientId}
          clientFirstName={firstName || clientName}
          onboarding={onboarding}
          savedStartDate={savedStartDate}
          sourceTemplateId={plan.sourceTemplateId}
        />
      )}
      infoTabLabel={t('clientPlanEditor.info.tab')}
      libraryExtraTab={{
        label: t('clientPlanEditor.templates.tab'),
        render: (context) => (
          <TemplatesLibraryTab
            context={context}
            weekStatus={weekStatus}
            onboarding={onboarding}
            clientFirstName={firstName || clientName}
          />
        ),
      }}
      weekStatus={weekStatus}
      saveState={saveState}
      onSave={save}
      onReload={onReload}
    />
  );
}

function NotFound({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-0 font-semibold text-ink">
        <Link to={`/clients/${clientId}/nutrition`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('clientPlanEditor.backToNutrition')}
        </Link>
      </Button>
      <div className="flex flex-col items-start gap-1">
        <p className="text-copy font-bold text-ink">{t('clientPlanEditor.notFound.title')}</p>
        <p className="text-body text-muted-foreground">{t('clientPlanEditor.notFound.body')}</p>
      </div>
    </div>
  );
}

/** The client plan editor page: loads the plan and the client, and hosts the shared editor. */
export default function ClientPlanEditorPage() {
  const { t } = useTranslation();
  const { clientId = '', planId = '' } = useParams<{ clientId: string; planId: string }>();
  const [reloadCount, setReloadCount] = useState(0);

  const planQuery = useQuery({
    queryKey: ['nutrition-plan-detail', planId],
    queryFn: () => fetchPlanForEditor(planId),
    enabled: Boolean(planId),
    // The editor captures its copy once, so it must start from the server's current version.
    refetchOnMount: 'always',
    retry: (failureCount, error) => {
      const status = getErrorStatus(error);
      return status !== 403 && status !== 404 && failureCount < 1;
    },
  });
  const dashboardQuery = useQuery({
    queryKey: ['client-dashboard', clientId],
    queryFn: () => apiClient.getClientDashboardEndpoint(clientId),
    enabled: Boolean(clientId),
  });

  if (planQuery.isError) {
    const status = getErrorStatus(planQuery.error);
    if (status === 404 || status === 403) {
      return <NotFound clientId={clientId} />;
    }
    return (
      <div className="flex h-full flex-col items-start gap-3 p-6">
        <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void planQuery.refetch()}>
          {t('clients.retry')}
        </Button>
      </div>
    );
  }

  // A cached copy shows at once but may be stale; wait for the fetch made on mount.
  if (!planQuery.isFetchedAfterMount || !planQuery.data || dashboardQuery.isPending) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>
    );
  }

  const plan = planQuery.data;
  if (plan.clientId !== clientId) {
    return <NotFound clientId={clientId} />;
  }

  const dashboard = dashboardQuery.data;
  const clientName =
    [dashboard?.firstName, dashboard?.lastName].filter(Boolean).join(' ') || t('clientPlanEditor.clientFallback');

  return (
    <LoadedClientPlanEditor
      key={`${planId}:${reloadCount}`}
      plan={plan}
      clientId={clientId}
      clientName={clientName}
      firstName={dashboard?.firstName}
      lastName={dashboard?.lastName}
      onboarding={dashboard?.onboarding}
      onReload={() => {
        void planQuery.refetch().then(() => setReloadCount((count) => count + 1));
      }}
    />
  );
}
