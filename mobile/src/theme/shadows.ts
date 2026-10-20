import type { ColorScheme, Colors } from './colors';

/** CSS-style `boxShadow` strings, named by the role of the surface that wears them. */
export type Shadows = {
  card: string;
  /** Accent-filled (own) chat bubbles. */
  accentBubble: string;
  /** Glass bars and sheets. */
  glass: string;
  floating: string;
  thumb: string;
  thumbStrong: string;
  /** Ring that separates an avatar from the surface behind it. */
  avatarRing: string;
  training: string;
  nutrition: string;
  /** Inner top highlight for tinted fills. */
  highlight: string;
};

const accentShadowColors = {
  training: 'rgba(242,140,56,0.3)',
  nutrition: 'rgba(140,193,82,0.3)',
};

const buildAccentShadow = (color: string): string => `0 8px 22px ${color}`;

const shared = {
  floating: '0 8px 24px rgba(0,0,0,0.18)',
  thumbStrong: '0 1px 3px rgba(0,0,0,0.25)',
  highlight: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  training: buildAccentShadow(accentShadowColors.training),
  nutrition: buildAccentShadow(accentShadowColors.nutrition),
};

const lightShadows = {
  ...shared,
  card: '0 1px 2px rgba(20,20,20,0.06), 0 6px 16px rgba(20,20,20,0.07)',
  glass:
    '0 10px 30px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  thumb: '0 1px 3px rgba(0,0,0,0.12)',
};

const darkShadows = {
  ...shared,
  card: '0 1px 2px rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.35)',
  glass: '0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
  thumb: '0 1px 3px rgba(0,0,0,0.4)',
};

/** `#RRGGBB` to `rgba(r,g,b,a)`. */
const withAlpha = (hex: string, alpha: number): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};

const buildAccentBubbleShadow = (scheme: ColorScheme, accent: string): string =>
  scheme === 'dark'
    ? `0 1px 2px rgba(0,0,0,0.4), 0 6px 16px ${withAlpha(accent, 0.28)}`
    : `0 1px 2px ${withAlpha(accent, 0.18)}, 0 6px 16px ${withAlpha(accent, 0.22)}`;

export const buildShadows = (scheme: ColorScheme, colors: Colors): Shadows => ({
  ...(scheme === 'dark' ? darkShadows : lightShadows),
  accentBubble: buildAccentBubbleShadow(scheme, colors.accent),
  avatarRing: `0 0 0 2px ${colors.ground}`,
});
