import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
            name: 'Jídelníček',
            weekCount: 1,
          });

          if (cancelled) return;

          if (newPlan?.planId) {
            navigate(`/clients/${clientId}/plans/${newPlan.planId}`, { replace: true });
          } else {
            setError('Nepodařilo se vytvořit plán.');
          }
        }
      } catch {
        if (!cancelled) {
          setError('Chyba při načítání jídelníčku.');
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
          ← Zpět
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
      Načítání jídelníčku…
    </div>
  );
}
