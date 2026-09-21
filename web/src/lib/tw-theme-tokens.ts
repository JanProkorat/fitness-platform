/**
 * Registry of this project's custom Tailwind theme tokens (declared in
 * `index.css`'s `@theme inline` block) that tailwind-merge's default config
 * does not recognise by shape and must be told about explicitly via
 * `extendTailwindMerge({ extend: { theme: { ... } } })` in `utils.ts`.
 *
 * `scripts/check-theme-tokens.mjs` parses `index.css` at build time and
 * fails if a token in one of these five namespaces is missing here (or if
 * an entry here no longer exists in `index.css`) — keep both in sync
 * whenever the theme block changes. Only the token *suffix* (the part
 * after `--text-`, `--shadow-`, etc.) goes in these arrays, matching how
 * tailwind-merge's own theme scale arrays are shaped.
 */

/** `--text-*` — 14 keys. Falls through to tailwind-merge's colour-scale
 * catch-all without this: every one of these class names would otherwise be
 * silently deleted as a "text colour" conflict (#1078). */
export const TEXT_SIZE_TOKENS = [
  'title',
  'body',
  'label',
  'tick',
  'caption',
  'meta',
  'copy',
  'subhead',
  'lede',
  'panel-title',
  'auth-title',
  'hero',
  'section-title',
  'cta-title',
] as const;

/** `--shadow-*` — same delete-the-class failure mode as text sizes, via
 * tailwind-merge's `shadow-color` catch-all. */
export const SHADOW_TOKENS = ['panel', 'selection-bar'] as const;

/** `--spacing-*` — unknown to tailwind-merge without this (not deleted,
 * just never conflict-resolved). */
export const SPACING_TOKENS = ['panel', 'wrap', 'collage-cell', 'hero-content', 'badge-min', 'swatch'] as const;

/** `--tracking-*` — same unknown-class shape as spacing. */
export const TRACKING_TOKENS = ['label'] as const;

/** `--animate-*` — same unknown-class shape as spacing. */
export const ANIMATE_TOKENS = ['panel-in', 'panel-out'] as const;
