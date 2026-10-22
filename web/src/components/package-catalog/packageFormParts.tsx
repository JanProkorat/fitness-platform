import { useTranslation } from 'react-i18next';

/** Translated validation message under a field, or nothing. */
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

/** Quiet helper line under a field. */
export function FieldHint({ children }: { children: string }) {
  return <span className="text-meta font-normal text-muted-foreground">{children}</span>;
}

/** What a drawer's save reports back so the drawer can react (restore a locked field) without rejecting. */
export type SaveOutcome = 'saved' | 'currencyLocked' | 'error';
