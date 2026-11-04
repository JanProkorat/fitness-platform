import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, MessageSquare } from 'lucide-react';
import {
  QuestionnaireResponseKind,
  type ClientFormAnswer,
  type ClientFormItem,
} from '@/api/questionnaires';
import ClientFormAnswers from '@/components/client-forms/ClientFormAnswers';
import { Button } from '@/components/ui/button';
import CheckInStrip from '@/components/client-detail/forms/CheckInStrip';
import {
  groupAnswersBySection,
  isoWeekNumber,
  numberChange,
  previousAnswer,
  previousWeekCheckIn,
} from '@/components/client-detail/forms/clientFormsModel';

function formatDate(value: string | undefined, language: string, withYear: boolean): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

function formatDateTime(value: string | undefined, language: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  item: ClientFormItem;
  /** The current collaboration's forms; the check-in strip and last week's answers come from here. */
  current: readonly ClientFormItem[];
  /** The client's public id, for the chat link. */
  clientPublicId: string;
  /** Previous-collaboration forms are read-only: no review button. */
  readOnly: boolean;
  isMarking: boolean;
  onSelect: (item: ClientFormItem) => void;
  onMarkReviewed: (item: ClientFormItem) => void;
}

/** One answered form: heading, section jump links and the answers; a check-in adds its week strip and review actions. */
export default function FormDetail({ item, current, clientPublicId, readOnly, isMarking, onSelect, onMarkReviewed }: Props) {
  const { t, i18n } = useTranslation();
  const anchorBase = useId();
  const language = i18n.language;
  const isCheckIn = item.kind === QuestionnaireResponseKind.CheckIn;
  const answers = item.answers ?? [];
  const sections = groupAnswersBySection(answers);
  const labelled = sections.filter((section) => section.label);

  const week = isCheckIn ? isoWeekNumber(item) : null;
  const previous = isCheckIn ? previousWeekCheckIn(current, item) : undefined;
  const previousWeek = previous ? isoWeekNumber(previous) : null;

  const title =
    week != null ? t('clientForms.page.weekTitle', { title: item.questionnaireTitle, week }) : item.questionnaireTitle;

  let meta: string;
  if (isCheckIn) {
    const base = t('clientForms.page.checkInMeta', {
      sent: formatDateTime(item.sentAt, language),
      answered: formatDateTime(item.submittedAt, language),
    });
    // The reviewed date shows in place of the button; the meta line only flags a pending review.
    meta = item.seenAt || readOnly ? base : `${base} · ${t('clientForms.page.notReviewed')}`;
  } else {
    meta = t('clientForms.card.answered', { date: formatDate(item.submittedAt, language, true), count: answers.length });
  }

  function jump(key: string) {
    document.getElementById(`${anchorBase}-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderChange(answer: ClientFormAnswer): ReactNode {
    const change = numberChange(answer, previousAnswer(previous, answer));
    if (!change || previousWeek == null) {
      return null;
    }
    const text =
      change.diff === 0
        ? t('clientForms.page.sameAsWeek', { week: previousWeek })
        : t('clientForms.page.changeVsWeek', {
            change: `${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)}`,
            week: previousWeek,
          });
    return (
      <span data-testid="answer-change" className="text-meta font-semibold text-muted-foreground">
        {text}
      </span>
    );
  }

  let reviewControl: ReactNode = null;
  if (isCheckIn && !readOnly) {
    reviewControl = item.seenAt ? (
      <span
        data-testid="check-in-reviewed"
        className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-card px-3.5 text-body font-semibold text-ink"
      >
        <Check className="size-4" aria-hidden="true" />
        {t('clientForms.page.reviewedOn', { date: formatDate(item.seenAt, language, false) })}
      </span>
    ) : (
      <Button
        type="button"
        size="lg"
        className="gap-1.75 px-3.5 font-semibold"
        disabled={isMarking}
        data-testid="mark-reviewed"
        onClick={() => onMarkReviewed(item)}
      >
        <Check aria-hidden="true" />
        {t('clientForms.page.markReviewed')}
      </Button>
    );
  }

  return (
    <article
      data-testid="form-detail"
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-panel"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <h2 className="min-w-0 font-display text-title font-semibold text-ink [overflow-wrap:anywhere]">{title}</h2>
          {isCheckIn && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="lg" className="gap-1.75 px-3.5 font-semibold">
                <Link to={`/inbox?client=${clientPublicId}`}>
                  <MessageSquare aria-hidden="true" />
                  {t('clientForms.page.replyInChat')}
                </Link>
              </Button>
              {reviewControl}
            </div>
          )}
        </div>
        <p className="text-copy text-muted-foreground">{meta}</p>
      </header>

      {isCheckIn && <CheckInStrip current={current} selected={item} onSelect={onSelect} />}

      {labelled.length > 0 && (
        <nav aria-label={t('clientForms.page.jumpTo')} className="flex flex-wrap gap-2">
          {labelled.map((section) => (
            <button
              key={section.key}
              type="button"
              data-testid="section-jump"
              onClick={() => jump(section.key)}
              className="inline-flex h-8 items-center rounded-full bg-muted px-3.5 text-body font-semibold text-ink outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}

      {answers.length === 0 ? (
        <p className="text-body text-muted-foreground">{t('clientForms.answers.noAnswer')}</p>
      ) : (
        <div className="grid gap-x-10 gap-y-6 border-t border-line pt-5 xl:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.key}
              id={`${anchorBase}-${section.key}`}
              aria-label={section.label || undefined}
              className="min-w-0 scroll-mt-4"
            >
              {section.label && <h3 className="pb-1 text-copy font-bold text-ink">{section.label}</h3>}
              <ClientFormAnswers answers={section.answers} bare renderExtra={isCheckIn ? renderChange : undefined} />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
