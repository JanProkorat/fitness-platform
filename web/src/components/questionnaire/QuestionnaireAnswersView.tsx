import { useTranslation } from 'react-i18next';
import type { ClientResponseItem } from '@/api/questionnaires';
import { formatAnswerValue } from './questionnaire-helpers';

interface QuestionnaireAnswersViewProps {
  /** The linked questionnaire response to render, or undefined if none is linked. */
  response: ClientResponseItem | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Read-only, namespace-agnostic view of a submitted questionnaire response:
 * a header (questionnaire title + submitted date) followed by an ordered
 * flat list of `label -> formatted value` pairs.
 *
 * Renders no management actions (assign/replace/cancel) — those stay in the
 * sidebar `PlanQuestionnairePanel`. Intended for reuse across plan-detail
 * page tabs (training, nutrition) — do not add page-specific copy here.
 */
export function QuestionnaireAnswersView({ response, isLoading, isError }: QuestionnaireAnswersViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-6" role="status" aria-live="polite">
        <span className="sr-only">{t('questionnaire.answersView.loading')}</span>
        <div className="h-4 w-48 animate-pulse rounded-sm bg-bg3" />
        <div className="h-3 w-32 animate-pulse rounded-sm bg-bg3" />
        <div className="mt-2 h-16 w-full animate-pulse rounded-md bg-bg3" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="m-6 flex items-center gap-2 rounded-md border border-red-br bg-red-bg p-4 text-sm text-red">
        <span aria-hidden="true">⚠️</span>
        {t('questionnaire.answersView.error')}
      </div>
    );
  }

  if (!response) {
    return (
      <div className="m-6 flex items-center gap-2 rounded-md border border-border bg-bg2 p-4 text-sm text-text3">
        <span aria-hidden="true">📋</span>
        {t('questionnaire.answersView.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text">{response.questionnaireTitle}</h2>
        {response.submittedAt && (
          <div className="text-xs text-text3">
            {t('questionnaire.submittedAt', {
              date: new Date(response.submittedAt).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            })}
          </div>
        )}
      </header>

      {response.answers.length === 0 ? (
        <div className="text-sm text-text3">{t('questionnaire.answersView.emptyAnswers')}</div>
      ) : (
        <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
          {response.answers.map((answer) => (
            <li key={answer.questionPublicId} className="flex flex-col gap-1 p-3">
              <div className="text-xs text-text3">{answer.questionLabel}</div>
              <div className="text-sm font-medium text-text">{formatAnswerValue(answer)}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
