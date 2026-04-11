import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getClientQuestionnaireResponses,
  type ClientResponseItem,
} from '@/api/questionnaires';
import { getPlans } from '@/api/plans';
import { getTrainingPlans } from '@/api/training-plans';

interface Props {
  clientId: string;
}

// ─── Status Badge ───────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colorMap: Record<string, { bg: string; color: string }> = {
    Submitted: { bg: 'var(--green-bg, rgba(52,199,89,0.1))', color: 'var(--green, #34c759)' },
    Pending: { bg: 'var(--orange-bg, rgba(255,149,0,0.1))', color: 'var(--orange, #ff9500)' },
    InProgress: { bg: 'var(--orange-bg, rgba(255,149,0,0.1))', color: 'var(--orange, #ff9500)' },
  };
  const colors = colorMap[status] ?? { bg: 'var(--bg2)', color: 'var(--text3)' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: colors.bg,
      color: colors.color,
    }}>
      {label}
    </span>
  );
}

// ─── Linked Plan Info ───────────────────────────────────────────────

interface LinkedPlanInfo {
  planId: string;
  name: string;
  type: 'nutrition' | 'training';
}

// ─── Main Component ──────────────────────────────────────────────────

export function QuestionnaireAnswersSection({ clientId }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale = i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questionnaire-responses', clientId],
    queryFn: () => getClientQuestionnaireResponses(clientId),
    retry: false,
  });

  // Fetch nutrition & training plans to resolve questionnaireResponseId → plan link
  const nutritionPlansQuery = useQuery({
    queryKey: ['nutrition-plans', clientId],
    queryFn: () => getPlans({ clientId, pageSize: 100 }),
    enabled: !!data && data.responses.length > 0,
  });

  const trainingPlansQuery = useQuery({
    queryKey: ['training-plans', clientId],
    queryFn: () => getTrainingPlans({ clientId, pageSize: 100 }),
    enabled: !!data && data.responses.length > 0,
  });

  // Build a map: responsePublicId → linked plan info
  const linkedPlanMap = useMemo(() => {
    const map = new Map<string, LinkedPlanInfo>();
    if (nutritionPlansQuery.data) {
      for (const plan of nutritionPlansQuery.data.plans) {
        if (plan.questionnaireResponseId) {
          map.set(plan.questionnaireResponseId, {
            planId: plan.planId,
            name: plan.name,
            type: 'nutrition',
          });
        }
      }
    }
    if (trainingPlansQuery.data) {
      for (const plan of trainingPlansQuery.data.plans) {
        if (plan.questionnaireResponseId) {
          map.set(plan.questionnaireResponseId, {
            planId: plan.planId,
            name: plan.name,
            type: 'training',
          });
        }
      }
    }
    return map;
  }, [nutritionPlansQuery.data, trainingPlansQuery.data]);

  const responses = data?.responses ?? [];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusLabel = (response: ClientResponseItem) => {
    if (response.status === 'Submitted') return t('questionnaire.submitted');
    if (response.status === 'Pending') return t('questionnaire.statusPending');
    return t('questionnaire.statusInProgress');
  };

  const handlePlanClick = (plan: LinkedPlanInfo) => {
    const prefix = plan.type === 'nutrition' ? 'plans' : 'training-plans';
    navigate(`/clients/${clientId}/${prefix}/${plan.planId}`);
  };

  if (isLoading) {
    return (
      <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 120, height: 10, borderRadius: 4, background: 'var(--bg3)' }} />
      </div>
    );
  }

  // ─── No responses at all ───
  if (isError || responses.length === 0) {
    return (
      <div style={{
        padding: '16px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        color: 'var(--text3)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>📋</span>
        {t('questionnaire.noQuestionnaireData')}
      </div>
    );
  }

  // ─── Response history table (read-only) ───────────────────────────
  const submittedResponses = responses.filter(r => r.status === 'Submitted');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          📋 {t('questionnaire.responseHistory')}
        </span>
      </div>

      {/* Compact response table */}
      {submittedResponses.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('questionnaire.colTitle')}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('questionnaire.colStatus')}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('questionnaire.colDate')}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('questionnaire.colLinkedPlan')}
                </th>
              </tr>
            </thead>
            <tbody>
              {submittedResponses.map((response, idx) => {
                const linkedPlan = linkedPlanMap.get(response.responsePublicId);
                return (
                  <tr
                    key={response.responsePublicId}
                    style={{
                      borderBottom: idx < submittedResponses.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                      {response.questionnaireTitle}
                      <span style={{ color: 'var(--text3)', marginLeft: 6, fontSize: 12 }}>
                        ({response.answerCount} {t('questionnaire.answers')})
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={response.status} label={getStatusLabel(response)} />
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>
                      {formatDate(response.submittedAt)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {linkedPlan ? (
                        <button
                          onClick={() => handlePlanClick(linkedPlan)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 0,
                          }}
                        >
                          <span style={{ fontSize: 12 }}>
                            {linkedPlan.type === 'nutrition' ? '🥗' : '🏋️'}
                          </span>
                          {linkedPlan.name}
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>→</span>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
