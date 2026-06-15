import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClientQuestionnaireResponses,
  assignQuestionnaire,
  type ClientResponseItem,
} from '@/api/questionnaires';
import { QuestionnaireSelectDialog } from '@/components/questionnaire/QuestionnaireSelectDialog';
import { formatAnswerValue } from '@/components/questionnaire/questionnaire-helpers';
import { useToastStore } from '@/stores/toast';

interface DotaznikyTabProps {
  /** Client's public ID — used as the clientId param for questionnaire endpoints. */
  clientId: string;
}

/** Returns a short localised date string from an ISO string. */
function formatShortDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

interface ExpandedAnswersProps {
  item: ClientResponseItem;
  language: string;
}

/** Inline expandable answers section for a completed questionnaire row. */
function ExpandableAnswers({ item, language }: ExpandedAnswersProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (item.answers.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-medium text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
      >
        <span
          className="inline-block transition-transform duration-150"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ▸
        </span>
        {t('clientDetail.dotazniky.viewAnswers')} ({item.answers.length})
      </button>

      {open && (
        <div className="mt-2 border border-border rounded-[var(--radius-md)] overflow-hidden">
          {item.answers.map((answer, idx) => (
            <div
              key={answer.questionPublicId}
              className="px-3 py-2 text-[11px]"
              style={{
                borderBottom:
                  idx < item.answers.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div className="text-text3 mb-0.5">{answer.questionLabel}</div>
              <div className="text-text font-medium">{formatAnswerValue(answer)}</div>
            </div>
          ))}
        </div>
      )}

      {item.submittedAt && (
        <div className="text-[11px] text-text3 mt-1">
          {t('clientDetail.dotazniky.submittedOn', {
            date: formatShortDate(item.submittedAt, language),
          })}
        </div>
      )}
    </div>
  );
}

export function DotaznikyTab({ clientId }: DotaznikyTabProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questionnaire-responses', clientId],
    queryFn: () => getClientQuestionnaireResponses(clientId),
    enabled: Boolean(clientId),
    retry: false,
  });

  const assignMutation = useMutation({
    mutationFn: (qId: string) => assignQuestionnaire(clientId, qId),
    onSuccess: () => {
      setAssignDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['questionnaire-responses', clientId] });
      addToast(t('clientDetail.dotazniky.assignSuccess'), 'success');
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) {
        addToast(t('clientDetail.dotazniky.assignConflict'), 'error');
      } else {
        addToast(t('clientDetail.dotazniky.assignError'), 'error');
      }
    },
  });

  const responses = data?.responses ?? [];
  const submitted = responses.filter((r) => r.status === 'Submitted');
  const pending = responses.filter(
    (r) => r.status === 'Pending' || r.status === 'InProgress',
  );

  // Sort: pending first (newest by dateCreated), then submitted (newest by submittedAt)
  const sorted: ClientResponseItem[] = [
    ...pending.sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
    ),
    ...submitted.sort((a, b) => {
      const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return db - da;
    }),
  ];

  if (isLoading) {
    return (
      <div id="cl-pane-dotazniky">
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div id="cl-pane-dotazniky">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-semibold text-text">
          {t('clientDetail.dotazniky.title')}
        </div>
        <button
          type="button"
          className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors"
          onClick={() => setAssignDialogOpen(true)}
        >
          + {t('clientDetail.dotazniky.assignButton')}
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('clientDetail.dotazniky.errorLoading')}
        </div>
      )}

      {/* Empty state */}
      {!isError && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-[32px] opacity-40">📝</div>
          <div className="text-[14px] font-medium text-text2">
            {t('clientDetail.dotazniky.emptyTitle')}
          </div>
          <div className="text-[13px] text-text3 max-w-xs">
            {t('clientDetail.dotazniky.emptyDescription')}
          </div>
          <button
            type="button"
            className="mt-1 text-[13px] font-semibold text-accent hover:underline bg-transparent border-none cursor-pointer"
            onClick={() => setAssignDialogOpen(true)}
          >
            + {t('clientDetail.dotazniky.assignFirst')}
          </button>
        </div>
      )}

      {/* Questionnaire rows */}
      {!isError && sorted.length > 0 && (
        <div className="flex flex-col gap-3">
          {sorted.map((item) => {
            const isSubmitted = item.status === 'Submitted';

            if (isSubmitted) {
              // Completed row — solid border
              return (
                <div
                  key={item.responsePublicId}
                  className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[20px] shrink-0">📋</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-text truncate">
                          {item.questionnaireTitle}
                        </div>
                        {item.submittedAt && (
                          <div className="text-[11px] text-text3 mt-0.5">
                            {formatShortDate(item.submittedAt, lang)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-green-bg text-green border border-[var(--green-br)] shrink-0">
                      {t('clientDetail.dotazniky.statusCompleted')}
                    </span>
                  </div>
                  <ExpandableAnswers item={item} language={lang} />
                </div>
              );
            }

            // Pending row — dashed border
            return (
              <div
                key={item.responsePublicId}
                className="rounded-[var(--radius-lg)] px-4 py-3.5"
                style={{ border: '1.5px dashed var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[20px] shrink-0 opacity-40">📋</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-text2 truncate">
                        {item.questionnaireTitle}
                      </div>
                      <div className="text-[11px] text-text3 mt-0.5">
                        {t('clientDetail.dotazniky.pendingSubtitle', {
                          date: formatShortDate(item.dateCreated, lang),
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-orange-bg text-orange shrink-0">
                    {t('clientDetail.dotazniky.statusPending')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign questionnaire dialog */}
      <QuestionnaireSelectDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        onConfirm={(qId) => assignMutation.mutate(qId)}
        title={t('questionnaire.sendQuestionnaireTitle')}
        description={t('questionnaire.sendQuestionnaireDesc')}
        confirmLabel={
          assignMutation.isPending
            ? t('questionnaire.sending')
            : t('questionnaire.sendQuestionnaire')
        }
        isPending={assignMutation.isPending}
        icon="📋"
      />
    </div>
  );
}
