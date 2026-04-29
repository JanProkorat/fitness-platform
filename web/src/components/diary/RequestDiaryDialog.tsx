/**
 * RequestDiaryDialog — standalone modal for sending a photo diary request.
 *
 * Design-of-record: docs/prototypes/trainer/scenes/diary-request-dialog.html
 *
 * Entry points:
 *   - NutritionPlanPage (Photos tab CTA) → passes linkId + planId
 *   - ClientDetailPage (photos tab CTA)  → passes linkId only
 *   - DashboardPage                      → passes linkId only
 *
 * NOTE — backend contract gap:
 *   `linkId` is the internal integer PK of ClientProfessionalLink.
 *   It is NOT exposed in GetClientDashboardResponse or any client-list API today.
 *   Until the backend adds `linkId` to those responses the prop will be undefined
 *   and the submit button stays disabled. Track as a backend follow-up.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createDiaryRequest } from '@/api/diary-requests';
import { showSuccess, showApiError } from '@/lib/api-errors';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

const DURATION_OPTIONS = [3, 7, 14] as const;
type DurationDays = (typeof DURATION_OPTIONS)[number];

export interface RequestDiaryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Internal integer PK of the ClientProfessionalLink. Required for submission. */
  linkId: number | undefined;
  /** Optional plan scope — passed from plan detail pages. */
  planId?: string;
  /** Display name shown in the client strip. */
  clientName: string;
  /** Client initials for the avatar. */
  clientInitials: string;
  /** Subtitle shown below the client name (e.g. "Výživa · Týden 4 / 12 · …"). */
  clientSubtitle?: string;
}

export function RequestDiaryDialog({
  open,
  onClose,
  linkId,
  planId,
  clientName,
  clientInitials,
  clientSubtitle,
}: RequestDiaryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState('');
  const [durationDays, setDurationDays] = useState<DurationDays>(7);

  // Reset on open
  const [trackedOpen, setTrackedOpen] = useState(false);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setMessage(t('diary.request.defaultMessage'));
      setDurationDays(7);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      createDiaryRequest({
        linkId,
        planId,
        durationDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
      showSuccess(t('diary.request.successToast'));
      onClose();
    },
    onError: (err) => {
      showApiError(err, 'diary.request.errorToast');
    },
  });

  if (!open) return null;

  const canSubmit = linkId != null && !mutation.isPending;
  const charCount = message.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        style={{ animation: 'dlg-fade-in .4s ease-out' }}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{
            width: 480,
            maxWidth: '95vw',
            maxHeight: '90vh',
            background: 'var(--bg)',
            borderRadius: 10,
            animation: 'dlg-slide-up .4s ease-out',
          }}
        >
          {/* Hero */}
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              height: 72,
              background: 'var(--accent-bg)',
              borderRadius: '10px 10px 0 0',
              borderBottom: '1px solid var(--accent-br)',
            }}
          >
            <span style={{ fontSize: 28, opacity: 0.7 }}>📸</span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                {t('diary.request.dialogTitle')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {t('diary.request.dialogSubtitle')}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--text3)',
                padding: 4,
              }}
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {/* Client strip */}
            <div
              className="flex items-center gap-3 px-5 py-3 border-b border-border"
              style={{ background: 'var(--bg2)' }}
            >
              <div
                className="flex items-center justify-center shrink-0 text-white text-base font-bold"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--blue), #0056b3)',
                  fontSize: 16,
                }}
              >
                {clientInitials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {clientName}
                </div>
                {clientSubtitle && (
                  <div
                    className="truncate"
                    style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}
                  >
                    {clientSubtitle}
                  </div>
                )}
              </div>
            </div>

            {/* Info banner */}
            <div
              className="mx-5 mt-4 mb-3 rounded-md px-3.5 py-2.5 text-[12px] leading-relaxed"
              style={{
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-br)',
                color: 'var(--text3)',
              }}
            >
              {t('diary.request.infoBanner')}
            </div>

            <div className="px-5 pb-5 flex flex-col gap-4">
              {/* Message field */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-text3">
                  {t('diary.request.messageLabel')}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('diary.request.messagePlaceholder')}
                  rows={4}
                  maxLength={500}
                  className="rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full resize-none"
                />
                <div className="text-[10px] text-text4 text-right mt-0.5">
                  {charCount} / 500
                </div>
              </div>

              {/* Duration selector */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-text3">
                  {t('diary.request.durationLabel')}
                </label>
                <div className="flex gap-1.5">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationDays(d)}
                      className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors"
                      style={{
                        background: durationDays === d ? 'var(--accent)' : 'var(--bg2)',
                        color: durationDays === d ? '#fff' : 'var(--text3)',
                        borderColor: durationDays === d ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {t('diary.request.durationDays', { count: d })}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload mode info */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-text3">
                  {t('diary.request.uploadModeLabel')}
                </label>
                <div
                  className="rounded-md px-3.5 py-2.5 text-[12px] leading-relaxed"
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {t('diary.request.modeAllAtOnce')}
                    </span>{' '}
                    — {t('diary.request.modeAllAtOnceDesc')}
                  </div>
                  <div className="mt-1">
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {t('diary.request.modeWorkflow')}
                    </span>{' '}
                    — {t('diary.request.modeWorkflowDesc', { days: durationDays })}
                  </div>
                </div>
                <div
                  className="mt-1.5 text-[11px]"
                  style={{ color: 'var(--text4)' }}
                >
                  {t('diary.request.modeHint')}
                </div>
              </div>

              {/* Sender info strip */}
              <div
                className="rounded-md px-3.5 py-2.5 text-[12px] leading-relaxed"
                style={{
                  background: 'rgba(52,199,89,0.07)',
                  border: '1px solid rgba(52,199,89,0.2)',
                  color: 'var(--text3)',
                }}
              >
                {t('diary.request.senderInfo')}
              </div>

              {/* linkId gap warning */}
              {linkId == null && (
                <div
                  className="rounded-md px-3.5 py-2.5 text-[12px]"
                  style={{
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                  }}
                >
                  {t('diary.request.linkIdMissing')}
                </div>
              )}

              {mutation.isError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>
                  {t('diary.request.errorToast')}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0"
          >
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                if (canSubmit) mutation.mutate();
              }}
              disabled={!canSubmit}
              className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mutation.isPending
                ? t('diary.request.sending')
                : t('diary.request.send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
