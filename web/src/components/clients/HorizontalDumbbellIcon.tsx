interface Props {
  className?: string;
}

/** Horizontal dumbbell — lucide's `Dumbbell` is drawn on a diagonal, the plan tile needs it level. */
export default function HorizontalDumbbellIcon({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7v10" />
      <path d="M3 9.5v5" />
      <path d="M18 7v10" />
      <path d="M21 9.5v5" />
      <path d="M6 12h12" />
    </svg>
  );
}
