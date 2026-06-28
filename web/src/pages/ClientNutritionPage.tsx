import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPlans, createPlan } from '@/api/plans';

/**
 * Wrapper that resolves a client's nutrition plan:
 * - If the client has a plan → redirect to /plans/:planId
 * - If not → auto-create an empty plan (1 week) and redirect
 */
export default function ClientNutritionPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Keep a ref to `t` so the resolve effect can access the current translator
  // without adding it to the deps array (t changes identity on every language
  // switch, which would re-fire the mutating effect and create duplicate plans).
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    async function resolve() {
      try {
        // Try to find an existing plan for this client
        const res = await getPlans({ clientId, page: 1, pageSize: 1 });
        const existingPlan = res.plans?.[0];

        if (cancelled) return;

        if (existingPlan?.planId) {
          // Plan exists → go to it
          navigate(`/clients/${clientId}/plans/${existingPlan.planId}`, { replace: true });
        } else {
          // No plan → create one
          const newPlan = await createPlan({
            clientId,
            name: tRef.current('clientNutrition.defaultPlanName'),
            weekCount: 1,
          });

          if (cancelled) return;

          if (newPlan?.planId) {
            navigate(`/clients/${clientId}/plans/${newPlan.planId}`, { replace: true });
          } else {
            setError(tRef.current('clientNutrition.createError'));
          }
        }
      } catch {
        if (!cancelled) {
          setError(tRef.current('clientNutrition.loadError'));
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [clientId, navigate]);

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
          {t('clientNutrition.back')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
      {t('clientNutrition.loading')}
    </div>
  );
}
