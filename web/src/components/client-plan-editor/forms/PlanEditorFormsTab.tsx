import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import type { OnboardingDataDto } from '@/api/generated';
import type { ClientFormItem, GetClientFormsResponse } from '@/api/questionnaires';
import { useMarkClientFormSeen } from '@/components/client-forms/useClientForms';
import FormAnswersPopover from '@/components/client-plan-editor/forms/FormAnswersPopover';
import FormCard from '@/components/client-plan-editor/forms/FormCard';
import { selectPlanEditorForms } from '@/components/client-plan-editor/forms/planEditorForms';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  clientId: string;
  clientFirstName: string;
  /** From the client dashboard; feeds the onboarding card's key answers. */
  onboarding?: OnboardingDataDto;
  /** The client's forms; the host owns the query so it can show a dot on the tab. */
  forms: UseQueryResult<GetClientFormsResponse>;
}

/** The Forms tab of the client plan editor: compact form cards, and the answers popover beside the panel. */
export default function PlanEditorFormsTab({ clientId, clientFirstName, onboarding, forms }: Props) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const markSeen = useMarkClientFormSeen(clientId);

  const cards = selectPlanEditorForms(forms.data?.current);
  const opened = cards.find((card) => card.responsePublicId === openId);

  function open(item: ClientFormItem) {
    setOpenId(item.responsePublicId ?? null);
    // A failed mark-seen never blocks reading the answers.
    if (item.isNew && item.responsePublicId) {
      markSeen.mutate(item.responsePublicId);
    }
  }

  let content: ReactNode;
  if (forms.isPending) {
    content = (
      <div className="flex flex-col gap-2.5" data-testid="forms-loading">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  } else if (forms.isError) {
    content = (
      <div role="alert" data-testid="forms-error" className="flex flex-col items-start gap-2">
        <p className="text-body text-muted-foreground">{t('clientForms.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void forms.refetch()}>
          {t('clientForms.retry')}
        </Button>
      </div>
    );
  } else if (cards.length === 0) {
    content = (
      <p data-testid="forms-empty" className="text-body text-muted-foreground">
        {t('clientForms.empty', { name: clientFirstName })}
      </p>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-2.5">
        {cards.map((item) => (
          <FormCard
            key={item.responsePublicId}
            item={item}
            onboarding={onboarding}
            selected={item.responsePublicId === openId}
            onOpen={open}
          />
        ))}
      </ul>
    );
  }

  return (
    <div ref={rootRef} data-testid="plan-editor-forms" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-4.5">
        <p className="text-body text-muted-foreground">{t('clientForms.intro', { name: clientFirstName })}</p>
        {content}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3">
        <Link
          to={`/clients/${clientId}/forms`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="forms-all-link"
          className="inline-flex items-center gap-1 rounded-xs text-body font-semibold text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('clientForms.allForms', { name: clientFirstName })}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {opened && (
        <FormAnswersPopover
          key={opened.responsePublicId}
          item={opened}
          clientId={clientId}
          clientFirstName={clientFirstName}
          anchorRef={rootRef}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
