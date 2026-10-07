import type { SVGProps } from 'react';

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17 7v.1" />
    </Base>
  );
}

export function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5v6" />
      <path d="M8 7.5v.1" />
      <path d="M11.5 16.5v-6" />
      <path d="M11.5 13c0-1.6 1-2.5 2.3-2.5s2.2.9 2.2 2.5v3.5" />
    </Base>
  );
}
