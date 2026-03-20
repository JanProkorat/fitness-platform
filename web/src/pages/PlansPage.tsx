import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPlans,
  createPlan,
  deletePlan,
  publishPlan,
} from '@/api/plans';
import type { CreatePlanRequest, PlanSummary } from '@/api/plan-types';
import ClientSelect from '@/components/nutrition/ClientSelect';
import { showApiError, showSuccess } from '@/lib/api-errors';

const statusStyles: Record<string, string> = {
  Draft: 'bg-yellow-500/15 text-yellow-400',
  Active: 'bg-green-500/15 text-green-400',
  Archived: 'bg-white/5 text-text3',
};

export default function PlansPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId') ?? undefined;

  const [page, setPage] = useState(1);

  // Drawer
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [newPlan, setNewPlan] = useState<CreatePlanRequest>({
    clientId: clientIdParam ?? '',
    name: '',
    weekCount: 1,
  });
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ planId: string; name: string } | null>(null);

  const openDrawer = useCallback(() => {
    setNewPlan({ clientId: clientIdParam ?? '', name: '', weekCount: 1 });
    setDrawerMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  }, [clientIdParam]);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerMounted(false), 300);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plans', clientIdParam, page],
    queryFn: () => getPlans({ clientId: clientIdParam, page, pageSize: 20 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      showSuccess('nutrition.planDeleted');
      refetch();
    },
    onError: (error) => showApiError(error, 'nutrition.deleteError'),
  });

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.name.trim() || !newPlan.clientId.trim()) return;

    setCreating(true);
    try {
      const plan = await createPlan(newPlan);
      showSuccess('nutrition.planCreated');
      closeDrawer();
      navigate(`/plans/${plan.planId}`);
    } catch (err) {
      showApiError(err, 'nutrition.createError');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, plan: PlanSummary) => {
    e.stopPropagation();
    setConfirmDelete({ planId: plan.planId, name: plan.name });
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.planId);
      setConfirmDelete(null);
    }
  };

  const handlePublish = async (e: React.MouseEvent, plan: PlanSummary) => {
    e.stopPropagation();
    try {
      await publishPlan(plan.planId);
      showSuccess('nutrition.planPublished');
      refetch();
    } catch (err) {
      showApiError(err, 'nutrition.updateError');
    }
  };

  const statusLabel = (status: string) =>
    status === 'Draft'
      ? t('nutrition.statusDraft')
      : status === 'Active'
        ? t('nutrition.statusActive')
        : t('nutrition.statusArchived');

  const inputClass =
    'rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-gold/40';

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('nutrition.title')}</h1>
          <p className="text-xs text-muted">{t('nutrition.subtitle')}</p>
        </div>
        <button
          onClick={openDrawer}
          className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
        >
          {t('nutrition.createPlan')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Plans table */}
        <div className="rounded-sm border border-border bg-surface">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.plans?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F4CB;</span>
              <p className="mt-3 text-sm">{t('nutrition.noPlans')}</p>
              <p className="mt-1 text-xs text-muted">{t('nutrition.noPlansHint')}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_80px_120px_80px_60px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('nutrition.planName')}</span>
                <span className="lbl">{t('nutrition.status')}</span>
                <span className="lbl">{t('nutrition.weeks')}</span>
                <span className="lbl">{t('nutrition.created')}</span>
                <span className="lbl text-center">{t('nutrition.publish')}</span>
                <span className="lbl" />
              </div>

              {/* Rows */}
              {data.plans.map((plan) => (
                <div
                  key={plan.planId}
                  onClick={() => navigate(`/plans/${plan.planId}`)}
                  className="grid grid-cols-[1fr_100px_80px_120px_80px_60px] cursor-pointer items-center gap-4 border-b border-charcoal px-5 py-3 transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <span className="truncate text-sm font-semibold">{plan.name}</span>
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold ${statusStyles[plan.status] ?? statusStyles.Archived}`}
                  >
                    {statusLabel(plan.status)}
                  </span>
                  <span className="text-sm text-text2">{plan.weekCount}</span>
                  <span className="text-xs text-text3">
                    {new Date(plan.dateCreated).toLocaleDateString()}
                  </span>
                  <div className="text-center">
                    {plan.status === 'Draft' && (
                      <button
                        onClick={(e) => handlePublish(e, plan)}
                        title={t('nutrition.publish')}
                        className="rounded-sm p-1 text-green-400 transition-colors hover:text-green-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="text-center">
                    <button
                      onClick={(e) => handleDeleteClick(e, plan)}
                      disabled={deleteMutation.isPending}
                      className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-muted">
                    {t('common.page', { current: page, total: totalPages })} &middot;{' '}
                    {t('common.total', { count: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      &larr; {t('common.previous')}
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      {t('common.next')} &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right-side drawer for creating a plan */}
      {drawerMounted && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('nutrition.createPlan')}</div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="text-text3 transition-colors hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form id="create-plan-form" onSubmit={handleCreate} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block font-heading text-xs text-text3">
                    {t('nutrition.planName')}
                  </label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder={t('nutrition.planNamePlaceholder')}
                    required
                    className={`w-full ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-heading text-xs text-text3">
                    {t('nutrition.client')}
                  </label>
                  <ClientSelect
                    value={newPlan.clientId}
                    onChange={(clientId) => setNewPlan({ ...newPlan, clientId })}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-heading text-xs text-text3">
                    {t('nutrition.weekCount')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={newPlan.weekCount ?? 1}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, weekCount: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </form>
            </div>

            {/* Sticky create button */}
            <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
              <button
                type="submit"
                form="create-plan-form"
                disabled={creating || !newPlan.name.trim() || !newPlan.clientId.trim()}
                className="w-full rounded-sm bg-gold px-5 py-3 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
              >
                {creating ? t('nutrition.saving') : t('nutrition.createPlan')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-sm border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-sm font-bold">{t('nutrition.deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-text2">
              {t('nutrition.deleteConfirmMessage', { name: confirmDelete.name })}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold text-text3 transition-colors hover:text-text"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-sm bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
              >
                {t('nutrition.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
