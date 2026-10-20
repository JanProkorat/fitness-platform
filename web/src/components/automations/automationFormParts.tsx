import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutomationRuleFormValues } from '@/components/automations/automationRuleForm';

export const SELECT_CLASS =
  'flex h-10 w-full min-w-0 appearance-none rounded-field border border-input bg-background py-1 pr-9 pl-3 text-copy text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50';

export const FIELD_CLASS = 'flex flex-col gap-1.5 text-body font-medium text-ink-2';

export function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

export function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-copy font-semibold text-ink">
      <span className="text-success" aria-hidden="true">
        {icon}
      </span>
      {children}
    </h3>
  );
}

/** Translated message of a field's validation error, or nothing. */
export function FieldError({ name }: { name: keyof AutomationRuleFormValues }) {
  const { t } = useTranslation();
  const {
    formState: { errors },
  } = useFormContext<AutomationRuleFormValues>();
  const message = errors[name]?.message;
  if (typeof message !== 'string') {
    return null;
  }
  return (
    <span role="alert" className="text-meta font-normal text-destructive">
      {t(message)}
    </span>
  );
}

interface ChoiceButtonProps {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

/** A pressed/unpressed choice tile used for trigger kind and action. */
export function ChoiceButton({ selected, onClick, icon, children, disabled = false }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-field border px-3 text-body font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        selected
          ? 'border-success bg-success-soft text-success-ink'
          : 'border-input bg-background text-foreground',
        !selected && !disabled && 'hover:bg-sunken',
        disabled && 'cursor-not-allowed',
        disabled && !selected && 'opacity-50',
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}
