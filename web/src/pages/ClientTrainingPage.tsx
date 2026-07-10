import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { getTrainingPlans, createTrainingPlan } from '@/api/training-plans';
import { useAuthStore } from '@/stores/auth';

/**
 * Wrapper that resolves a client's training plan:
 * - If the client has a plan → redirect to /clients/:id/training-plans/:planId
 * - If not → auto-create an empty plan (1 week) and redirect
 *
 * Route-level `RoleGuard` (App.tsx) already restricts this route to
 * Trainer/Admin. This component-level check is defense-in-depth so the
 * plan-creation effect below can never fire for a Nutritionist even if a
 * future route change re-widens the guard (#687 route-guard note).
 */
export default function ClientTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManageTraining = Boolean(user?.roles.some((r) => ['Trainer', 'Admin'].includes(r)));
  // Keep a ref to `t` so the resolve effect can access the current translator
  // without adding it to the deps array (t changes identity on every language
  // switch, which would re-fire the mutating effect and create duplicate plans).
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !canManageTraining) return;

    let cancelled = false;

    async function resolve() {
      try {
        const res = await getTrainingPlans({ clientId, page: 1, pageSize: 1 });
        const existingPlan = res.plans?.[0];

        if (cancelled) return;

        if (existingPlan?.planId) {
          navigate(`/clients/${clientId}/training-plans/${existingPlan.planId}`, { replace: true });
        } else {
          const newPlan = await createTrainingPlan({
            clientId,
            name: tRef.current('clientTraining.defaultPlanName'),
            weekCount: 1,
          });

          if (cancelled) return;

          if (newPlan?.planId) {
            // ClientDetailPage reads ['training-plans', { clientId, status: 'Active' }]
            // for its "active training plan" card — without this invalidation
            // it keeps rendering the create-plan placeholder after the trainer
            // navigates back from this auto-create redirect (#615).
            queryClient.invalidateQueries({
              queryKey: ['training-plans', { clientId, status: 'Active' }],
            });
            navigate(`/clients/${clientId}/training-plans/${newPlan.planId}`, { replace: true });
          } else {
            setError(tRef.current('clientTraining.createError'));
          }
        }
      } catch {
        if (!cancelled) {
          setError(tRef.current('clientTraining.loadError'));
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [clientId, navigate, queryClient, canManageTraining]);

  if (!canManageTraining) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontSize: 14 }}>{t('clientTraining.roleDenied')}</p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard', { replace: true })}
        >
          {t('clientTraining.back')}
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontSize: 14 }}>{error}</p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate(-1)}
        >
          {t('clientTraining.back')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
      {t('clientTraining.loading')}
    </div>
  );
}
