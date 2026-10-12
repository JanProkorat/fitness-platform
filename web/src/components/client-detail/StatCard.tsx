import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
}

/** One of the three equal-width stat cards on the client-detail Overview tab. */
export default function StatCard({ label, value, caption }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4.5 py-4 shadow-panel">
      <span className="text-label font-semibold tracking-label text-muted-foreground uppercase">{label}</span>
      <span className="font-display text-stat font-semibold text-ink">{value}</span>
      {caption && <span className="text-meta text-muted-foreground">{caption}</span>}
    </div>
  );
}
