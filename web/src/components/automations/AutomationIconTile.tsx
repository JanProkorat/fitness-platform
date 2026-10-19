import type { ReactNode } from 'react';
import type { AutomationTileTone } from '@/components/automations/automationFormat';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<AutomationTileTone, string> = {
  form: 'bg-nutrition-soft text-nutrition-ink',
  photos: 'bg-training-soft text-training-ink',
  measurements: 'bg-sunken text-ink-2',
  checkIn: 'bg-error-soft text-error',
};

/** Rounded icon tile with the per-action tint used by both automations tables. */
export default function AutomationIconTile({ tone, children }: { tone: AutomationTileTone; children: ReactNode }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONE_CLASS[tone])}>
      {children}
    </span>
  );
}
