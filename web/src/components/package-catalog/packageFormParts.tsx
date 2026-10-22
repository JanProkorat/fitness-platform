import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FIELD_CLASS } from '@/components/automations/automationFormParts';

/** What a drawer's save reports back so the drawer can react (restore a locked field) without rejecting. */
export type SaveOutcome = 'saved' | 'currencyLocked' | 'error';

/** Attributes the control inside a {@link Field} must spread so the label, hint and error are wired up. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

interface FieldProps {
  label: string;
  /** Validation message key, shown under the control. */
  error?: string;
  /** Quiet helper line under the control. */
  hint?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * A labelled form field. The label holds only its own text, so the control's accessible name stays
 * exactly the label; the hint and the error are linked through aria-describedby instead.
 */
export function Field({ label, error, hint, children }: FieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <div className={FIELD_CLASS}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {error && (
        <span id={errorId} role="alert" className="text-meta font-normal text-destructive">
          {t(error)}
        </span>
      )}
      {hint && (
        <span id={hintId} className="text-meta font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Translated validation message under a group of controls, or nothing. */
export function FormError({ message }: { message?: string }) {
  const { t } = useTranslation();
  if (!message) {
    return null;
  }
  return (
    <span role="alert" className="text-meta font-normal text-destructive">
      {t(message)}
    </span>
  );
}

/** Quiet helper line under a group of controls. */
export function FieldHint({ children }: { children: string }) {
  return <span className="text-meta font-normal text-muted-foreground">{children}</span>;
}
