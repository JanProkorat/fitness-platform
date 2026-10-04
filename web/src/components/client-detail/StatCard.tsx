import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
}

/**
 * One of the four equal-width stat cards on the client-detail Overview tab
 * (#1094 — average rating, payments, current weight, client since). The
 * wireframe's "average rating" card has a pale-red fill when the rating is
 * below a threshold; with the value TBD there is no threshold to evaluate,
 * so this renders every card in the same neutral style (design review) —
 * no `variant` prop, no red token.
 */
export default function StatCard({ label, value, caption }: Props) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="text-caption font-semibold tracking-label text-muted-foreground uppercase">{label}</span>
      <span className="text-title font-bold text-ink">{value}</span>
      {caption && <span className="text-caption text-muted-foreground">{caption}</span>}
    </div>
  );
}
