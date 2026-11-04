import { useTranslation } from 'react-i18next';
import { ChevronRight, Clock, TriangleAlert } from 'lucide-react';
import {
  FormResponseState,
  QuestionnaireResponseKind,
  type ClientFormItem,
} from '@/api/questionnaires';
import { isAnswered, isoWeekNumber } from '@/components/client-detail/forms/clientFormsModel';
import { KindChip } from '@/components/client-plan-editor/forms/FormCard';
import { formatFormDate } from '@/components/client-plan-editor/forms/planEditorForms';
import { cn } from '@/lib/utils';

const CARD_CLASS = 'flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 text-left shadow-card';

function StatusMark({ item }: { item: ClientFormItem }) {
  const { t } = useTranslation();
  if (item.isNew) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta font-bold text-error">
        <span className="size-1.5 rounded-full bg-error" aria-hidden="true" />
        {t('clientForms.new')}
      </span>
    );
  }
  if (item.state === FormResponseState.Waiting) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-muted-foreground">
        <Clock className="size-3.5" aria-hidden="true" />
        {t('clientForms.waiting')}
      </span>
    );
  }
  if (item.state === FormResponseState.Missed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-muted-foreground">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        {t('clientForms.missed')}
      </span>
    );
  }
  return <ChevronRight className="size-4 text-ink-2" aria-hidden="true" />;
}

interface Props {
  item: ClientFormItem;
  selected: boolean;
  onOpen: (item: ClientFormItem) => void;
}

/** One entry of the forms list. Answered forms are buttons; waiting and missed ones are greyed plain text. */
export default function FormListCard({ item, selected, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const answered = isAnswered(item);
  const count = item.answers?.length ?? 0;

  let subtitle: string;
  if (item.state === FormResponseState.Waiting) {
    subtitle = t('clientForms.card.sent', { date: formatFormDate(item.sentAt, language) });
  } else if (item.state === FormResponseState.Missed) {
    subtitle = t('clientForms.card.missed', { date: formatFormDate(item.checkInDueAtUtc ?? item.sentAt, language) });
  } else if (item.kind === QuestionnaireResponseKind.CheckIn && isoWeekNumber(item) != null) {
    subtitle = t('clientForms.page.checkInCard', {
      week: isoWeekNumber(item),
      date: formatFormDate(item.submittedAt, language),
      count,
    });
  } else {
    subtitle = t('clientForms.card.answered', { date: formatFormDate(item.submittedAt, language), count });
  }

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <KindChip kind={item.kind} />
        <StatusMark item={item} />
      </span>
      <span className="text-copy font-bold text-ink [overflow-wrap:anywhere]">{item.questionnaireTitle}</span>
      <span className="text-body text-muted-foreground">{subtitle}</span>
    </>
  );

  if (!answered) {
    return (
      <li>
        <div data-testid="form-list-card" data-state={item.state} className={cn(CARD_CLASS, 'opacity-70 shadow-none')}>
          {body}
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        data-testid="form-list-card"
        data-state={item.state}
        data-new={item.isNew ? 'true' : undefined}
        aria-pressed={selected}
        onClick={() => onOpen(item)}
        className={cn(
          CARD_CLASS,
          'cursor-pointer outline-none hover:border-ink-2 focus-visible:ring-3 focus-visible:ring-ring/50',
          selected && 'border-2 border-ink p-3',
        )}
      >
        {body}
      </button>
    </li>
  );
}
