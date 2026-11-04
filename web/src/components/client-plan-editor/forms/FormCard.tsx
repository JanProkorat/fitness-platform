import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, ChevronRight, Clock, FileText, TriangleAlert, UserRound, type LucideIcon } from 'lucide-react';
import {
  FormResponseState,
  QuestionnaireResponseKind,
  type ClientFormItem,
} from '@/api/questionnaires';
import type { OnboardingDataDto } from '@/api/generated';
import { splitAllergies } from '@/components/client-detail/nutrition/nutritionProfile';
import { checkInSummary, formatFormDate, isOpenable } from '@/components/client-plan-editor/forms/planEditorForms';
import { ALLERGY_CHIP_CLASS, CHIP_CLASS } from '@/components/client-plan-editor/onboardingChipClasses';
import { cn } from '@/lib/utils';

const KIND_ICONS: Record<QuestionnaireResponseKind, LucideIcon> = {
  [QuestionnaireResponseKind.Questionnaire]: FileText,
  [QuestionnaireResponseKind.CheckIn]: CalendarCheck,
  [QuestionnaireResponseKind.Onboarding]: UserRound,
};

const CARD_CLASS = 'flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 text-left shadow-card';

/** Chip showing which kind of form it is; a badge, not a heading. */
export function KindChip({ kind }: { kind: QuestionnaireResponseKind | undefined }) {
  const { t } = useTranslation();
  const resolved = kind ?? QuestionnaireResponseKind.Questionnaire;
  const Icon = KIND_ICONS[resolved];
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-meta font-semibold text-ink">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {t(`clientForms.kind.${resolved}`)}
    </span>
  );
}

function StatusMark({ item, openable }: { item: ClientFormItem; openable: boolean }) {
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
  return openable ? <ChevronRight className="size-4 text-ink-2" aria-hidden="true" /> : null;
}

function OnboardingChips({ onboarding }: { onboarding: OnboardingDataDto | undefined }) {
  const { t } = useTranslation();
  if (!onboarding) {
    return null;
  }
  const value = (code: string) => t(`clients.values.${code}`, { defaultValue: code });
  const warm = [...splitAllergies(onboarding.allergies), ...splitAllergies(onboarding.injuries)].map(value);
  const dislikes = onboarding.dislikes ?? [];
  if (warm.length === 0 && dislikes.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap pt-1" data-testid="form-card-chips">
      {warm.map((label, index) => (
        <li key={`${index}-${label}`} className={cn(ALLERGY_CHIP_CLASS, 'h-6 px-2')}>
          {label}
        </li>
      ))}
      {dislikes.length > 0 && (
        <li className={cn(CHIP_CLASS, 'h-6 max-w-full px-2')}>
          <span className="truncate">{t('clientForms.avoids', { items: dislikes.join(', ') })}</span>
        </li>
      )}
    </ul>
  );
}

interface Props {
  item: ClientFormItem;
  /** Onboarding answers the page already loaded; used for the onboarding card's key answers. */
  onboarding?: OnboardingDataDto;
  selected: boolean;
  onOpen: (item: ClientFormItem) => void;
}

/** One compact form card. Answered forms are buttons; waiting and missed ones are plain text. */
export default function FormCard({ item, onboarding, selected, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const openable = isOpenable(item);
  const language = i18n.language;
  const isCheckIn = item.kind === QuestionnaireResponseKind.CheckIn;
  const isOnboarding = item.kind === QuestionnaireResponseKind.Onboarding;

  let subtitle: string;
  if (item.state === FormResponseState.Waiting) {
    subtitle = t('clientForms.card.sent', { date: formatFormDate(item.sentAt, language) });
  } else if (item.state === FormResponseState.Missed) {
    subtitle = t('clientForms.card.missed', { date: formatFormDate(item.checkInDueAtUtc ?? item.sentAt, language) });
  } else if (isCheckIn) {
    subtitle = t('clientForms.card.latestAnswered', { date: formatFormDate(item.submittedAt, language) });
  } else {
    subtitle = t('clientForms.card.answered', {
      date: formatFormDate(item.submittedAt, language),
      count: item.answers?.length ?? 0,
    });
  }

  const summary = isCheckIn && openable ? checkInSummary(item) : [];

  const body: ReactNode = (
    <>
      <span className="flex items-center justify-between gap-2">
        <KindChip kind={item.kind} />
        <StatusMark item={item} openable={openable} />
      </span>
      <span className="text-copy font-bold text-ink [overflow-wrap:anywhere]">{item.questionnaireTitle}</span>
      <span className="text-body text-muted-foreground">{subtitle}</span>
      {summary.length > 0 && (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-body font-semibold text-ink">
          {summary.map(({ label, value }, index) => (
            <span key={`${index}-${label}`} className="inline-flex min-w-0 gap-1">
              <span className="max-w-24 truncate" title={label}>
                {label}
              </span>
              <span>{value}</span>
            </span>
          ))}
        </span>
      )}
      {isOnboarding && openable && <OnboardingChips onboarding={onboarding} />}
    </>
  );

  if (!openable) {
    return (
      <li>
        <div data-testid="form-card" data-state={item.state} className={cn(CARD_CLASS, 'shadow-none')}>
          {body}
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        data-testid="form-card"
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
