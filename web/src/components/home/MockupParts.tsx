// Pixel sizes and positions in this file are illustration drawing copied from the board, not layout tokens.
import type { ReactNode } from 'react';
import { IconApple, IconCheck, IconPlay } from '@/components/home/HomeIcons';

/** Three-segment protein / carbs / fat split bar used on every meal tile. */
export function MacroBar({ height = 'h-[3px]' }: { height?: string }) {
  return (
    <div className={`flex gap-0.5 ${height}`}>
      <span className="flex-[25] rounded-xs bg-macro-protein" />
      <span className="flex-[45] rounded-xs bg-macro-carbs" />
      <span className="flex-[30] rounded-xs bg-macro-fat" />
    </div>
  );
}

interface WindowFrameProps {
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}

/** Browser-style window chrome around a web-portal mockup. */
export function WindowFrame({ title, subtitle, className = '', children }: WindowFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-card ${className}`}
    >
      <div className="flex h-10 items-center gap-1.5 border-b border-border bg-surface px-4">
        <span className="size-[9px] rounded-full bg-border" />
        <span className="size-[9px] rounded-full bg-border" />
        <span className="size-[9px] rounded-full bg-border" />
        <span className="ml-3 text-meta font-semibold text-ink">{title}</span>
        <span className="text-meta text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

/** Floating card that overlaps a window (check-in toast, shopping list, live set). */
export function FloatCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

const PHONE_SCREEN_GLOW =
  '[background-image:radial-gradient(240px_200px_at_0%_0%,var(--gf-phone-warm),transparent_70%),radial-gradient(240px_240px_at_100%_50%,var(--gf-phone-fresh),transparent_70%)]';

interface PhoneFrameProps {
  /** `hero` is the slightly wider device used in the hero collage. */
  size?: 'hero' | 'standard';
  className?: string;
  children: ReactNode;
}

/** Decorative phone body with a status bar; screen content goes in `children`. */
export function PhoneFrame({ size = 'standard', className = '', children }: PhoneFrameProps) {
  const dimensions =
    size === 'hero' ? 'w-[270px] rounded-phone-hero' : 'w-[250px] rounded-phone';
  return (
    <div
      aria-hidden="true"
      className={`relative flex h-[500px] shrink-0 flex-col gap-3 overflow-hidden border-[9px] border-phone-bezel bg-phone-screen p-3.5 text-ink shadow-dialog ${PHONE_SCREEN_GLOW} ${dimensions} ${className}`}
    >
      <div className="flex items-center justify-between px-2 text-caption font-semibold text-ink">
        <span>9:41</span>
        <span className="h-[18px] w-16 rounded-full bg-scrim" />
        <span>100%</span>
      </div>
      {children}
    </div>
  );
}

/** Translucent card sitting on a phone screen. */
export function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`border border-on-dark/40 bg-glass ${className}`}>{children}</div>
  );
}

/** Ticked / unticked meal dot. */
export function MealDot({ done, size = 'size-5' }: { done: boolean; size?: string }) {
  if (done) {
    return (
      <span
        className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-nutrition text-on-nutrition`}
      >
        <IconCheck size={12} />
      </span>
    );
  }
  return (
    <span className={`${size} shrink-0 rounded-full border-[1.5px] border-muted-foreground`} />
  );
}

/** Eyebrow label above a section title. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-meta font-bold tracking-eyebrow uppercase ${className}`}>{children}</span>
  );
}

interface FeatureItemProps {
  icon: ReactNode;
  /** Tailwind classes for the icon tile background and glyph colour. */
  tone: string;
  title: string;
  description: string;
}

/** Icon tile + title + one-line description in a section's feature list. */
export function FeatureItem({ icon, tone, title, description }: FeatureItemProps) {
  return (
    <div className="flex gap-3.5">
      <span className={`flex size-[38px] shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-home-feature-title font-bold text-ink">{title}</span>
        <span className="text-copy leading-normal text-muted-foreground">{description}</span>
      </span>
    </div>
  );
}

interface StoreLinksProps {
  appStore: string;
  googlePlay: string;
  size?: 'md' | 'sm';
}

/** App Store / Google Play placeholders; real store URLs land with the app release. */
export function StoreLinks({ appStore, googlePlay, size = 'md' }: StoreLinksProps) {
  const sizing = size === 'md' ? 'h-10 px-3.5' : 'h-[34px] px-3.5';
  const base = `inline-flex items-center gap-1.75 rounded-field border border-border bg-surface text-body font-semibold whitespace-nowrap text-ink hover:bg-sunken ${sizing}`;
  return (
    <>
      <a href="#" className={base}>
        <IconApple size={16} />
        {appStore}
      </a>
      <a href="#" className={base}>
        <IconPlay size={16} />
        {googlePlay}
      </a>
    </>
  );
}
