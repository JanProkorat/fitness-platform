import { useTranslation } from 'react-i18next';
import { Dialog, Button } from '@/components/ui';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';
import { MEAL_KINDS, type MealKind } from '@/components/nutrition/meal-kind';

export interface PublishWeekDialogProps {
  isOpen: boolean;
  selectedWeek: number;
  isPublishing: boolean;
  onPublish: () => void;
  onClose: () => void;
}

export function PublishWeekDialog({
  isOpen,
  selectedWeek,
  isPublishing,
  onPublish,
  onClose,
}: PublishWeekDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        style={{ animation: 'dlg-fade-in .4s ease-out' }}
      />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{
            width: 440,
            maxWidth: '95vw',
            background: 'var(--bg)',
            borderRadius: 10,
            animation: 'dlg-slide-up .4s ease-out',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              height: 80,
              background: 'var(--accent-bg)',
              borderRadius: '10px 10px 0 0',
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.6 }}>📤</span>
          </div>
          <div className="px-5 py-4">
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              {t('nutrition.publishWeek', { number: selectedWeek })}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text2)',
                lineHeight: 1.6,
              }}
            >
              {t('nutrition.confirmPublishWeek')}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {isPublishing
                ? t('nutrition.publishingWeek')
                : t('nutrition.publishWeekButton')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export interface CompletePlanDialogProps {
  isOpen: boolean;
  isCompleting: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export function CompletePlanDialog({
  isOpen,
  isCompleting,
  onComplete,
  onClose,
}: CompletePlanDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        style={{ animation: 'dlg-fade-in .4s ease-out' }}
      />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{
            width: 440,
            maxWidth: '95vw',
            background: 'var(--bg)',
            borderRadius: 10,
            animation: 'dlg-slide-up .4s ease-out',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              height: 80,
              background: 'var(--accent-bg)',
              borderRadius: '10px 10px 0 0',
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.6 }}>✓</span>
          </div>
          <div className="px-5 py-4">
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              {t('nutrition.completePlan')}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text2)',
                lineHeight: 1.6,
              }}
            >
              {t('nutrition.confirmComplete')}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={onComplete}
              disabled={isCompleting}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {isCompleting ? '...' : t('nutrition.completePlan')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export interface AddMealDialogProps {
  isOpen: boolean;
  mealKind: MealKind;
  mealTime: string;
  onMealKindChange: (kind: MealKind) => void;
  onMealTimeChange: (time: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddMealDialog({
  isOpen,
  mealKind,
  mealTime,
  onMealKindChange,
  onMealTimeChange,
  onAdd,
  onClose,
}: AddMealDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={t('nutrition.addMealButton')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onAdd}>
            {t('nutrition.addMealButton')}
          </Button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">{t('nutrition.mealKind')}</label>
        <select
          className="form-select auth-input"
          style={{
            fontSize: 13,
            padding: '7px 10px',
            cursor: 'pointer',
            width: '100%',
          }}
          value={mealKind}
          onChange={(e) => onMealKindChange(e.target.value as MealKind)}
          autoFocus
        >
          {MEAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`mealKind.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">{t('nutrition.mealTime')}</label>
        <input
          type="time"
          className="auth-input"
          style={{
            fontSize: 13,
            padding: '7px 10px',
            cursor: 'pointer',
            width: '100%',
          }}
          value={mealTime}
          onChange={(e) => onMealTimeChange(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
