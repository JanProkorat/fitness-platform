import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

import {
  ANIMATE_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
  TEXT_SIZE_TOKENS,
  TRACKING_TOKENS,
} from "./tw-theme-tokens"

/**
 * tailwind-merge's default config classifies a bare-word theme value by
 * shape, not by which CSS property it maps to. `theme.text` only matches
 * t-shirt sizes (`xs`/`sm`/`md`/...), so a custom scale name like
 * `text-body` falls through to `theme.color`'s catch-all and gets treated
 * as a *text colour* instead of a font size — silently deleting whichever
 * `text-sm`/`text-lg` a base variant set (#1078). `shadow-panel` has the
 * identical delete-the-class failure via `theme.shadow`/`theme.color`.
 * `spacing`/`tracking`/`animate` tokens are the milder form: unknown to
 * tailwind-merge, so a real conflict between two such classes just never
 * gets resolved (both survive, source order decides) rather than being
 * silently dropped.
 *
 * `extend.theme` (not `override.theme`, which would replace tailwind-
 * merge's built-in scale arrays instead of appending to them) tells
 * tailwind-merge about this project's own scale names so they're
 * classified under the right group. See `tw-theme-tokens.ts` for the
 * token list and `scripts/check-theme-tokens.mjs` for the build-time check
 * that keeps it in sync with `index.css`'s `@theme inline` block.
 *
 * Known residual hazard: tailwind-merge's `font-size` group conflicts with
 * `leading` (a later font-size class removes an earlier `leading-*` in the
 * same call), which is correct for built-in sizes (they carry a paired
 * line-height) but not for this project's `--text-*` tokens, which are
 * bare sizes with no companion line-height. Left as tailwind-merge's
 * default rather than stripped, because removing it would reintroduce the
 * same bug in the other direction for built-in sizes (`text-sm`/`leading-*`
 * pairs are common and correctly deduped today). No shipped call site is
 * exposed to this today — every `CardDescription` usage (the one base
 * string pairing a token with `leading-*`) is invoked without a
 * `className` override — so there is nothing to compensate for yet; a
 * future caller passing a `text-*` size through `className` after a
 * `leading-*`-bearing base is the case to watch for.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TEXT_SIZE_TOKENS],
      shadow: [...SHADOW_TOKENS],
      spacing: [...SPACING_TOKENS],
      tracking: [...TRACKING_TOKENS],
      animate: [...ANIMATE_TOKENS],
    },
  },
})

/**
 * shadcn/ui's canonical class-merging helper: clsx for conditional
 * composition, tailwind-merge to resolve conflicting Tailwind utility
 * classes (e.g. a variant's `bg-primary` overriding a passed-in `bg-*`)
 * rather than emitting both and leaving the winner to stylesheet order.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
