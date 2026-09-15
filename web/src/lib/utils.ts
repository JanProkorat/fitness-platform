import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * shadcn/ui's canonical class-merging helper: clsx for conditional
 * composition, tailwind-merge to resolve conflicting Tailwind utility
 * classes (e.g. a variant's `bg-primary` overriding a passed-in `bg-*`)
 * rather than emitting both and leaving the winner to stylesheet order.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
