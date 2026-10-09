import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanCardKind = 'nutrition' | 'training';

const KIND_STYLES: Record<PlanCardKind, { eyebrow: string; dot: string; tile: string }> = {
  nutrition: { eyebrow: 'text-nutrition', dot: 'bg-nutrition', tile: 'bg-nutrition-soft text-nutrition-ink' },
  training: { eyebrow: 'text-training', dot: 'bg-training', tile: 'bg-training-soft text-training-ink' },
};

interface Props {
  kind: PlanCardKind;
  eyebrow: string;
  caption: string;
  /** Target of the "Open" link; omitted when the caller's link grants no access to this domain. */
  openTo?: string;
  children: ReactNode;
}

/** Shared frame of the panel's meal-plan / training cards: coloured eyebrow, caption, "Open" link, then the body. */
export default function PlanCardShell({ kind, eyebrow, caption, openTo, children }: Props) {
  const { t } = useTranslation();
  const styles = KIND_STYLES[kind];

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card px-5 py-4.5 shadow-panel">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex items-center gap-1.75 text-label font-bold uppercase tracking-label',
            styles.eyebrow,
          )}
        >
          <span className={cn('size-1.75 rounded-full', styles.dot)} aria-hidden="true" />
          {eyebrow}
        </span>
        <span className="min-w-0 truncate text-meta text-muted-foreground">{caption}</span>
        {openTo && (
          <Link
            to={openTo}
            className="ml-auto flex shrink-0 items-center gap-0.5 text-body font-semibold text-ink hover:underline"
          >
            {t('inbox.panel.open')}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

interface TileProps {
  kind: PlanCardKind;
  icon: ReactNode;
  title: string;
  subtitle: string;
}

/** Icon tile + plan/session title + one muted detail line. */
export function PlanCardSummary({ kind, icon, title, subtitle }: TileProps) {
  return (
    <div className="flex items-center gap-3.5">
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', KIND_STYLES[kind].tile)}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-display text-card-title font-semibold text-ink">{title}</span>
        <span className="text-meta text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}
