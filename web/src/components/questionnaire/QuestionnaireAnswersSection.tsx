import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientQuestionnaireResponse, type ResponseAnswerDto } from '@/api/questionnaires';

interface Props {
  clientId: string;
}

function formatAnswerValue(answer: ResponseAnswerDto): React.ReactNode {
  switch (answer.questionType) {
    case 'short_text':
    case 'single_choice':
      return answer.valueText ?? '—';
    case 'multi_select': {
      if (!answer.valueJson) return '—';
      try {
        const arr = JSON.parse(answer.valueJson) as string[];
        return Array.isArray(arr) ? arr.join(', ') : answer.valueJson;
      } catch {
        return answer.valueJson;
      }
    }
    case 'number':
      return answer.valueNumber != null ? String(answer.valueNumber) : '—';
    case 'scale':
      return answer.valueNumber != null ? `${answer.valueNumber} / 10` : '—';
    case 'file_upload':
      if (!answer.fileUrl) return '—';
      return (
        <a
          href={answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--blue)', textDecoration: 'underline' }}
        >
          {answer.fileUrl}
        </a>
      );
    default:
      return answer.valueText ?? answer.valueNumber?.toString() ?? '—';
  }
}

export function QuestionnaireAnswersSection({ clientId }: Props) {
  const { t, i18n } = useTranslation();

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['questionnaire-response', clientId],
    queryFn: () => getClientQuestionnaireResponse(clientId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 120, height: 10, borderRadius: 4, background: 'var(--bg3)' }} />
      </div>
    );
  }

  if (isError || !response) {
    return (
      <div style={{
        padding: '16px',
        background: 'var(--orange-bg)',
        border: '1px solid rgba(173,87,0,0.15)',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        color: 'var(--orange)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>⏳</span>
        {t('questionnaire.waitingForResponse')}
      </div>
    );
  }

  const submittedDate = response.submittedAt
    ? new Date(response.submittedAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB')
    : null;

  return (
    <div>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          📋 {t('questionnaire.answersTitle')}
        </span>
        {submittedDate && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {t('questionnaire.submittedAt', { date: submittedDate })}
          </span>
        )}
      </div>

      {/* Answer rows */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {response.answers.map((answer, idx) => (
          <div
            key={answer.questionPublicId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '7px 12px',
              borderBottom: idx < response.answers.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            {/* Label */}
            <div style={{
              width: 200,
              flexShrink: 0,
              fontSize: 13,
              color: 'var(--text3)',
              paddingRight: 16,
              paddingTop: 1,
            }}>
              {answer.questionLabel}
            </div>

            {/* Value */}
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
              {formatAnswerValue(answer)}
            </div>

            {/* Synced badge */}
            {answer.mappedField && (
              <div style={{
                flexShrink: 0,
                marginLeft: 8,
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--accent)',
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-br)',
              }}>
                {t('questionnaire.synced')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
