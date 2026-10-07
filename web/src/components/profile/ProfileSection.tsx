import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface ProfileSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Card with a title and one-line description wrapping one group of profile fields. */
export function ProfileSection({ title, description, children }: ProfileSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-panel-title font-semibold tracking-heading text-ink">{title}</h2>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  /** Right-aligned text on the label row, e.g. a character counter. */
  aside?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint, swapping the hint for the error message when there is one. */
export function Field({ label, htmlFor, hint, error, aside, className, children }: FieldProps) {
  const messageId = `${htmlFor}-message`;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {aside && <span className="text-meta text-muted-foreground tabular-nums">{aside}</span>}
      </div>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="text-meta text-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-meta text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
