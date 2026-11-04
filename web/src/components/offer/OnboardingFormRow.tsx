import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** The id the "None" choice selects: no form is sent. */
export const NO_FORM_ID = '';

export interface OfferForm {
  publicId: string;
  title: string;
  questionCount: number;
  isDefault: boolean;
}

interface Props {
  forms: OfferForm[];
  /** The chosen form id, or `NO_FORM_ID`. */
  value: string;
  onChange: (formId: string) => void;
  /** First name of the client, for "Skip the form for Adam"; generic copy when unknown. */
  clientName?: string;
  isLoading?: boolean;
  isError?: boolean;
}

/** The "Onboarding form  Client Onboarding Form · 9 questions  [Change]" row, with the menu to pick another form. */
export default function OnboardingFormRow({ forms, value, onChange, clientName, isLoading = false, isError = false }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const chosen = forms.find((form) => form.publicId === value);

  function choose(formId: string) {
    onChange(formId);
    setOpen(false);
  }

  return (
    <div
      data-testid="offer-form-row"
      className="flex items-center gap-3 rounded-field border border-border bg-card px-3.5 py-2.5"
    >
      <span className="shrink-0 text-body text-muted-foreground">{t('offer.form.label')}</span>
      <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
        {isLoading ? (
          t('common.loading')
        ) : isError ? (
          <span className="font-normal text-destructive">{t('offer.form.loadError')}</span>
        ) : chosen ? (
          <>
            {chosen.title}
            <span className="font-normal text-muted-foreground">
              {' · '}
              {t('offer.form.questions', { count: chosen.questionCount })}
            </span>
          </>
        ) : (
          t('offer.form.none')
        )}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={isLoading} className="shrink-0 font-semibold">
            {t('offer.form.change')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-88 p-1.5">
          <div role="listbox" aria-label={t('offer.form.label')} className="flex flex-col">
            {forms.map((form) => (
              <FormOption
                key={form.publicId}
                selected={form.publicId === value}
                title={`${form.title} · ${t('offer.form.questions', { count: form.questionCount })}`}
                hint={form.isDefault ? t('offer.form.defaultHint') : undefined}
                onClick={() => choose(form.publicId)}
              />
            ))}
            <FormOption
              selected={value === NO_FORM_ID}
              title={t('offer.form.noneOption')}
              hint={clientName ? t('offer.form.noneHint', { name: clientName }) : t('offer.form.noneHintGeneric')}
              onClick={() => choose(NO_FORM_ID)}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border px-2.5 pt-2.5 pb-1">
            <Link
              to="/forms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-body font-semibold text-ink hover:underline"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('offer.form.new')}
            </Link>
            <Link
              to="/forms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-body font-semibold text-ink hover:underline"
            >
              {t('offer.form.manage')}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FormOption({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 rounded-field px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted',
        selected && 'bg-muted',
      )}
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-ink">
        {selected && <Check className="size-4" aria-hidden="true" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-semibold text-ink">{title}</span>
        {hint && <span className="text-meta text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}
