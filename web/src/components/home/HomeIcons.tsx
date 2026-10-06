import type { ReactNode, SVGProps } from 'react';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  children: ReactNode;
}

function Icon({ size = 18, strokeWidth = 1.8, children }: IconProps) {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  return <svg {...props}>{children}</svg>;
}

interface SizedProps {
  size?: number;
  strokeWidth?: number;
}

export function IconCheck({ size = 12, strokeWidth = 2.6 }: SizedProps) {
  return (
    <Icon size={size} strokeWidth={strokeWidth}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function IconPlay({ size = 14 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M6 4l13 8-13 8z" />
    </Icon>
  );
}

export function IconDumbbell({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M6 7v10" />
      <path d="M3 9.5v5" />
      <path d="M18 7v10" />
      <path d="M21 9.5v5" />
      <path d="M6 12h12" />
    </Icon>
  );
}

export function IconCopy({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </Icon>
  );
}

export function IconPulse({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </Icon>
  );
}

export function IconCalendar({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Icon>
  );
}

export function IconSliders({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </Icon>
  );
}

export function IconPeople({ size = 18 }: SizedProps) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2" />
    </Icon>
  );
}

export function IconSearch({ size = 13 }: SizedProps) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Icon>
  );
}

export function IconGrip({ size = 14 }: SizedProps) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </Icon>
  );
}

export function IconChevronRight({ size = 20 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function IconArrowUp({ size = 16 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </Icon>
  );
}

export function IconApple({ size = 16 }: SizedProps) {
  return (
    <Icon size={size}>
      <path d="M15.5 4c-.3 1.6-1.6 2.9-3.1 2.8.1-1.5 1.5-2.8 3.1-2.8z" />
      <path d="M17.5 12.8c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-2 .7-1 1-2 1-2.1 0 0-1.6-.6-1.6-3.2z" />
    </Icon>
  );
}

export function IconCursor() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
      <path
        d="M2 2L2 18L6.5 13.5L9.5 20L12 19L9 12.5L15 12.5Z"
        className="fill-ink stroke-surface"
        strokeWidth="1.4"
      />
    </svg>
  );
}
