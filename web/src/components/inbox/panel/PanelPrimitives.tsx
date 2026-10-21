import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Error text with a retry button for a panel card whose query failed. */
export function PanelLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div data-testid="panel-load-error" className="flex flex-col items-center gap-2 py-4">
      <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('clients.retry')}
      </Button>
    </div>
  );
}

interface HeaderProps {
  name: string;
  /** Status chip text; omitted for a plain "not a client" header. */
  chip?: string;
  chipDotClassName?: string;
  description: string;
}

/** Client name, an optional status chip with a dot, and a one-line muted description. */
export function PanelStatusHeader({ name, chip, chipDotClassName, description }: HeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-auth-title font-semibold tracking-heading text-ink">{name}</h2>
        {chip && (
          <span
            data-testid="panel-status-chip"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.25 py-0.75 text-meta font-semibold whitespace-nowrap text-ink"
          >
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', chipDotClassName)} />
            {chip}
          </span>
        )}
      </div>
      <span className="text-body text-muted-foreground">{description}</span>
    </div>
  );
}

export interface PanelFact {
  label: string;
  value: string;
}

interface FactsProps {
  /** Small uppercase heading, e.g. "ONBOARDING ANSWERS". */
  title: string;
  /** Right-aligned muted text beside the heading. */
  aside?: string;
  facts: PanelFact[];
  testId: string;
  children?: ReactNode;
}

/** A panel card with an eyebrow heading and a list of label / value rows. */
export function PanelFactsCard({ title, aside, facts, testId, children }: FactsProps) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-5 pt-4.5 pb-1.5 shadow-panel"
    >
      <div className="flex items-center">
        <h3 className="text-label font-bold tracking-label text-muted-foreground uppercase">{title}</h3>
        {aside && <span className="ml-auto text-meta text-muted-foreground">{aside}</span>}
      </div>
      {facts.length > 0 ? (
        <dl className="flex flex-col">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.75 border-t border-border py-3">
              <dt className="text-meta text-muted-foreground">{fact.label}</dt>
              <dd className="text-body font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        children
      )}
    </section>
  );
}
