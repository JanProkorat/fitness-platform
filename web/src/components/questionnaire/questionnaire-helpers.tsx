import type { ResponseAnswerDto } from '@/api/questionnaires';

// Shared between QuestionCard (editor) and QuestionnairePreview (read-only
// preview) — was duplicated in both files before this extraction (#687).
export const TYPE_ICONS: Record<string, string> = {
  section: '§',
  short_text: 'Aa',
  single_choice: '◉',
  multi_select: '☑',
  number: '#',
  scale: '⟷',
  file_upload: '📎',
};

export function formatAnswerValue(answer: ResponseAnswerDto): React.ReactNode {
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
          style={{ color: 'var(--blue)', textDecoration: 'underline', fontSize: 11 }}
        >
          {answer.fileUrl.split('/').pop()}
        </a>
      );
    default:
      return answer.valueText ?? answer.valueNumber?.toString() ?? '—';
  }
}
