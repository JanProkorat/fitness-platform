/**
 * Shared home for fixed hex colors used in module-scope data maps — muscle
 * group colors, food-category colors, notification-type tints, role badges,
 * and the avatar initials palette. `useTheme()` isn't reachable at module
 * scope, so these components previously each restated the same raw hex
 * values (`#ff9500`, `#af52de`, `#3ed7be`, etc.) independently (#609).
 * Import from here instead of re-typing a hex literal in a new one-off map.
 */
export const SemanticColors = {
  brickRed: '#c0392b',
  orange: '#ff9500',
  purple: '#af52de',
  teal: '#3ed7be',
  green: '#34c759',
  coral: '#ff6b6b',
  skyBlue: '#5ac8fa',
  deepBlue: '#0b6e99',
  indigo: '#6940a5',
  terracotta: '#a0522d',
  brown: '#8b5e3c',
  stone: '#9b9a97',
  forestTeal: '#0f7b6c',
  olive: '#6d8c54',
  rust: '#ad5700',
  ocean: '#2e86ab',
  moss: '#7a8b3c',
} as const

/**
 * Deterministic background palette for initials-avatar fallbacks
 * (`Avatar.tsx`'s `getColorForName`). Purely decorative — not tied to any
 * semantic meaning — but given a shared home so it isn't a component-local
 * one-off array.
 */
export const AVATAR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
] as const

/**
 * Derives an `rgba()` string from a hex color + alpha (0-1). Use this instead
 * of manually re-typing the color's rgb() triplet when building a tint —
 * `NotificationRow` and `TrainerCard` previously duplicated the numeric
 * components of `Static.blue`/`Static.green`/etc. by hand.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
