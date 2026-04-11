import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientQuestionnaireResponses } from '@/api/questionnaires';

interface Props {
  clientId: string;
  value: string;
  onChange: (responseId: string) => void;
  /** i18n namespace prefix — 'nutrition' or 'training' */
  ns: 'nutrition' | 'training';
}

/**
 * Dropdown that lists submitted questionnaire responses for a given client.
 * Used in plan creation drawers to optionally link a questionnaire response.
 */
export function QuestionnaireResponseSelect({ clientId, value, onChange, ns }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const { data, isLoading } = useQuery({
    queryKey: ['questionnaire-responses', clientId],
    queryFn: () => getClientQuestionnaireResponses(clientId),
    enabled: !!clientId,
  });

  const submitted = (data?.responses ?? []).filter((r) => r.status === 'Submitted');

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!clientId || isLoading}
      className="w-full rounded-md border border-border-md bg-bg px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv disabled:opacity-50"
      style={{ fontFamily: 'inherit' }}
    >
      <option value="">{t(`${ns}.selectQuestionnaire`)}</option>
      {submitted.length === 0 && clientId && !isLoading && (
        <option value="" disabled>
          {t(`${ns}.noSubmittedResponses`)}
        </option>
      )}
      {submitted.map((r) => (
        <option key={r.responsePublicId} value={r.responsePublicId}>
          {r.questionnaireTitle}
          {r.submittedAt
            ? ` — ${new Date(r.submittedAt).toLocaleDateString(locale)}`
            : ''}
        </option>
      ))}
    </select>
  );
}
