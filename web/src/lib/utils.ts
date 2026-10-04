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
 * Ordering convention: tailwind-merge's `font-size` group conflicts with
 * `leading` (a later font-size class removes an earlier `leading-*` in the
 * same call). As of #1079 every `--text-*` token carries its own paired
 * `--text-*--line-height` in `index.css`'s `@theme inline` block, so this
 * is no longer a hazard specific to this project's tokens — it is the same
 * behaviour Tailwind's own built-in sizes have always had (`text-sm` /
 * `text-lg` also carry a paired line-height, which is exactly why a later
 * one correctly deletes an earlier stray `leading-*`). A deliberate
 * per-use override — `CardDescription`'s `text-meta leading-relaxed` is
 * the one shipped example — still works, but only when the `leading-*`
 * comes AFTER its `text-*` sibling in the same `cn()` call; reversing the
 * order lets the later `text-*` delete the override instead of the other
 * way around. Keep new `cn()` calls to that ordering.
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
