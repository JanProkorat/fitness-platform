import { Check, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  /** Small pill above the title, e.g. "Not on your plan". */
  badge: string;
  title: string;
  description: string;
  /** What the feature gives the coach. */
  bullets: readonly string[];
}

/** A feature the coach's plan does not include: a card over a muted placeholder of the page it replaces. */
export default function FeaturePaywall({ badge, title, description, bullets }: Props) {
  return (
    <div className="relative min-h-96 overflow-hidden rounded-2xl border border-line bg-card" data-testid="feature-paywall">
      <div className="flex flex-col opacity-60" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-6 sm:pt-16">
        <section
          aria-labelledby="feature-paywall-title"
          className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-line bg-card p-8 shadow-panel"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-training-soft text-training-ink">
              <Lock className="size-4.5" aria-hidden="true" />
            </span>
            <span className="rounded-md bg-sunken px-2.5 py-1 text-meta font-semibold text-ink-2">{badge}</span>
          </div>
          <h2 id="feature-paywall-title" className="text-auth-title font-semibold text-ink">
            {title}
          </h2>
          <p className="text-copy text-muted-foreground">{description}</p>
          <ul className="flex flex-col gap-2.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-copy text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
