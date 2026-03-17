import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPlans,
  createPlan,
  deletePlan,
  publishPlan,
  duplicatePlan,
} from '@/api/plans';
import type { CreatePlanRequest, PlanSummary } from '@/api/plan-types';
import ClientSelect from '@/components/nutrition/ClientSelect';

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
  const [showCreate, setShowCreate] = useState(false);
  const [newPlan, setNewPlan] = useState<CreatePlanRequest>({
    clientId: clientIdParam ?? '',
    name: '',
    weekCount: 1,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plans', clientIdParam, page],
    queryFn: () => getPlans({ clientId: clientIdParam, page, pageSize: 20 }),
  });

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.name.trim() || !newPlan.clientId.trim()) return;

    try {
      const plan = await createPlan(newPlan);
      setShowCreate(false);
      setNewPlan({ clientId: clientIdParam ?? '', name: '', weekCount: 1 });
      navigate(`/plans/${plan.planId}`);
    } catch {
      // creation failed
    }
  };

  const handleDelete = async (plan: PlanSummary) => {
    if (!window.confirm(t('nutrition.confirmDelete'))) return;
    try {
      await deletePlan(plan.planId);
      refetch();
    } catch {
      // delete failed
    }
  };

  const handlePublish = async (plan: PlanSummary) => {
    if (!window.confirm(t('nutrition.confirmPublish'))) return;
    try {
      await publishPlan(plan.planId);
      refetch();
    } catch {
      // publish failed
    }
  };

  const handleDuplicate = async (plan: PlanSummary) => {
    const name = window.prompt(
      t('nutrition.duplicateName'),
      `${plan.name} (${t('nutrition.copy')})`,
    );
    if (name === null) return; // cancelled

    try {
      const dup = await duplicatePlan(plan.planId, name || undefined);
      navigate(`/plans/${dup.planId}`);
    } catch {
      // duplicate failed
    }
  };

  const statusLabel = (status: string) =>
    status === 'Draft'
      ? t('nutrition.statusDraft')
      : status === 'Active'
        ? t('nutrition.statusActive')
        : t('nutrition.statusArchived');

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('nutrition.title')}</h1>
          <p className="text-xs text-muted">{t('nutrition.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
        >
          {t('nutrition.createPlan')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Create dialog */}
        {showCreate && (
          <div className="mb-5 rounded-sm border border-gold-dim/30 bg-gold/5 p-5">
            <div className="mb-3 text-sm font-semibold">{t('nutrition.createPlan')}</div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="lbl">{t('nutrition.planName')}</label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder={t('nutrition.planNamePlaceholder')}
                    required
                    className="mt-1 w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                  />
                </div>
                <div className="w-56">
                  <label className="lbl">{t('nutrition.client')}</label>
                  <ClientSelect
                    value={newPlan.clientId}
                    onChange={(clientId) => setNewPlan({ ...newPlan, clientId })}
                  />
                </div>
                <div className="w-28">
                  <label className="lbl">{t('nutrition.weekCount')}</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={newPlan.weekCount ?? 1}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, weekCount: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-sm bg-gold px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
                >
                  {t('nutrition.createPlan')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-sm border border-border px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-text"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

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
              <div className="grid grid-cols-[1fr_100px_80px_120px_180px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('nutrition.planName')}</span>
                <span className="lbl">{t('nutrition.status')}</span>
                <span className="lbl">{t('nutrition.weeks')}</span>
                <span className="lbl">{t('nutrition.created')}</span>
                <span className="lbl text-right">{t('common.actions')}</span>
              </div>

              {/* Rows */}
              {data.plans.map((plan) => (
                <div
                  key={plan.planId}
                  className="grid grid-cols-[1fr_100px_80px_120px_180px] items-center gap-4 border-b border-charcoal px-5 py-3 last:border-0"
                >
                  <button
                    onClick={() => navigate(`/plans/${plan.planId}`)}
                    className="truncate text-left text-sm font-semibold transition-colors hover:text-gold"
                  >
                    {plan.name}
                  </button>
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold ${statusStyles[plan.status] ?? statusStyles.Archived}`}
                  >
                    {statusLabel(plan.status)}
                  </span>
                  <span className="text-sm text-text2">{plan.weekCount}</span>
                  <span className="text-xs text-text3">
                    {new Date(plan.dateCreated).toLocaleDateString()}
                  </span>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => navigate(`/plans/${plan.planId}`)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
                    >
                      {t('nutrition.edit')}
                    </button>
                    <button
                      onClick={() => handleDuplicate(plan)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-gold"
                    >
                      {t('nutrition.duplicate')}
                    </button>
                    {plan.status === 'Draft' && (
                      <button
                        onClick={() => handlePublish(plan)}
                        className="font-heading text-[11px] font-semibold uppercase tracking-wide text-green-400 transition-colors hover:text-green-300"
                      >
                        {t('nutrition.publish')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(plan)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-red-400"
                    >
                      {t('nutrition.delete')}
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
    </div>
  );
}
