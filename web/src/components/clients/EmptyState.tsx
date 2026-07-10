import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Large decorative emoji/icon rendered above the title. */
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Optional CTA button/link rendered below the description. */
  action?: ReactNode;
}

/**
 * Shared empty-state block for the client-detail tabs (Checkiny, Dotazniky,
 * Plany, Fotky, Mereni) — all five previously duplicated the same
 * icon/title/description shell with only the copy and the optional CTA
 * differing (#687).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="text-[32px] opacity-40">{icon}</div>
      <div className="text-[14px] font-medium text-text2">{title}</div>
      <div className="text-[13px] text-text3 max-w-xs">{description}</div>
      {action}
    </div>
  );
}
