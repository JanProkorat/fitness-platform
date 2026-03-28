import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrainingPlans, createTrainingPlan } from '@/api/training-plans';

/**
 * Wrapper that resolves a client's training plan:
 * - If the client has a plan → redirect to /clients/:id/training-plans/:planId
 * - If not → auto-create an empty plan (1 week) and redirect
 */
export default function ClientTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

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
            name: 'Tréninkový plán',
            weekCount: 1,
          });

          if (cancelled) return;

          if (newPlan?.planId) {
            navigate(`/clients/${clientId}/training-plans/${newPlan.planId}`, { replace: true });
          } else {
            setError('Nepodařilo se vytvořit plán.');
          }
        }
      } catch {
        if (!cancelled) {
          setError('Chyba při načítání tréninkového plánu.');
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
          &larr; Zpět
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
      Načítání tréninkového plánu&hellip;
    </div>
  );
}
