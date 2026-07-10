import type { ReactNode } from 'react';

interface StatCardShellProps {
  /** Small uppercase heading rendered above the card body. */
  title: ReactNode;
  children: ReactNode;
  /**
   * Accent variant (gold-tinted background/border) used by TopPrCard.
   * Default is the plain bordered shell shared by ThisMonthCard/ThisWeekCard.
   */
  variant?: 'default' | 'accent';
}

/**
 * Shared card shell for the client-detail "Recent activity" stat cards
 * (ThisMonthCard, ThisWeekCard, TopPrCard) — the outer border/padding and
 * uppercase title row were duplicated across all three before this
 * extraction (#687).
 */
export function StatCardShell({ title, children, variant = 'default' }: StatCardShellProps) {
  return (
    <div
      className={variant === 'accent' ? 'rounded-md p-3 pb-3.5' : 'border border-border rounded-md p-3 pb-3.5'}
      style={variant === 'accent' ? { background: 'var(--accent-bg)', border: '1px solid var(--accent-br)' } : undefined}
    >
      <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}
