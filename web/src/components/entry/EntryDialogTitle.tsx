import type { ComponentProps } from 'react';
import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** The heading of a sign-in dialog form; doubles as the dialog's accessible name. */
export default function EntryDialogTitle({ className, ...props }: ComponentProps<typeof DialogTitle>) {
  return (
    <DialogTitle
      className={cn('font-display text-stat leading-tight font-semibold text-ink', className)}
      {...props}
    />
  );
}
