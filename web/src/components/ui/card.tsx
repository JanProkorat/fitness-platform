import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Standalone-page card primitive (prototype `.card`, scratchpad
 * gf-register.html) — the centred single-card shell used by the
 * verify-email and reset-password pages (#1058 phase 3). Not used inside
 * LoginPanel's split layout; those forms render directly in the panel.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex w-full max-w-[440px] flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-7 text-center shadow-panel sm:p-9',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-center gap-2.5 text-body font-semibold text-ink', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 data-slot="card-title" className={cn('text-auth-title font-bold text-ink', className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-meta leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('flex w-full flex-col gap-4', className)} {...props} />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
