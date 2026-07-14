import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

export interface DiaryPlanOption {
  planId: string;
  name: string;
  kind: 'nutrition' | 'training';
}

interface LinkDiaryToPlanDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (planId: string) => void;
  /** All of the client's nutrition + training plans, role-gated by caller. */
  plans: DiaryPlanOption[];
  isPending: boolean;
}

/**
 * Lets a trainer/nutritionist retroactively link an existing photo diary
 * request to one of the client's plans (#778 AC5). Mirrors
 * `LinkExistingResponseDialog` (#777) but picks a *plan* rather than a
 * questionnaire response — the direction is reversed because the backend
 * endpoint (`POST /trainer/photo-diary-requests/{id}/link`) sets the
 * diary's `PlanId`, not the plan's questionnaire reference.
 */
export function LinkDiaryToPlanDialog({
  open,
  onClose,
  onConfirm,
  plans,
  isPending,
}: LinkDiaryToPlanDialogProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('');
  const [trackedOpen, setTrackedOpen] = useState(false);

  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (!open) setSelectedId('');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          <div className="flex items-center justify-center" style={{ height: 90, background: 'var(--accent-bg)', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 36, opacity: 0.6 }}>🔗</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t('diary.link.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('diary.link.description')}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            {plans.length === 0 ? (
              <div className="text-[13px] text-text3">{t('diary.link.noPlans')}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((p) => (
                  <label
                    key={p.planId}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors"
                    style={{
                      borderColor: selectedId === p.planId ? 'var(--accent)' : 'var(--border)',
                      background: selectedId === p.planId ? 'var(--accent-bg)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="link-diary-to-plan"
                      value={p.planId}
                      checked={selectedId === p.planId}
                      onChange={() => setSelectedId(p.planId)}
                    />
                    <span className="shrink-0" aria-hidden="true">{p.kind === 'nutrition' ? '🥗' : '🏋️'}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="text-[13px] font-medium text-text truncate">{p.name}</div>
                      <div className="text-[11px] text-text3">
                        {p.kind === 'nutrition' ? t('sidebar.mealPlan') : t('sidebar.trainingPlan')}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (selectedId) onConfirm(selectedId); }}
              disabled={!selectedId || isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {isPending ? t('diary.link.linking') : t('diary.link.confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
