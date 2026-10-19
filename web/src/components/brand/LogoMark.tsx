import { cn } from '@/lib/utils';

/** `theme` follows light/dark; `dark` always uses the dark ramp; `on-red` is for brand-red surfaces. */
export type LogoMarkTone = 'theme' | 'dark' | 'on-red';

interface Props {
  tone?: LogoMarkTone;
  /** Crops the viewBox to the artwork (used inside the wordmark lockup). */
  cropped?: boolean;
  className?: string;
}

interface ToneClasses {
  dot1: string;
  dot2: string;
  bar1: string;
  bar2: string;
  ring: string;
  tick: string;
}

// Full class names so the Tailwind scanner sees every utility.
const TONES: Record<LogoMarkTone, ToneClasses> = {
  theme: {
    dot1: 'fill-mark-row1',
    dot2: 'fill-mark-row2',
    bar1: 'stroke-mark-row1',
    bar2: 'stroke-mark-row2',
    ring: 'stroke-mark-ring',
    tick: 'stroke-mark-tick',
  },
  dark: {
    dot1: 'fill-mark-row1-dark',
    dot2: 'fill-mark-row2-dark',
    bar1: 'stroke-mark-row1-dark',
    bar2: 'stroke-mark-row2-dark',
    ring: 'stroke-mark-ring-dark',
    tick: 'stroke-mark-tick-dark',
  },
  'on-red': {
    dot1: 'fill-mark-row1-on-red',
    dot2: 'fill-mark-row2-on-red',
    bar1: 'stroke-mark-row1-on-red',
    bar2: 'stroke-mark-row2-on-red',
    ring: 'stroke-mark-ring-on-red',
    tick: 'stroke-mark-tick-on-red',
  },
};

/** The Form Up checklist mark: two filled rows and an open ring, with a tick in the first dot. */
export default function LogoMark({ tone = 'theme', cropped = false, className }: Props) {
  const c = TONES[tone];
  return (
    <svg
      viewBox={cropped ? '15 17 73 67' : '0 0 100 100'}
      aria-hidden="true"
      focusable="false"
      className={cn('block overflow-visible', className)}
    >
      <circle cx="24" cy="26" r="9" className={c.dot1} />
      <path
        d="M-4 0.5 L-1.2 3.4 L4.2 -2.6"
        transform="translate(24 26)"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={c.tick}
      />
      <path
        d="M40 26 H80"
        fill="none"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={c.bar1}
      />
      <circle cx="24" cy="50" r="9" className={c.dot2} />
      <path
        d="M40 50 H66"
        fill="none"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={c.bar2}
      />
      <circle cx="24" cy="74" r="7.5" fill="none" strokeWidth="4" className={c.ring} />
    </svg>
  );
}
