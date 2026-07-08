import { useTranslation } from 'react-i18next';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

interface RevokeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function RevokeConfirmDialog({
  open,
  onClose,
  onConfirm,
  isPending,
}: RevokeConfirmDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 440, maxWidth: '95vw', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          <div className="flex items-center justify-center" style={{ height: 80, background: 'var(--red-bg)', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 32, opacity: 0.7 }}>🗑️</span>
          </div>
          <div className="px-5 py-4">
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('questionnaire.revokeConfirmTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{t('questionnaire.revokeConfirmDesc')}</div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--red)' }}
            >
              {isPending ? t('questionnaire.revoking') : t('questionnaire.revokeQuestionnaire')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
