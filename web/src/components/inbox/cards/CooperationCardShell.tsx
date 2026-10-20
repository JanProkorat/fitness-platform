import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CardLabelTone = 'muted' | 'request' | 'success';
export type CardIconTone = 'request' | 'invite';

const LABEL_TONES: Record<CardLabelTone, string> = {
  muted: 'text-muted-foreground',
  request: 'text-training',
  success: 'text-success',
};

const ICON_TONES: Record<CardIconTone, string> = {
  request: 'bg-training-soft text-training-ink',
  invite: 'bg-sunken text-ink-2',
};

interface Props {
  /** Which side of the thread the card sits on: a client request is incoming, a coach invite outgoing. */
  align: 'incoming' | 'outgoing';
  icon: ReactNode;
  iconTone: CardIconTone;
  label: string;
  labelTone: CardLabelTone;
  title: string;
  subtitle: string;
  /** Test hook, e.g. `client-request-card`. */
  testId: string;
  status: string;
  /** Buttons row; omitted once the card is settled. */
  actions?: ReactNode;
}

/**
 * The frame shared by the client-request card and the coach-invite card: icon
 * tile, a status label, a title, a muted sub-line, and an optional button row.
 * Incoming cards hug the left edge, outgoing ones the right, each leaving the
 * avatar column free like a chat bubble does.
 */
export default function CooperationCardShell({
  align,
  icon,
  iconTone,
  label,
  labelTone,
  title,
  subtitle,
  testId,
  status,
  actions,
}: Props) {
  return (
    <div className={cn('flex items-end gap-2.5', align === 'outgoing' && 'justify-end')}>
      {align === 'incoming' && <span aria-hidden="true" className="w-7 shrink-0" />}
      <div
        role="group"
        aria-label={label}
        data-testid={testId}
        data-status={status}
        className="flex w-85 max-w-full flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 text-ink shadow-panel"
      >
        <div className="flex items-center gap-3">
          <span className={cn('flex size-9.5 shrink-0 items-center justify-center rounded-full', ICON_TONES[iconTone])}>
            {icon}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={cn('text-meta font-semibold', LABEL_TONES[labelTone])}>{label}</span>
            <span className="font-display text-copy font-semibold">{title}</span>
            <span className="text-meta text-muted-foreground">{subtitle}</span>
          </span>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {align === 'outgoing' && <span aria-hidden="true" className="w-7 shrink-0" />}
    </div>
  );
}
